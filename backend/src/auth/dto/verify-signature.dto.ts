import { Type, Static } from '@sinclair/typebox';

export const VerifySignatureSchema = Type.Object({
  wallet: Type.String({
    pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
    description: 'Base58 Solana wallet address',
  }),
  message: Type.String({
    minLength: 1,
    description: 'Full SIWS message that was signed',
  }),
  signature: Type.String({
    minLength: 1,
    description: 'Base58 encoded signature',
  }),
});

export type VerifySignatureDto = Static<typeof VerifySignatureSchema>;
