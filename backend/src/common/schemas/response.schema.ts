import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ResponseDocument = HydratedDocument<SurveyResponse>;

@Schema({ _id: false })
export class ScoreBreakdown {
  @Prop({ default: 0 })
  completionRate!: number;

  @Prop({ default: 0 })
  responseDepth!: number;

  @Prop({ default: 0 })
  consistency!: number;

  @Prop({ default: 0 })
  walletHistory!: number;

  @Prop({ default: 0 })
  creatorRating!: number;
}

export const ScoreBreakdownSchema =
  SchemaFactory.createForClass(ScoreBreakdown);

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

  @Prop({ type: Date, required: true })
  openedAt!: Date;

  @Prop({ type: ScoreBreakdownSchema, default: null })
  scoreBreakdown?: ScoreBreakdown | null;

  @Prop({ default: 0 })
  scoreDelta!: number;

  @Prop({ default: 0 })
  scoreDeltaInt!: number;

  @Prop({ type: Date, default: null })
  scoreUpdatedAt?: Date | null;

  @Prop({ type: String, default: null })
  scoreUpdateTx?: string | null;

  @Prop({ default: 1 })
  creatorRatingScore!: number;

  @Prop({ default: false })
  creatorRatingApplied!: boolean;

  @Prop({ default: false })
  distributed!: boolean;

  @Prop({ default: 0 })
  distributedAmount!: number;

  @Prop({ type: Date, default: null })
  distributedAt?: Date | null;

  @Prop({ type: String, default: null })
  txSignature?: string | null;

  @Prop({
    type: String,
    enum: ['clean', 'flagged', 'rejected'],
    default: 'clean',
  })
  moderationStatus!: ModerationStatusValue;

  @Prop({ type: String, default: null })
  moderationReason?: ModerationReasonValue | null;

  @Prop({ type: String, default: null })
  moderationNote?: string | null;

  @Prop({ type: Date, default: null })
  moderatedAt?: Date | null;

  @Prop({ type: String, default: null })
  moderatedBy?: string | null;
}

export type ModerationStatusValue = 'clean' | 'flagged' | 'rejected';
export type ModerationReasonValue =
  | 'spam'
  | 'bot'
  | 'duplicate'
  | 'low_quality'
  | 'other';

export const ResponseSchema = SchemaFactory.createForClass(SurveyResponse);
ResponseSchema.index({ formId: 1, respondentWallet: 1 }, { unique: true });
