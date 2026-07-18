import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Form } from '../common/schemas/form.schema';
import type { CreateFormDto } from './dto/create-form.dto';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';

export interface CreateFormResult {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
}

export interface FormListItem {
  id: string;
  title: string;
  status: string;
  rewardPool: number;
  maxResponses: number;
  responseCount: number;
  rewardType: string;
  createdAt: Date;
}

export interface FormDetail extends FormListItem {
  questions: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    options: string[];
    placeholder?: string | null;
  }>;
  minWalletAge: number;
  minSolBalance: number;
}

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(@InjectModel(Form.name) private formModel: Model<Form>) {}

  async createForm(
    dto: CreateFormDto,
    creator: string,
  ): Promise<CreateFormResult> {
    const doc = await this.formModel.create({
      title: dto.title,
      questions: dto.questions,
      rewardPool: dto.rewardPool,
      maxResponses: dto.maxResponses,
      rewardType: dto.rewardType,
      numWinners: dto.numWinners ?? 1,
      minWalletAge: dto.minWalletAge ?? 0,
      minSolBalance: dto.minSolBalance ?? 0,
      creator,
      status: 'draft',
    } as Record<string, unknown>);

    const form = await doc.save();

    this.logger.log({
      event: 'FORM_CREATED',
      formId: String(form._id),
      creator: creator.slice(0, 8) + '...',
    });

    return {
      id: String(form._id),
      title: form.title,
      status: form.status,
      createdAt: form.createdAt!,
    };
  }

  async getFormsByCreator(creator: string): Promise<FormListItem[]> {
    const forms = await this.formModel
      .find({ creator })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    this.logger.debug({
      event: 'FORMS_FETCHED',
      creator: creator.slice(0, 8) + '...',
      count: forms.length,
    });

    return forms.map((form) => ({
      id: String(form._id),
      title: form.title,
      status: form.status,
      rewardPool: form.rewardPool,
      maxResponses: form.maxResponses,
      responseCount: 0,
      rewardType: form.rewardType,
      createdAt: form.createdAt ?? new Date(),
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

    return {
      id: String(form._id),
      title: form.title,
      status: form.status,
      rewardPool: form.rewardPool,
      maxResponses: form.maxResponses,
      responseCount: 0,
      rewardType: form.rewardType,
      createdAt: form.createdAt ?? new Date(),
      questions: form.questions.map((q) => ({
        id: q.id,
        type: q.type,
        label: q.label,
        required: q.required,
        options: q.options,
        placeholder: q.placeholder,
      })),
      minWalletAge: form.minWalletAge,
      minSolBalance: form.minSolBalance,
    };
  }
}
