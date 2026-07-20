import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Form } from '../common/schemas/form.schema';
import { SurveyResponse } from '../common/schemas/response.schema';
import type { CreateFormDto } from './dto/create-form.dto';
import type { BuildInitTxDto } from './dto/build-init-tx.dto';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';
import { SolanaService } from '../solana/solana.service';

export interface CreateFormResult {
  id: string;
  title: string;
  status: string;
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
  minWalletAge: number;
  minSolBalance: number;
}

export interface ExploreFormItem {
  id: string;
  title: string;
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

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    @InjectModel(Form.name) private formModel: Model<Form>,
    @InjectModel(SurveyResponse.name)
    private responseModel: Model<SurveyResponse>,
    private readonly solanaService: SolanaService,
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

    // Save form to MongoDB with on-chain data from frontend
    const doc = await this.formModel.create({
      title: dto.title,
      questions: dto.questions,
      rewardPool: dto.rewardPool,
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
      onChain: {
        surveyId: dto.surveyId,
        surveyPda: dto.surveyPda,
        escrowVault: dto.escrowPda,
        txSignature: dto.initTxSignature,
      },
      createdAt: form.createdAt!,
    };
  }

  async buildInitializeTx(dto: BuildInitTxDto): Promise<{ tx: string }> {
    const tx = await this.solanaService.buildInitializeSurveyTx(
      dto.creator,
      dto.surveyId,
      dto.rewardPoolSol,
      dto.rewardType,
      dto.maxResponses,
      dto.blockhash,
    );

    return { tx };
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

    return forms.map((form) => ({
      id: String(form._id),
      title: form.title,
      organization: form.organization,
      rewardPool: form.rewardPool,
      rewardType: form.rewardType,
      numWinners: form.numWinners,
      responses: countMap.get(String(form._id)) ?? 0,
      maxResponses: form.maxResponses,
      closesAt: form.closesAt?.toISOString() ?? null,
      previewQuestion: form.previewQuestion,
      minWalletAge: form.minWalletAge,
      minSolBalance: form.minSolBalance,
      createdAt: form.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
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

    return forms.map((form) => ({
      id: String(form._id),
      title: form.title,
      status: form.status,
      organization: form.organization,
      rewardPool: form.rewardPool,
      maxResponses: form.maxResponses,
      responseCount: countMap.get(String(form._id)) ?? 0,
      rewardType: form.rewardType,
      createdAt: form.createdAt ?? new Date(),
      closesAt: form.closesAt?.toISOString() ?? null,
      previewQuestion: form.previewQuestion,
    }));
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
      status: form.status,
      organization: form.organization,
      rewardPool: form.rewardPool,
      maxResponses: form.maxResponses,
      responseCount,
      rewardType: form.rewardType,
      createdAt: form.createdAt ?? new Date(),
      closesAt: form.closesAt?.toISOString() ?? null,
      previewQuestion: form.previewQuestion,
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
      minWalletAge: form.minWalletAge,
      minSolBalance: form.minSolBalance,
    };
  }
}
