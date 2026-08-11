import { Type, Static } from '@sinclair/typebox';

export const AnalyticsQuerySchema = Type.Object({
  /** Cap on responses + distributions returned per form (most recent first). */
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 500 })),
});

export type AnalyticsQueryDto = Static<typeof AnalyticsQuerySchema>;
