export interface UserProfile {
  id: string;
  wallet: string;
  username: string | null;
  globalScore: number;
  surveysCompleted: number;
  badgeTier: string;
}

export interface JwtPayload {
  sub: string;
  wallet: string;
  tv: number;
}
