import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FeeService } from './fee.service';
import { SolanaService } from '../solana/solana.service';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

const LAMPORTS_PER_SOL = 1_000_000_000;

describe('FeeService', () => {
  let service: FeeService;
  let config: { get: jest.Mock };
  let solanaService: { getAuthorityPublicKey: jest.Mock };

  beforeEach(async () => {
    config = { get: jest.fn() };
    solanaService = {
      getAuthorityPublicKey: jest
        .fn()
        .mockReturnValue('AuthorityWallet111111111111111111111111111111111'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeService,
        { provide: ConfigService, useValue: config },
        { provide: SolanaService, useValue: solanaService },
      ],
    }).compile();

    service = module.get<FeeService>(FeeService);
  });

  function withBps(bps: number) {
    config.get.mockImplementation((key: string) => {
      if (key === 'PROTOCOL_FEE_BPS') return bps;
      if (key === 'PROTOCOL_FEE_WALLET')
        return 'FeeWallet111111111111111111111111111111111111';
      return undefined;
    });
  }

  describe('computeFee', () => {
    it('should charge no fee at 0 BPS', () => {
      withBps(0);

      const result = service.computeFee(4 * LAMPORTS_PER_SOL);

      expect(result.feeLamports).toBe(0);
      expect(result.netRewardPoolLamports).toBe(4 * LAMPORTS_PER_SOL);
    });

    it('should charge 5% on a 4 SOL pool at 500 BPS', () => {
      withBps(500);

      const result = service.computeFee(4 * LAMPORTS_PER_SOL);

      expect(result.feeLamports).toBe(200_000_000);
      expect(result.netRewardPoolLamports).toBe(3_800_000_000);
    });

    it('should floor a sub-lamport fee to zero on a 1-lamport pool', () => {
      withBps(500);

      const result = service.computeFee(1);

      expect(result.feeLamports).toBe(0);
      expect(result.netRewardPoolLamports).toBe(1);
    });

    it('should preserve the invariant fee + net === gross', () => {
      withBps(333);

      const result = service.computeFee(7 * LAMPORTS_PER_SOL);

      expect(result.feeLamports + result.netRewardPoolLamports).toBe(
        7 * LAMPORTS_PER_SOL,
      );
    });
  });

  describe('wallet configuration', () => {
    it('should use PROTOCOL_FEE_WALLET when configured', () => {
      withBps(100);

      expect(service.getFeeWallet()).toBe(
        'FeeWallet111111111111111111111111111111111111',
      );
    });

    it('should fall back to the authority wallet when not configured', () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'PROTOCOL_FEE_BPS') return 100;
        return undefined;
      });

      expect(service.getFeeWallet()).toBe(
        'AuthorityWallet111111111111111111111111111111111',
      );
    });

    it('should default BPS to 0 when not configured', () => {
      config.get.mockReturnValue(undefined);

      expect(service.getFeeBps()).toBe(0);
    });
  });
});
