import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { SurveyResponse } from '../common/schemas/response.schema';
import { Form } from '../common/schemas/form.schema';
import { SurveyLifecycleService } from '../forms/survey-lifecycle.service';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';
import { FormClosedException } from '../common/exceptions/form/form-closed.exception';
import { FormFullException } from '../common/exceptions/form/form-full.exception';

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

    // Guard 2: Form must still be active
    if (form.status !== 'active') {
      throw new FormClosedException(formId);
    }

    // Guard 3: Form must not be at capacity
    const responseCount = await this.responseModel
      .countDocuments({ formId })
      .exec();
    if (responseCount >= form.maxResponses) {
      throw new FormFullException(formId, form.maxResponses);
    }

    // Guard 4: No duplicate submissions
    const existing = await this.responseModel
      .findOne({ formId, respondentWallet })
      .exec();

    if (existing) {
      throw new ConflictException('You have already submitted this survey.');
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
    void this.surveyLifecycleService.checkAndCloseIfFull(formId);

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
