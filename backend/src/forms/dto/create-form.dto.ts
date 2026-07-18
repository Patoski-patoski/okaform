import { Type, Static } from '@sinclair/typebox';

export const CreateFormSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  questions: Type.Array(
    Type.Object({
      id: Type.String(),
      type: Type.String(),
      label: Type.String({ minLength: 1 }),
      placeholder: Type.Optional(Type.String()),
      required: Type.Boolean(),
      options: Type.Array(Type.String()),
      minWords: Type.Number(),
      maxWords: Type.Number(),
      randomize: Type.Boolean(),
      ratingMax: Type.Number(),
      lowLabel: Type.String(),
      highLabel: Type.String(),
      matrixRows: Type.Array(Type.String()),
      matrixColumns: Type.Array(Type.String()),
    }),
    { minItems: 1 },
  ),
  rewardPool: Type.Number({ minimum: 0 }),
  maxResponses: Type.Number({ minimum: 1 }),
  rewardType: Type.Union([Type.Literal('weighted'), Type.Literal('lottery')]),
  numWinners: Type.Optional(Type.Number({ minimum: 1 })),
  minWalletAge: Type.Optional(Type.Number({ minimum: 0 })),
  minSolBalance: Type.Optional(Type.Number({ minimum: 0 })),
});

export type CreateFormDto = Static<typeof CreateFormSchema>;
