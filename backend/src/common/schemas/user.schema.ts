import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum BadgeTier {
  GHOST = 'Ghost',
  CIPHER = 'Cipher',
  SENTINEL = 'Sentinel',
  ORACLE = 'Oracle',
  SOVEREIGN = 'Sovereign',
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

  @Prop({
    type: String,
    enum: Object.values(BadgeTier),
    default: BadgeTier.GHOST,
  })
  badgeTier!: BadgeTier;

  @Prop({ type: Date, default: null })
  lastLoginAt?: Date | null;

  @Prop({ type: String, default: null })
  siwsNonce?: string | null;

  @Prop({ type: Date, default: null })
  siwsNonceExpiresAt?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
