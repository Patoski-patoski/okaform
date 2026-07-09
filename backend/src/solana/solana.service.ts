import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { InvalidWalletException } from '../common/exceptions/solana/invalid-wallet.exception';
import { RpcErrorException } from '../common/exceptions/solana/rpc-error.exception';

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
      const signatures = await this.connection.getSignaturesForAddress(pubkey, {
        limit: 1,
      });

      if (signatures.length === 0) {
        return 0;
      }

      const oldestTx = signatures[signatures.length - 1];
      if (!oldestTx.blockTime) {
        return 0;
      }

      const firstTxDate = new Date(oldestTx.blockTime * 1000);
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
      const signatures = await this.connection.getSignaturesForAddress(pubkey);
      return signatures.length;
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
