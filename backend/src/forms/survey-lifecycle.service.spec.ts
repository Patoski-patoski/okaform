import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SurveyLifecycleService } from './survey-lifecycle.service';
import { Form } from '../common/schemas/form.schema';
import { SurveyResponse } from '../common/schemas/response.schema';
import { SolanaService } from '../solana/solana.service';
import { DistributionService } from '../distribution/distribution.service';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

const LAMPORTS_PER_SOL = 1_000_000_000;

describe('SurveyLifecycleService', () => {
  let service: SurveyLifecycleService;
  let formModel: { findById: jest.Mock };
  let responseModel: { find: jest.Mock };
  let solanaService: {
    buildDistributeRewardsTxBatch: jest.Mock;
    buildDistributeRewardsTx: jest.Mock;
    fetchRespondentBadgeTier: jest.Mock;
    getEscrowBalance: jest.Mock;
  };
  let distributionService: { saveDistributionRecords: jest.Mock };

  function mockForm(data: Record<string, unknown>) {
    return { exec: jest.fn().mockResolvedValue(data) };
  }

  beforeEach(async () => {
    formModel = { findById: jest.fn() };
    responseModel = { find: jest.fn() };
    solanaService = {
      buildDistributeRewardsTx: jest.fn(),
      buildDistributeRewardsTxBatch: jest
        .fn()
        .mockImplementation(
          (
            _creator: string,
            _surveyId: string,
            allWallets: string[],
            allAmounts: number[],
          ) => ({
            txs: ['mock-base64-tx'],
            walletChunks: [allWallets],
            amountChunks: [allAmounts],
          }),
        ),
      fetchRespondentBadgeTier: jest.fn().mockResolvedValue('Ghost'),
      getEscrowBalance: jest.fn(),
    };
    distributionService = { saveDistributionRecords: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveyLifecycleService,
        { provide: getModelToken(Form.name), useValue: formModel },
        {
          provide: getModelToken(SurveyResponse.name),
          useValue: responseModel,
        },
        { provide: SolanaService, useValue: solanaService },
        { provide: DistributionService, useValue: distributionService },
      ],
    }).compile();

    service = module.get<SurveyLifecycleService>(SurveyLifecycleService);
  });

  describe('buildDistributeTx', () => {
    const creator = 'CreatorWallet1111111111111111111111111111111111';
    const blockhash = 'blockhash123';

    beforeEach(() => {
      solanaService.getEscrowBalance.mockResolvedValue(
        BigInt(10 * LAMPORTS_PER_SOL),
      );
    });

    function mockRespondents(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        respondentWallet: `Wallet${String(i).padStart(2, '0')}11111111111111111111111111111111`,
      }));
    }

    it('should distribute equally to all when fewer participants than numWinners', async () => {
      formModel.findById.mockReturnValue(
        mockForm({
          status: 'closed',
          creator,
          rewardPool: 10,
          rewardType: 'lucky_draw',
          numWinners: 10,
          closesAt: new Date('2020-01-01'),
          onChain: { surveyId: 'survey_abc', escrowVault: 'escrow123' },
        }),
      );

      responseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRespondents(5)),
      });

      const result = await service.buildDistributeTx('f1', creator, blockhash);

      // All 5 participants become winners (numWinners capped to participant count)
      expect(result.participantWallets).toHaveLength(1);
      expect(result.amounts).toHaveLength(1);
      const wallets = result.participantWallets[0];
      const amts = result.amounts[0];
      expect(wallets).toHaveLength(5);
      expect(amts).toHaveLength(5);

      // Each gets an equal share of the full reward pool, no leftover for creator
      for (let i = 0; i < 5; i++) {
        expect(amts[i]).toBe(2 * LAMPORTS_PER_SOL);
      }
    });

    it('should randomly select numWinners from participants when more than numWinners', async () => {
      formModel.findById.mockReturnValue(
        mockForm({
          status: 'closed',
          creator,
          rewardPool: 10,
          rewardType: 'lucky_draw',
          numWinners: 3,
          closesAt: new Date('2020-01-01'),
          onChain: { surveyId: 'survey_abc', escrowVault: 'escrow123' },
        }),
      );

      responseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRespondents(10)),
      });

      const result = await service.buildDistributeTx('f1', creator, blockhash);

      // 3 winners + creator for rounding leftover (floor(10/3)*3 < 10)
      expect(result.participantWallets).toHaveLength(1);
      expect(result.amounts).toHaveLength(1);
      const wallets = result.participantWallets[0];
      const amts = result.amounts[0];
      expect(wallets).toHaveLength(4);
      expect(amts).toHaveLength(4);

      const expected = Math.floor((10 * LAMPORTS_PER_SOL) / 3);
      for (let i = 0; i < 3; i++) {
        expect(amts[i]).toBe(expected);
      }

      // Last entry is creator with 1-lamport rounding leftover
      expect(wallets[3]).toBe(creator);
      expect(amts[3]).toBe(10 * LAMPORTS_PER_SOL - 3 * expected);

      const winners = new Set(wallets.slice(0, 3));
      expect(winners.size).toBe(3);
    });

    it('should give each winner equal share when participants match numWinners with no leftover', async () => {
      formModel.findById.mockReturnValue(
        mockForm({
          status: 'closed',
          creator,
          rewardPool: 10,
          rewardType: 'lucky_draw',
          numWinners: 5,
          closesAt: new Date('2020-01-01'),
          onChain: { surveyId: 'survey_abc', escrowVault: 'escrow123' },
        }),
      );

      responseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRespondents(5)),
      });

      const result = await service.buildDistributeTx('f1', creator, blockhash);

      expect(result.participantWallets).toHaveLength(1);
      expect(result.amounts).toHaveLength(1);
      const wallets = result.participantWallets[0];
      const amts = result.amounts[0];
      expect(wallets).toHaveLength(5);
      amts.forEach((amt) => expect(amt).toBe(2 * LAMPORTS_PER_SOL));
      expect(wallets).not.toContain(creator);
    });

    it('should allow distribution for an active survey with responses', async () => {
      formModel.findById.mockReturnValue(
        mockForm({
          status: 'active',
          creator,
          rewardPool: 10,
          rewardType: 'lucky_draw',
          numWinners: 5,
          closesAt: new Date('2099-01-01'),
          onChain: { surveyId: 'survey_abc', escrowVault: 'escrow123' },
        }),
      );

      responseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRespondents(5)),
      });
      const result = await service.buildDistributeTx('f1', creator, blockhash);

      expect(result.participantWallets).toHaveLength(1);
      expect(result.amounts).toHaveLength(1);
      expect(result.participantWallets[0]).toHaveLength(5);
      expect(result.amounts[0]).toHaveLength(5);
    });

    it('should reject when called by non-creator', async () => {
      formModel.findById.mockReturnValue(
        mockForm({
          status: 'closed',
          creator,
          rewardPool: 10,
          rewardType: 'lucky_draw',
          numWinners: 5,
          closesAt: new Date('2020-01-01'),
          onChain: { surveyId: 'survey_abc', escrowVault: 'escrow123' },
        }),
      );

      await expect(
        service.buildDistributeTx(
          'f1',
          'SomeOther1111111111111111111111111111111111',
          blockhash,
        ),
      ).rejects.toThrow('Only the form creator can distribute rewards');
    });

    it('should reject when no undistributed responses exist', async () => {
      formModel.findById.mockReturnValue(
        mockForm({
          status: 'closed',
          creator,
          rewardPool: 10,
          rewardType: 'lucky_draw',
          numWinners: 5,
          closesAt: new Date('2020-01-01'),
          onChain: { surveyId: 'survey_abc', escrowVault: 'escrow123' },
        }),
      );

      responseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.buildDistributeTx('f1', creator, blockhash),
      ).rejects.toThrow('All responses have already been distributed');
    });

    it('should reject when form does not exist', async () => {
      formModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.buildDistributeTx('nonexistent', creator, blockhash),
      ).rejects.toThrow('Form not found');
    });
  });
});
