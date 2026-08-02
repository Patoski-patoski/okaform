import { useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Transaction, type PublicKey } from "@solana/web3.js";
import { useWallet } from "@/hooks/useWallet";
import {
  buildCloseTx,
  confirmClose,
  buildDistributeTx,
  confirmDistribute,
  buildCloseEscrowTx,
  confirmCloseEscrow,
} from "@/lib/forms";
import { WalletNotConnectedError } from "@/lib/errors";
import { logger } from "@/lib/logger";

function deserializeTx(base64: string): Transaction {
  return Transaction.from(
    Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
  );
}

function requireSigner(
  publicKey: PublicKey | null,
  signTransaction:
    | ((transaction: Transaction) => Promise<Transaction>)
    | undefined,
): {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
} {
  if (!publicKey || !signTransaction) {
    throw new WalletNotConnectedError();
  }
  return { publicKey, signTransaction };
}

export interface SurveyLifecycleApi {
  /** Build + sign + send the close transaction, then confirm it server-side. */
  closeSurvey: (formId: string) => Promise<void>;
  /**
   * Build + sign + send every distribution batch, then confirm server-side.
   * After all batches land, best-effort close of the escrow rent buffer.
   */
  distributeRewards: (formId: string) => Promise<void>;
  /** Close the survey, then distribute rewards to respondents. */
  closeAndDistribute: (formId: string) => Promise<void>;
}

/**
 * Shared survey lifecycle actions used by the dashboard close modal, the
 * distribution flow, and the survey settings tab. Each action throws on
 * failure so callers can surface their own error handling.
 */
export function useSurveyLifecycle(): SurveyLifecycleApi {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const closeSurvey = useCallback(
    async (formId: string) => {
      const { publicKey: payer, signTransaction: signer } = requireSigner(
        publicKey,
        signTransaction,
      );

      const { blockhash } = await connection.getLatestBlockhash();
      const { tx: txBase64 } = await buildCloseTx(formId, blockhash);

      const tx = deserializeTx(txBase64);
      tx.feePayer = payer;
      tx.recentBlockhash = blockhash;

      const signed = await signer(tx);
      await connection.sendRawTransaction(signed.serialize());

      await confirmClose(formId);
    },
    [connection, publicKey, signTransaction],
  );

  const distributeRewards = useCallback(
    async (formId: string) => {
      const { publicKey: payer, signTransaction: signer } = requireSigner(
        publicKey,
        signTransaction,
      );

      const { blockhash } = await connection.getLatestBlockhash();
      const result = await buildDistributeTx(formId, blockhash);

      if (!result.recovered) {
        for (let i = 0; i < result.txs.length; i++) {
          const batchTxBase64 = result.txs[i];
          const batchWallets = result.participantWallets[i];
          const batchAmounts = result.amounts[i];

          if (!batchTxBase64 || !batchWallets || !batchAmounts) continue;

          // Fetch a fresh blockhash per batch so long runs don't hit expiry.
          const { blockhash: freshBlockhash } =
            await connection.getLatestBlockhash();

          const tx = deserializeTx(batchTxBase64);
          tx.feePayer = payer;
          tx.recentBlockhash = freshBlockhash;

          const signed = await signer(tx);
          const txSignature = await connection.sendRawTransaction(
            signed.serialize(),
          );

          await connection.confirmTransaction(txSignature, "confirmed");

          await confirmDistribute(
            formId,
            batchWallets,
            batchAmounts,
            txSignature,
            result.badgeTiers,
            i === result.txs.length - 1,
          );
        }
      }

      // All batches confirmed — sweep the escrow rent buffer back to the creator
      // and close the escrow PDA so it gets reaped on-chain.
      try {
        const { blockhash: escrowBlockhash } =
          await connection.getLatestBlockhash();

        const { tx: escrowTxBase64 } = await buildCloseEscrowTx(
          formId,
          escrowBlockhash,
        );

        const escrowTx = deserializeTx(escrowTxBase64);
        escrowTx.feePayer = payer;
        escrowTx.recentBlockhash = escrowBlockhash;

        const signedEscrowTx = await signer(escrowTx);
        const escrowTxSignature = await connection.sendRawTransaction(
          signedEscrowTx.serialize(),
        );
        await connection.confirmTransaction(escrowTxSignature, "confirmed");

        await confirmCloseEscrow(formId, escrowTxSignature);
      } catch (err) {
        // Distribution succeeded — escrow close is non-critical cleanup, but
        // log it so stuck escrow rent buffers can be swept later.
        logger.error("Failed to close escrow:", err);
      }
    },
    [connection, publicKey, signTransaction],
  );

  const closeAndDistribute = useCallback(
    async (formId: string) => {
      await closeSurvey(formId);
      await distributeRewards(formId);
    },
    [closeSurvey, distributeRewards],
  );

  return { closeSurvey, distributeRewards, closeAndDistribute };
}
