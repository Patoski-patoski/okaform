import { useWallet as useAdapterWallet } from "@solana/wallet-adapter-react";

export function useWallet() {
  return useAdapterWallet();
}
