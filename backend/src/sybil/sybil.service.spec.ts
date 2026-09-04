import { Test, TestingModule } from '@nestjs/testing';
import { SybilService } from './sybil.service';
import { SolanaService } from '../solana/solana.service';
import { InvalidWalletException } from '../common/exceptions/solana/invalid-wallet.exception';
import { RpcErrorException } from '../common/exceptions/solana/rpc-error.exception';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';

describe('SybilService', () => {
  let service: SybilService;
  let solanaService: jest.Mocked<SolanaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SybilService,
        {
          provide: SolanaService,
          useValue: {
            getWalletAgeDays: jest.fn(),
            getSolBalance: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SybilService>(SybilService);
    solanaService = module.get(SolanaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkEligibility', () => {
    const TEST_WALLET = 'ABC123DEF456GHI789JKL012MNO345PQR678STU901';

    it('should pass when wallet meets all criteria', async () => {
      solanaService.getWalletAgeDays.mockResolvedValue(90);
      solanaService.getSolBalance.mockResolvedValue(2.5);

      const result = await service.checkEligibility(TEST_WALLET, {
        minWalletAgeDays: 30,
        minSolBalance: 1,
      });

      expect(result.passed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.details.walletAgeDays).toBe(90);
      expect(result.details.solBalance).toBe(2.5);
    });

    it('should fail when wallet is too young', async () => {
      solanaService.getWalletAgeDays.mockResolvedValue(5);
      solanaService.getSolBalance.mockResolvedValue(2.5);

      const result = await service.checkEligibility(TEST_WALLET, {
        minWalletAgeDays: 30,
        minSolBalance: 1,
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Wallet age 5 days');
    });

    it('should fail when SOL balance is insufficient', async () => {
      solanaService.getWalletAgeDays.mockResolvedValue(90);
      solanaService.getSolBalance.mockResolvedValue(0.5);

      const result = await service.checkEligibility(TEST_WALLET, {
        minWalletAgeDays: 30,
        minSolBalance: 1,
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('SOL balance');
    });

    it('should fail with multiple reasons when both checks fail', async () => {
      solanaService.getWalletAgeDays.mockResolvedValue(5);
      solanaService.getSolBalance.mockResolvedValue(0.1);

      const result = await service.checkEligibility(TEST_WALLET, {
        minWalletAgeDays: 30,
        minSolBalance: 1,
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Wallet age');
      expect(result.reason).toContain('SOL balance');
    });

    it('should pass when no rules are configured', async () => {
      solanaService.getWalletAgeDays.mockResolvedValue(0);
      solanaService.getSolBalance.mockResolvedValue(0);

      const result = await service.checkEligibility(TEST_WALLET, {});

      expect(result.passed).toBe(true);
      expect(result.details.requiredAgeDays).toBe(0);
      expect(result.details.requiredBalance).toBe(0);
    });

    it('should pass when rules are undefined', async () => {
      solanaService.getWalletAgeDays.mockResolvedValue(0);
      solanaService.getSolBalance.mockResolvedValue(0);

      const result = await service.checkEligibility(TEST_WALLET, {});

      expect(result.passed).toBe(true);
    });

    it('should include correct details in response', async () => {
      solanaService.getWalletAgeDays.mockResolvedValue(45);
      solanaService.getSolBalance.mockResolvedValue(1.23);

      const result = await service.checkEligibility(TEST_WALLET, {
        minWalletAgeDays: 30,
        minSolBalance: 1,
      });

      expect(result.details).toEqual({
        walletAgeDays: 45,
        solBalance: 1.23,
        requiredAgeDays: 30,
        requiredBalance: 1,
      });
    });

    it('should call both RPC methods in parallel', async () => {
      solanaService.getWalletAgeDays.mockResolvedValue(30);
      solanaService.getSolBalance.mockResolvedValue(1);

      await service.checkEligibility(TEST_WALLET, {
        minWalletAgeDays: 0,
        minSolBalance: 0,
      });

      expect(solanaService.getWalletAgeDays).toHaveBeenCalledWith(
        TEST_WALLET,
        0,
      );
      expect(solanaService.getSolBalance).toHaveBeenCalledWith(TEST_WALLET);
    });

    it('should propagate InvalidWalletException for invalid address', async () => {
      solanaService.getWalletAgeDays.mockRejectedValue(
        new InvalidWalletException('invalid'),
      );

      await expect(
        service.checkEligibility('invalid', {
          minWalletAgeDays: 0,
          minSolBalance: 0,
        }),
      ).rejects.toThrow(InvalidWalletException);
    });

    it('should propagate RpcErrorException for RPC failures', async () => {
      solanaService.getWalletAgeDays.mockRejectedValue(
        new RpcErrorException('getWalletAge'),
      );

      await expect(
        service.checkEligibility(TEST_WALLET, {
          minWalletAgeDays: 0,
          minSolBalance: 0,
        }),
      ).rejects.toThrow(RpcErrorException);
    });
  });
});
