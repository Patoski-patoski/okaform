import { Type, Static } from '@sinclair/typebox';

export const SybilCheckSchema = Type.Object({
  minWalletAgeDays: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
  minSolBalance: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
});

export type SybilCheckDto = Static<typeof SybilCheckSchema>;

export interface SybilResult {
  passed: boolean;
  reason?: string;
  details: {
    walletAgeDays: number;
    solBalance: number;
    requiredAgeDays: number;
    requiredBalance: number;
  };
}
