import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useAdapterWallet,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

type SolanaCluster = "devnet" | "mainnet-beta" | "testnet";

function resolveEndpoint(): string {
  const envUrl = import.meta.env.VITE_SOLANA_RPC_URL as string | undefined;
  if (envUrl) return envUrl;

  const network = (import.meta.env.VITE_SOLANA_NETWORK as string) || "devnet";
  const valid: SolanaCluster[] = ["devnet", "mainnet-beta", "testnet"];
  return valid.includes(network as SolanaCluster)
    ? clusterApiUrl(network as SolanaCluster)
    : clusterApiUrl("devnet");
}

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  const endpoint = useMemo(resolveEndpoint, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

export function useWallet() {
  return useAdapterWallet();
}
