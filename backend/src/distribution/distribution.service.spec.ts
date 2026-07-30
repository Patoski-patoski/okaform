import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DistributionService } from './distribution.service';
import { DistributionRecord } from './distribution.schema';
import { calculateWeightedAmounts } from './distribution.service';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

describe('DistributionService', () => {
  let service: DistributionService;
  let recordModel: {
    bulkWrite: jest.Mock;
    insertMany: jest.Mock;
    find: jest.Mock;
    syncIndexes: jest.Mock;
    collection: {
      indexes: jest.Mock;
      dropIndex: jest.Mock;
    };
  };

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
            bulkWrite: jest.fn(),
            insertMany: jest.fn(),
            find: jest.fn().mockReturnValue(mockFind),
            syncIndexes: jest.fn().mockResolvedValue(undefined),
            collection: {
              indexes: jest.fn().mockResolvedValue([]),
              dropIndex: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<DistributionService>(DistributionService);
    recordModel = module.get(getModelToken(DistributionRecord.name));
  });

  describe('saveDistributionRecords', () => {
    it('should upsert records via bulkWrite', async () => {
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

      recordModel.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });

      await service.saveDistributionRecords(records);

      expect(recordModel.bulkWrite).toHaveBeenCalledTimes(1);
      const ops = recordModel.bulkWrite.mock.calls[0][0];
      expect(ops).toHaveLength(1);
      expect(ops[0].updateOne.filter).toEqual({
        formId: 'form123',
        recipientWallet: 'wallet1',
        txSignature: 'tx_sig_123',
      });
      expect(ops[0].updateOne.upsert).toBe(true);
      expect(ops[0].updateOne.update.$set.explorerUrl).toBe(
        'https://solscan.io/tx/tx_sig_123?cluster=devnet',
      );
    });

    it('should handle empty array gracefully', async () => {
      await service.saveDistributionRecords([]);

      expect(recordModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('should never throw on DB error', async () => {
      const mockError = new Error('DB connection failed');
      recordModel.bulkWrite.mockRejectedValue(mockError);

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

  describe('onApplicationInit', () => {
    it('should drop stale txSignature_1 index if it exists', async () => {
      recordModel.collection.indexes.mockResolvedValue([
        { name: 'txSignature_1' },
        { name: '_id_' },
      ]);

      await service.onApplicationInit();

      expect(recordModel.collection.dropIndex).toHaveBeenCalledWith(
        'txSignature_1',
      );
      expect(recordModel.syncIndexes).toHaveBeenCalled();
    });

    it('should not attempt to drop txSignature_1 if it does not exist', async () => {
      recordModel.collection.indexes.mockResolvedValue([{ name: '_id_' }]);

      await service.onApplicationInit();

      expect(recordModel.collection.dropIndex).not.toHaveBeenCalled();
      expect(recordModel.syncIndexes).toHaveBeenCalled();
    });

    it('should not throw if index operations fail', async () => {
      recordModel.collection.indexes.mockRejectedValue(
        new Error('Index fetch failed'),
      );

      await expect(service.onApplicationInit()).resolves.toBeUndefined();
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

describe('calculateWeightedAmounts', () => {
  it('should distribute equally for equal tiers', () => {
    const participants = [
      {
        wallet: 'Alice1111111111111111111111111111111111111',
        badgeTier: 'Sentinel',
      },
      {
        wallet: 'Bob111111111111111111111111111111111111111',
        badgeTier: 'Sentinel',
      },
      {
        wallet: 'Carol11111111111111111111111111111111111111',
        badgeTier: 'Sentinel',
      },
    ];
    const pool = 3_000_000_000n;

    const result = calculateWeightedAmounts(participants, pool);

    expect(result).toHaveLength(3);
    result.forEach((r) => expect(r.amountLamports).toBe(1_000_000_000n));
    expect(
      result[0].amountLamports +
        result[1].amountLamports +
        result[2].amountLamports,
    ).toBe(pool);
  });

  it('should distribute proportionally for mixed tiers with remainder to highest', () => {
    const participants = [
      {
        wallet: 'Alice1111111111111111111111111111111111111',
        badgeTier: 'Sovereign',
      },
      {
        wallet: 'Bob111111111111111111111111111111111111111',
        badgeTier: 'Sentinel',
      },
      {
        wallet: 'Carol11111111111111111111111111111111111111',
        badgeTier: 'Ghost',
      },
    ];
    const pool = 10_000_000_000n;

    const result = calculateWeightedAmounts(participants, pool);

    expect(result).toHaveLength(3);
    expect(result[0].amountLamports).toBe(5_000_000_001n);
    expect(result[1].amountLamports).toBe(3_333_333_333n);
    expect(result[2].amountLamports).toBe(1_666_666_666n);
    expect(
      result[0].amountLamports +
        result[1].amountLamports +
        result[2].amountLamports,
    ).toBe(pool);
  });

  it('should give all lamports to a single participant', () => {
    const participants = [
      {
        wallet: 'Alice1111111111111111111111111111111111111',
        badgeTier: 'Oracle',
      },
    ];
    const pool = 5_000_000_000n;

    const result = calculateWeightedAmounts(participants, pool);

    expect(result).toHaveLength(1);
    expect(result[0].amountLamports).toBe(5_000_000_000n);
  });

  it('should fall back to Ghost weight for unknown badge tier', () => {
    const participants = [
      {
        wallet: 'Alice1111111111111111111111111111111111111',
        badgeTier: 'Unknown',
      },
    ];
    const pool = 1_000_000_000n;

    const result = calculateWeightedAmounts(participants, pool);

    expect(result).toHaveLength(1);
    expect(result[0].amountLamports).toBe(1_000_000_000n);
  });

  it('should throw NO_PARTICIPANTS for empty array', () => {
    expect(() => calculateWeightedAmounts([], 1_000_000_000n)).toThrow(
      'No participants to distribute rewards to.',
    );
  });

  it('should handle large pool with precision and distribute remainder to highest tier', () => {
    const participants = [
      {
        wallet: 'Sovereign111111111111111111111111111111111',
        badgeTier: 'Sovereign',
      },
      {
        wallet: 'Ghost1111111111111111111111111111111111111',
        badgeTier: 'Ghost',
      },
    ];
    const pool = 1_000_000_001n;

    const result = calculateWeightedAmounts(participants, pool);

    expect(result).toHaveLength(2);
    expect(result[0].amountLamports).toBe(750_000_001n);
    expect(result[1].amountLamports).toBe(250_000_000n);
    expect(result[0].amountLamports + result[1].amountLamports).toBe(pool);
  });

  it('should keep result order matching input order', () => {
    const participants = [
      {
        wallet: 'First1111111111111111111111111111111111111',
        badgeTier: 'Ghost',
      },
      {
        wallet: 'Second111111111111111111111111111111111111',
        badgeTier: 'Sentinel',
      },
    ];
    const pool = 3_000_000_000n;

    const result = calculateWeightedAmounts(participants, pool);

    expect(result[0].wallet).toBe('First1111111111111111111111111111111111111');
    expect(result[1].wallet).toBe('Second111111111111111111111111111111111111');
  });
});
