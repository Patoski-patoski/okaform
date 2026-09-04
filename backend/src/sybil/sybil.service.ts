import { Injectable, Logger } from '@nestjs/common';
import { SolanaService } from '../solana/solana.service';
import type { SybilCheckDto, SybilResult } from './dto/sybil-check.dto';

@Injectable()
export class SybilService {
  private readonly logger = new Logger(SybilService.name);

  constructor(private readonly solanaService: SolanaService) {}

  async checkEligibility(
    wallet: string,
    rules: SybilCheckDto,
  ): Promise<SybilResult> {
    const minAge = rules.minWalletAgeDays ?? 0;
    const minBalance = rules.minSolBalance ?? 0;

    const [walletAgeDays, solBalance] = await Promise.all([
      this.solanaService.getWalletAgeDays(wallet, minAge),
      this.solanaService.getSolBalance(wallet),
    ]);

    const reasons: string[] = [];

    if (walletAgeDays < minAge) {
      reasons.push(
        `Wallet age ${walletAgeDays} days is below minimum ${minAge} days`,
      );
    }

    if (solBalance < minBalance) {
      reasons.push(
        `SOL balance ${solBalance.toFixed(4)} is below minimum ${minBalance}`,
      );
    }

    const passed = reasons.length === 0;

    this.logger.log({
      event: 'SYBIL_CHECK',
      wallet: wallet.slice(0, 8) + '...',
      passed,
      walletAgeDays,
      solBalance: solBalance.toFixed(4),
      minAge,
      minBalance,
    });

    return {
      passed,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
      details: {
        walletAgeDays,
        solBalance,
        requiredAgeDays: minAge,
        requiredBalance: minBalance,
      },
    };
  }
}
