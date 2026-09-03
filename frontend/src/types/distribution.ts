export interface DistributionRecord {
  formId: string;
  surveyPda: string;
  recipientWallet: string;
  amountLamports: number;
  amountUnits?: number;
  badgeTier: string;
  txSignature: string;
  explorerUrl: string;
  distributedAt: string;
  rewardType: string;
  rewardCurrency?: string;
}
