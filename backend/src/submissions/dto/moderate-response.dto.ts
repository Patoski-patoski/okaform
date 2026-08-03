import { Type, Static } from '@sinclair/typebox';

export const ModerateResponseSchema = Type.Object({
  status: Type.Union([
    Type.Literal('flagged'),
    Type.Literal('rejected'),
    Type.Literal('clean'),
  ]),
  reason: Type.Optional(
    Type.Union([
      Type.Literal('spam'),
      Type.Literal('bot'),
      Type.Literal('duplicate'),
      Type.Literal('low_quality'),
      Type.Literal('other'),
    ]),
  ),
  note: Type.Optional(Type.String({ maxLength: 500 })),
});

export type ModerateResponseDto = Static<typeof ModerateResponseSchema>;
