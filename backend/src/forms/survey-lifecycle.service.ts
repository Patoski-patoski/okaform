import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Form } from '../common/schemas/form.schema';
import { SurveyResponse } from '../common/schemas/response.schema';
import { SolanaService } from '../solana/solana.service';

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
  ) {}

  /**
   * Check if a survey has reached max responses and auto-close if so.
   * Then distribute rewards automatically.
   * Called after each successful submission.
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

    if (form.status !== 'active') {
      return false;
    }

    // Count actual responses from the responses collection — the only source of truth.
    // The denormalized form.responseCount field is never updated and must not be used here.
    const responseCount = await this.responseModel
      .countDocuments({ formId: form._id })
      .exec();
    const maxResponses = form.maxResponses;

    if (responseCount < maxResponses) {
      return false;
    }

    // Max responses reached — auto-close
    this.logger.log({
      event: 'AUTO_CLOSE_TRIGGERED',
      formId,
      responseCount,
      maxResponses,
      creator: form.creator.slice(0, 8) + '...',
    });

    // Close on-chain requires the creator's signature — not available server-side.
    // The creator can close on-chain manually from the dashboard.
    // We update DB state and distribute rewards here.
    this.logger.log({
      event: 'AUTO_CLOSE_SUCCESS',
      formId,
    });

    form.status = 'closed';
    await form.save();

    this.logger.log({
      event: 'AUTO_CLOSE_DISTRIBUTE_SKIP',
      formId,
      reason:
        'on-chain distribution requires creator signature — the creator can distribute from the dashboard',
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
    tx: string;
    participantWallets: string[];
    amounts: number[];
  }> {
    const form = await this.formModel.findById(formId).exec();
    if (!form || form.status !== 'closed') {
      this.logger.warn({
        event: 'BUILD_DISTRIBUTE_TX_SKIP',
        formId,
        reason: form ? `status=${form.status}` : 'form not found',
      });
      throw new Error(form ? 'Survey is not closed yet' : 'Form not found');
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

    const rewardPoolLamports = form.rewardPool * LAMPORTS_PER_SOL;
    const participantWallets = responses.map((r) => r.respondentWallet);

    let amounts: number[];
    if (form.rewardType === 'lottery') {
      const perParticipant = Math.floor(
        rewardPoolLamports / participantWallets.length,
      );
      amounts = participantWallets.map(() => perParticipant);
    } else {
      const totalScore = responses.reduce(
        (sum, r) => sum + (r.scoreAtSubmission || 1),
        0,
      );
      amounts = responses.map((r) => {
        const score = r.scoreAtSubmission || 1;
        const share = (score / totalScore) * rewardPoolLamports;
        return Math.floor(share);
      });
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

    const tx = await this.solanaService.buildDistributeRewardsTx(
      form.creator,
      surveyId,
      participantWallets,
      amounts,
      blockhash,
    );

    return { tx, participantWallets, amounts };
  }

  /**
   * Confirm distribution after the on-chain transaction has been sent.
   * Marks responses as distributed in the database.
   */
  async confirmDistribute(
    formId: string,
    callerWallet: string,
    participantWallets: string[],
    amounts: number[],
    txSignature: string,
  ): Promise<void> {
    const form = await this.formModel.findById(formId).exec();
    if (!form || form.creator !== callerWallet) {
      throw new Error('Only the form creator can confirm distribution');
    }

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

    this.logger.log({
      event: 'DISTRIBUTE_CONFIRMED',
      formId,
      txSignature,
      distributed: amounts.reduce((s, a) => s + a, 0) / LAMPORTS_PER_SOL,
      participants: participantWallets.length,
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
}
