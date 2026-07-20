import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FormDocument = HydratedDocument<Form>;

export type QuestionTypeValue =
  | 'short_text'
  | 'long_text'
  | 'multiple_choice'
  | 'checkbox'
  | 'dropdown'
  | 'multi_select'
  | 'number'
  | 'email'
  | 'phone'
  | 'link'
  | 'file_upload'
  | 'date'
  | 'time'
  | 'linear_scale'
  | 'matrix'
  | 'rating'
  | 'payment'
  | 'signature'
  | 'ranking'
  | 'new_page'
  | 'thank_you'
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'divider'
  | 'title'
  | 'label'
  | 'image'
  | 'video'
  | 'audio'
  | 'embed_anything'
  | 'conditional_logic'
  | 'calculated_field'
  | 'hidden_field'
  | 'recaptcha'
  | 'country';

export type RewardType = 'weighted' | 'lottery';
export type FormStatus = 'draft' | 'active' | 'closed';

@Schema({ _id: false })
export class Question {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  type!: QuestionTypeValue;

  @Prop({ required: true })
  label!: string;

  @Prop({ default: '' })
  placeholder!: string;

  @Prop({ default: false })
  required!: boolean;

  @Prop({ type: [String], default: [] })
  options!: string[];

  @Prop({ default: 0 })
  minWords!: number;

  @Prop({ default: 0 })
  maxWords!: number;

  @Prop({ default: false })
  randomize!: boolean;

  @Prop({ default: 5 })
  ratingMax!: number;

  @Prop({ default: '' })
  lowLabel!: string;

  @Prop({ default: '' })
  highLabel!: string;

  @Prop({ type: [String], default: [] })
  matrixRows!: string[];

  @Prop({ type: [String], default: [] })
  matrixColumns!: string[];
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

@Schema({ _id: false })
export class OnChainData {
  @Prop({ required: true })
  surveyId!: string;

  @Prop({ required: true })
  surveyPda!: string;

  @Prop({ required: true })
  escrowVault!: string;

  @Prop({ required: true })
  txSignature!: string;
}

export const OnChainDataSchema = SchemaFactory.createForClass(OnChainData);

@Schema({ timestamps: true })
export class Form {
  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: [QuestionSchema], default: [] })
  questions!: Question[];

  @Prop({ required: true })
  rewardPool!: number;

  @Prop({ required: true })
  maxResponses!: number;

  @Prop({ type: String, enum: ['weighted', 'lottery'], default: 'weighted' })
  rewardType!: RewardType;

  @Prop({ default: 1 })
  numWinners!: number;

  @Prop({ default: 0 })
  minWalletAge!: number;

  @Prop({ default: 0 })
  minSolBalance!: number;

  @Prop({ required: true, index: true })
  creator!: string;

  @Prop({ type: String, enum: ['draft', 'active', 'closed'], default: 'draft' })
  status!: FormStatus;

  @Prop({ default: 0 })
  responseCount!: number;

  @Prop({ default: '' })
  organization!: string;

  @Prop({ type: Date, default: null })
  closesAt?: Date;

  @Prop({ default: '' })
  previewQuestion!: string;

  @Prop({ type: OnChainDataSchema, default: null })
  onChain?: OnChainData;
}

export const FormSchema = SchemaFactory.createForClass(Form);
