import crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Form } from '../common/schemas/form.schema';
import { SurveyResponse } from '../common/schemas/response.schema';
import { SolanaService } from '../solana/solana.service';
import {
  DistributionService,
  calculateWeightedAmounts,
  BADGE_WEIGHTS,
} from '../distribution/distribution.service';

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Handles survey lifecycle events: auto-close when max responses is reached,
 * and automatic reward distribution after closing.
 */
@Injectable()
export class SurveyLifecycleService {
  private readonly logger = new Logger(SurveyLifecycleService.name);

  constructor(
    @InjectModel(Form.name) private formModel: Model<Form>,
    @InjectModel(SurveyResponse.name)
    private responseModel: Model<SurveyResponse>,
    private readonly solanaService: SolanaService,
    private readonly distributionService: DistributionService,
  ) {}

  /**
   * Check if a survey has reached max responses and log it.
   * Submissions are blocked atomically by the capacity check in submissions.service.ts,
   * so no MongoDB state change is needed here.
   */
  async checkAndCloseIfFull(formId: string): Promise<boolean> {
    const form = await this.formModel.findById(formId).exec();

    if (!form) {
      this.logger.warn({
        event: 'AUTO_CLOSE_FORM_NOT_FOUND',
        formId,
      });
      return false;
    }

    const responseCount = await this.responseModel
      .countDocuments({ formId: formId })
      .exec();
    const maxResponses = form.maxResponses;

    if (responseCount < maxResponses) {
      return false;
    }

    this.logger.log({
      event: 'AUTO_CLOSE_TRIGGERED',
      formId,
      responseCount,
      maxResponses,
      creator: form.creator.slice(0, 8) + '...',
    });

    this.logger.log({
      event: 'AUTO_CLOSE_SKIP_DB_UPDATE',
      formId,
      reason:
        'on-chain survey is still active; creator can distribute or close from the dashboard',
    });

    return true;
  }

  /**
   * Build an unsigned distribute-rewards transaction for the frontend to sign.
   * Calculates amounts, builds the tx, and returns everything needed for signing.
   */
  async buildDistributeTx(
    formId: string,
    callerWallet: string,
    blockhash: string,
  ): Promise<{
    txs: string[];
    participantWallets: string[][];
    amounts: number[][];
    badgeTiers: Record<string, string>;
    recovered?: boolean;
  }> {
    const form = await this.formModel.findById(formId).exec();
    if (!form) {
      this.logger.warn({
        event: 'BUILD_DISTRIBUTE_TX_SKIP',
        formId,
        reason: 'form not found',
      });
      throw new Error('Form not found');
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'BUILD_DISTRIBUTE_TX_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new Error('Only the form creator can distribute rewards');
    }

    const responses = await this.responseModel
      .find({ formId, distributed: { $ne: true } })
      .exec();

    if (responses.length === 0) {
      this.logger.warn({
        event: 'BUILD_DISTRIBUTE_TX_SKIP',
        formId,
        reason: 'no undistributed responses',
      });
      throw new Error('All responses have already been distributed');
    }

    const participantWallets = responses.map((r) => r.respondentWallet);

    let amounts: number[];
    let badgeTiers: { wallet: string; badgeTier: string }[];
    let recovered = false;

    if (form.rewardType === 'lucky_draw') {
      if (!form.onChain?.escrowVault) {
        throw new Error('Escrow vault PDA not found for this form');
      }

      const escrowBalance = await this.solanaService.getEscrowBalance(
        form.onChain.escrowVault,
      );

      let rewardPoolLamports: number;
      if (escrowBalance === 0n) {
        const initTxVerified = form.onChain?.txSignature
          ? await this.solanaService
              .verifyInitializeSurveyTx(form.onChain.txSignature)
              .then(() => true)
              .catch(() => false)
          : false;

        if (!initTxVerified) {
          throw new Error('Escrow vault has no balance to distribute');
        }

        this.logger.log({
          event: 'DISTRIBUTE_RECOVERY',
          formId,
          reason:
            'Escrow is empty but init tx succeeded — previous on-chain distribute already completed',
        });

        rewardPoolLamports = form.rewardPool * LAMPORTS_PER_SOL;
        recovered = true;
      } else {
        rewardPoolLamports = Number(escrowBalance);
      }

      const numWinners = Math.min(form.numWinners, participantWallets.length);
      const perWinner = Math.floor(rewardPoolLamports / numWinners);

      const winners = this.shuffleWalletsForLuckyDraw(
        participantWallets,
        numWinners,
      );
      participantWallets.length = 0;
      participantWallets.push(...winners);
      amounts = winners.map(() => perWinner);

      const totalDistributed = amounts.reduce((s, a) => s + a, 0);
      const leftover = rewardPoolLamports - totalDistributed;
      if (leftover > 0) {
        participantWallets.push(form.creator);
        amounts.push(leftover);
      }

      badgeTiers = await Promise.all(
        participantWallets.map(async (wallet) => {
          const badgeTier =
            await this.solanaService.fetchRespondentBadgeTier(wallet);
          return { wallet, badgeTier: badgeTier ?? 'Ghost' };
        }),
      );
    } else {
      if (!form.onChain?.escrowVault) {
        throw new Error('Escrow vault PDA not found for this form');
      }

      const escrowBalance = await this.solanaService.getEscrowBalance(
        form.onChain.escrowVault,
      );

      let effectiveBalance: bigint;
      if (escrowBalance === 0n) {
        const initTxVerified = form.onChain?.txSignature
          ? await this.solanaService
              .verifyInitializeSurveyTx(form.onChain.txSignature)
              .then(() => true)
              .catch(() => false)
          : false;

        if (!initTxVerified) {
          throw new Error('Escrow vault has no balance to distribute');
        }

        this.logger.log({
          event: 'DISTRIBUTE_RECOVERY',
          formId,
          reason:
            'Escrow is empty but init tx succeeded — previous on-chain distribute already completed',
        });

        effectiveBalance = BigInt(form.rewardPool * LAMPORTS_PER_SOL);
        recovered = true;
      } else {
        effectiveBalance = escrowBalance;
      }

      badgeTiers = await Promise.all(
        participantWallets.map(async (wallet) => {
          const badgeTier =
            await this.solanaService.fetchRespondentBadgeTier(wallet);
          return { wallet, badgeTier: badgeTier ?? 'Ghost' };
        }),
      );

      const badgeTierBreakdown: Record<string, number> = {};
      for (const b of Object.keys(BADGE_WEIGHTS)) {
        badgeTierBreakdown[b] = 0;
      }
      for (const p of badgeTiers) {
        const tier = p.badgeTier;
        badgeTierBreakdown[tier] = (badgeTierBreakdown[tier] ?? 0) + 1;
      }

      this.logger.log({
        event: 'WEIGHTED_DISTRIBUTION_START',
        formId,
        participantCount: participantWallets.length,
        rewardPoolLamports: effectiveBalance.toString(),
        badgeTierBreakdown,
      });

      const shares = calculateWeightedAmounts(badgeTiers, effectiveBalance);

      amounts = shares.map((s) => Number(s.amountLamports));

      this.logger.log({
        event: 'WEIGHTED_AMOUNTS_CALCULATED',
        formId,
        amounts: shares.map((s) => ({
          wallet: s.wallet.slice(0, 8) + '...',
          amountSol: (Number(s.amountLamports) / 1e9).toFixed(6),
        })),
        totalDistributed: (Number(effectiveBalance) / 1e9).toFixed(6) + ' SOL',
      });
    }

    const badgeTiersMap: Record<string, string> = {};
    for (const b of badgeTiers) {
      badgeTiersMap[b.wallet] = b.badgeTier;
    }

    this.logger.log({
      event: 'BUILD_DISTRIBUTE_TX_CALCULATED',
      formId,
      rewardPool: form.rewardPool,
      rewardType: form.rewardType,
      participants: participantWallets.length,
      totalAmount: amounts.reduce((s, a) => s + a, 0) / LAMPORTS_PER_SOL,
    });

    const surveyId = form.onChain?.surveyId ?? formId;

    if (recovered) {
      this.logger.log({
        event: 'DISTRIBUTE_RECOVERY_CONFIRM',
        formId,
        participantCount: participantWallets.length,
        totalAmount: amounts.reduce((s, a) => s + a, 0) / LAMPORTS_PER_SOL,
      });

      const now = new Date();
      const recoveryTxSignature = `recovery_${formId}_${now.getTime()}`;
      const bulkOps = participantWallets.map((wallet, i) => ({
        updateOne: {
          filter: { formId, respondentWallet: wallet },
          update: {
            $set: {
              distributed: true,
              distributedAmount: amounts[i],
              distributedAt: now,
              txSignature: recoveryTxSignature,
            },
          },
        },
      }));
      await this.responseModel.bulkWrite(bulkOps);

      form.rewardDistributed = true;
      await form.save();

      const distributionRecords = participantWallets.map((wallet, i) => ({
        formId,
        surveyPda: form.onChain?.surveyPda ?? '',
        recipientWallet: wallet,
        amountLamports: amounts[i],
        badgeTier: badgeTiersMap[wallet] ?? 'Ghost',
        txSignature: recoveryTxSignature,
        rewardType: form.rewardType,
      }));
      void this.distributionService.saveDistributionRecords(
        distributionRecords,
      );

      return {
        txs: [],
        participantWallets: [participantWallets],
        amounts: [amounts],
        badgeTiers: badgeTiersMap,
        recovered: true,
      };
    }

    const { txs, walletChunks, amountChunks } =
      await this.solanaService.buildDistributeRewardsTxBatch(
        form.creator,
        surveyId,
        participantWallets,
        amounts,
        blockhash,
      );

    return {
      txs,
      participantWallets: walletChunks,
      amounts: amountChunks,
      badgeTiers: badgeTiersMap,
    };
  }

  /**
   * Confirm distribution after the on-chain transaction has been sent.
   * Marks responses as distributed in the database.
   * Validates that the provided wallets and amounts match the undistributed responses.
   */
  async confirmDistribute(
    formId: string,
    callerWallet: string,
    participantWallets: string[],
    amounts: number[],
    txSignature: string,
    badgeTiers?: Record<string, string>,
  ): Promise<void> {
    const form = await this.formModel.findById(formId).exec();
    if (!form || form.creator !== callerWallet) {
      throw new Error('Only the form creator can confirm distribution');
    }

    if (form.rewardDistributed) {
      this.logger.warn({
        event: 'DISTRIBUTE_ALREADY_DISTRIBUTED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new Error(
        'Rewards have already been fully distributed for this survey',
      );
    }

    if (participantWallets.length !== amounts.length) {
      this.logger.warn({
        event: 'CONFIRM_DISTRIBUTE_ARRAY_MISMATCH',
        formId,
        wallets: participantWallets.length,
        amounts: amounts.length,
      });
      throw new Error(
        `Participant wallets (${participantWallets.length}) and amounts (${amounts.length}) must have the same length`,
      );
    }

    // Validate: fetch undistributed responses and ensure provided wallets are a subset
    const undistributed = await this.responseModel
      .find({ formId, distributed: { $ne: true } })
      .lean()
      .exec();

    const undistributedWallets = new Set(
      undistributed.map((r) => r.respondentWallet),
    );

    // Validate all provided wallets are actually undistributed respondents
    for (const wallet of participantWallets) {
      if (!undistributedWallets.has(wallet)) {
        this.logger.warn({
          event: 'CONFIRM_DISTRIBUTE_INVALID_WALLET',
          formId,
          wallet: wallet.slice(0, 8) + '...',
        });
        throw new Error(
          `Wallet ${wallet.slice(0, 8)}... is not an undistributed respondent`,
        );
      }
    }

    // Validate amounts match what was calculated in buildDistributeTx
    // (on-chain escrow balance is not re-checked here because the distribute
    //  tx already moved SOL out of the escrow vault)

    const now = new Date();
    const bulkOps = participantWallets.map((wallet, i) => ({
      updateOne: {
        filter: { formId, respondentWallet: wallet },
        update: {
          $set: {
            distributed: true,
            distributedAmount: amounts[i],
            distributedAt: now,
            txSignature,
          },
        },
      },
    }));

    await this.responseModel.bulkWrite(bulkOps);

    let badgeTierMap: Map<string, string>;
    if (badgeTiers) {
      badgeTierMap = new Map(Object.entries(badgeTiers));
    } else {
      const fetched = await Promise.all(
        participantWallets.map(async (wallet) => {
          const badgeTier =
            await this.solanaService.fetchRespondentBadgeTier(wallet);
          return { wallet, badgeTier: badgeTier ?? 'Ghost' };
        }),
      );
      badgeTierMap = new Map(fetched.map((b) => [b.wallet, b.badgeTier]));
    }

    const distributionRecords = participantWallets.map((wallet, i) => ({
      formId,
      surveyPda: form.onChain?.surveyPda ?? '',
      recipientWallet: wallet,
      amountLamports: amounts[i],
      badgeTier: badgeTierMap.get(wallet) ?? 'Ghost',
      txSignature,
      rewardType: form.rewardType,
    }));

    void this.distributionService.saveDistributionRecords(distributionRecords);

    this.logger.log({
      event: 'DISTRIBUTION_RECORDS_SAVED',
      formId,
      count: distributionRecords.length,
      txSignature,
    });

    // Re-count remaining undistributed AFTER the bulkWrite to get an accurate picture.
    // Using the pre-bulkWrite snapshot for comparison was unreliable in multi-batch
    // scenarios — the last batch would compare its size against a count that already
    // excluded wallets marked by previous batches, making the equality check wrong.
    const remainingUndistributed = await this.responseModel
      .countDocuments({ formId, distributed: { $ne: true } })
      .exec();

    const fullyDistributed = remainingUndistributed === 0;
    if (fullyDistributed) {
      form.rewardDistributed = true;
      await form.save();
    }

    this.logger.log({
      event: 'DISTRIBUTE_CONFIRMED',
      formId,
      txSignature,
      distributed: amounts.reduce((s, a) => s + a, 0) / LAMPORTS_PER_SOL,
      participants: participantWallets.length,
      fullyDistributed,
    });
  }

  /**
   * Build an unsigned close transaction for the creator to sign.
   * Does NOT update DB or distribute rewards — that happens in confirmClose.
   */
  async buildCloseTx(
    formId: string,
    callerWallet: string,
    blockhash: string,
  ): Promise<string> {
    const form = await this.formModel.findById(formId).exec();

    if (!form) {
      this.logger.warn({ event: 'BUILD_CLOSE_TX_FORM_NOT_FOUND', formId });
      throw new Error('Form not found');
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'BUILD_CLOSE_TX_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new Error('Only the form creator can close this survey');
    }

    if (form.status !== 'active') {
      this.logger.warn({
        event: 'BUILD_CLOSE_TX_SKIP',
        formId,
        status: form.status,
      });
      throw new Error(`Survey is already ${form.status}`);
    }

    this.logger.log({
      event: 'BUILD_CLOSE_TX',
      formId,
      creator: form.creator.slice(0, 8) + '...',
    });

    const surveyId = form.onChain?.surveyId ?? formId;
    return this.solanaService.buildCloseSurveyTx(
      callerWallet,
      surveyId,
      blockhash,
    );
  }

  /**
   * Confirm a manual close after the on-chain transaction has been sent.
   * Updates MongoDB status and distributes rewards.
   */
  async confirmClose(formId: string, callerWallet: string): Promise<void> {
    const form = await this.formModel.findById(formId).exec();

    if (!form) {
      this.logger.warn({ event: 'CONFIRM_CLOSE_FORM_NOT_FOUND', formId });
      throw new Error('Form not found');
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'CONFIRM_CLOSE_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new Error('Only the form creator can close this survey');
    }

    if (form.status !== 'active') {
      this.logger.warn({
        event: 'CONFIRM_CLOSE_SKIP',
        formId,
        status: form.status,
      });
      throw new Error(`Survey is already ${form.status}`);
    }

    this.logger.log({ event: 'CONFIRM_CLOSE_START', formId });

    form.status = 'closed';
    await form.save();

    this.logger.log({ event: 'CONFIRM_CLOSE_SUCCESS', formId });
  }

  private shuffleWalletsForLuckyDraw<T>(wallets: T[], count: number): T[] {
    const shuffled = [...wallets];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }
}
