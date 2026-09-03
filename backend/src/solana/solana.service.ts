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
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { InvalidWalletException } from '../common/exceptions/solana/invalid-wallet.exception';
import { RpcErrorException } from '../common/exceptions/solana/rpc-error.exception';
import { TransactionFailedException } from '../common/exceptions/solana/transaction-failed.exception';
import { badgeTierFromGlobalScore } from '../common/badges';
import okaformIdl from './idl/okaform.json';

const PAGE_SIZE = 1000;
const MAX_SIGNATURES = 10000;

/**
 * Maximum number of recipient accounts per distributeRewards transaction.
 * Solana transactions are capped at ~1232 bytes; each remainingAccount adds
 * ~32 bytes for the pubkey plus overhead, so 10 is a safe conservative limit.
 */
export const MAX_DISTRIBUTE_RECIPIENTS_PER_TX = 10;

/**
 * Maximum recipients per SPL distributeRewardsSpl transaction.
 * SPL transfers require additional accounts (mint, token program, ATAs),
 * reducing the safe limit compared to native SOL transfers.
 */
export const MAX_DISTRIBUTE_RECIPIENTS_SPL_PER_TX = 6;

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
  private readonly backendKeypair: Keypair;
  private readonly protocolAuthorityKeypair: Keypair;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.get<string>('SOLANA_RPC_URL');
    if (!rpcUrl) {
      throw new Error('SOLANA_RPC_URL is not defined');
    }
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Load the backend signer keypair from env. This is the wallet that signs
    // server-initiated transactions (e.g. fee collection on survey creation).
    const keypairStr = this.config.get<string>('BACKEND_KEYPAIR');
    if (!keypairStr) {
      throw new Error('BACKEND_KEYPAIR is not defined');
    }
    const secretKey = Buffer.from(JSON.parse(keypairStr));
    this.backendKeypair = Keypair.fromSecretKey(secretKey);

    // Load the on-chain protocol authority keypair (authority::ID) from env.
    // This is the authority-gated signer for protocol operations such as
    // collect_fee, and the default protocol fee wallet.
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
      new anchor.Wallet(this.backendKeypair),
      { commitment: 'confirmed' },
    );
    this.program = new anchor.Program(okaformIdl, provider);

    this.logger.log({
      event: 'SOLANA_SERVICE_INIT',
      rpcUrl: rpcUrl.slice(0, 30) + '...',
      programId: okaformIdl.address,
      backend: this.backendKeypair.publicKey.toBase58().slice(0, 8) + '...',
      protocolAuthority:
        this.protocolAuthorityKeypair.publicKey.toBase58().slice(0, 8) + '...',
    });
  }

  /**
   * Public key of the on-chain protocol authority (authority::ID). Used as the
   * default protocol fee wallet and for authority-gated operations.
   */
  getProtocolAuthorityPublicKey(): string {
    return this.protocolAuthorityKeypair.publicKey.toBase58();
  }

  /**
   * Official configured USDC mint for this cluster.
   * Defaults to Circle's devnet faucet mint on devnet, and Circle's official mint on mainnet-beta.
   */
  getUsdcMint(): string {
    const configured = this.config.get<string>('USDC_MINT');
    if (configured) return configured;
    const rpcUrl = this.config.get<string>('SOLANA_RPC_URL');
    if (rpcUrl?.includes('devnet')) {
      return '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    }
    return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
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
      this.backendKeypair.publicKey,
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
          signer: this.backendKeypair.publicKey,
          survey: surveyPda,
          escrowVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([this.backendKeypair])
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

  /**
   * Fetch the respondent's badge tier, derived OFF-CHAIN from their cumulative
   * on-chain global_score via the thresholds in common/badges. The badge_tier
   * enum stored by the deployed program uses the legacy scale and is
   * intentionally not read here. Returns null when the score read fails.
   */
  async fetchRespondentBadgeTier(wallet: string): Promise<string | null> {
    const score = await this.fetchRespondentScore(wallet);
    if (score === null) return null;
    return badgeTierFromGlobalScore(score);
  }

  /**
   * Fetch the respondent's cumulative on-chain global score (u16). Returns null
   * when the score account does not exist or the RPC read fails.
   */
  async fetchRespondentScore(wallet: string): Promise<number | null> {
    try {
      const walletPubkey = this.validateWallet(wallet);
      const [scorePda] = this.deriveScorePda(walletPubkey);
      const account = await (
        this.program.account as unknown as {
          respondentScoreAccount: {
            fetch: (pda: PublicKey) => Promise<{ globalScore: number }>;
          };
        }
      )['respondentScoreAccount'].fetch(scorePda);
      return account.globalScore ?? null;
    } catch (error) {
      this.logger.warn({
        event: 'FETCH_SCORE_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async verifyInitializeSurveyTx(txSignature: string): Promise<void> {
    const tx = await this.connection.getTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
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
      maxSupportedTransactionVersion: 0,
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

  /**
   * Derive the respondent score account PDA from a wallet public key.
   */
  deriveScorePda(wallet: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('score'), wallet.toBuffer()],
      this.program.programId,
    );
  }

  /**
   * Check whether a respondent score account exists on-chain. Used to decide
   * whether the frontend must initialize it before update_score can run.
   */
  async scoreAccountExists(wallet: string): Promise<boolean> {
    try {
      const walletPubkey = this.validateWallet(wallet);
      const [scorePda] = this.deriveScorePda(walletPubkey);
      await (
        this.program.account as unknown as {
          respondentScoreAccount: {
            fetch: (pda: PublicKey) => Promise<unknown>;
          };
        }
      ).respondentScoreAccount.fetch(scorePda);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build an unsigned initializeScoreAccount transaction for the respondent's
   * wallet to sign. The wallet is the payer and signer for account creation,
   * so this transaction MUST be signed by the respondent wallet — never by the
   * protocol authority.
   */
  async buildInitScoreTx(
    wallet: string,
    blockhash: string,
  ): Promise<{ tx: string; scorePda: string; exists: boolean }> {
    const walletPubkey = this.validateWallet(wallet);
    const [scorePda] = this.deriveScorePda(walletPubkey);
    const exists = await this.scoreAccountExists(wallet);

    if (exists) {
      return { tx: '', scorePda: scorePda.toBase58(), exists: true };
    }

    this.logger.log({
      event: 'BUILD_INIT_SCORE_TX',
      wallet: wallet.slice(0, 8) + '...',
    });

    try {
      const tx = await this.program.methods
        .initializeScoreAccount()
        .accounts({
          wallet: walletPubkey,
          scoreAccount: scorePda,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = walletPubkey;
      tx.recentBlockhash = blockhash;

      return {
        tx: tx.serialize({ requireAllSignatures: false }).toString('base64'),
        scorePda: scorePda.toBase58(),
        exists: false,
      };
    } catch (error) {
      this.logger.error({
        event: 'BUILD_INIT_SCORE_TX_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new TransactionFailedException(
        'buildInitScoreTx',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Apply a reputation score delta to a respondent's on-chain score account.
   * Authority-gated to protocolAuthorityKeypair (authority::ID).
   */
  async updateScore(wallet: string, delta: number): Promise<string> {
    const walletPubkey = this.validateWallet(wallet);
    const [scorePda] = this.deriveScorePda(walletPubkey);

    this.logger.log({
      event: 'UPDATE_SCORE_START',
      wallet: wallet.slice(0, 8) + '...',
      delta,
    });

    try {
      const txSignature = await this.program.methods
        .updateScore(delta)
        .accounts({
          authority: this.protocolAuthorityKeypair.publicKey,
          scoreAccount: scorePda,
          wallet: walletPubkey,
        })
        .signers([this.protocolAuthorityKeypair])
        .rpc();

      this.logger.log({
        event: 'UPDATE_SCORE_SUCCESS',
        wallet: wallet.slice(0, 8) + '...',
        delta,
        txSignature,
      });

      return txSignature;
    } catch (error) {
      this.logger.error({
        event: 'UPDATE_SCORE_FAILED',
        wallet: wallet.slice(0, 8) + '...',
        delta,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new TransactionFailedException(
        'update_score',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // ── SPL Token Methods ─────────────────────────────────────────────────

  /**
   * Derive the token escrow PDA from a survey PDA.
   * Seeds: [b"token_escrow", survey_pda]
   */
  deriveTokenEscrowPda(surveyPda: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('token_escrow'), surveyPda.toBuffer()],
      this.program.programId,
    );
  }

  /**
   * Get SPL token balance of an escrow token account.
   */
  async getTokenEscrowBalance(escrowPda: string): Promise<bigint> {
    const pubkey = this.validateWallet(escrowPda);
    try {
      const balance = await this.connection.getTokenAccountBalance(
        pubkey,
        'confirmed',
      );
      return BigInt(balance.value.amount);
    } catch (error) {
      this.logger.error({
        event: 'RPC_GET_TOKEN_BALANCE_FAILED',
        escrowPda: escrowPda.slice(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('getTokenEscrowBalance');
    }
  }

  /**
   * Build an unsigned initializeSurveySpl transaction for the frontend to sign.
   * Returns the serialized transaction as base64.
   */
  async buildInitializeSurveySplTx(
    creatorWallet: string,
    surveyId: string,
    rewardPoolUnits: number,
    rewardType: RewardType,
    maxResponses: number,
    tokenMint: string,
    creatorTokenAccount: string,
    blockhash: string,
  ): Promise<{ tx: string; surveyPda: string; escrowPda: string }> {
    const creatorPubkey = this.validateWallet(creatorWallet);
    const mintPubkey = this.validateWallet(tokenMint);
    const creatorAtaPubkey = this.validateWallet(creatorTokenAccount);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');

    const [surveyPda] = this.deriveSurveyPda(creatorPubkey, surveyIdBytes);
    const [escrowVault] = this.deriveTokenEscrowPda(surveyPda);

    this.logger.log({
      event: 'BUILD_INIT_SURVEY_SPL_TX',
      creator: creatorWallet.slice(0, 8) + '...',
      surveyId: surveyId.slice(0, 16) + '...',
      rewardPoolUnits,
      mint: tokenMint.slice(0, 8) + '...',
    });

    try {
      const tx = await this.program.methods
        .initializeSurveySpl(
          Buffer.from(surveyIdBytes),
          new anchor.BN(rewardPoolUnits), // eslint-disable-line @typescript-eslint/no-unsafe-call
          toRewardTypeArg(rewardType),
          maxResponses,
        )
        .accounts({
          signer: creatorPubkey,
          survey: surveyPda,
          rewardMint: mintPubkey,
          escrowVault,
          creatorTokenAccount: creatorAtaPubkey,
          tokenProgram: TOKEN_PROGRAM_ID,
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
    } catch (error) {
      this.logger.error({
        event: 'BUILD_INIT_SURVEY_SPL_TX_FAILED',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('buildInitializeSurveySplTx');
    }
  }

  /**
   * Build an unsigned distributeRewardsSpl transaction for one batch.
   * Creates ATAs for recipients if they don't exist (idempotent).
   */
  async buildDistributeRewardsSplTx(
    creatorWallet: string,
    surveyId: string,
    participantWallets: string[],
    amounts: number[],
    tokenMint: string,
    blockhash: string,
  ): Promise<string> {
    const creatorPubkey = this.validateWallet(creatorWallet);
    const mintPubkey = this.validateWallet(tokenMint);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');
    const [surveyPda] = this.deriveSurveyPda(creatorPubkey, surveyIdBytes);
    const [escrowVault] = this.deriveTokenEscrowPda(surveyPda);

    this.logger.log({
      event: 'BUILD_DISTRIBUTE_SPL_TX',
      creator: creatorWallet.slice(0, 8) + '...',
      surveyId: surveyId.slice(0, 16) + '...',
      participants: participantWallets.length,
    });

    try {
      const tx = new Transaction();

      // Derive ATAs for each recipient and add create-ATA-idempotent instructions
      // On-chain program validates remaining_accounts in pairs: [wallet, ata, wallet, ata, ...]
      const recipientAccounts: {
        pubkey: PublicKey;
        isSigner: boolean;
        isWritable: boolean;
      }[] = [];
      for (const wallet of participantWallets) {
        const walletPubkey = this.validateWallet(wallet);
        const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey);

        // Create ATA if it doesn't exist (idempotent — no-op if it already exists)
        tx.add(
          createAssociatedTokenAccountIdempotentInstruction(
            creatorPubkey, // payer
            ata, // ATA address
            walletPubkey, // owner
            mintPubkey, // mint
          ),
        );

        // Recipient wallet (identity check)
        recipientAccounts.push({
          pubkey: walletPubkey,
          isSigner: false,
          isWritable: false,
        });

        // Recipient ATA (token transfer target)
        recipientAccounts.push({
          pubkey: ata,
          isSigner: false,
          isWritable: true,
        });
      }

      // Build the distributeRewardsSpl instruction
      // eslint-disable-next-line @typescript-eslint/await-thenable
      const distributeIx = await this.program.instruction[
        'distributeRewardsSpl'
      ](
        Buffer.from(surveyIdBytes),
        amounts.map((a) => new anchor.BN(a)), // eslint-disable-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        {
          accounts: {
            creator: creatorPubkey,
            survey: surveyPda,
            escrowVault,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          remainingAccounts: recipientAccounts,
        },
      );

      tx.add(distributeIx);
      tx.feePayer = creatorPubkey;
      tx.recentBlockhash = blockhash;

      return tx.serialize({ requireAllSignatures: false }).toString('base64');
    } catch (error) {
      this.logger.error({
        event: 'BUILD_DISTRIBUTE_SPL_TX_FAILED',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('buildDistributeRewardsSplTx');
    }
  }

  /**
   * Build distributeRewardsSpl transactions in batches of
   * MAX_DISTRIBUTE_RECIPIENTS_SPL_PER_TX.
   */
  async buildDistributeRewardsSplTxBatch(
    creatorWallet: string,
    surveyId: string,
    allWallets: string[],
    allAmounts: number[],
    tokenMint: string,
    blockhash: string,
  ): Promise<{
    txs: string[];
    walletChunks: string[][];
    amountChunks: number[][];
  }> {
    const walletChunks = chunkArray(
      allWallets,
      MAX_DISTRIBUTE_RECIPIENTS_SPL_PER_TX,
    );
    const amountChunks = chunkArray(
      allAmounts,
      MAX_DISTRIBUTE_RECIPIENTS_SPL_PER_TX,
    );

    this.logger.log({
      event: 'BUILD_DISTRIBUTE_SPL_TX_BATCH',
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
        throw new RpcErrorException('buildDistributeRewardsSplTxBatch');
      }

      const serialised = await this.buildDistributeRewardsSplTx(
        creatorWallet,
        surveyId,
        walletBatch,
        amountBatch,
        tokenMint,
        blockhash,
      );
      txs.push(serialised);
    }

    return { txs, walletChunks, amountChunks };
  }

  /**
   * Collect protocol fee from an SPL token escrow.
   * Authority-gated — signed by protocolAuthorityKeypair.
   */
  async collectProtocolFeeSpl(
    feeAmount: number,
    surveyId: string,
    surveyPda: string,
    escrowVault: string,
    tokenMint: string,
  ): Promise<string> {
    const surveyPubkey = this.validateWallet(surveyPda);
    const escrowPubkey = this.validateWallet(escrowVault);
    const mintPubkey = this.validateWallet(tokenMint);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');

    // Get or derive the protocol treasury's ATA for this mint
    const feeWalletStr = this.config.get<string>('PROTOCOL_FEE_WALLET');
    const feeWalletOwner = this.validateWallet(
      feeWalletStr ?? this.protocolAuthorityKeypair.publicKey.toBase58(),
    );
    const feeTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      feeWalletOwner,
    );

    this.logger.log({
      event: 'COLLECT_FEE_SPL_START',
      surveyId: surveyId.slice(0, 16) + '...',
      feeAmount,
      mint: tokenMint.slice(0, 8) + '...',
    });

    try {
      const txSignature = await this.program.methods
        .collectFeeSpl(
          Buffer.from(surveyIdBytes),
          new anchor.BN(feeAmount), // eslint-disable-line @typescript-eslint/no-unsafe-call
        )
        .accounts({
          authority: this.protocolAuthorityKeypair.publicKey,
          survey: surveyPubkey,
          escrowVault: escrowPubkey,
          feeTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([this.protocolAuthorityKeypair])
        .rpc();

      this.logger.log({
        event: 'COLLECT_FEE_SPL_SUCCESS',
        surveyId: surveyId.slice(0, 16) + '...',
        feeAmount,
        txSignature,
      });

      return txSignature;
    } catch (error) {
      this.logger.error({
        event: 'COLLECT_FEE_SPL_FAILED',
        surveyId: surveyId.slice(0, 16) + '...',
        feeAmount,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new TransactionFailedException(
        'collect_fee_spl',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Build an unsigned closeEscrowSpl transaction for the creator to sign.
   * Sweeps remaining tokens to creator ATA and closes the token account.
   */
  async buildCloseEscrowSplTx(
    creatorWallet: string,
    surveyId: string,
    tokenMint: string,
    blockhash: string,
  ): Promise<{ tx: string }> {
    const creatorPubkey = this.validateWallet(creatorWallet);
    const mintPubkey = this.validateWallet(tokenMint);
    const surveyIdBytes = Buffer.from(surveyId, 'utf8');
    const [surveyPda] = this.deriveSurveyPda(creatorPubkey, surveyIdBytes);
    const [escrowVault] = this.deriveTokenEscrowPda(surveyPda);
    const creatorAta = await getAssociatedTokenAddress(
      mintPubkey,
      creatorPubkey,
    );

    this.logger.log({
      event: 'BUILD_CLOSE_ESCROW_SPL_TX',
      creator: creatorWallet.slice(0, 8) + '...',
      surveyId: surveyId.slice(0, 16) + '...',
    });

    try {
      // eslint-disable-next-line @typescript-eslint/await-thenable
      const closeIx = await this.program.instruction['closeEscrowSpl'](
        Buffer.from(surveyIdBytes),
        {
          accounts: {
            signer: creatorPubkey,
            survey: surveyPda,
            escrowVault,
            creatorTokenAccount: creatorAta,
            beneficiary: creatorPubkey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          },
        },
      );

      const tx = new Transaction();
      tx.add(closeIx);
      tx.feePayer = creatorPubkey;
      tx.recentBlockhash = blockhash;

      return {
        tx: tx.serialize({ requireAllSignatures: false }).toString('base64'),
      };
    } catch (error) {
      this.logger.error({
        event: 'BUILD_CLOSE_ESCROW_SPL_TX_FAILED',
        creator: creatorWallet.slice(0, 8) + '...',
        surveyId: surveyId.slice(0, 16) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new RpcErrorException('buildCloseEscrowSplTx');
    }
  }
}
