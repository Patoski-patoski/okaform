/**
 * Badge tier thresholds applied to the cumulative on-chain global_score.
 *
 * Derived OFF-CHAIN so the ladder can be tuned without a program redeploy. The
 * `badge_tier` enum stored by the deployed devnet program still uses the legacy
 * per-survey scale and must NOT be used for display or reward weighting — always
 * derive the tier from global_score via this function instead.
 *
 * Calibrated against a "quality" submission (4.0/5.0 breakdown => +40 points):
 *   Ghost   0-149    -> Cipher   150      ~4 quality submissions
 *   Cipher  150-349  -> Sentinel 350      ~5 more
 *   Sentinel 350-649 -> Oracle   650      ~8 more
 *   Oracle  650-999  -> Sovereign 1000    ~9 more
 *
 * Keep in sync with `getBadgeTier` in frontend/src/lib/tiers.ts.
 */
export function badgeTierFromGlobalScore(score: number): string {
  if (score >= 1000) return 'Sovereign';
  if (score >= 650) return 'Oracle';
  if (score >= 350) return 'Sentinel';
  if (score >= 150) return 'Cipher';
  return 'Ghost';
}
