import { Type, Static } from '@sinclair/typebox';

export const SetUsernameSchema = Type.Object({
  username: Type.String({
    pattern: '^[a-zA-Z0-9]{3,20}$',
    description: 'Alphanumeric username, 3-20 characters, no spaces',
  }),
});

export type SetUsernameDto = Static<typeof SetUsernameSchema>;
