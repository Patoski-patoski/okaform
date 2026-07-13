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
}

export interface CreateFormResult {
  id: string;
  title: string;
  status: string;
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
