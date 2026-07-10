import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { InvalidWalletException } from '../common/exceptions/solana/invalid-wallet.exception';
import { RpcErrorException } from '../common/exceptions/solana/rpc-error.exception';

const PAGE_SIZE = 1000;
const MAX_SIGNATURES = 10000;

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private readonly connection: Connection;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.get<string>('SOLANA_RPC_URL');
    if (!rpcUrl) {
      throw new Error('SOLANA_RPC_URL is not defined');
    }
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.logger.log({
      event: 'SOLANA_SERVICE_INIT',
      rpcUrl: rpcUrl.slice(0, 30) + '...',
    });
  }

  private validateWallet(wallet: string): PublicKey {
    try {
      return new PublicKey(wallet);
    } catch {
      throw new InvalidWalletException(wallet);
    }
  }

  async getSolBalance(wallet: string): Promise<number> {
    const pubkey = this.validateWallet(wallet);

    try {
      const lamports = await this.connection.getBalance(pubkey);
      return lamports / LAMPORTS_PER_SOL;
    } catch (error) {
      this.logger.error({
        event: 'RPC_GET_BALANCE_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('getBalance');
    }
  }

  async getWalletAgeDays(wallet: string): Promise<number> {
    const pubkey = this.validateWallet(wallet);

    try {
      let before: string | undefined;
      let oldestBlockTime: number | null = null;
      let scanned = 0;

      while (scanned < MAX_SIGNATURES) {
        const batch = await this.connection.getSignaturesForAddress(pubkey, {
          limit: PAGE_SIZE,
          before,
        });

        if (batch.length === 0) break;

        // Scan from end (oldest in this batch) to find earliest blockTime
        for (let i = batch.length - 1; i >= 0; i--) {
          const tx = batch[i];
          if (
            tx.blockTime &&
            (oldestBlockTime === null || tx.blockTime < oldestBlockTime)
          ) {
            oldestBlockTime = tx.blockTime;
          }
        }

        scanned += batch.length;

        if (batch.length < PAGE_SIZE) break;
        before = batch[batch.length - 1].signature;
      }

      if (oldestBlockTime === null) {
        return 0;
      }

      const firstTxDate = new Date(oldestBlockTime * 1000);
      const now = new Date();
      const diffMs = now.getTime() - firstTxDate.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch (error) {
      this.logger.error({
        event: 'RPC_GET_WALLET_AGE_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('getWalletAge');
    }
  }

  async getTransactionCount(wallet: string): Promise<number> {
    const pubkey = this.validateWallet(wallet);

    try {
      let total = 0;
      let before: string | undefined;

      while (total < MAX_SIGNATURES) {
        const batch = await this.connection.getSignaturesForAddress(pubkey, {
          limit: PAGE_SIZE,
          before,
        });

        if (batch.length === 0) break;

        total += batch.length;

        if (batch.length < PAGE_SIZE) break;
        before = batch[batch.length - 1].signature;
      }

      return total;
    } catch (error) {
      this.logger.error({
        event: 'RPC_GET_TX_COUNT_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('getTransactionCount');
    }
  }
}
