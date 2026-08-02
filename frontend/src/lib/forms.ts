import { api } from "./api";

export interface CreateFormPayload {
  title: string;
  questions: {
    id: string;
    type: string;
    label: string;
    required: boolean;
    options: string[];
    minWords: number;
    maxWords: number;
    randomize: boolean;
    ratingMax: number;
    lowLabel: string;
    highLabel: string;
    matrixRows: string[];
    matrixColumns: string[];
  }[];
  rewardPool: number;
  maxResponses: number;
  rewardType: "weighted" | "lucky_draw";
  numWinners?: number;
  minWalletAge?: number;
  minSolBalance?: number;
  closesAt?: string;
  surveyId: string;
  surveyPda: string;
  escrowPda: string;
  initTxSignature: string;
}

export interface OnChainData {
  surveyId: string;
  surveyPda: string;
  escrowVault: string;
  txSignature: string;
}

export interface CreateFormResult {
  id: string;
  title: string;
  status: string;
  onChain: OnChainData;
  createdAt: string;
}

export interface FormListItem {
  id: string;
  title: string;
  status: string;
  organization: string;
  rewardPool: number;
  maxResponses: number;
  responseCount: number;
  rewardType: string;
  createdAt: string;
  closesAt: string | null;
  previewQuestion: string;
  rewardDistributed: boolean;
  description: string;
  creator: string;
  grossRewardPoolLamports: number;
  netRewardPoolLamports: number;
  feeLamports: number;
  feeBps: number;
  feeWallet: string;
  minWalletAge: number;
  minSolBalance: number;
  surveyPda: string | null;
  escrowPda: string | null;
  closedAt: string | null;
}

export interface FormDetailQuestion {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  options: string[];
  minWords: number;
  maxWords: number;
  ratingMax: number;
  lowLabel: string;
  highLabel: string;
}

export interface FormDetail extends FormListItem {
  questions: FormDetailQuestion[];
}

export async function getFormById(formId: string): Promise<FormDetail> {
  return api<FormDetail>(`/forms/${formId}`);
}

export interface UpdateSurveySettingsPayload {
  title?: string;
  description?: string;
}

export async function updateSurveySettings(
  formId: string,
  payload: UpdateSurveySettingsPayload,
): Promise<FormDetail> {
  return api<FormDetail>(`/forms/${formId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSurveyData(formId: string): Promise<void> {
  return api<void>(`/forms/${formId}/data`, {
    method: "DELETE",
  });
}

export interface ExploreFormItem {
  id: string;
  title: string;
  status: "active" | "closed" | "draft";
  organization: string;
  rewardPool: number;
  rewardType: string;
  numWinners: number;
  responses: number;
  maxResponses: number;
  closesAt: string | null;
  previewQuestion: string;
  minWalletAge: number;
  minSolBalance: number;
  createdAt: string;
}

export interface FormConfig {
  protocolFeeBps: number;
  protocolFeeWallet: string;
}

export async function getFormConfig(): Promise<FormConfig> {
  return api<FormConfig>("/forms/config");
}

export async function createForm(
  payload: CreateFormPayload,
): Promise<CreateFormResult> {
  return api<CreateFormResult>("/forms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function buildInitTx(payload: {
  surveyId: string;
  rewardPoolSol: number;
  rewardType: "weighted" | "lucky_draw";
  maxResponses: number;
  creator: string;
  blockhash: string;
  closesAt?: string;
}): Promise<{ tx: string; surveyPda: string; escrowPda: string }> {
  return api<{ tx: string; surveyPda: string; escrowPda: string }>(
    "/forms/build-init-tx",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getForms(): Promise<FormListItem[]> {
  return api<FormListItem[]>("/forms");
}

export async function getExploreForms(): Promise<ExploreFormItem[]> {
  return api<ExploreFormItem[]>("/forms/explore");
}

export async function buildCloseTx(
  formId: string,
  blockhash: string,
): Promise<{ tx: string }> {
  return api<{ tx: string }>(`/forms/${formId}/close`, {
    method: "POST",
    body: JSON.stringify({ blockhash }),
  });
}

export async function confirmClose(formId: string): Promise<void> {
  return api<void>(`/forms/${formId}/confirm-close`, {
    method: "POST",
  });
}

export interface BuildDistributeTxResult {
  /** One base64-serialised Solana transaction per batch of recipients. */
  txs: string[];
  /** Recipient wallet addresses for each batch (parallel to txs). */
  participantWallets: string[][];
  /** Lamport amounts for each batch (parallel to txs). */
  amounts: number[][];
  badgeTiers: Record<string, string>;
  recovered?: boolean;
}

export async function buildDistributeTx(
  formId: string,
  blockhash: string,
): Promise<BuildDistributeTxResult> {
  return api<BuildDistributeTxResult>(`/forms/${formId}/build-distribute-tx`, {
    method: "POST",
    body: JSON.stringify({ blockhash }),
  });
}

export async function confirmDistribute(
  formId: string,
  participantWallets: string[],
  amounts: number[],
  txSignature: string,
  badgeTiers?: Record<string, string>,
  isLastBatch?: boolean,
): Promise<void> {
  return api<void>(`/forms/${formId}/confirm-distribute`, {
    method: "POST",
    body: JSON.stringify({
      participantWallets,
      amounts,
      txSignature,
      badgeTiers,
      isLastBatch,
    }),
  });
}

export async function buildCloseEscrowTx(
  formId: string,
  blockhash: string,
): Promise<{ tx: string }> {
  return api<{ tx: string }>(`/forms/${formId}/build-close-escrow-tx`, {
    method: "POST",
    body: JSON.stringify({ blockhash }),
  });
}

export async function confirmCloseEscrow(
  formId: string,
  txSignature: string,
): Promise<void> {
  return api<void>(`/forms/${formId}/confirm-close-escrow`, {
    method: "POST",
    body: JSON.stringify({ txSignature }),
  });
}

export interface SubmitResponsePayload {
  answers: Record<string, unknown>[];
  respondentWallet: string;
}

export async function submitResponse(
  formId: string,
  payload: SubmitResponsePayload,
): Promise<SubmissionItem> {
  return api<SubmissionItem>(`/submissions/${formId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface SubmissionItem {
  id: string;
  respondentWallet: string;
  scoreAtSubmission: number;
  similarityFlag: boolean;
  submittedAt: string;
  answers: Record<string, unknown>[];
}

export async function getSubmissions(
  formId: string,
): Promise<SubmissionItem[]> {
  return api<SubmissionItem[]>(`/submissions/${formId}`);
}

export interface SybilCheckResult {
  passed: boolean;
  reason?: string;
  details?: {
    walletAgeDays: number;
    solBalance: number;
    requiredAgeDays: number;
    requiredBalance: number;
  };
}

export async function checkSybilEligibility(
  wallet: string,
  minWalletAgeDays: number,
  minSolBalance: number,
): Promise<SybilCheckResult> {
  const params = new URLSearchParams();
  if (minWalletAgeDays > 0)
    params.set("minWalletAgeDays", String(minWalletAgeDays));
  if (minSolBalance > 0) params.set("minSolBalance", String(minSolBalance));
  const query = params.toString() ? `?${params.toString()}` : "";
  return api<SybilCheckResult>(`/sybil/check/${wallet}${query}`);
}
