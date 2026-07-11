import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { InvalidWalletException } from '../common/exceptions/solana/invalid-wallet.exception';
import { RpcErrorException } from '../common/exceptions/solana/rpc-error.exception';

const PAGE_SIZE = 1000;
const MAX_SIGNATURES = 10000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private readonly connection: Connection;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

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

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private setCache<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private validateWallet(wallet: string): PublicKey {
    try {
      return new PublicKey(wallet);
    } catch {
      throw new InvalidWalletException(wallet);
    }
  }

  async getSolBalance(wallet: string): Promise<number> {
    const cacheKey = `balance:${wallet}`;
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    const pubkey = this.validateWallet(wallet);

    try {
      const lamports = await this.connection.getBalance(pubkey);
      const balance = lamports / LAMPORTS_PER_SOL;
      this.setCache(cacheKey, balance, 5 * 60 * 1000); // 5min cache
      return balance;
    } catch (error) {
      this.logger.error({
        event: 'RPC_GET_BALANCE_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('getBalance');
    }
  }

  /**
   * Get wallet age in days. Optionally accepts a minAgeDays threshold
   * for early termination — stops scanning once a tx older than the
   * threshold is found, avoiding a full paginated scan.
   */
  async getWalletAgeDays(wallet: string, minAgeDays?: number): Promise<number> {
    const cacheKey = `age:${wallet}`;
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    const pubkey = this.validateWallet(wallet);
    const cutoffDays = minAgeDays ?? 0;
    const nowSec = Math.floor(Date.now() / 1000);

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

        // Early termination: if we found a tx older than the threshold,
        // no need to scan further — wallet definitely qualifies
        if (cutoffDays > 0 && oldestBlockTime !== null) {
          const ageDays = Math.floor((nowSec - oldestBlockTime) / 86400);
          if (ageDays >= cutoffDays) {
            this.setCache(cacheKey, ageDays, 60 * 60 * 1000); // 1hr cache
            return ageDays;
          }
        }

        if (batch.length < PAGE_SIZE) break;
        before = batch[batch.length - 1].signature;
      }

      if (oldestBlockTime === null) {
        return 0;
      }

      const ageDays = Math.floor((nowSec - oldestBlockTime) / 86400);
      this.setCache(cacheKey, ageDays, 60 * 60 * 1000); // 1hr cache
      return ageDays;
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
