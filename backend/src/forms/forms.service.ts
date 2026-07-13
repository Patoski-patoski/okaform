import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Form } from '../common/schemas/form.schema';
import type { CreateFormDto } from './dto/create-form.dto';

export interface CreateFormResult {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
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
}
