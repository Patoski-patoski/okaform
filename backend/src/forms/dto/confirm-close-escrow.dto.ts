import { Type, Static } from '@sinclair/typebox';

export const ConfirmCloseEscrowSchema = Type.Object({
  txSignature: Type.String({ minLength: 1 }),
});

export type ConfirmCloseEscrowDto = Static<typeof ConfirmCloseEscrowSchema>;
