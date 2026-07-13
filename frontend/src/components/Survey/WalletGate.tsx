import { Lock, Wallet } from "lucide-react";
import { Button, Card } from "@/components/okaform";

export function WalletGate({ onConnect }: { onConnect: () => void }) {
  return (
    <Card padding="lg">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ok-border bg-ok-bg">
          <Lock className="h-6 w-6 text-ok-muted" />
        </div>

        <div>
          <h3 className="mb-1 font-display text-lg font-semibold text-ok-text">
            Connect your wallet to check eligibility
          </h3>
          <p className="text-sm text-ok-muted">
            This survey requires a connected Solana wallet.
          </p>
        </div>

        <Button variant="primary" size="lg" onClick={onConnect}>
          <Wallet className="h-4 w-4" />
          Connect Phantom Wallet
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] text-ok-muted/60">Requires:</span>
          {["Wallet age > 30 days", "Min 1 SOL balance"].map((req) => (
            <span
              key={req}
              className="inline-flex items-center rounded-full border border-ok-border bg-ok-bg px-2.5 py-0.5 text-[11px] text-ok-muted/70"
            >
              {req}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
