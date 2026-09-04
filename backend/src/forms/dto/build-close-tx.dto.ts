import { Type, Static } from '@sinclair/typebox';

export const BuildCloseTxSchema = Type.Object({
  blockhash: Type.String({ minLength: 1 }),
});

export type BuildCloseTxDto = Static<typeof BuildCloseTxSchema>;
