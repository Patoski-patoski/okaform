import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { SurveyResponse } from '../common/schemas/response.schema';

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
  ) {}

  async createSubmission(
    formId: string,
    respondentWallet: string,
    answers: Record<string, unknown>[],
  ): Promise<SubmissionItem> {
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

    return {
      id: String(saved._id),
      respondentWallet: saved.respondentWallet,
      scoreAtSubmission: saved.scoreAtSubmission,
      similarityFlag: saved.similarityFlag,
      submittedAt: saved.submittedAt,
      answers: saved.answers ?? [],
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
