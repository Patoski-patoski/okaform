import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DistributionService } from './distribution.service';
import { DistributionRecord } from './distribution.schema';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

describe('DistributionService', () => {
  let service: DistributionService;
  let recordModel: jest.Mocked<{
    insertMany: ReturnType<typeof jest.fn>;
    find: ReturnType<typeof jest.fn>;
  }>;

  const mockRecord = {
    formId: 'form123',
    surveyPda: 'pda123',
    recipientWallet: 'wallet1',
    amountLamports: 100_000_000,
    badgeTier: 'Sentinel',
    txSignature: 'tx_sig_123',
    explorerUrl: 'https://solscan.io/tx/tx_sig_123?cluster=devnet',
    distributedAt: new Date(),
    rewardType: 'weighted',
  };

  beforeEach(async () => {
    const mockFind = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributionService,
        {
          provide: getModelToken(DistributionRecord.name),
          useValue: {
            insertMany: jest.fn(),
            find: jest.fn().mockReturnValue(mockFind),
          },
        },
      ],
    }).compile();

    service = module.get<DistributionService>(DistributionService);
    recordModel = module.get(getModelToken(DistributionRecord.name));
  });

  describe('saveDistributionRecords', () => {
    it('should save records successfully', async () => {
      const records = [
        {
          formId: 'form123',
          surveyPda: 'pda123',
          recipientWallet: 'wallet1',
          amountLamports: 100_000_000,
          badgeTier: 'Sentinel',
          txSignature: 'tx_sig_123',
          rewardType: 'weighted',
        },
      ];

      await service.saveDistributionRecords(records);

      expect(recordModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            formId: 'form123',
            recipientWallet: 'wallet1',
            explorerUrl: 'https://solscan.io/tx/tx_sig_123?cluster=devnet',
          }),
        ]),
        { ordered: false },
      );
    });

    it('should handle empty array gracefully', async () => {
      await service.saveDistributionRecords([]);

      expect(recordModel.insertMany).not.toHaveBeenCalled();
    });

    it('should never throw on DB error', async () => {
      const mockError = new Error('DB connection failed');
      recordModel.insertMany.mockRejectedValue(mockError);

      const records = [
        {
          formId: 'form123',
          surveyPda: 'pda123',
          recipientWallet: 'wallet1',
          amountLamports: 100_000_000,
          badgeTier: 'Sentinel',
          txSignature: 'tx_sig_123',
          rewardType: 'weighted',
        },
      ];

      await expect(
        service.saveDistributionRecords(records),
      ).resolves.toBeUndefined();
    });
  });

  describe('getDistributionByForm', () => {
    it('should return records sorted by distributedAt descending', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockRecord]),
      };
      recordModel.find.mockReturnValue(mockFind);

      const result = await service.getDistributionByForm('form123');

      expect(recordModel.find).toHaveBeenCalledWith({ formId: 'form123' });
      expect(mockFind.sort).toHaveBeenCalledWith({ distributedAt: -1 });
      expect(result).toHaveLength(1);
      expect(result[0]?.formId).toBe('form123');
    });
  });

  describe('getEarningsByWallet', () => {
    it('should return records for a given wallet', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockRecord]),
      };
      recordModel.find.mockReturnValue(mockFind);

      const result = await service.getEarningsByWallet('wallet1');

      expect(recordModel.find).toHaveBeenCalledWith({
        recipientWallet: 'wallet1',
      });
      expect(mockFind.sort).toHaveBeenCalledWith({ distributedAt: -1 });
      expect(result).toHaveLength(1);
    });
  });
});
