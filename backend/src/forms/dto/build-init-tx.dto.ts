import { Type, Static } from '@sinclair/typebox';

export const BuildInitTxSchema = Type.Object({
  surveyId: Type.String(),
  rewardPool: Type.Number({ minimum: 0 }),
  rewardType: Type.Union([Type.Literal('weighted'), Type.Literal('lottery')]),
  maxResponses: Type.Number({ minimum: 1 }),
  creator: Type.String(),
  blockhash: Type.String(),
});

export type BuildInitTxDto = Static<typeof BuildInitTxSchema>;
