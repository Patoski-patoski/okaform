import { Type, Static } from '@sinclair/typebox';

export const SubmitResponseSchema = Type.Object({
  answers: Type.Array(Type.Record(Type.String(), Type.Unknown())),
  respondentWallet: Type.String({ minLength: 32, maxLength: 44 }),
});

export type SubmitResponseDto = Static<typeof SubmitResponseSchema>;
