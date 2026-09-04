import { Type, Static } from '@sinclair/typebox';

export const GetNonceSchema = Type.Object({
  wallet: Type.String({
    pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
    description: 'Base58 Solana wallet address',
  }),
});

export type GetNonceDto = Static<typeof GetNonceSchema>;
