import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DistributionRecord,
  DistributionRecordDocument,
} from './distribution.schema';
import { OkaformException } from '../common/exceptions/base.exception';
import { badgeTierFromGlobalScore } from '../common/badges';

export interface SaveDistributionInput {
  formId: string;
  surveyPda: string;
  recipientWallet: string;
  amountLamports: number;
  badgeTier: string;
  txSignature: string;
  rewardType: string;
}

function badgeTierFromScore(score: number): string {
  return badgeTierFromGlobalScore(score);
}

export const BADGE_WEIGHTS: Record<string, number> = {
  Ghost: 50,
  Cipher: 75,
  Sentinel: 100,
  Oracle: 125,
  Sovereign: 150,
};

function normalizeBadgeTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}

export interface WeightedParticipant {
  wallet: string;
  badgeTier: string;
}

export interface WeightedShare {
  wallet: string;
  amountLamports: bigint;
}

export function calculateWeightedAmounts(
  participants: WeightedParticipant[],
  rewardPoolLamports: bigint,
): WeightedShare[] {
  if (participants.length === 0) {
    throw new OkaformException(
      {
        code: 'NO_PARTICIPANTS',
        detail: 'No participants to distribute rewards to.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  const weights = participants.map((p) => ({
    wallet: p.wallet,
    weight: BigInt(BADGE_WEIGHTS[normalizeBadgeTier(p.badgeTier)] ?? 50),
    badgeTier: p.badgeTier,
  }));

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0n);

  const shares = weights.map((w) => ({
    wallet: w.wallet,
    amount: (rewardPoolLamports * w.weight) / totalWeight,
    badgeTier: w.badgeTier,
  }));

  const distributed = shares.reduce((sum, s) => sum + s.amount, 0n);
  const remainder = rewardPoolLamports - distributed;

  if (remainder > 0n) {
    const maxWeight = weights.reduce(
      (max, w) => (w.weight > max ? w.weight : max),
      0n,
    );
    const highestWeightIndex = weights.findIndex((w) => w.weight === maxWeight);
    shares[highestWeightIndex].amount += remainder;
  }

  const total = shares.reduce((sum, s) => sum + s.amount, 0n);
  if (total !== rewardPoolLamports) {
    throw new OkaformException(
      {
        code: 'DISTRIBUTION_MATH_ERROR',
        detail: 'Weighted amounts do not sum to reward pool.',
        context: {
          expected: rewardPoolLamports.toString(),
          actual: total.toString(),
          participantCount: participants.length,
        },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  return shares.map((s) => ({
    wallet: s.wallet,
    amountLamports: s.amount,
  }));
}

@Injectable()
export class DistributionService implements OnModuleInit {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    @InjectModel(DistributionRecord.name)
    private recordModel: Model<DistributionRecordDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    let hasStaleIndex = false;
    try {
      const indexes = await this.recordModel.collection.indexes();
      hasStaleIndex = indexes.some((idx) => idx.name === 'txSignature_1');
    } catch (error) {
      this.logger.warn({
        event: 'ON_INIT_INDEX_FETCH_FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (hasStaleIndex) {
      try {
        await this.recordModel.collection.dropIndex('txSignature_1');
        this.logger.log({ event: 'DROPPED_STALE_TX_SIGNATURE_INDEX' });
      } catch (error) {
        this.logger.warn({
          event: 'ON_INIT_INDEX_DROP_FAILED',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await this.recordModel.syncIndexes();
      this.logger.log({ event: 'DISTRIBUTION_INDEXES_SYNCED' });
    } catch (error) {
      this.logger.warn({
        event: 'ON_INIT_INDEX_SYNC_FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async saveDistributionRecords(
    records: SaveDistributionInput[],
  ): Promise<void> {
    if (records.length === 0) {
      this.logger.debug({
        event: 'SAVE_DISTRIBUTION_RECORDS_EMPTY',
      });
      return;
    }

    try {
      const ops = records.map((r) => ({
        updateOne: {
          filter: {
            formId: r.formId,
            recipientWallet: r.recipientWallet,
            txSignature: r.txSignature,
          },
          update: {
            $set: {
              formId: r.formId,
              surveyPda: r.surveyPda,
              recipientWallet: r.recipientWallet,
              amountLamports: r.amountLamports,
              badgeTier: r.badgeTier,
              txSignature: r.txSignature,
              explorerUrl: `https://solscan.io/tx/${r.txSignature}?cluster=devnet`,
              distributedAt: new Date(),
              rewardType: r.rewardType,
            },
          },
          upsert: true,
        },
      }));

      const result = await this.recordModel.bulkWrite(ops);
      this.logger.log({
        event: 'DISTRIBUTION_RECORDS_UPSERTED',
        inserted: result.upsertedCount,
        modified: result.modifiedCount,
        total: records.length,
      });
    } catch (error) {
      this.logger.error({
        event: 'SAVE_DISTRIBUTION_RECORDS_FAILED',
        count: records.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getDistributionByForm(formId: string): Promise<DistributionRecord[]> {
    return this.recordModel
      .find({ formId })
      .sort({ distributedAt: -1 })
      .lean()
      .exec();
  }

  async getEarningsByWallet(wallet: string): Promise<DistributionRecord[]> {
    return this.recordModel
      .find({ recipientWallet: wallet })
      .sort({ distributedAt: -1 })
      .lean()
      .exec();
  }

  async deleteByForm(formId: string): Promise<number> {
    const result = await this.recordModel.deleteMany({ formId }).exec();
    return result.deletedCount ?? 0;
  }
}

export { badgeTierFromScore };
