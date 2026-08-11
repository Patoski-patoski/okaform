import {
  Injectable,
  Logger,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  SurveyResponse,
  type ModerationReasonValue,
  type ModerationStatusValue,
} from '../common/schemas/response.schema';
import { Form, type Question } from '../common/schemas/form.schema';
import { SurveyLifecycleService } from '../forms/survey-lifecycle.service';
import { SybilService } from '../sybil/sybil.service';
import type { SybilResult } from '../sybil/dto/sybil-check.dto';
import { ScoreService } from '../score/score.service';
import { SolanaService } from '../solana/solana.service';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';
import { FormClosedException } from '../common/exceptions/form/form-closed.exception';
import { FormFullException } from '../common/exceptions/form/form-full.exception';
import { OkaformException } from '../common/exceptions/base.exception';
import type { ModerateResponseDto } from './dto/moderate-response.dto';

export interface SubmissionItem {
  id: string;
  respondentWallet: string;
  scoreAtSubmission: number;
  scoreDelta: number;
  similarityFlag: boolean;
  submittedAt: Date;
  answers: Record<string, unknown>[];
  moderationStatus: ModerationStatusValue;
  moderationReason: ModerationReasonValue | null;
  moderationNote: string | null;
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectModel(SurveyResponse.name)
    private responseModel: Model<SurveyResponse>,
    @InjectModel(Form.name)
    private formModel: Model<Form>,
    private readonly surveyLifecycleService: SurveyLifecycleService,
    private readonly sybilService: SybilService,
    private readonly scoreService: ScoreService,
    private readonly solanaService: SolanaService,
  ) {}

  async createSubmission(
    formId: string,
    respondentWallet: string,
    answers: Record<string, unknown>[],
    openedAt: number,
  ): Promise<SubmissionItem> {
    // Guard 1: Form must exist
    const form = await this.formModel.findById(formId).lean().exec();
    if (!form) {
      throw new FormNotFoundException(formId);
    }

    // Guard 2: Creator cannot respond to their own survey
    if (respondentWallet === form.creator) {
      this.logger.warn({
        event: 'CREATOR_SUBMISSION_BLOCKED',
        formId,
        wallet: respondentWallet.slice(0, 8) + '...',
      });
      throw new OkaformException(
        {
          code: 'CREATOR_CANNOT_RESPOND',
          detail: 'You cannot submit a response to your own survey.',
          context: {
            formId,
            respondentWallet: respondentWallet.slice(0, 8) + '...',
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Guard 3: Form must be active (fast early rejection, not atomic)
    if (form.status !== 'active') {
      throw new FormClosedException(formId);
    }

    // Guard 4: No duplicate submissions
    const existing = await this.responseModel
      .findOne({ formId, respondentWallet })
      .exec();

    if (existing) {
      throw new ConflictException('You have already submitted this survey.');
    }

    // Guard 5: Sybil check — wallet age and SOL balance (done before atomic section)
    const sybilResult = await this.sybilService.checkEligibility(
      respondentWallet,
      {
        minWalletAgeDays: form.minWalletAge ?? 0,
        minSolBalance: form.minSolBalance ?? 0,
      },
    );

    if (!sybilResult.passed) {
      this.logger.warn({
        event: 'SYBIL_CHECK_FAILED',
        formId,
        wallet: respondentWallet.slice(0, 8) + '...',
        reason: sybilResult.reason,
      });
      throw new OkaformException(
        {
          code: 'SYBIL_CHECK_FAILED',
          detail:
            sybilResult.reason ??
            'Wallet does not meet eligibility requirements',
          context: {
            formId,
            wallet: respondentWallet.slice(0, 8) + '...',
            walletAgeDays: sybilResult.details?.walletAgeDays,
            solBalance: sybilResult.details?.solBalance,
            requiredAgeDays: sybilResult.details?.requiredAgeDays,
            requiredBalance: sybilResult.details?.requiredBalance,
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Guard 6: Atomic capacity check — only one concurrent request gets through
    const updatedForm = await this.formModel
      .findOneAndUpdate(
        {
          _id: formId,
          status: 'active',
          $expr: { $lt: ['$responseCount', '$maxResponses'] },
        },
        { $inc: { responseCount: 1 } },
        { new: true },
      )
      .exec();

    if (!updatedForm) {
      const current = await this.formModel.findById(formId).lean().exec();
      if (!current || current.status !== 'active') {
        throw new FormClosedException(formId);
      }
      throw new FormFullException(formId, current.maxResponses);
    }

    const doc = await this.responseModel.create({
      formId,
      respondentWallet,
      answers,
      scoreAtSubmission: 0,
      similarityFlag: false,
      submittedAt: new Date(),
      openedAt: new Date(openedAt),
    });

    const saved = await doc.save();

    this.logger.log({
      event: 'SUBMISSION_CREATED',
      formId,
      respondentWallet: respondentWallet.slice(0, 8) + '...',
    });

    // Score the submission. On-chain updates are best-effort and must never
    // fail the submission itself.
    let scoreAtSubmission = 0;
    let scoreDelta = 0;
    if (form.rewardType === 'weighted') {
      const scored = await this.applyScore({
        formId,
        respondentWallet,
        answers,
        questions: form.questions,
        submittedAt: saved.submittedAt ?? new Date(),
        openedAt,
        sybilResult,
      });
      scoreAtSubmission = scored.scoreAtSubmission;
      scoreDelta = scored.scoreDelta;
    } else {
      this.logger.log({
        event: 'SCORE_SKIPPED',
        reason: 'LOTTERY_SURVEY',
        formId,
      });
    }

    // Fire-and-forget: check if survey should be auto-closed and rewards distributed
    // Attach .catch() to prevent unhandled promise rejections
    void this.surveyLifecycleService
      .checkAndCloseIfFull(formId)
      .catch((error) => {
        this.logger.error({
          event: 'AUTO_CLOSE_BACKGROUND_FAILED',
          formId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return {
      id: String(saved._id),
      respondentWallet: saved.respondentWallet,
      scoreAtSubmission,
      scoreDelta,
      similarityFlag: saved.similarityFlag,
      submittedAt: saved.submittedAt,
      answers: saved.answers,
      moderationStatus: saved.moderationStatus ?? 'clean',
      moderationReason: saved.moderationReason ?? null,
      moderationNote: saved.moderationNote ?? null,
    };
  }

  /**
   * Compute the 5-metric submission score and persist a snapshot, then apply
   * the score delta on-chain (update_score, authority-gated). Any failure in
   * the on-chain step is logged and swallowed — the submission already passed.
   */
  private async applyScore(params: {
    formId: string;
    respondentWallet: string;
    answers: Record<string, unknown>[];
    questions: Question[];
    submittedAt: Date;
    openedAt: number;
    sybilResult: SybilResult;
  }): Promise<{ scoreAtSubmission: number; scoreDelta: number }> {
    const {
      formId,
      respondentWallet,
      answers,
      questions,
      submittedAt,
      openedAt,
      sybilResult,
    } = params;

    const scoreResult = this.scoreService.calculateSubmissionScore({
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        required: q.required,
        minWords: q.minWords,
      })),
      answers: answers.map((a) => ({
        questionId: typeof a.questionId === 'string' ? a.questionId : '',
        value: a.value,
      })),
      submittedAt,
      openedAt,
      sybilResult,
    });

    const deltaInt = Math.round(scoreResult.total * 10);

    this.logger.log({
      event: 'SCORE_CALCULATED',
      formId,
      wallet: respondentWallet.slice(0, 8) + '...',
      total: scoreResult.total,
      delta: deltaInt,
      breakdown: scoreResult.breakdown,
    });

    if (deltaInt === 0) {
      this.logger.warn({
        event: 'SCORE_DELTA_ZERO',
        formId,
        wallet: respondentWallet.slice(0, 8) + '...',
      });
    }

    const scoreUpdate: Partial<{
      scoreBreakdown: typeof scoreResult.breakdown;
      scoreDelta: number;
      scoreDeltaInt: number;
      scoreUpdatedAt: Date;
      scoreUpdateTx: string | null;
      scoreAtSubmission: number;
    }> = {
      scoreBreakdown: scoreResult.breakdown,
      scoreDelta: scoreResult.total,
      scoreDeltaInt: deltaInt,
      scoreUpdatedAt: new Date(),
      scoreUpdateTx: null,
      scoreAtSubmission: 0,
    };

    try {
      if (!(await this.solanaService.scoreAccountExists(respondentWallet))) {
        this.logger.warn({
          event: 'SCORE_ACCOUNT_NOT_FOUND',
          formId,
          wallet: respondentWallet.slice(0, 8) + '...',
        });
      } else {
        const txSignature = await this.solanaService.updateScore(
          respondentWallet,
          deltaInt,
        );

        scoreUpdate.scoreUpdateTx = txSignature;

        // Snapshot the wallet's cumulative on-chain score so the Responses tab
        // badge matches the live on-chain tier shown in the Distribution tab.
        const onChainScore =
          await this.solanaService.fetchRespondentScore(respondentWallet);
        if (onChainScore !== null) {
          scoreUpdate.scoreAtSubmission = onChainScore;
        }

        this.logger.log({
          event: 'SCORE_UPDATED_ON_CHAIN',
          formId,
          wallet: respondentWallet.slice(0, 8) + '...',
          delta: deltaInt,
          scoreAtSubmission: scoreUpdate.scoreAtSubmission,
          txSignature,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'SCORE_UPDATE_FAILED',
        formId,
        wallet: respondentWallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await this.responseModel
        .findOneAndUpdate(
          { formId, respondentWallet },
          { $set: scoreUpdate },
          { new: false },
        )
        .exec();
    } catch (error) {
      this.logger.error({
        event: 'SCORE_PERSIST_FAILED',
        formId,
        wallet: respondentWallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      scoreAtSubmission: scoreUpdate.scoreAtSubmission ?? 0,
      scoreDelta: deltaInt,
    };
  }

  async getSubmissionsByForm(
    formId: string,
    moderationStatus?: 'all' | ModerationStatusValue,
  ): Promise<SubmissionItem[]> {
    const filter: Record<string, unknown> = { formId };
    if (moderationStatus && moderationStatus !== 'all') {
      filter.moderationStatus = moderationStatus;
    }

    const responses = await this.responseModel
      .find(filter)
      .sort({ submittedAt: -1 })
      .lean()
      .exec();

    this.logger.debug({
      event: 'SUBMISSIONS_FETCHED',
      formId,
      count: responses.length,
    });

    return responses.map((r) => ({
      id: String(r._id),
      respondentWallet: r.respondentWallet,
      scoreAtSubmission: r.scoreAtSubmission,
      scoreDelta: r.scoreDeltaInt ?? 0,
      similarityFlag: r.similarityFlag,
      submittedAt: r.submittedAt ?? new Date(),
      answers: r.answers ?? [],
      moderationStatus: r.moderationStatus ?? 'clean',
      moderationReason: r.moderationReason ?? null,
      moderationNote: r.moderationNote ?? null,
    }));
  }

  async moderateResponse(
    formId: string,
    responseId: string,
    creatorWallet: string,
    dto: ModerateResponseDto,
  ): Promise<void> {
    // Verify form belongs to creator
    const form = await this.formModel.findById(formId).lean().exec();
    if (!form) throw new FormNotFoundException(formId);
    if (form.creator !== creatorWallet) {
      throw new OkaformException(
        {
          code: 'UNAUTHORIZED',
          detail: 'Only the survey creator can moderate responses.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const response = await this.responseModel.findById(responseId).exec();
    if (!response) {
      throw new OkaformException(
        { code: 'RESPONSE_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }

    const previousStatus = response.moderationStatus ?? 'clean';

    // Update moderation status
    await this.responseModel
      .findByIdAndUpdate(responseId, {
        moderationStatus: dto.status,
        moderationReason: dto.reason ?? null,
        moderationNote: dto.note ?? null,
        moderatedAt: new Date(),
        moderatedBy: creatorWallet,
      })
      .exec();

    this.logger.log({
      event: 'RESPONSE_MODERATED',
      formId,
      responseId,
      respondentWallet: response.respondentWallet.slice(0, 8) + '...',
      previousStatus,
      newStatus: dto.status,
      reason: dto.reason,
    });

    // Apply reputation penalty if status is 'rejected'
    // Remove penalty if status is changed back to 'clean'
    if (dto.status === 'rejected' && previousStatus !== 'rejected') {
      await this.applyModerationPenalty(
        response.respondentWallet,
        formId,
        response.scoreDeltaInt ?? 0,
      );
    } else if (dto.status === 'clean' && previousStatus === 'rejected') {
      await this.removeModerationPenalty(
        response.respondentWallet,
        formId,
        response.scoreDeltaInt ?? 0,
      );
    }
  }

  /**
   * Apply a reputation penalty on-chain: reverse the original score delta
   * PLUS a 10-point penalty. e.g. if submission earned +35 points, penalty
   * is -45 points. On-chain failure is logged and swallowed — the MongoDB
   * moderation status is already updated.
   */
  private async applyModerationPenalty(
    wallet: string,
    formId: string,
    originalDelta: number,
  ): Promise<void> {
    const penaltyDelta = -(originalDelta + 10);

    try {
      const txSignature = await this.solanaService.updateScore(
        wallet,
        penaltyDelta,
      );

      this.logger.warn({
        event: 'MODERATION_PENALTY_APPLIED',
        wallet: wallet.slice(0, 8) + '...',
        formId,
        penaltyDelta,
        txSignature,
      });
    } catch (error) {
      this.logger.error({
        event: 'MODERATION_PENALTY_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Restore reputation after un-rejecting a response: add back the original
   * delta plus the 10-point penalty that was applied. Mirrors
   * applyModerationPenalty with a positive delta.
   */
  private async removeModerationPenalty(
    wallet: string,
    formId: string,
    originalDelta: number,
  ): Promise<void> {
    const restoreDelta = originalDelta + 10;

    try {
      const txSignature = await this.solanaService.updateScore(
        wallet,
        restoreDelta,
      );

      this.logger.warn({
        event: 'MODERATION_PENALTY_REVERSED',
        wallet: wallet.slice(0, 8) + '...',
        formId,
        restoreDelta,
        txSignature,
      });
    } catch (error) {
      this.logger.error({
        event: 'MODERATION_PENALTY_REVERT_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async countByForm(formId: string): Promise<number> {
    return this.responseModel.countDocuments({ formId }).exec();
  }
}
