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
  rewardType: "weighted" | "lottery";
  numWinners?: number;
  minWalletAge?: number;
  minSolBalance?: number;
  closesAt?: string;
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
  creator: string;
  questions: FormDetailQuestion[];
  minWalletAge: number;
  minSolBalance: number;
}

export async function getFormById(formId: string): Promise<FormDetail> {
  return api<FormDetail>(`/forms/${formId}`);
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

export async function createForm(
  payload: CreateFormPayload,
): Promise<CreateFormResult> {
  return api<CreateFormResult>("/forms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  tx: string;
  participantWallets: string[];
  amounts: number[];
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
): Promise<void> {
  return api<void>(`/forms/${formId}/confirm-distribute`, {
    method: "POST",
    body: JSON.stringify({ participantWallets, amounts, txSignature }),
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
  return api<SubmissionItem>(`/forms/${formId}/submit`, {
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
