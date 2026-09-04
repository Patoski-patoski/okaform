import { api } from "./api";

export interface NonceResponse {
  nonce: string;
  message: string;
}

export interface UserProfile {
  wallet: string;
  username: string | null;
  globalScore: number;
  surveysCompleted: number;
  badgeTier: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  user: UserProfile;
}

export async function getNonce(wallet: string): Promise<NonceResponse> {
  return api<NonceResponse>("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ wallet }),
  });
}

export async function verifySignature(
  wallet: string,
  message: string,
  signature: string,
): Promise<AuthTokensResponse> {
  return api<AuthTokensResponse>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ wallet, message, signature }),
  });
}

export async function getMe(): Promise<UserProfile> {
  return api<UserProfile>("/auth/me");
}

export async function logout(): Promise<void> {
  return api<void>("/auth/logout", {
    method: "POST",
  });
}

export async function setUsername(
  username: string,
): Promise<{ wallet: string; username: string }> {
  return api<{ wallet: string; username: string }>("/users/username", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}
