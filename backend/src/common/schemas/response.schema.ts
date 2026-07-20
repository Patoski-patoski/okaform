import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ResponseDocument = HydratedDocument<SurveyResponse>;

@Schema({ timestamps: true })
export class SurveyResponse {
  @Prop({ type: Types.ObjectId, ref: 'Form', required: true, index: true })
  formId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  respondentWallet!: string;

  @Prop({ type: [Object], default: [] })
  answers!: Record<string, unknown>[];

  @Prop({ default: 0 })
  scoreAtSubmission!: number;

  @Prop({ default: false })
  similarityFlag!: boolean;

  @Prop({ default: null })
  submittedAt!: Date;

  @Prop({ default: false })
  distributed!: boolean;

  @Prop({ default: 0 })
  distributedAmount!: number;

  @Prop({ type: Date, default: null })
  distributedAt?: Date | null;

  @Prop({ type: String, default: null })
  txSignature?: string | null;
}

export const ResponseSchema = SchemaFactory.createForClass(SurveyResponse);
