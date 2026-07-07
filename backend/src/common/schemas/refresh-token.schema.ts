import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: null })
  revokedAt?: Date | null;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
