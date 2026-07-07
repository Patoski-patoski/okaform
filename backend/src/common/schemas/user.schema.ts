import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum BadgeTier {
  GREY = 'Grey',
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  wallet!: string;

  @Prop({ default: null })
  username?: string;

  @Prop({ default: 0 })
  globalScore!: number;

  @Prop({ default: 0 })
  surveysCompleted!: number;

  @Prop({ type: String, enum: BadgeTier, default: BadgeTier.GREY })
  badgeTier!: BadgeTier;

  @Prop({ default: null })
  lastLoginAt!: Date;

  @Prop({ type: String, default: null })
  siwsNonce?: string | null;

  @Prop({ type: Date, default: null })
  siwsNonceExpiresAt?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
