import {
  Injectable,
  Logger,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Form } from '../common/schemas/form.schema';
import { SurveyResponse } from '../common/schemas/response.schema';
import type { ModerationStatusValue } from '../common/schemas/response.schema';
import type { CreateFormDto } from './dto/create-form.dto';
import type { BuildInitTxDto } from './dto/build-init-tx.dto';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';
import { InvalidExpirationException } from '../common/exceptions/form/invalid-expiration.exception';
import { SurveyStillActiveException } from '../common/exceptions/form/survey-still-active.exception';
import { SolanaService } from '../solana/solana.service';
import { SurveyLifecycleService } from './survey-lifecycle.service';
import { FeeService } from './fee.service';
import { DistributionService } from '../distribution/distribution.service';
import type { UpdateSurveySettingsDto } from './dto/update-survey-settings.dto';

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface CreateFormResult {
  id: string;
  title: string;
  status: string;
  feeCollected: boolean;
  feeCollectedOnChain: boolean;
  onChain: {
    surveyId: string;
    surveyPda: string;
    escrowVault: string;
    txSignature: string;
  };
  createdAt: Date;
}

export interface FormListItem {
  id: string;
  title: string;
  status: string;
  organization: string;
  rewardPool: number;
  maxResponses: number;
  responseCount: number;
  rewardType: string;
  createdAt: Date;
  closesAt: string | null;
  previewQuestion: string;
  rewardDistributed: boolean;
  description: string;
  creator: string;
  grossRewardPoolLamports: number;
  netRewardPoolLamports: number;
  feeLamports: number;
  feeBps: number;
  feeWallet: string;
  minWalletAge: number;
  minSolBalance: number;
  surveyPda: string | null;
  escrowPda: string | null;
  closedAt: Date | null;
}

export interface FormDetail extends FormListItem {
  questions: Array<{
    id: string;
    type: string;
    label: string;
    placeholder: string;
    required: boolean;
    options: string[];
    minWords: number;
    maxWords: number;
    ratingMax: number;
    lowLabel: string;
    highLabel: string;
  }>;
}

export interface ExploreFormItem {
  id: string;
  title: string;
  status: 'active' | 'closed' | 'draft';
  organization: string;
  rewardPool: number;
  rewardType: string;
  numWinners: number;
  responses: number;
  maxResponses: number;
  closesAt: string | null;
  previewQuestion: string;
  minWalletAge: number;
  minSolBalance: number;
  createdAt: string;
}

export interface AnalyticsResponseItem {
  id: string;
  scoreAtSubmission: number;
  similarityFlag: boolean;
  moderationStatus: ModerationStatusValue;
  submittedAt: string;
}

export interface AnalyticsDistributionItem {
  amountLamports: number;
  distributedAt: string;
}

export interface AnalyticsFormItem {
  id: string;
  title: string;
  status: string;
  maxResponses: number;
  /** Reward pool in SOL (the DB stores SOL; lamports live in grossRewardPoolLamports). */
  rewardPoolSol: number;
  responses: AnalyticsResponseItem[];
  distributions: AnalyticsDistributionItem[];
}

export interface AnalyticsAggregate {
  forms: AnalyticsFormItem[];
}

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    @InjectModel(Form.name) private formModel: Model<Form>,
    @InjectModel(SurveyResponse.name)
    private responseModel: Model<SurveyResponse>,
    private readonly solanaService: SolanaService,
    private readonly surveyLifecycleService: SurveyLifecycleService,
    private readonly feeService: FeeService,
    private readonly distributionService: DistributionService,
  ) {}

  async createForm(
    dto: CreateFormDto,
    creator: string,
  ): Promise<CreateFormResult> {
    this.logger.log({
      event: 'FORM_CREATE_START',
      creator: creator.slice(0, 8) + '...',
      surveyId: dto.surveyId,
      rewardPool: dto.rewardPool,
      rewardType: dto.rewardType,
    });

    await this.solanaService.verifyInitializeSurveyTx(dto.initTxSignature);

    this.validateExpirationDate(dto.closesAt);

    const grossRewardPoolLamports = Math.floor(
      dto.rewardPool * LAMPORTS_PER_SOL,
    );
    const { feeLamports, netRewardPoolLamports } = this.feeService.computeFee(
      grossRewardPoolLamports,
    );

    // Persist the survey first so a fee-collection failure can be retried
    // without losing the on-chain initialized survey state.
    const doc = await this.formModel.create({
      title: dto.title,
      questions: dto.questions,
      rewardPool: dto.rewardPool,
      grossRewardPoolLamports,
      netRewardPoolLamports,
      feeLamports,
      feeBps: this.feeService.getFeeBps(),
      feeWallet: this.feeService.getFeeWallet(),
      feeTxSignature: null,
      feeCollected: false,
      maxResponses: dto.maxResponses,
      rewardType: dto.rewardType,
      numWinners: dto.numWinners ?? 1,
      minWalletAge: dto.minWalletAge ?? 0,
      minSolBalance: dto.minSolBalance ?? 0,
      organization: dto.organization ?? '',
      closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
      previewQuestion: dto.previewQuestion ?? '',
      creator,
      status: 'active',
      onChain: {
        surveyId: dto.surveyId,
        surveyPda: dto.surveyPda,
        escrowVault: dto.escrowPda,
        txSignature: dto.initTxSignature,
      },
    } as Record<string, unknown>);

    const form = await doc.save();
    let feeCollectedOnChain = feeLamports === 0;

    if (feeLamports > 0) {
      this.logger.log({
        event: 'FEE_COLLECTION_START',
        creator: creator.slice(0, 8) + '...',
        surveyId: dto.surveyId,
        grossLamports: grossRewardPoolLamports,
        feeLamports,
        netLamports: netRewardPoolLamports,
        feeBps: this.feeService.getFeeBps(),
        feeWallet: this.feeService.getFeeWallet().slice(0, 8) + '...',
      });

      try {
        const feeTxSignature = await this.solanaService.collectProtocolFee(
          feeLamports,
          dto.surveyId,
          dto.surveyPda,
          dto.escrowPda,
        );

        feeCollectedOnChain = true;

        try {
          form.set({ feeTxSignature, feeCollected: true });
          await form.save();

          this.logger.log({
            event: 'FEE_COLLECTED',
            creator: creator.slice(0, 8) + '...',
            surveyId: dto.surveyId,
            feeLamports,
            feeTxSignature,
          });
        } catch (error: unknown) {
          // Fee was collected on-chain but could not be persisted. Surfacing
          // this distinctly matters because collect_fee is NOT idempotent —
          // retrying would take the fee out of the escrow a second time.
          this.logger.error({
            event: 'FEE_COLLECTED_PERSIST_FAILED',
            creator: creator.slice(0, 8) + '...',
            surveyId: dto.surveyId,
            feeLamports,
            feeTxSignature,
            error,
            errorMessage:
              error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          });
        }
      } catch (error: unknown) {
        // Fee collection failed before any on-chain funds moved — safe to
        // leave feeCollected: false so the creator can retry. The survey
        // itself stays live.
        this.logger.error({
          event: 'FEE_COLLECTION_FAILED',
          creator: creator.slice(0, 8) + '...',
          surveyId: dto.surveyId,
          feeLamports,
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    this.logger.log({
      event: 'FORM_CREATE_SUCCESS',
      formId: String(form._id),
      surveyId: dto.surveyId,
      creator: creator.slice(0, 8) + '...',
      txSignature: dto.initTxSignature,
    });

    return {
      id: String(form._id),
      title: form.title,
      status: form.status,
      feeCollected: form.feeCollected ?? false,
      feeCollectedOnChain,
      onChain: {
        surveyId: dto.surveyId,
        surveyPda: dto.surveyPda,
        escrowVault: dto.escrowPda,
        txSignature: dto.initTxSignature,
      },
      createdAt: form.createdAt!,
    };
  }

  async buildInitializeTx(
    dto: BuildInitTxDto,
  ): Promise<{ tx: string; surveyPda: string; escrowPda: string }> {
    this.validateExpirationDate(dto.closesAt);

    return this.solanaService.buildInitializeSurveyTx(
      dto.creator,
      dto.surveyId,
      dto.rewardPoolSol,
      dto.rewardType,
      dto.maxResponses,
      dto.blockhash,
    );
  }

  private validateExpirationDate(closesAtStr?: string): void {
    if (!closesAtStr) return;

    // Accept YYYY-MM-DDTHH:mm (browser datetime-local), YYYY-MM-DDTHH:mm:ss,
    // YYYY-MM-DDTHH:mm:ss.sss, optionally with Z or +/-HH:mm timezone.
    const iso8601 =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;
    if (!iso8601.test(closesAtStr)) {
      throw new InvalidExpirationException(
        'Survey expiration date must be in ISO 8601 format (e.g. 2026-12-31T23:59:59Z).',
      );
    }

    // Normalize: append seconds and UTC timezone when absent (browser
    // datetime-local sends YYYY-MM-DDTHH:mm without timezone).
    let normalized = closesAtStr;
    if (normalized.length === 16) normalized += ':00';
    if (!/[Z+-]/.test(normalized.slice(-6))) normalized += 'Z';

    const closesAt = new Date(normalized);
    if (isNaN(closesAt.getTime())) {
      throw new InvalidExpirationException(
        'Survey expiration date is not a valid date.',
      );
    }

    const now = new Date();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    const diff = closesAt.getTime() - now.getTime();
    if (diff < oneDayInMs) {
      throw new InvalidExpirationException(
        'Survey expiration must be at least 24 hours from now.',
      );
    }
    if (diff > thirtyDaysInMs) {
      throw new InvalidExpirationException(
        'Survey expiration cannot be more than 30 days from now.',
      );
    }
  }

  private deriveStatus(
    closesAt: Date | null | undefined,
    dbStatus: string,
  ): 'active' | 'closed' {
    if (dbStatus === 'closed') return 'closed';
    if (closesAt && closesAt.getTime() <= Date.now()) return 'closed';
    return 'active';
  }

  async getExploreForms(): Promise<ExploreFormItem[]> {
    const forms = await this.formModel
      .find({ status: { $in: ['active', 'closed'] } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const strFormIds = forms.map((f) => String(f._id));

    const counts = await this.responseModel
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            $expr: { $in: [{ $toString: '$formId' }, strFormIds] },
          },
        },
        { $group: { _id: { $toString: '$formId' }, count: { $sum: 1 } } },
      ])
      .exec();

    const countMap = new Map(counts.map((c) => [c._id, c.count]));

    this.logger.debug({
      event: 'EXPLORE_FORMS_FETCHED',
      count: forms.length,
    });

    return forms.map((form) => {
      const responses = countMap.get(String(form._id)) ?? 0;

      return {
        id: String(form._id),
        title: form.title,
        status:
          responses >= form.maxResponses
            ? ('closed' as const)
            : this.deriveStatus(form.closesAt, form.status),
        organization: form.organization,
        rewardPool: form.rewardPool,
        rewardType: form.rewardType,
        numWinners: form.numWinners,
        responses,
        maxResponses: form.maxResponses,
        closesAt: form.closesAt?.toISOString() ?? null,
        previewQuestion: form.previewQuestion,
        minWalletAge: form.minWalletAge,
        minSolBalance: form.minSolBalance,
        createdAt: form.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  async getFormsByCreator(creator: string): Promise<FormListItem[]> {
    const forms = await this.formModel
      .find({ creator, status: { $ne: 'draft' } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    this.logger.debug({
      event: 'FORMS_FETCHED',
      creator: creator.slice(0, 8) + '...',
      count: forms.length,
    });

    const strFormIds = forms.map((f) => String(f._id));

    const counts = await this.responseModel
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            $expr: { $in: [{ $toString: '$formId' }, strFormIds] },
          },
        },
        { $group: { _id: { $toString: '$formId' }, count: { $sum: 1 } } },
      ])
      .exec();

    const countMap = new Map(counts.map((c) => [c._id, c.count]));

    return forms.map((form) => {
      const responseCount = countMap.get(String(form._id)) ?? 0;

      return {
        id: String(form._id),
        title: form.title,
        status:
          responseCount >= form.maxResponses
            ? ('closed' as const)
            : this.deriveStatus(form.closesAt, form.status),
        organization: form.organization,
        rewardPool: form.rewardPool,
        maxResponses: form.maxResponses,
        responseCount,
        rewardType: form.rewardType,
        createdAt: form.createdAt ?? new Date(),
        closesAt: form.closesAt?.toISOString() ?? null,
        previewQuestion: form.previewQuestion,
        rewardDistributed: form.rewardDistributed ?? false,
        description: form.description ?? '',
        creator: form.creator,
        grossRewardPoolLamports: form.grossRewardPoolLamports ?? 0,
        netRewardPoolLamports: form.netRewardPoolLamports ?? 0,
        feeLamports: form.feeLamports ?? 0,
        feeBps: form.feeBps ?? 0,
        feeWallet: form.feeWallet ?? '',
        minWalletAge: form.minWalletAge ?? 0,
        minSolBalance: form.minSolBalance ?? 0,
        surveyPda: form.onChain?.surveyPda ?? null,
        escrowPda: form.onChain?.escrowVault ?? null,
        closedAt: form.closedAt ?? null,
      };
    });
  }

  async getAnalyticsForCreator(
    creator: string,
    limit?: number,
  ): Promise<AnalyticsAggregate> {
    const forms = await this.formModel
      .find({ creator, status: { $ne: 'draft' } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const formIds = forms.map((f) => String(f._id));

    if (formIds.length === 0) {
      return { forms: [] };
    }

    const [responses, distributions] = await Promise.all([
      this.responseModel
        .find({
          $expr: { $in: [{ $toString: '$formId' }, formIds] },
        })
        .sort({ submittedAt: -1 })
        .lean()
        .exec(),
      this.distributionService.getDistributionByFormIds(formIds),
    ]);

    const responsesByForm = new Map<string, AnalyticsResponseItem[]>();
    for (const r of responses) {
      const key = String(r.formId);
      const list = responsesByForm.get(key) ?? [];
      list.push({
        id: String(r._id),
        scoreAtSubmission: r.scoreAtSubmission,
        similarityFlag: r.similarityFlag ?? false,
        moderationStatus: r.moderationStatus ?? 'clean',
        submittedAt: (r.submittedAt ?? new Date()).toISOString(),
      });
      responsesByForm.set(key, list);
    }

    const distributionsByForm = new Map<string, AnalyticsDistributionItem[]>();
    for (const d of distributions) {
      const list = distributionsByForm.get(d.formId) ?? [];
      list.push({
        amountLamports: d.amountLamports,
        distributedAt: d.distributedAt.toISOString(),
      });
      distributionsByForm.set(d.formId, list);
    }

    this.logger.debug({
      event: 'ANALYTICS_FETCHED',
      creator: creator.slice(0, 8) + '...',
      count: forms.length,
    });

    return {
      forms: forms.map((form) => {
        const id = String(form._id);
        const responseCount = responsesByForm.get(id)?.length ?? 0;
        const responseList = (responsesByForm.get(id) ?? []).slice(0, limit);
        const distributionList = (distributionsByForm.get(id) ?? []).slice(
          0,
          limit,
        );
        return {
          id,
          title: form.title,
          status:
            responseCount >= form.maxResponses
              ? ('closed' as const)
              : this.deriveStatus(form.closesAt, form.status),
          maxResponses: form.maxResponses,
          rewardPoolSol: form.rewardPool,
          responses: responseList,
          distributions: distributionList,
        };
      }),
    };
  }

  async getFormById(formId: string): Promise<FormDetail> {
    const form = await this.formModel.findById(formId).lean().exec();

    if (!form) {
      throw new FormNotFoundException(formId);
    }

    this.logger.debug({
      event: 'FORM_FETCHED',
      formId,
    });

    const responseCount = await this.responseModel
      .countDocuments({ formId: form._id })
      .exec();

    return {
      id: String(form._id),
      title: form.title,
      creator: form.creator,
      status:
        responseCount >= form.maxResponses
          ? ('closed' as const)
          : this.deriveStatus(form.closesAt, form.status),
      organization: form.organization,
      rewardPool: form.rewardPool,
      maxResponses: form.maxResponses,
      responseCount,
      rewardType: form.rewardType,
      createdAt: form.createdAt ?? new Date(),
      closesAt: form.closesAt?.toISOString() ?? null,
      previewQuestion: form.previewQuestion,
      rewardDistributed: form.rewardDistributed ?? false,
      description: form.description ?? '',
      grossRewardPoolLamports: form.grossRewardPoolLamports ?? 0,
      netRewardPoolLamports: form.netRewardPoolLamports ?? 0,
      feeLamports: form.feeLamports ?? 0,
      feeBps: form.feeBps ?? 0,
      feeWallet: form.feeWallet ?? '',
      minWalletAge: form.minWalletAge ?? 0,
      minSolBalance: form.minSolBalance ?? 0,
      surveyPda: form.onChain?.surveyPda ?? null,
      escrowPda: form.onChain?.escrowVault ?? null,
      closedAt: form.closedAt ?? null,
      questions: form.questions.map((q) => ({
        id: q.id,
        type: q.type,
        label: q.label,
        placeholder: q.placeholder,
        required: q.required,
        options: q.options,
        minWords: q.minWords,
        maxWords: q.maxWords,
        ratingMax: q.ratingMax,
        lowLabel: q.lowLabel,
        highLabel: q.highLabel,
      })),
    };
  }

  /**
   * Build an unsigned close transaction for the frontend to sign.
   * Only the form creator can call this.
   */
  async buildCloseTx(
    formId: string,
    callerWallet: string,
    blockhash: string,
  ): Promise<{ tx: string }> {
    const form = await this.formModel.findById(formId).lean().exec();

    if (!form) {
      throw new FormNotFoundException(formId);
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'BUILD_CLOSE_TX_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new ForbiddenException(
        'Only the form creator can close this survey.',
      );
    }

    if (form.status !== 'active') {
      throw new ConflictException(`Survey is already ${form.status}.`);
    }

    const tx = await this.surveyLifecycleService.buildCloseTx(
      formId,
      callerWallet,
      blockhash,
    );

    return { tx };
  }

  /**
   * Confirm a close after the on-chain transaction has been sent.
   * Updates DB and distributes rewards.
   */
  async confirmClose(formId: string, callerWallet: string): Promise<void> {
    const form = await this.formModel.findById(formId).lean().exec();

    if (!form) {
      throw new FormNotFoundException(formId);
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'CONFIRM_CLOSE_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new ForbiddenException(
        'Only the form creator can close this survey.',
      );
    }

    if (form.status !== 'active') {
      throw new ConflictException(`Survey is already ${form.status}.`);
    }

    await this.surveyLifecycleService.confirmClose(formId, callerWallet);
  }

  /**
   * Build an unsigned distribute-rewards transaction for the frontend to sign.
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
    const form = await this.formModel.findById(formId).lean().exec();

    if (!form) {
      throw new FormNotFoundException(formId);
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'BUILD_DISTRIBUTE_TX_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new ForbiddenException(
        'Only the form creator can distribute rewards.',
      );
    }

    return this.surveyLifecycleService.buildDistributeTx(
      formId,
      callerWallet,
      blockhash,
    );
  }

  /**
   * Confirm distribution after the on-chain transaction has been sent.
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
    const form = await this.formModel.findById(formId).lean().exec();

    if (!form) {
      throw new FormNotFoundException(formId);
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'CONFIRM_DISTRIBUTE_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new ForbiddenException(
        'Only the form creator can distribute rewards.',
      );
    }

    return this.surveyLifecycleService.confirmDistribute(
      formId,
      callerWallet,
      participantWallets,
      amounts,
      txSignature,
      badgeTiers,
      isLastBatch,
    );
  }

  /**
   * Build an unsigned closeEscrow transaction for the frontend to sign.
   * Only the form creator can call this, and only after rewards are distributed.
   */
  async buildCloseEscrowTx(
    formId: string,
    callerWallet: string,
    blockhash: string,
  ): Promise<{ tx: string }> {
    const form = await this.formModel.findById(formId).lean().exec();

    if (!form) {
      throw new FormNotFoundException(formId);
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'BUILD_CLOSE_ESCROW_TX_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new ForbiddenException(
        'Only the form creator can close the escrow.',
      );
    }

    return this.surveyLifecycleService.buildCloseEscrowTx(
      formId,
      callerWallet,
      blockhash,
    );
  }

  /**
   * Confirm the escrow has been closed after the on-chain transaction has been sent.
   */
  async confirmCloseEscrow(
    formId: string,
    callerWallet: string,
    txSignature: string,
  ): Promise<void> {
    const form = await this.formModel.findById(formId).lean().exec();

    if (!form) {
      throw new FormNotFoundException(formId);
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'CONFIRM_CLOSE_ESCROW_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new ForbiddenException(
        'Only the form creator can close the escrow.',
      );
    }

    await this.surveyLifecycleService.confirmCloseEscrow(
      formId,
      callerWallet,
      txSignature,
    );
  }

  /**
   * Update off-chain survey metadata (title/description only).
   * On-chain fields (reward pool, PDAs, filters) are never touched.
   */
  async updateSurveySettings(
    formId: string,
    callerWallet: string,
    dto: UpdateSurveySettingsDto,
  ): Promise<FormDetail> {
    const form = await this.formModel.findById(formId).exec();

    if (!form) {
      throw new FormNotFoundException(formId);
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'UPDATE_SURVEY_SETTINGS_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new ForbiddenException(
        'Only the form creator can update survey settings.',
      );
    }

    if (dto.title !== undefined) form.title = dto.title;
    if (dto.description !== undefined) form.description = dto.description;

    await form.save();

    this.logger.log({
      event: 'SURVEY_SETTINGS_UPDATED',
      formId,
      fields: Object.keys(dto),
    });

    return this.getFormById(formId);
  }

  /**
   * Delete all survey data from MongoDB (form, responses, distribution records).
   * MongoDB-only — never touches the Solana program or escrow.
   */
  async deleteSurveyData(
    formId: string,
    callerWallet: string,
  ): Promise<{
    responsesDeleted: number;
    distributionRecordsDeleted: number;
  }> {
    const form = await this.formModel.findById(formId).lean().exec();

    if (!form) {
      throw new FormNotFoundException(formId);
    }

    if (form.creator !== callerWallet) {
      this.logger.warn({
        event: 'DELETE_SURVEY_DATA_UNAUTHORIZED',
        formId,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new ForbiddenException(
        'Only the form creator can delete survey data.',
      );
    }

    if (form.status !== 'closed') {
      this.logger.warn({
        event: 'DELETE_SURVEY_DATA_BLOCKED',
        formId,
        status: form.status,
        caller: callerWallet.slice(0, 8) + '...',
      });
      throw new SurveyStillActiveException(formId);
    }

    const [responsesDeleted, distributionRecordsDeleted] = await Promise.all([
      this.responseModel.deleteMany({ formId: form._id }).exec(),
      this.distributionService.deleteByForm(formId),
    ]);

    await this.formModel.deleteOne({ _id: form._id }).exec();

    this.logger.log({
      event: 'SURVEY_DATA_DELETED',
      formId,
      responsesDeleted: responsesDeleted.deletedCount ?? 0,
      distributionRecordsDeleted,
    });

    return {
      responsesDeleted: responsesDeleted.deletedCount ?? 0,
      distributionRecordsDeleted,
    };
  }
}
