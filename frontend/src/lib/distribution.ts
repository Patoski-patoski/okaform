import { api } from "./api";
import type { DistributionRecord } from "@/types/distribution";

export async function getFormDistribution(
  formId: string,
): Promise<DistributionRecord[]> {
  return api<DistributionRecord[]>(`/forms/${formId}/distribution`);
}

export async function getUserEarnings(
  wallet: string,
): Promise<DistributionRecord[]> {
  return api<DistributionRecord[]>(`/users/${wallet}/earnings`);
}
