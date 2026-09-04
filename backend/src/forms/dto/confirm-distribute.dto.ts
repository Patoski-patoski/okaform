import { Type, Static } from '@sinclair/typebox';

export const ConfirmDistributeSchema = Type.Object({
  participantWallets: Type.Array(Type.String()),
  amounts: Type.Array(Type.Number()),
  txSignature: Type.String({ minLength: 1 }),
  badgeTiers: Type.Optional(Type.Record(Type.String(), Type.String())),
  isLastBatch: Type.Optional(Type.Boolean()),
});

export type ConfirmDistributeDto = Static<typeof ConfirmDistributeSchema>;
