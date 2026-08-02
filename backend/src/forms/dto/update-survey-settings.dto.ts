import { Type, Static } from '@sinclair/typebox';

export const UpdateSurveySettingsSchema = Type.Object({
  title: Type.Optional(Type.String({ minLength: 3, maxLength: 100 })),
  description: Type.Optional(Type.String({ maxLength: 500 })),
});

export type UpdateSurveySettingsDto = Static<typeof UpdateSurveySettingsSchema>;
