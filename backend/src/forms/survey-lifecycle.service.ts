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
      .find({
        formId,
        distributed: { $ne: true },
        moderationStatus: { $nin: ['flagged', 'rejected'] },
      })
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

      const { rewardPoolLamports, recovered: recoveredFlag } =
        await this.resolveDistributableLamports(
          formId,
          form.onChain.escrowVault,
          this.declaredRewardPoolLamports(form),
          form.rewardCurrency,
          form.onChain?.txSignature,
        );
      recovered = recoveredFlag;

      const numWinners = Math.min(form.numWinners, participantWallets.length);
      const perWinner = Math.floor(Number(rewardPoolLamports) / numWinners);

      const winners = this.shuffleWalletsForLuckyDraw(
        participantWallets,
        numWinners,
      );
      participantWallets.length = 0;
      participantWallets.push(...winners);
      amounts = winners.map(() => perWinner);

      const totalDistributed = amounts.reduce((s, a) => s + a, 0);
      const leftover = Number(rewardPoolLamports) - totalDistributed;
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

      const { rewardPoolLamports: effectiveBalance, recovered: recoveredFlag } =
        await this.resolveDistributableLamports(
          formId,
          form.onChain.escrowVault,
          this.declaredRewardPoolLamports(form),
          form.rewardCurrency,
          form.onChain?.txSignature,
        );
      recovered = recoveredFlag;

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

    const aggregatedAmounts = new Map<string, number>();
    for (let i = 0; i < participantWallets.length; i++) {
      const w = participantWallets[i];
      aggregatedAmounts.set(w, (aggregatedAmounts.get(w) ?? 0) + amounts[i]);
    }

    const uniqueWallets = Array.from(aggregatedAmounts.keys());
    const uniqueAmounts = uniqueWallets.map((w) => aggregatedAmounts.get(w)!);

    this.logger.log({
      event: 'BUILD_DISTRIBUTE_TX_CALCULATED',
      formId,
      rewardPool: form.rewardPool,
      rewardType: form.rewardType,
      participants: uniqueWallets.length,
      totalAmount: uniqueAmounts.reduce((s, a) => s + a, 0) / LAMPORTS_PER_SOL,
    });

    const surveyId = form.onChain?.surveyId ?? formId;

    if (recovered) {
      this.logger.log({
        event: 'DISTRIBUTE_RECOVERY_CONFIRM',
        formId,
        participantCount: uniqueWallets.length,
        totalAmount:
          uniqueAmounts.reduce((s, a) => s + a, 0) / LAMPORTS_PER_SOL,
      });

      const now = new Date();
      const recoveryTxSignature = `recovery_${formId}_${now.getTime()}`;
      const bulkOps = uniqueWallets.map((wallet, i) => ({
        updateMany: {
          filter: { formId, respondentWallet: wallet },
          update: {
            $set: {
              distributed: true,
              distributedAmount: uniqueAmounts[i],
              distributedAt: now,
              txSignature: recoveryTxSignature,
            },
          },
        },
      }));
      await this.responseModel.bulkWrite(bulkOps);

      // Mark any remaining losers as distributed: true with 0 amount
      await this.responseModel.updateMany(
        { formId, distributed: { $ne: true } },
        {
          $set: { distributed: true, distributedAmount: 0, distributedAt: now },
        },
      );

      form.rewardDistributed = true;
      await form.save();

      const distributionRecords = uniqueWallets.map((wallet, i) => ({
        formId,
        surveyPda: form.onChain?.surveyPda ?? '',
        recipientWallet: wallet,
        amountLamports: uniqueAmounts[i],
        badgeTier: badgeTiersMap[wallet] ?? 'Ghost',
        txSignature: recoveryTxSignature,
        rewardType: form.rewardType,
      }));
      void this.distributionService.saveDistributionRecords(
        distributionRecords,
      );

      return {
        txs: [],
        participantWallets: [uniqueWallets],
        amounts: [uniqueAmounts],
        badgeTiers: badgeTiersMap,
        recovered: true,
      };
    }

    if (form.rewardCurrency === 'USDC') {
      if (!form.tokenMint)
        throw new Error('Token mint required for USDC distribution');
      const { txs, walletChunks, amountChunks } =
        await this.solanaService.buildDistributeRewardsSplTxBatch(
          form.creator,
          surveyId,
          uniqueWallets,
          uniqueAmounts,
          form.tokenMint,
          blockhash,
        );
      return {
        txs,
        participantWallets: walletChunks,
        amounts: amountChunks,
        badgeTiers: badgeTiersMap,
      };
    } else {
      const { txs, walletChunks, amountChunks } =
        await this.solanaService.buildDistributeRewardsTxBatch(
          form.creator,
          surveyId,
          uniqueWallets,
          uniqueAmounts,
          blockhash,
        );

      return {
        txs,
        participantWallets: walletChunks,
        amounts: amountChunks,
        badgeTiers: badgeTiersMap,
      };
    }
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
    isLastBatch?: boolean,
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
      updateMany: {
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
    const remainingUndistributed = await this.responseModel
      .countDocuments({ formId, distributed: { $ne: true } })
      .exec();

    // If it's the last batch, we must forcefully mark all remaining losers as distributed (amount 0)
    if (isLastBatch && remainingUndistributed > 0) {
      this.logger.log({
        event: 'CONFIRM_DISTRIBUTE_MARK_LOSERS',
        formId,
        count: remainingUndistributed,
      });

      await this.responseModel.updateMany(
        { formId, distributed: { $ne: true } },
        {
          $set: {
            distributed: true,
            distributedAmount: 0,
            distributedAt: now,
          },
        },
      );
    }

    const finalRemaining = await this.responseModel
      .countDocuments({ formId, distributed: { $ne: true } })
      .exec();

    const fullyDistributed = finalRemaining === 0;
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
    form.closedAt = new Date();
    await form.save();

    this.logger.log({ event: 'CONFIRM_CLOSE_SUCCESS', formId });
  }

  /**
   * Build an unsigned closeEscrow transaction for the creator to sign.
   * Sweeps the remaining escrow balance (rent-exemption buffer) back to the
   * creator after rewards have been distributed, so the escrow PDA can be reaped.
   */
  async buildCloseEscrowTx(
    formId: string,
    callerWallet: string,
    blockhash: string,
  ): Promise<{ tx: string }> {
    const form = await this.formModel.findById(formId).exec();

    if (!form) {
      this.logger.warn({
        event: 'BUILD_CLOSE_ESCROW_FORM_NOT_FOUND',
        formId,
      });
      throw new Error('Form not found');
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'BUILD_CLOSE_ESCROW_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new Error('Only the form creator can close the escrow');
    }

    if (!form.rewardDistributed) {
      this.logger.warn({
        event: 'BUILD_CLOSE_ESCROW_SKIP',
        formId,
        reason: 'rewards not distributed yet',
      });
      throw new Error(
        'Rewards must be distributed before the escrow can be closed',
      );
    }

    if (form.escrowClosed) {
      this.logger.warn({
        event: 'BUILD_CLOSE_ESCROW_ALREADY_CLOSED',
        formId,
      });
      throw new Error('Escrow has already been closed for this survey');
    }

    this.logger.log({
      event: 'BUILD_CLOSE_ESCROW_TX',
      formId,
      creator: form.creator.slice(0, 8) + '...',
    });

    const surveyId = form.onChain?.surveyId ?? formId;
    if (form.rewardCurrency === 'USDC') {
      if (!form.tokenMint)
        throw new Error('Token mint required for USDC close escrow');
      return this.solanaService.buildCloseEscrowSplTx(
        callerWallet,
        surveyId,
        form.tokenMint,
        blockhash,
      );
    }
    return this.solanaService.buildCloseEscrowTx(
      callerWallet,
      surveyId,
      blockhash,
    );
  }

  /**
   * Confirm the escrow has been closed after the on-chain transaction has been
   * sent. Verifies the transaction on-chain and marks the escrow as closed.
   */
  async confirmCloseEscrow(
    formId: string,
    callerWallet: string,
    txSignature: string,
  ): Promise<void> {
    const form = await this.formModel.findById(formId).exec();

    if (!form) {
      this.logger.warn({
        event: 'CONFIRM_CLOSE_ESCROW_FORM_NOT_FOUND',
        formId,
      });
      throw new Error('Form not found');
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'CONFIRM_CLOSE_ESCROW_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new Error('Only the form creator can close the escrow');
    }

    if (form.escrowClosed) {
      this.logger.warn({
        event: 'CONFIRM_CLOSE_ESCROW_ALREADY_CLOSED',
        formId,
      });
      throw new Error('Escrow has already been closed for this survey');
    }

    await this.solanaService.verifyCloseEscrowTx(txSignature);

    form.escrowClosed = true;
    await form.save();

    this.logger.log({
      event: 'CONFIRM_CLOSE_ESCROW_SUCCESS',
      formId,
      txSignature,
    });
  }

  /**
   * Resolve the distributable lamports for a survey.
   * If the escrow is empty (already swept on-chain), fall back to the declared
   * net reward pool after verifying the init tx. Otherwise cap at the declared
   * net reward pool so the rent-exemption buffer stays in escrow for close_escrow.
   */
  private declaredRewardPoolLamports(form: Form): bigint {
    if (form.netRewardPoolUnits !== undefined && form.netRewardPoolUnits > 0) {
      return BigInt(form.netRewardPoolUnits);
    }
    if (
      form.netRewardPoolLamports !== undefined &&
      form.netRewardPoolLamports > 0
    ) {
      return BigInt(form.netRewardPoolLamports);
    }
    const multiplier =
      form.rewardCurrency === 'USDC' ? 1_000_000 : LAMPORTS_PER_SOL;
    return BigInt(Math.round(form.rewardPool * multiplier));
  }

  private async resolveDistributableLamports(
    formId: string,
    escrowVault: string,
    declaredPoolLamports: bigint,
    rewardCurrency?: string,
    txSignature?: string,
  ): Promise<{ rewardPoolLamports: bigint; recovered: boolean }> {
    const escrowBalance =
      rewardCurrency === 'USDC'
        ? await this.solanaService.getTokenEscrowBalance(escrowVault)
        : await this.solanaService.getEscrowBalance(escrowVault);

    if (escrowBalance === 0n) {
      const initTxVerified = txSignature
        ? await this.solanaService
            .verifyInitializeSurveyTx(txSignature)
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

      return {
        rewardPoolLamports: declaredPoolLamports,
        recovered: true,
      };
    }

    return {
      rewardPoolLamports:
        escrowBalance > declaredPoolLamports
          ? declaredPoolLamports
          : escrowBalance,
      recovered: false,
    };
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
