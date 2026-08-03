import { Type, Static } from '@sinclair/typebox';

export const ListResponsesQuerySchema = Type.Object({
  moderationStatus: Type.Optional(
    Type.Union([
      Type.Literal('all'),
      Type.Literal('clean'),
      Type.Literal('flagged'),
      Type.Literal('rejected'),
    ]),
  ),
});

export type ListResponsesQueryDto = Static<typeof ListResponsesQuerySchema>;
