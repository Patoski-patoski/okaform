import { Type, Static } from '@sinclair/typebox';

export const BuildInitScoreTxSchema = Type.Object({
  wallet: Type.String({ minLength: 32, maxLength: 44 }),
  blockhash: Type.String({ minLength: 1 }),
});

export type BuildInitScoreTxDto = Static<typeof BuildInitScoreTxSchema>;
