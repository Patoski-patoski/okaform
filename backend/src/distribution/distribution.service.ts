import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DistributionRecord,
  DistributionRecordDocument,
} from './distribution.schema';

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
  if (score >= 100) return 'Sovereign';
  if (score >= 76) return 'Oracle';
  if (score >= 51) return 'Sentinel';
  if (score >= 26) return 'Cipher';
  return 'Ghost';
}

@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    @InjectModel(DistributionRecord.name)
    private recordModel: Model<DistributionRecordDocument>,
  ) {}

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
      const docs = records.map((r) => ({
        formId: r.formId,
        surveyPda: r.surveyPda,
        recipientWallet: r.recipientWallet,
        amountLamports: r.amountLamports,
        badgeTier: r.badgeTier,
        txSignature: r.txSignature,
        explorerUrl: `https://solscan.io/tx/${r.txSignature}?cluster=devnet`,
        distributedAt: new Date(),
        rewardType: r.rewardType,
      }));

      await this.recordModel.insertMany(docs, { ordered: false });
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
}

export { badgeTierFromScore };
