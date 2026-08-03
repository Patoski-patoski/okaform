import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
import { api } from "@/lib/api";

const enc = (s: string) => new Uint8Array(new TextEncoder().encode(s));

const SCORE_SEED = enc("score");

export interface InitializeScoreResult {
  txSignature: string | null;
  scorePda: string;
  exists: boolean;
}

export interface ScoreAccountSigner {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

/**
 * Ensure the respondent's on-chain score account exists. If it doesn't, build
 * the initializeScoreAccount transaction via the backend, sign it with the
 * respondent's wallet, and send it. Returns null txSignature when the account
 * already exists.
 */
export async function ensureScoreAccountOnChain(
  wallet: ScoreAccountSigner,
  connection: Connection,
): Promise<InitializeScoreResult> {
  const programId = new PublicKey(import.meta.env.VITE_PROGRAM_ID);

  const [scorePda] = PublicKey.findProgramAddressSync(
    [SCORE_SEED, wallet.publicKey.toBuffer()],
    programId,
  );

  const { blockhash } = await connection.getLatestBlockhash();

  const { tx: txBase64, exists } = await api<{
    tx: string;
    scorePda: string;
    exists: boolean;
  }>("/score/build-init-score-tx", {
    method: "POST",
    body: JSON.stringify({
      wallet: wallet.publicKey.toBase58(),
      blockhash,
    }),
  });

  if (exists || txBase64 === "") {
    return {
      txSignature: null,
      scorePda: scorePda.toBase58(),
      exists: true,
    };
  }

  const tx = Transaction.from(
    Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0)),
  );

  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;

  const signed = await wallet.signTransaction(tx);
  const txSignature = await connection.sendRawTransaction(signed.serialize());

  await connection.confirmTransaction(txSignature, "confirmed");

  return { txSignature, scorePda: scorePda.toBase58(), exists: false };
}
