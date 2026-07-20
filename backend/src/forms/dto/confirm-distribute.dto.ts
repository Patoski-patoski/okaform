import { Type, Static } from '@sinclair/typebox';

export const ConfirmDistributeSchema = Type.Object({
  participantWallets: Type.Array(Type.String()),
  amounts: Type.Array(Type.Number()),
  txSignature: Type.String({ minLength: 1 }),
});

export type ConfirmDistributeDto = Static<typeof ConfirmDistributeSchema>;
