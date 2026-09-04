import { JwtAuthGuard } from './jwt-auth.guard';
import { describe, expect, it } from '@jest/globals';

describe('JwtAuthGuard', () => {
  it('should be defined', () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeDefined();
  });

  it('should have canActivate method', () => {
    const guard = new JwtAuthGuard();
    expect(typeof guard.canActivate).toBe('function');
  });
});
