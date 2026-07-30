import { Type, Static } from '@sinclair/typebox';

export const BuildInitTxSchema = Type.Object({
  surveyId: Type.String(),
  rewardPoolSol: Type.Number({ minimum: 0 }),
  rewardType: Type.Union([
    Type.Literal('weighted'),
    Type.Literal('lucky_draw'),
  ]),
  maxResponses: Type.Number({ minimum: 1 }),
  creator: Type.String(),
  blockhash: Type.String(),
  closesAt: Type.Optional(Type.String()),
});

export type BuildInitTxDto = Static<typeof BuildInitTxSchema>;
