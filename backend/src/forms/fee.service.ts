import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SolanaService } from '../solana/solana.service';

export interface FeeBreakdown {
  feeLamports: number;
  netRewardPoolLamports: number;
}

/**
 * Computes the protocol fee (PROTOCOL_FEE_BPS) applied on survey creation.
 * The fee is taken out of the escrow right after initialization, leaving the
 * net reward pool available for distribution.
 */
@Injectable()
export class FeeService {
  private readonly logger = new Logger(FeeService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly solanaService: SolanaService,
  ) {}

  /**
   * Split the gross reward pool into protocol fee + net distributable pool.
   * The fee is rounded down to whole lamports, so the invariant
   * feeLamports + netRewardPoolLamports === grossRewardPoolLamports always holds.
   */
  computeFee(grossRewardPoolLamports: number): FeeBreakdown {
    const feeLamports = Math.floor(
      (grossRewardPoolLamports * this.getFeeBps()) / 10000,
    );
    const netRewardPoolLamports = grossRewardPoolLamports - feeLamports;
    return { feeLamports, netRewardPoolLamports };
  }

  getFeeBps(): number {
    return this.config.get<number>('PROTOCOL_FEE_BPS') ?? 0;
  }

  getFeeWallet(): string {
    return (
      this.config.get<string>('PROTOCOL_FEE_WALLET') ??
      this.solanaService.getProtocolAuthorityPublicKey()
    );
  }
}
