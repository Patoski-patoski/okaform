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
import { TransactionFailedException } from '../common/exceptions/solana/transaction-failed.exception';
import okaformIdl from './idl/okaform.json';

const PAGE_SIZE = 1000;
const MAX_SIGNATURES = 10000;

/**
 * Maximum number of recipient accounts per distributeRewards transaction.
 * Solana transactions are capped at ~1232 bytes; each remainingAccount adds
 * ~32 bytes for the pubkey plus overhead, so 10 is a safe conservative limit.
 */
export const MAX_DISTRIBUTE_RECIPIENTS_PER_TX = 10;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export type RewardType = 'weighted' | 'lucky_draw';

type RewardTypeArg =
  | { weighted: Record<string, never> }
  | { luckyDraw: Record<string, never> };

function toRewardTypeArg(rewardType: RewardType): RewardTypeArg {
  if (rewardType === 'weighted') return { weighted: {} };
  return { luckyDraw: {} };
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
  private readonly protocolAuthorityKeypair: Keypair;

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

    // Load the on-chain authority keypair (authority::ID) from env
    const protocolAuthorityStr = this.config.get<string>('AUTHORITY_KEYPAIR');
    if (!protocolAuthorityStr) {
      throw new Error('AUTHORITY_KEYPAIR is not defined');
    }
    const protocolAuthoritySecret = Buffer.from(
      JSON.parse(protocolAuthorityStr),
    );
    this.protocolAuthorityKeypair = Keypair.fromSecretKey(
      protocolAuthoritySecret,
    );

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
      protocolAuthority:
        this.protocolAuthorityKeypair.publicKey.toBase58().slice(0, 8) + '...',
    });
  }

  /**
   * Public key of the on-chain protocol authority (authority::ID). Used as the
   * default protocol fee wallet and for authority-gated operations.
   */
  getAuthorityPublicKey(): string {
    return this.protocolAuthorityKeypair.publicKey.toBase58();
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
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');
    const rewardPoolLamports = Math.floor(rewardPoolSol * LAMPORTS_PER_SOL);

    // Use the backend's keypair (the actual signer) for PDA derivation
    const [surveyPda] = this.deriveSurveyPda(
      this.authorityKeypair.publicKey,
      surveyIdBytes,
    );
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
          signer: this.authorityKeypair.publicKey,
          survey: surveyPda,
          escrowVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([this.authorityKeypair])
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
   * Build an unsigned distributeRewards transaction for the frontend to sign.
   * Returns the serialized transaction as base64.
   */
  /**
   * Build an unsigned closeEscrow transaction for the creator to sign.
   * Sweeps any remaining escrow balance (rent-exemption buffer) back to the
   * survey creator after rewards have been distributed, then the escrow
   * account is reaped by the runtime once its balance reaches zero.
   */
  async buildCloseEscrowTx(
    creatorWallet: string,
    surveyId: string,
    blockhash: string,
  ): Promise<{ tx: string }> {
    const creatorPubkey = this.validateWallet(creatorWallet);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');
    const [surveyPda] = this.deriveSurveyPda(creatorPubkey, surveyIdBytes);
    const [escrowVault] = this.deriveEscrowVault(surveyPda);

    this.logger.log({
      event: 'BUILD_CLOSE_ESCROW_TX',
      creator: creatorWallet.slice(0, 8) + '...',
      surveyId: surveyId.slice(0, 16) + '...',
      surveyPda: surveyPda.toBase58(),
    });

    try {
      const tx = await this.program.methods
        .closeEscrow(Buffer.from(surveyIdBytes))
        .accounts({
          signer: creatorPubkey,
          survey: surveyPda,
          escrowVault,
          beneficiary: creatorPubkey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = creatorPubkey;
      tx.recentBlockhash = blockhash;

      return {
        tx: tx.serialize({ requireAllSignatures: false }).toString('base64'),
      };
    } catch (error) {
      this.logger.error({
        event: 'BUILD_CLOSE_ESCROW_TX_FAILED',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('buildCloseEscrowTx');
    }
  }

  /**
   * Get a signed distributeRewards transaction for one batch (slice) of
   * recipients. The caller is responsible for chunking wallets/amounts.
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
   * Build one distributeRewards transaction per batch of recipients.
   * Recipients are chunked into groups of MAX_DISTRIBUTE_RECIPIENTS_PER_TX
   * so that no single transaction exceeds Solana's ~1232-byte size limit.
   *
   * All transactions share the same blockhash — the frontend should fetch a
   * fresh blockhash before each transaction it submits.
   */
  async buildDistributeRewardsTxBatch(
    creatorWallet: string,
    surveyId: string,
    allWallets: string[],
    allAmounts: number[],
    blockhash: string,
  ): Promise<{
    txs: string[];
    walletChunks: string[][];
    amountChunks: number[][];
  }> {
    const walletChunks = chunkArray(
      allWallets,
      MAX_DISTRIBUTE_RECIPIENTS_PER_TX,
    );
    const amountChunks = chunkArray(
      allAmounts,
      MAX_DISTRIBUTE_RECIPIENTS_PER_TX,
    );

    this.logger.log({
      event: 'BUILD_DISTRIBUTE_TX_BATCH',
      creator: creatorWallet.slice(0, 8) + '...',
      surveyId: surveyId.slice(0, 16) + '...',
      totalRecipients: allWallets.length,
      batchCount: walletChunks.length,
    });

    const txs: string[] = [];
    for (let i = 0; i < walletChunks.length; i++) {
      const walletBatch = walletChunks[i];
      const amountBatch = amountChunks[i];
      if (!walletBatch || !amountBatch) {
        throw new RpcErrorException('buildDistributeRewardsTxBatch');
      }

      const serialised = await this.buildDistributeRewardsTx(
        creatorWallet,
        surveyId,
        walletBatch,
        amountBatch,
        blockhash,
      );
      txs.push(serialised);
    }

    return { txs, walletChunks, amountChunks };
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
  ): Promise<{ tx: string; surveyPda: string; escrowPda: string }> {
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
        signer: creatorPubkey,
        survey: surveyPda,
        escrowVault,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    tx.feePayer = creatorPubkey;
    tx.recentBlockhash = blockhash;

    return {
      tx: tx.serialize({ requireAllSignatures: false }).toString('base64'),
      surveyPda: surveyPda.toBase58(),
      escrowPda: escrowVault.toBase58(),
    };
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

  /**
   * Get wallet age in days. Optionally accepts a minAgeDays threshold
   * for early termination — stops scanning once a tx older than the
   * threshold is found, avoiding a full paginated scan.
   */
  async getWalletAgeDays(wallet: string, minAgeDays?: number): Promise<number> {
    const rpcUrl = this.config.get<string>('SOLANA_RPC_URL');
    if (rpcUrl?.includes('devnet')) {
      return 99999;
    }

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

        if (cutoffDays > 0 && oldestBlockTime !== null) {
          const ageDays = Math.floor((nowSec - oldestBlockTime) / 86400);
          if (ageDays >= cutoffDays) {
            return ageDays;
          }
        }

        if (batch.length < PAGE_SIZE) break;
        before = batch[batch.length - 1].signature;
      }

      if (oldestBlockTime === null) {
        return 0;
      }

      return Math.floor((nowSec - oldestBlockTime) / 86400);
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

  async getEscrowBalance(escrowPda: string): Promise<bigint> {
    const pubkey = this.validateWallet(escrowPda);
    const balance = await this.connection.getBalance(pubkey, 'confirmed');
    return BigInt(balance);
  }

  async fetchRespondentBadgeTier(wallet: string): Promise<string | null> {
    try {
      const walletPubkey = this.validateWallet(wallet);
      const [scorePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('score'), walletPubkey.toBuffer()],
        this.program.programId,
      );
      const account = await (
        this.program.account as unknown as {
          respondentScoreAccount: {
            fetch: (pda: PublicKey) => Promise<{
              badgeTier: Record<string, Record<string, unknown>>;
            }>;
          };
        }
      )['respondentScoreAccount'].fetch(scorePda);
      const badgeTier = Object.keys(account.badgeTier)[0];
      return badgeTier ?? null;
    } catch (error) {
      this.logger.warn({
        event: 'FETCH_BADGE_TIER_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async verifyInitializeSurveyTx(txSignature: string): Promise<void> {
    const tx = await this.connection.getTransaction(txSignature, {
      commitment: 'confirmed',
    });

    if (!tx) {
      this.logger.warn({
        event: 'INIT_TX_NOT_FOUND',
        txSignature,
      });
      throw new TransactionFailedException(
        txSignature,
        'Initialize survey transaction not found on-chain.',
      );
    }

    if (tx.meta?.err) {
      this.logger.warn({
        event: 'INIT_TX_FAILED',
        txSignature,
        error: tx.meta.err,
      });
      throw new TransactionFailedException(
        txSignature,
        `Initialize survey transaction failed: ${JSON.stringify(tx.meta.err)}`,
      );
    }

    this.logger.log({
      event: 'INIT_TX_VERIFIED',
      txSignature,
    });
  }

  /**
   * Collect the protocol fee from a survey escrow. Transfers `feeLamports`
   * from the escrow vault to the configured protocol fee wallet, leaving the
   * net reward pool for distribution. Gated to authority::ID on-chain.
   */
  async collectProtocolFee(
    feeLamports: number,
    surveyId: string,
    surveyPda: string,
    escrowVault: string,
  ): Promise<string> {
    const surveyPubkey = this.validateWallet(surveyPda);
    const escrowPubkey = this.validateWallet(escrowVault);
    const feeWalletStr = this.config.get<string>('PROTOCOL_FEE_WALLET');
    const feeWalletPubkey = this.validateWallet(
      feeWalletStr ?? this.protocolAuthorityKeypair.publicKey.toBase58(),
    );
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');

    this.logger.log({
      event: 'COLLECT_FEE_START',
      surveyId: surveyId.slice(0, 16) + '...',
      surveyPda: surveyPda.slice(0, 8) + '...',
      feeLamports,
      feeWallet: feeWalletPubkey.toBase58().slice(0, 8) + '...',
    });

    try {
      const txSignature = await this.program.methods
        .collectFee(Buffer.from(surveyIdBytes), toLamportsBn(feeLamports))
        .accounts({
          authority: this.protocolAuthorityKeypair.publicKey,
          survey: surveyPubkey,
          escrowVault: escrowPubkey,
          feeWallet: feeWalletPubkey,
          systemProgram: SystemProgram.programId,
        })
        .signers([this.protocolAuthorityKeypair])
        .rpc();

      this.logger.log({
        event: 'COLLECT_FEE_SUCCESS',
        surveyId: surveyId.slice(0, 16) + '...',
        feeLamports,
        txSignature,
      });

      return txSignature;
    } catch (error) {
      this.logger.error({
        event: 'COLLECT_FEE_FAILED',
        surveyId: surveyId.slice(0, 16) + '...',
        feeLamports,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new TransactionFailedException(
        'collect_fee',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Verify a closeEscrow transaction landed on-chain without errors.
   */
  async verifyCloseEscrowTx(txSignature: string): Promise<void> {
    const tx = await this.connection.getTransaction(txSignature, {
      commitment: 'confirmed',
    });

    if (!tx) {
      this.logger.warn({
        event: 'CLOSE_ESCROW_TX_NOT_FOUND',
        txSignature,
      });
      throw new TransactionFailedException(
        txSignature,
        'Close escrow transaction not found on-chain.',
      );
    }

    if (tx.meta?.err) {
      this.logger.warn({
        event: 'CLOSE_ESCROW_TX_FAILED',
        txSignature,
        error: tx.meta.err,
      });
      throw new TransactionFailedException(
        txSignature,
        `Close escrow transaction failed: ${JSON.stringify(tx.meta.err)}`,
      );
    }

    this.logger.log({
      event: 'CLOSE_ESCROW_TX_VERIFIED',
      txSignature,
    });
  }
}
