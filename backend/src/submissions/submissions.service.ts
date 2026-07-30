import {
  Injectable,
  Logger,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { SurveyResponse } from '../common/schemas/response.schema';
import { Form } from '../common/schemas/form.schema';
import { SurveyLifecycleService } from '../forms/survey-lifecycle.service';
import { SybilService } from '../sybil/sybil.service';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';
import { FormClosedException } from '../common/exceptions/form/form-closed.exception';
import { FormFullException } from '../common/exceptions/form/form-full.exception';
import { OkaformException } from '../common/exceptions/base.exception';

export interface SubmissionItem {
  id: string;
  respondentWallet: string;
  scoreAtSubmission: number;
  similarityFlag: boolean;
  submittedAt: Date;
  answers: Record<string, unknown>[];
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
  ) {}

  async createSubmission(
    formId: string,
    respondentWallet: string,
    answers: Record<string, unknown>[],
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
    });

    const saved = await doc.save();

    this.logger.log({
      event: 'SUBMISSION_CREATED',
      formId,
      respondentWallet: respondentWallet.slice(0, 8) + '...',
    });

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
      scoreAtSubmission: saved.scoreAtSubmission,
      similarityFlag: saved.similarityFlag,
      submittedAt: saved.submittedAt,
      answers: saved.answers,
    };
  }

  async getSubmissionsByForm(formId: string): Promise<SubmissionItem[]> {
    const responses = await this.responseModel
      .find({ formId })
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
      similarityFlag: r.similarityFlag,
      submittedAt: r.submittedAt ?? new Date(),
      answers: r.answers ?? [],
    }));
  }

  async countByForm(formId: string): Promise<number> {
    return this.responseModel.countDocuments({ formId }).exec();
  }
}
