import { useState, useEffect } from "react";
import { getFormDistribution } from "@/lib/distribution";
import type { DistributionRecord } from "@/types/distribution";
import {
  CheckCircle2,
  Download,
  Copy,
  ExternalLink,
  Inbox,
  Loader2,
  Check,
} from "lucide-react";
import { Badge } from "@/components/okaform";

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}${days === 1 ? " day ago" : " days ago"}`;
  if (hours > 0) return `${hours}${hours === 1 ? " hour ago" : " hours ago"}`;
  return `${mins}${mins === 1 ? " minute ago" : " minutes ago"}`;
}

function exportCSV(records: DistributionRecord[], formId: string) {
  const headers = [
    "Wallet",
    "Badge",
    "Amount (SOL)",
    "Tx Signature",
    "Explorer URL",
    "Distributed At",
  ];
  const rows = records.map((r) => [
    r.recipientWallet,
    r.badgeTier,
    (r.amountLamports / 1e9).toFixed(6),
    r.txSignature,
    r.explorerUrl,
    new Date(r.distributedAt).toISOString(),
  ]);
  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `okaform-distribution-${formId}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CopyableWallet({ wallet }: { wallet: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-ok-muted">
      {wallet.slice(0, 4)}...{wallet.slice(-4)}
      <button
        onClick={handleCopy}
        className="text-ok-dim hover:text-ok-text transition-colors"
        title="Copy wallet address"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-ok-border/30">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-24 animate-pulse rounded bg-ok-surface/40" />
        </td>
      ))}
    </tr>
  );
}

interface DistributionTabProps {
  formId: string;
}

export default function DistributionTab({ formId }: DistributionTabProps) {
  const [records, setRecords] = useState<DistributionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getFormDistribution(formId)
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load distribution records");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ok-dim" />
        </div>
        <table className="w-full">
          <thead className="bg-ok-surface font-mono text-[10px] uppercase tracking-wider text-ok-dim border-b border-ok-border">
            <tr>
              {["Recipient Wallet", "Badge", "Amount", "Tx Signature", "Time"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-ok-danger/20 bg-ok-danger/5 px-4 py-3">
        <p className="font-mono text-xs text-ok-danger">{error}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Inbox className="h-8 w-8 text-ok-dim/30" />
        <p className="mt-3 font-mono text-xs text-ok-muted">
          No distribution records yet
        </p>
        <p className="mt-1 text-xs text-ok-dim">
          Distribution records appear here once the survey is closed and rewards
          have been sent.
        </p>
      </div>
    );
  }

  const totalSol =
    records.reduce((sum, r) => sum + r.amountLamports, 0) / 1e9;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded border border-ok-green/20 bg-ok-green/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-ok-green" />
          <span className="font-mono text-xs font-semibold text-ok-green">
            DISTRIBUTION COMPLETE
          </span>
        </div>
        <span className="font-mono text-sm font-bold text-ok-green">
          ◎ {totalSol.toFixed(4)} SOL distributed to {records.length} wallet
          {records.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => exportCSV(records, formId)}
          className="inline-flex items-center gap-1.5 rounded border border-ok-border/30 bg-transparent px-3 py-1.5 font-mono text-[10px] text-ok-dim hover:text-ok-text transition-colors"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </div>

      <table className="w-full">
        <thead className="bg-ok-surface font-mono text-[10px] uppercase tracking-wider text-ok-dim border-b border-ok-border">
          <tr>
            {["Recipient Wallet", "Badge", "Amount", "Tx Signature", "Time"].map(
              (h) => (
                <th key={h} className="px-4 py-2.5 text-left font-medium">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.txSignature + record.recipientWallet}
              className="border-b border-ok-border/30 hover:bg-ok-surface/30"
            >
              <td className="px-4 py-3">
                <CopyableWallet wallet={record.recipientWallet} />
              </td>
              <td className="px-4 py-3">
                <Badge tier={record.badgeTier.toLowerCase() as "grey" | "blue" | "green" | "gold" | "diamond"} />
              </td>
              <td className="px-4 py-3 font-mono text-xs font-bold text-ok-green">
                ◎ {(record.amountLamports / 1e9).toFixed(4)}
              </td>
              <td className="px-4 py-3">
                <a
                  href={record.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-ok-muted hover:text-ok-green transition-colors"
                >
                  {record.txSignature.slice(0, 8)}...
                  {record.txSignature.slice(-4)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </td>
              <td className="px-4 py-3 font-mono text-[10px] text-ok-dim">
                {formatRelativeTime(new Date(record.distributedAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
