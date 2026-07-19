import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api";

const enc = (s: string) => new Uint8Array(new TextEncoder().encode(s));

const SURVEY_SEED = enc("survey");
const ESCROW_SEED = enc("escrow");

export interface InitializeSurveyParams {
  surveyId: string;
  rewardPool: number;
  rewardType: "weighted" | "lottery";
  maxResponses: number;
}

export interface InitializeSurveyResult {
  txSignature: string;
  surveyPda: string;
  escrowPda: string;
}

export async function initializeSurveyOnChain(
  wallet: AnchorWallet,
  connection: Connection,
  params: InitializeSurveyParams,
): Promise<InitializeSurveyResult> {
  const programId = new PublicKey(import.meta.env.VITE_PROGRAM_ID);

  const [surveyPda] = PublicKey.findProgramAddressSync(
    [SURVEY_SEED, wallet.publicKey.toBuffer(), enc(params.surveyId)],
    programId,
  );

  const [escrowPda] = PublicKey.findProgramAddressSync(
    [ESCROW_SEED, surveyPda.toBuffer()],
    programId,
  );

  const { blockhash } = await connection.getLatestBlockhash();

  const { tx: txBase64 } = await api<{ tx: string }>("/forms/build-init-tx", {
    method: "POST",
    body: JSON.stringify({
      surveyId: params.surveyId,
      rewardPool: params.rewardPool,
      rewardType: params.rewardType,
      maxResponses: params.maxResponses,
      creator: wallet.publicKey.toBase58(),
      blockhash,
    }),
  });

  const tx = Transaction.from(
    Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0)),
  );

  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;

  const signed = await wallet.signTransaction(tx);
  const txSignature = await connection.sendRawTransaction(signed.serialize());

  await connection.confirmTransaction(txSignature, "confirmed");

  return {
    txSignature,
    surveyPda: surveyPda.toBase58(),
    escrowPda: escrowPda.toBase58(),
  };
}
