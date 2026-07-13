import { CheckCircle2 } from "lucide-react";
import { Badge, getBadgeTier } from "@/components/okaform";

export function EligibilityPass({
  wallet,
  score,
}: {
  wallet: string;
  score: number;
}) {
  const tier = getBadgeTier(score);
  const truncated = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/5 px-4 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-ok-green" />
        <span className="text-sm font-medium text-ok-green">
          Your wallet is eligible to respond
        </span>
        <span className="ml-auto font-mono text-xs text-ok-muted/60">
          {truncated}
        </span>
      </div>

      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-ok-muted">Your reputation:</span>
        <Badge tier={tier} />
        <span className="font-mono text-xs text-ok-muted">
          · Score {score}
        </span>
      </div>
    </div>
  );
}
