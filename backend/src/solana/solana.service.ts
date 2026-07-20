import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { InvalidWalletException } from '../common/exceptions/solana/invalid-wallet.exception';
import { RpcErrorException } from '../common/exceptions/solana/rpc-error.exception';
import okaformIdl from './idl/okaform.json';

const PAGE_SIZE = 1000;
const MAX_SIGNATURES = 10000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export type RewardType = 'weighted' | 'lottery';

type RewardTypeArg =
  { weighted: Record<string, never> } | { lottery: Record<string, never> };

function toRewardTypeArg(rewardType: RewardType): RewardTypeArg {
  if (rewardType === 'weighted') return { weighted: {} };
  return { lottery: {} };
}

function toLamportsBn(lamports: number): anchor.BN {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return new anchor.BN(lamports);
}

export interface InitializeSurveyResult {
  surveyId: string;
  surveyPda: string;
  escrowVault: string;
  txSignature: string;
}

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private readonly connection: Connection;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly program: anchor.Program;
  private readonly authorityKeypair: Keypair;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.get<string>('SOLANA_RPC_URL');
    if (!rpcUrl) {
      throw new Error('SOLANA_RPC_URL is not defined');
    }
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Load authority keypair from env
    const keypairStr = this.config.get<string>('BACKEND_KEYPAIR');
    if (!keypairStr) {
      throw new Error('BACKEND_KEYPAIR is not defined');
    }
    const secretKey = Buffer.from(JSON.parse(keypairStr));
    this.authorityKeypair = Keypair.fromSecretKey(secretKey);

    // Initialize Anchor program
    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(this.authorityKeypair),
      { commitment: 'confirmed' },
    );
    this.program = new anchor.Program(okaformIdl, provider);

    this.logger.log({
      event: 'SOLANA_SERVICE_INIT',
      rpcUrl: rpcUrl.slice(0, 30) + '...',
      programId: okaformIdl.address,
      authority: this.authorityKeypair.publicKey.toBase58().slice(0, 8) + '...',
    });
  }

  getAuthorityPublicKey(): string {
    return this.authorityKeypair.publicKey.toBase58();
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

  /**
   * Derive survey PDA from creator wallet and survey_id bytes.
   */
  deriveSurveyPda(
    creator: PublicKey,
    surveyId: Uint8Array,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('survey'), creator.toBuffer(), surveyId],
      this.program.programId,
    );
  }

  /**
   * Derive escrow vault PDA from survey PDA.
   */
  deriveEscrowVault(surveyPda: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), surveyPda.toBuffer()],
      this.program.programId,
    );
  }

  /**
   * Initialize a survey on-chain. Creates the survey PDA and escrow vault,
   * then transfers SOL into the escrow.
   */
  async initializeSurvey(
    creatorWallet: string,
    surveyId: string,
    rewardPoolSol: number,
    rewardType: RewardType,
    maxResponses: number,
  ): Promise<InitializeSurveyResult> {
    const creatorPubkey = this.validateWallet(creatorWallet);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');
    const rewardPoolLamports = Math.floor(rewardPoolSol * LAMPORTS_PER_SOL);

    const [surveyPda] = this.deriveSurveyPda(creatorPubkey, surveyIdBytes);
    const [escrowVault] = this.deriveEscrowVault(surveyPda);

    this.logger.log({
      event: 'INITIALIZE_SURVEY_START',
      creator: creatorWallet.slice(0, 8) + '...',
      surveyId: surveyId.slice(0, 16) + '...',
      rewardPool: rewardPoolSol,
      rewardType,
      maxResponses,
    });

    try {
      const tx = await this.program.methods
        .initializeSurvey(
          Buffer.from(surveyIdBytes),
          toLamportsBn(rewardPoolLamports),
          toRewardTypeArg(rewardType),
          maxResponses,
        )
        .accounts({
          creator: creatorPubkey,
          survey: surveyPda,
          escrowVault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      this.logger.log({
        event: 'INITIALIZE_SURVEY_SUCCESS',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        surveyPda: surveyPda.toBase58(),
        txSignature: tx,
      });

      return {
        surveyId,
        surveyPda: surveyPda.toBase58(),
        escrowVault: escrowVault.toBase58(),
        txSignature: tx,
      };
    } catch (error) {
      this.logger.error({
        event: 'INITIALIZE_SURVEY_FAILED',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('initializeSurvey');
    }
  }

  /**
   * Close a survey on-chain. Sets is_active = false.
   * Called automatically when max responses is reached.
   */
  async buildCloseSurveyTx(
    creatorWallet: string,
    surveyId: string,
    blockhash: string,
  ): Promise<string> {
    const creatorPubkey = this.validateWallet(creatorWallet);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');
    const [surveyPda] = this.deriveSurveyPda(creatorPubkey, surveyIdBytes);

    this.logger.log({
      event: 'BUILD_CLOSE_SURVEY_TX',
      creator: creatorWallet.slice(0, 8) + '...',
      surveyId: surveyId.slice(0, 16) + '...',
    });

    try {
      const tx = await this.program.methods
        .closeSurvey(Buffer.from(surveyIdBytes))
        .accounts({
          signer: creatorPubkey,
          survey: surveyPda,
        })
        .transaction();

      tx.feePayer = creatorPubkey;
      tx.recentBlockhash = blockhash;

      return tx.serialize({ requireAllSignatures: false }).toString('base64');
    } catch (error) {
      this.logger.error({
        event: 'BUILD_CLOSE_SURVEY_TX_FAILED',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('buildCloseSurveyTx');
    }
  }

  /**
   * Distribute rewards to participants on-chain.
   * Transfers SOL from escrow vault to participant wallets.
   */
  async distributeRewards(
    creatorWallet: string,
    surveyId: string,
    participantWallets: string[],
    amounts: number[],
  ): Promise<{ txSignature: string; distributed: number }> {
    const creatorPubkey = this.validateWallet(creatorWallet);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');
    const [surveyPda] = this.deriveSurveyPda(creatorPubkey, surveyIdBytes);
    const [escrowVault] = this.deriveEscrowVault(surveyPda);

    this.logger.log({
      event: 'DISTRIBUTE_REWARDS_START',
      creator: creatorWallet.slice(0, 8) + '...',
      surveyId: surveyId.slice(0, 16) + '...',
      participants: participantWallets.length,
    });

    try {
      const participantAccounts = participantWallets.map((wallet) => ({
        pubkey: new PublicKey(wallet),
        isSigner: false,
        isWritable: true,
      }));

      const tx = await this.program.methods
        .distributeRewards(
          Buffer.from(surveyIdBytes),
          amounts.map((a) => new anchor.BN(a)), // eslint-disable-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        )
        .accounts({
          creator: creatorPubkey,
          survey: surveyPda,
          escrowVault,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(participantAccounts)
        .rpc();

      const totalDistributed = amounts.reduce((sum, a) => sum + a, 0);

      this.logger.log({
        event: 'DISTRIBUTE_REWARDS_SUCCESS',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        txSignature: tx,
        distributed: totalDistributed / LAMPORTS_PER_SOL,
      });

      return { txSignature: tx, distributed: totalDistributed };
    } catch (error) {
      this.logger.error({
        event: 'DISTRIBUTE_REWARDS_FAILED',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('distributeRewards');
    }
  }

  /**
   * Build an unsigned distributeRewards transaction for the frontend to sign.
   * Returns the serialized transaction as base64.
   */
  async buildDistributeRewardsTx(
    creatorWallet: string,
    surveyId: string,
    participantWallets: string[],
    amounts: number[],
    blockhash: string,
  ): Promise<string> {
    const creatorPubkey = this.validateWallet(creatorWallet);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');
    const [surveyPda] = this.deriveSurveyPda(creatorPubkey, surveyIdBytes);
    const [escrowVault] = this.deriveEscrowVault(surveyPda);

    this.logger.log({
      event: 'BUILD_DISTRIBUTE_TX',
      creator: creatorWallet.slice(0, 8) + '...',
      surveyId: surveyId.slice(0, 16) + '...',
      participants: participantWallets.length,
    });

    try {
      const participantAccounts = participantWallets.map((wallet) => ({
        pubkey: new PublicKey(wallet),
        isSigner: false,
        isWritable: true,
      }));

      // Build instruction manually to avoid Anchor SDK remainingAccounts issues
      // eslint-disable-next-line @typescript-eslint/await-thenable
      const distributeIx = await this.program.instruction['distributeRewards'](
        Buffer.from(surveyIdBytes),
        amounts.map((a) => new anchor.BN(a)), // eslint-disable-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        {
          accounts: {
            creator: creatorPubkey,
            survey: surveyPda,
            escrowVault,
            systemProgram: SystemProgram.programId,
          },
          remainingAccounts: participantAccounts,
        },
      );

      const tx = new Transaction();
      tx.add(distributeIx);
      tx.feePayer = creatorPubkey;
      tx.recentBlockhash = blockhash;

      return tx.serialize({ requireAllSignatures: false }).toString('base64');
    } catch (error) {
      this.logger.error({
        event: 'BUILD_DISTRIBUTE_TX_FAILED',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('buildDistributeRewardsTx');
    }
  }

  /**
   * Build an unsigned initializeSurvey transaction for the frontend to sign.
   * Returns the serialized transaction as base64.
   */
  async buildInitializeSurveyTx(
    creatorWallet: string,
    surveyId: string,
    rewardPoolSol: number,
    rewardType: RewardType,
    maxResponses: number,
    blockhash: string,
  ): Promise<string> {
    const creatorPubkey = this.validateWallet(creatorWallet);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');
    const rewardPoolLamports = Math.floor(rewardPoolSol * LAMPORTS_PER_SOL);

    const [surveyPda] = this.deriveSurveyPda(creatorPubkey, surveyIdBytes);
    const [escrowVault] = this.deriveEscrowVault(surveyPda);

    const tx = await this.program.methods
      .initializeSurvey(
        Buffer.from(surveyIdBytes),
        toLamportsBn(rewardPoolLamports),
        toRewardTypeArg(rewardType),
        maxResponses,
      )
      .accounts({
        creator: creatorPubkey,
        survey: surveyPda,
        escrowVault,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    tx.feePayer = creatorPubkey;
    tx.recentBlockhash = blockhash;

    return tx.serialize({ requireAllSignatures: false }).toString('base64');
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
