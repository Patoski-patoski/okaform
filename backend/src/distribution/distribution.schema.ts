import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DistributionRecordDocument = HydratedDocument<DistributionRecord>;

@Schema({ collection: 'distribution_records', timestamps: true })
export class DistributionRecord {
  @Prop({ required: true, index: true })
  formId!: string;

  @Prop({ required: true })
  surveyPda!: string;

  @Prop({ required: true, index: true })
  recipientWallet!: string;

  @Prop({ required: true })
  amountLamports!: number;

  @Prop({ required: true })
  badgeTier!: string;

  @Prop({ required: true, unique: true })
  txSignature!: string;

  @Prop({ required: true })
  explorerUrl!: string;

  @Prop({ required: true })
  distributedAt!: Date;

  @Prop({ required: true })
  rewardType!: string;
}

export const DistributionRecordSchema =
  SchemaFactory.createForClass(DistributionRecord);

DistributionRecordSchema.index({ formId: 1, recipientWallet: 1 });
