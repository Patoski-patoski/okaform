import { badgeTierFromGlobalScore } from './badges';
import { describe, it, expect } from '@jest/globals';

describe('badgeTierFromGlobalScore', () => {
  it.each([
    [0, 'Ghost'],
    [149, 'Ghost'],
    [150, 'Cipher'],
    [349, 'Cipher'],
    [350, 'Sentinel'],
    [649, 'Sentinel'],
    [650, 'Oracle'],
    [999, 'Oracle'],
    [1000, 'Sovereign'],
    [5000, 'Sovereign'],
  ])('maps cumulative score %i to %s', (score, tier) => {
    expect(badgeTierFromGlobalScore(score)).toBe(tier);
  });

  it('requires roughly 4 quality submissions to move Ghost -> Cipher', () => {
    const quality = 40;
    expect(badgeTierFromGlobalScore(3 * quality)).toBe('Ghost');
    expect(badgeTierFromGlobalScore(4 * quality)).toBe('Cipher');
  });

  it('keeps a one-submission wallet at Ghost', () => {
    expect(badgeTierFromGlobalScore(40)).toBe('Ghost');
    expect(badgeTierFromGlobalScore(80)).toBe('Ghost');
  });
});
