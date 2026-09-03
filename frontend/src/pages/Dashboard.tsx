import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import OkaformLogo from "@/components/OkaformLogo";
import {
  Home,
  FileText,
  PlusCircle,
  BarChart3,
  Settings,
  Wallet,
  ArrowLeft,
  Search,
  ChevronDown,
  AlertTriangle,
  X,
  CheckCircle2,
  Eye,
  XCircle,
  Loader2,
  Server,
  Activity,
  Database,
  Gift,
  Menu,
  FileEdit,
  LogOut,
  Flag,
  ShieldCheck,
} from "lucide-react";

import { Button, Badge, StatusPill, SOLAmount } from "@/components/okaform";
import type { StatusType } from "@/components/okaform";
import { buttonVariants, getBadgeTier } from "@/lib/tiers";
import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import solanaLogo from "@/assets/icons/solana-logo.svg";
import HomeView from "@/components/Dashboard/HomeView";
import {
  responsesQueryKey,
  distributionQueryKey,
} from "@/hooks/useRecentActivity";
import AnalyticsView from "@/components/Dashboard/AnalyticsView";
import SettingsView from "@/components/Dashboard/SettingsView";
import DraftsView from "@/components/Dashboard/DraftsView";
import DistributionTab from "@/components/DistributionTab";
import SurveySettingsTab from "@/components/Dashboard/SurveySettingsTab";
import { useSurveyLifecycle } from "@/hooks/useSurveyLifecycle";
import {
  getForms,
  getSubmissions,
  getFormById,
  moderateResponse,
} from "@/lib/forms";
import type {
  SubmissionItem,
  FormDetailQuestion,
  ModerationStatusValue,
  ModerationReasonValue,
} from "@/lib/forms";

/* ──────────────────────────────────────────────────────────────────────────────
   Creator dashboard — technical/infrastructure aesthetic.
   Left sidebar (240px fixed) + main content area.
   ────────────────────────────────────────────────────────────────────────────── */

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabId = "responses" | "analytics" | "distribution" | "settings";
type View = "surveys" | "detail";

interface Survey {
  id: string;
  title: string;
  description: string;
  status: StatusType;
  responses: number;
  maxResponses: number;
  rewardPool: number;
  rewardType: "weighted" | "lucky_draw";
  createdAt: string;
  rewardDistributed: boolean;
  creator: string;
  grossRewardPoolLamports: number;
  netRewardPoolLamports: number;
  feeLamports: number;
  feeBps: number;
  minWalletAge: number;
  minSolBalance: number;
  surveyPda: string | null;
  escrowPda: string | null;
  closedAt: string | null;
  rewardCurrency?: string;
  tokenMint?: string;
  tokenDecimals?: number;
  grossRewardPoolUnits?: number;
  netRewardPoolUnits?: number;
  feeUnits?: number;
}

const SIDEBAR_NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "surveys", label: "My Surveys", icon: FileText },
  { id: "drafts", label: "Drafts", icon: FileEdit },
  { id: "create", label: "Create Survey", icon: PlusCircle },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

// ─── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  activeNav,
  onNavChange,
  open,
  onToggle,
}: {
  activeNav: string;
  onNavChange: (id: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { connected, publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { user, isAuthenticated, isLoading, login } = useAuth();
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const wallet = publicKey?.toBase58();
  const score = user?.globalScore ?? 0;
  const tier = getBadgeTier(score);

  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    void connection.getBalance(publicKey).then((lamports) => {
      if (!cancelled) setBalance(lamports);
    });
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey, connection]);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (wallet) {
      navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-[#3D444D] bg-[#0D1117] transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Logo + close */}
      <div className="flex h-16 items-center justify-between border-b border-[#3D444D]/50 px-4">
        <Link to="/" className="no-underline">
          <OkaformLogo height={48} />
        </Link>
        <button
          onClick={onToggle}
          className="rounded p-1 text-[#656C76] hover:text-[#F0F6F6] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1.5 px-4 py-6">
        {SIDEBAR_NAV.map((item) => {
          if (item.id === "create") {
            return (
              <Link
                key={item.id}
                to="/create"
                className="group flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium text-[#656C76] transition-all duration-200 hover:bg-[#151B23]/50 hover:text-[#F0F6F6] hover:shadow-[inset_2px_0_0_0_var(--color-ok-border)]"
              >
                <item.icon className="h-4 w-4 text-[#656C76] transition-colors group-hover:text-[#9198A1]" />
                {item.label}
              </Link>
            );
          }

          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-ok-green/10 text-ok-green shadow-[inset_2px_0_0_0_var(--color-ok-green)]"
                  : "text-[#656C76] hover:bg-[#151B23]/50 hover:text-[#F0F6F6] hover:shadow-[inset_2px_0_0_0_var(--color-ok-border)]",
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active
                    ? "text-ok-green"
                    : "text-[#656C76] group-hover:text-[#9198A1]",
                )}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* External Navigation */}
      <div className="border-t border-[#3D444D]/50 px-4 py-3">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[#656C76]">
          Navigation
        </p>
        <div className="space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 rounded px-3 py-1.5 font-mono text-[11px] text-[#656C76] transition-colors hover:bg-[#151B23]/50 hover:text-[#F0F6F6]"
          >
            <Home className="h-3 w-3" />
            Site Home
          </Link>
          <Link
            to="/explore"
            className="flex items-center gap-2 rounded px-3 py-1.5 font-mono text-[11px] text-[#656C76] transition-colors hover:bg-[#151B23]/50 hover:text-[#F0F6F6]"
          >
            <Search className="h-3 w-3" />
            Explore Surveys
          </Link>
          <Link
            to="/pricing"
            className="flex items-center gap-2 rounded px-3 py-1.5 font-mono text-[11px] text-[#656C76] transition-colors hover:bg-[#151B23]/50 hover:text-[#F0F6F6]"
          >
            <BarChart3 className="h-3 w-3" />
            Pricing
          </Link>
        </div>
      </div>

      {/* Wallet / Reputation */}
      <div className="border-t border-[#3D444D]/50 p-4">
        {!connected ? (
          <button
            onClick={() => setVisible(true)}
            className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-[#3D444D] bg-[#151B23]/20 px-3 py-2.5 text-sm font-medium text-[#9198A1] transition-colors hover:border-ok-green/40 hover:text-ok-green"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </button>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded border border-[#3D444D] bg-[#151B23]/20 px-3 py-2.5 text-xs text-[#9198A1]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Signing in...
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col gap-2 rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-3">
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-2 cursor-pointer transition-colors hover:text-ok-green"
              title="Click to copy"
            >
              <Wallet className="h-4 w-4 text-[#9198A1]" />
              <span className="truncate font-mono text-xs font-medium text-[#F0F6F6]">
                {copied ? "Copied!" : truncateAddress(wallet ?? "")}
              </span>
            </button>
            <button
              onClick={() => login()}
              className="mt-1 w-full rounded bg-ok-green/10 px-2 py-1.5 text-xs font-medium text-ok-green transition-colors hover:bg-ok-green/20"
            >
              Sign In with Solana
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-3 transition-colors hover:border-[#3D444D]">
            <div className="flex items-center justify-between">
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-2 cursor-pointer transition-colors hover:text-ok-green"
                title="Click to copy"
              >
                <Wallet className="h-4 w-4 text-[#9198A1]" />
                <span className="truncate font-mono text-xs font-medium text-[#F0F6F6]">
                  {copied
                    ? "Copied!"
                    : (user?.username ?? truncateAddress(wallet ?? ""))}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  disconnect();
                }}
                className="rounded px-1.5 py-0.5 transition-colors hover:bg-ok-danger/10 hover:text-ok-danger"
                title="Disconnect"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center justify-between border-t border-[#3D444D]/30 pt-2">
              <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
                Reputation
              </span>
              <Badge tier={tier} className="scale-90 origin-right" />
            </div>
            {balance !== null && (
              <div className="flex items-center justify-between border-t border-[#3D444D]/30 pt-2">
                <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
                  Balance
                </span>
                <span className="flex items-center gap-1 text-xs text-ok-text">
                  <img src={solanaLogo} alt="SOL" className="h-3 w-auto" />
                  <span className="font-mono">
                    {(balance / 1_000_000_000).toFixed(2)}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Stats row ─────────────────────────────────────────────────────────────────

function StatsRow({
  totalResponses,
  totalMaxResponses,
  totalSolDistributed,
  lifetimeSurveys,
}: {
  totalResponses: number;
  totalMaxResponses: number;
  lifetimeSurveys: number;
  totalSolDistributed: number;
}) {
  const totalPercent =
    totalMaxResponses > 0
      ? Math.round((totalResponses / totalMaxResponses) * 100)
      : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Hero Stat: The Pulse (Spans 2 columns) */}
      <div className="relative overflow-hidden rounded border border-[#3D444D] bg-[#151B23]/40 p-6 lg:col-span-2">
        {/* Decorative corner */}
        <div
          className="absolute right-0 top-0 h-12 w-12 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(225deg, transparent 50%, #14F195 50%)",
          }}
        />

        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok-green opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ok-green"></span>
              </span>
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-ok-green">
                SYS // LIVE
              </span>
            </div>
            <p className="mt-4 font-mono text-xs text-[#656C76] uppercase tracking-wider">
              Active Responses
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <p className="font-mono text-4xl font-bold tracking-tight text-[#F0F6F6]">
                {totalResponses}
              </p>
              {totalMaxResponses > 0 && (
                <p className="font-mono text-sm text-[#656C76]">
                  / {totalMaxResponses} cap
                </p>
              )}
            </div>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded border border-ok-green/20 bg-ok-green/10">
            <Activity className="h-4 w-4 text-ok-green" />
          </div>
        </div>

        {/* Progress */}
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[#3D444D]">
          <div
            className="h-full rounded-full bg-ok-green shadow-[0_0_10px_rgba(20,241,149,0.5)]"
            style={{ width: `${totalPercent}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
          <span>Data Vectors Ingested</span>
          <span className="text-ok-green">{totalPercent}%</span>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="flex flex-col gap-4">
        <div className="relative flex-1 overflow-hidden rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-4">
          <div
            className="absolute right-0 top-0 h-8 w-8 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(225deg, transparent 50%, #A371F7 50%)",
            }}
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              Total SOL Distributed
            </span>
            <Database className="h-3.5 w-3.5 text-[#656C76]" />
          </div>
          <SOLAmount
            amount={totalSolDistributed}
            unit="sol"
            className="mt-2 font-mono text-2xl font-semibold text-[#F0F6F6]"
          />
        </div>

        <div className="relative flex-1 overflow-hidden rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-4">
          <div
            className="absolute right-0 top-0 h-8 w-8 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(225deg, transparent 50%, #14F195 50%)",
            }}
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              Lifetime Surveys
            </span>
            <Server className="h-3.5 w-3.5 text-[#656C76]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F0F6F6]">
            {lifetimeSurveys}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Surveys table ─────────────────────────────────────────────────────────────

function SurveysTable({
  surveys,
  onSelect,
  onCloseRequest,
  onDistributeRequest,
  isDistributing,
}: {
  surveys: Survey[];
  onSelect: (id: string) => void;
  onCloseRequest: (id: string) => void;
  onDistributeRequest: (id: string) => void;
  isDistributing: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded border border-[#3D444D]/80 bg-[#151B23]/20">
      {/* Decorative corner */}
      <div
        className="absolute right-0 top-0 h-12 w-12 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(225deg, transparent 50%, #3D444D 50%)",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3D444D] px-5 py-4">
        <h2 className="font-mono text-sm text-[#F0F6F6] flex items-center gap-2">
          <FileText className="h-4 w-4 text-ok-green" />[ My Surveys ]
        </h2>
        <Link
          to="/create"
          className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Create Survey
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {surveys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-[#656C76]/30 mb-4" />
            <p className="font-mono text-sm text-[#9198A1]">No surveys yet</p>
            <p className="mt-1 text-xs text-[#656C76]">
              Create your first survey to get started
            </p>
            <Link to="/create" className="mt-4">
              <Button variant="primary" size="sm">
                <PlusCircle className="h-3.5 w-3.5" />
                Create Survey
              </Button>
            </Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#3D444D] bg-[#151B23]/50 text-[10px] text-[#656C76] uppercase tracking-wider">
                <th className="px-5 py-4 font-medium">Title</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Responses</th>
                <th className="px-5 py-4 font-medium">Reward Pool</th>
                <th className="px-5 py-4 font-medium">Type</th>
                <th className="px-5 py-4 font-medium">Created</th>
                <th className="px-5 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3D444D]/40">
              {surveys.map((survey) => (
                <tr
                  key={survey.id}
                  className="group transition-all duration-200 hover:bg-[#151B23]/40 hover:shadow-[inset_2px_0_0_0_var(--color-ok-green)]"
                >
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-medium text-[#F0F6F6]">
                    {survey.title}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill status={survey.status} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-[#9198A1]">
                    <span className="text-[#F0F6F6]">{survey.responses}</span> /{" "}
                    {survey.maxResponses}
                  </td>
                  <td className="px-5 py-4">
                    <SOLAmount
                      amount={survey.rewardPool}
                      unit="sol"
                      className="text-xs font-mono"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider",
                        survey.rewardType === "weighted"
                          ? "border-ok-green/25 bg-ok-green/10 text-ok-green"
                          : "border-ok-purple/25 bg-ok-purple/10 text-ok-purple",
                      )}
                    >
                      {survey.rewardType === "weighted"
                        ? "Weighted"
                        : "Lucky Draw"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-[10px] text-[#656C76]">
                    {survey.createdAt}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 opacity-80 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => onSelect(survey.id)}
                        className="inline-flex items-center gap-1.5 rounded border border-[#3D444D] bg-[#0D1117]/60 px-2.5 py-1.5 font-mono text-[10px] font-medium text-[#9198A1] transition-colors hover:border-ok-green/40 hover:text-[#F0F6F6]"
                      >
                        <Eye className="h-3 w-3" />
                        {survey.status === "active" ? "View" : "Results"}
                      </button>
                      {survey.status === "active" &&
                        !survey.rewardDistributed && (
                          <button
                            onClick={() => onCloseRequest(survey.id)}
                            className="inline-flex items-center gap-1.5 rounded border border-ok-danger/20 bg-ok-danger/5 px-2.5 py-1.5 font-mono text-[10px] font-medium text-ok-danger transition-colors hover:bg-ok-danger/15 hover:border-ok-danger/30"
                          >
                            <XCircle className="h-3 w-3" />
                            Close
                          </button>
                        )}
                      {!survey.rewardDistributed && (
                        <button
                          onClick={() => onDistributeRequest(survey.id)}
                          disabled={isDistributing}
                          className="inline-flex items-center gap-1.5 rounded border border-ok-green/20 bg-ok-green/5 px-2.5 py-1.5 font-mono text-[10px] font-medium text-ok-green transition-colors hover:bg-ok-green/15 hover:border-ok-green/30 disabled:opacity-50"
                        >
                          {isDistributing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Gift className="h-3 w-3" />
                          )}
                          Distribute
                        </button>
                      )}
                      {survey.rewardDistributed && (
                        <span className="inline-flex items-center gap-1.5 rounded border border-[#3D444D]/50 bg-[#151B23]/30 px-2.5 py-1.5 font-mono text-[10px] text-[#656C76]">
                          <CheckCircle2 className="h-3 w-3 text-ok-green/60" />
                          Distributed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Responses tab ─────────────────────────────────────────────────────────────

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="min-w-0 flex-1 truncate text-left font-mono text-xs text-[#9198A1] cursor-pointer transition-colors hover:text-[#F0F6F6]"
      title="Click to copy"
    >
      {copied ? "Copied!" : truncateAddress(address)}
    </button>
  );
}

const MODERATION_META: Record<
  ModerationStatusValue,
  { label: string; className: string }
> = {
  clean: {
    label: "Clean",
    className: "border-ok-green/25 bg-ok-green/10 text-ok-green",
  },
  flagged: {
    label: "Flagged",
    className: "border-ok-warning/25 bg-ok-warning/10 text-ok-warning",
  },
  rejected: {
    label: "Rejected",
    className: "border-ok-danger/25 bg-ok-danger/10 text-ok-danger",
  },
};

const MODERATION_REASONS: ModerationReasonValue[] = [
  "spam",
  "bot",
  "duplicate",
  "low_quality",
  "other",
];

const REASON_LABELS: Record<ModerationReasonValue, string> = {
  spam: "Spam",
  bot: "Bot",
  duplicate: "Duplicate",
  low_quality: "Low quality",
  other: "Other",
};

function ModerationPill({ status }: { status: ModerationStatusValue }) {
  const meta = MODERATION_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider",
        meta.className,
      )}
    >
      {status === "flagged" && <Flag className="h-2.5 w-2.5" />}
      {status === "rejected" && <XCircle className="h-2.5 w-2.5" />}
      {status === "clean" && <CheckCircle2 className="h-2.5 w-2.5" />}
      {meta.label}
    </span>
  );
}

function ResponsesTab({
  formId,
  canModerate,
}: {
  formId: string;
  canModerate: boolean;
}) {
  const [responses, setResponses] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [badgeFilter, setBadgeFilter] = useState<string>("all");
  const [modFilter, setModFilter] = useState<"all" | ModerationStatusValue>(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResponse, setSelectedResponse] =
    useState<SubmissionItem | null>(null);
  const [questions, setQuestions] = useState<FormDetailQuestion[]>([]);
  const [modTarget, setModTarget] = useState<{
    response: SubmissionItem;
    status: ModerationStatusValue;
  } | null>(null);
  const [modReason, setModReason] = useState<ModerationReasonValue>("spam");
  const [modNote, setModNote] = useState("");
  const [modSubmitting, setModSubmitting] = useState(false);
  const [modError, setModError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const fetchResponses = useCallback(
    (status?: "all" | ModerationStatusValue) => {
      let cancelled = false;
      setLoading(true);
      Promise.all([getSubmissions(formId, status), getFormById(formId)])
        .then(([subs, form]) => {
          if (!cancelled) {
            setResponses(subs);
            setQuestions(form.questions);
          }
        })
        .catch(() => {
          if (!cancelled) setResponses([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [formId],
  );

  useEffect(() => fetchResponses(modFilter), [fetchResponses, modFilter]);

  const filtered = useMemo(() => {
    let rows = responses;
    if (modFilter !== "all") {
      rows = rows.filter((r) => r.moderationStatus === modFilter);
    }
    if (badgeFilter !== "all") {
      rows = rows.filter(
        (r) => getBadgeTier(r.scoreAtSubmission) === badgeFilter,
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => r.respondentWallet.toLowerCase().includes(q));
    }
    return rows;
  }, [responses, badgeFilter, modFilter, searchQuery]);

  const summary = useMemo(() => {
    let clean = 0;
    let flagged = 0;
    let rejected = 0;
    for (const r of responses) {
      if (r.moderationStatus === "flagged") flagged += 1;
      else if (r.moderationStatus === "rejected") rejected += 1;
      else clean += 1;
    }
    return { clean, flagged, rejected, total: responses.length };
  }, [responses]);

  const handleModerate = async () => {
    if (!modTarget) return;
    setModSubmitting(true);
    setModError(null);
    try {
      await moderateResponse(formId, modTarget.response.id, {
        status: modTarget.status,
        reason: modTarget.status === "clean" ? undefined : modReason,
        note: modTarget.status === "clean" ? undefined : modNote || undefined,
      });
      const updated: SubmissionItem = {
        ...modTarget.response,
        moderationStatus: modTarget.status,
        moderationReason: modTarget.status === "clean" ? null : modReason,
        moderationNote: modTarget.status === "clean" ? null : modNote || null,
      };
      setResponses((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      setSelectedResponse((prev) =>
        prev && prev.id === updated.id ? updated : prev,
      );
      setModTarget(null);
      setModNote("");
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    } catch (err) {
      setModError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setModSubmitting(false);
    }
  };

  const openModeration = (
    response: SubmissionItem,
    status: ModerationStatusValue,
  ) => {
    setModReason(response.moderationReason ?? "spam");
    setModNote(response.moderationNote ?? "");
    setModError(null);
    setModTarget({ response, status });
  };

  const moderationModal = modTarget && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !modSubmitting && setModTarget(null)}
      />
      <div className="relative w-full max-w-md rounded border border-[#3D444D] bg-[#151B23] p-6 shadow-2xl">
        <button
          onClick={() => !modSubmitting && setModTarget(null)}
          className="absolute right-4 top-4 text-[#9198A1] hover:text-[#F0F6F6]"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          className={cn(
            "mb-6 flex h-10 w-10 items-center justify-center rounded border",
            modTarget.status === "clean"
              ? "border-ok-green/25 bg-ok-green/10"
              : modTarget.status === "flagged"
                ? "border-ok-warning/25 bg-ok-warning/10"
                : "border-ok-danger/25 bg-ok-danger/10",
          )}
        >
          {modTarget.status === "clean" ? (
            <ShieldCheck className="h-4 w-4 text-ok-green" />
          ) : modTarget.status === "flagged" ? (
            <Flag className="h-4 w-4 text-ok-warning" />
          ) : (
            <XCircle className="h-4 w-4 text-ok-danger" />
          )}
        </div>

        <h3 className="mb-2 font-mono text-sm font-medium text-[#F0F6F6]">
          {modTarget.status === "clean"
            ? "Approve response?"
            : modTarget.status === "flagged"
              ? "Flag this response?"
              : "Reject this response?"}
        </h3>
        <p className="mb-6 text-xs leading-relaxed text-[#9198A1]">
          {modTarget.status === "rejected"
            ? "Rejecting applies an on-chain reputation penalty and excludes this response from reward distribution."
            : modTarget.status === "flagged"
              ? "Flagging marks this response for review. Flagged responses are excluded from reward distribution."
              : "Approving clears any previous moderation flag or penalty on this response."}
        </p>

        {modTarget.status !== "clean" && (
          <>
            <label className="mb-1.5 block font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              Reason
            </label>
            <select
              value={modReason}
              onChange={(e) =>
                setModReason(e.target.value as ModerationReasonValue)
              }
              className="mb-4 w-full rounded border border-[#3D444D] bg-[#0D1117]/60 px-3 py-2 font-mono text-xs text-[#F0F6F6] focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
            >
              {MODERATION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {REASON_LABELS[reason]}
                </option>
              ))}
            </select>

            <label className="mb-1.5 block font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              Note (optional)
            </label>
            <textarea
              value={modNote}
              onChange={(e) => setModNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add context for this decision..."
              className="mb-6 w-full resize-none rounded border border-[#3D444D] bg-[#0D1117]/60 px-3 py-2 font-mono text-xs text-[#F0F6F6] placeholder:text-[#656C76]/40 focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
            />
          </>
        )}

        {modError && (
          <div className="mb-4 rounded border border-ok-danger/30 bg-ok-danger/5 px-3 py-2 text-xs text-ok-danger">
            {modError}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={() => setModTarget(null)}
            disabled={modSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant={
              modTarget.status === "rejected"
                ? "danger"
                : modTarget.status === "flagged"
                  ? "secondary"
                  : "primary"
            }
            size="md"
            className="flex-1"
            onClick={handleModerate}
            disabled={modSubmitting}
          >
            {modSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Confirm"
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading && responses.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[#656C76]" />
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Database className="h-8 w-8 text-[#656C76]/30" />
        <p className="font-mono text-xs text-[#9198A1]">No responses yet.</p>
      </div>
    );
  }

  const relativeTime = (date: string): string => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (selectedResponse) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedResponse(null)}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#656C76] uppercase tracking-wider transition-colors hover:text-[#F0F6F6]"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to responses
        </button>

        <div className="rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <CopyableAddress address={selectedResponse.respondentWallet} />
            <Badge tier={getBadgeTier(selectedResponse.scoreAtSubmission)} />
            <ModerationPill status={selectedResponse.moderationStatus} />
            <span className="font-mono text-[10px] text-[#656C76]">
              {new Date(selectedResponse.submittedAt).toLocaleString()}
            </span>
          </div>

          {selectedResponse.moderationReason && (
            <div className="mb-4 rounded border border-[#3D444D]/30 bg-[#0D1117]/40 px-3 py-2">
              <p className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
                Moderation reason
              </p>
              <p className="mt-1 font-mono text-xs text-[#F0F6F6]">
                {REASON_LABELS[selectedResponse.moderationReason]}
              </p>
              {selectedResponse.moderationNote && (
                <p className="mt-1 text-xs text-[#9198A1]">
                  {selectedResponse.moderationNote}
                </p>
              )}
            </div>
          )}

          {canModerate && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
                Moderation
              </span>
              <button
                onClick={() => openModeration(selectedResponse, "clean")}
                className="inline-flex items-center gap-1.5 rounded border border-ok-green/25 bg-ok-green/5 px-2.5 py-1 font-mono text-[10px] font-medium text-ok-green transition-colors hover:bg-ok-green/15"
              >
                <ShieldCheck className="h-3 w-3" />
                Approve
              </button>
              <button
                onClick={() => openModeration(selectedResponse, "flagged")}
                className="inline-flex items-center gap-1.5 rounded border border-ok-warning/25 bg-ok-warning/5 px-2.5 py-1 font-mono text-[10px] font-medium text-ok-warning transition-colors hover:bg-ok-warning/15"
              >
                <Flag className="h-3 w-3" />
                Flag
              </button>
              <button
                onClick={() => openModeration(selectedResponse, "rejected")}
                className="inline-flex items-center gap-1.5 rounded border border-ok-danger/25 bg-ok-danger/5 px-2.5 py-1 font-mono text-[10px] font-medium text-ok-danger transition-colors hover:bg-ok-danger/15"
              >
                <XCircle className="h-3 w-3" />
                Reject
              </button>
            </div>
          )}

          <div className="space-y-4">
            {selectedResponse.answers.map((answer, i) => {
              const q = questions[i];
              return (
                <div key={i}>
                  <p className="mb-1 font-mono text-xs font-medium text-[#F0F6F6]">
                    {q?.label ?? `Question ${i + 1}`}
                  </p>
                  <div className="rounded border border-[#3D444D]/30 bg-[#0D1117]/40 px-3 py-2 font-mono text-xs text-[#9198A1]">
                    {typeof answer.value === "string" ||
                    typeof answer.value === "number"
                      ? String(answer.value)
                      : JSON.stringify(answer.value ?? answer)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {moderationModal}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded border border-[#3D444D]/50 bg-[#151B23]/30 px-4 py-3">
        <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
          Moderation
        </span>
        <span className="flex items-center gap-1.5 font-mono text-xs text-ok-green">
          <CheckCircle2 className="h-3 w-3" />
          {summary.clean} clean
        </span>
        <span className="flex items-center gap-1.5 font-mono text-xs text-ok-warning">
          <Flag className="h-3 w-3" />
          {summary.flagged} flagged
        </span>
        <span className="flex items-center gap-1.5 font-mono text-xs text-ok-danger">
          <XCircle className="h-3 w-3" />
          {summary.rejected} rejected
        </span>
        <span className="ml-auto font-mono text-[10px] text-[#656C76]">
          {summary.total} total
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={modFilter}
            onChange={(e) =>
              setModFilter(e.target.value as "all" | ModerationStatusValue)
            }
            className="appearance-none rounded border border-[#3D444D] bg-[#0D1117]/60 px-3 py-2 pr-8 font-mono text-xs text-[#F0F6F6] focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
          >
            <option value="all">All Statuses</option>
            <option value="clean">Clean</option>
            <option value="flagged">Flagged</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9198A1]" />
        </div>

        <div className="relative">
          <select
            value={badgeFilter}
            onChange={(e) => setBadgeFilter(e.target.value)}
            className="appearance-none rounded border border-[#3D444D] bg-[#0D1117]/60 px-3 py-2 pr-8 font-mono text-xs text-[#F0F6F6] focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
          >
            <option value="all">All Badges</option>
            <option value="grey">Ghost</option>
            <option value="blue">Cipher</option>
            <option value="green">Sentinel</option>
            <option value="gold">Oracle</option>
            <option value="diamond">Sovereign</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9198A1]" />
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9198A1]" />
          <input
            type="text"
            placeholder="Search by wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-[#3D444D] bg-[#0D1117]/60 py-2 pl-9 pr-3 font-mono text-xs text-[#F0F6F6] placeholder:text-[#656C76]/40 focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
          />
        </div>
      </div>

      {/* Response rows */}
      <div className="overflow-hidden rounded border border-[#3D444D]/50 bg-[#151B23]/30">
        <div className="divide-y divide-[#3D444D]/40">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[#151B23]/40"
            >
              <CopyableAddress address={r.respondentWallet} />
              <Badge tier={getBadgeTier(r.scoreAtSubmission)} />
              <ModerationPill status={r.moderationStatus} />
              <span className="whitespace-nowrap font-mono text-[10px] text-[#656C76]">
                {relativeTime(r.submittedAt)}
              </span>
              {r.similarityFlag && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-ok-warning">
                  <AlertTriangle className="h-3 w-3" />
                  Sim flag
                </span>
              )}
              <button
                onClick={() => setSelectedResponse(r)}
                className="rounded border border-[#3D444D] bg-[#0D1117]/60 px-2.5 py-1 font-mono text-[9px] font-medium text-[#9198A1] transition-colors hover:border-ok-green/30 hover:text-[#F0F6F6]"
              >
                View
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Moderation modal */}
      {moderationModal}
    </div>
  );
}

// ─── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ formId }: { formId: string }) {
  const [responses, setResponses] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSubmissions(formId)
      .then((data) => {
        if (!cancelled) setResponses(data);
      })
      .catch(() => {
        if (!cancelled) setResponses([]);
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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[#656C76]" />
      </div>
    );
  }

  // Rejected responses are excluded from analytics
  const eligibleResponses = responses.filter(
    (r) => r.moderationStatus !== "rejected",
  );

  const totalResponses = eligibleResponses.length;
  const avgScore =
    totalResponses > 0
      ? Math.round(
          eligibleResponses.reduce((sum, r) => sum + r.scoreAtSubmission, 0) /
            totalResponses,
        )
      : 0;
  const flaggedCount = eligibleResponses.filter((r) => r.similarityFlag).length;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Responses", value: String(totalResponses), icon: Activity },
          { label: "Avg Score", value: String(avgScore), icon: BarChart3 },
          {
            label: "Flagged",
            value: String(flaggedCount),
            icon: AlertTriangle,
          },
          {
            label: "Completion",
            value: totalResponses > 0 ? "100%" : "0%",
            icon: CheckCircle2,
          },
        ].map((m) => (
          <div
            key={m.label}
            className="relative overflow-hidden rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-4"
          >
            <div
              className="absolute right-0 top-0 h-8 w-8 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(225deg, transparent 50%, #14F195 50%)",
              }}
            />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
                {m.label}
              </span>
              <m.icon className="h-3 w-3 text-[#656C76]" />
            </div>
            <p className="mt-2 font-mono text-xl font-semibold text-[#F0F6F6]">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {totalResponses === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Database className="h-8 w-8 text-[#656C76]/30" />
          <p className="font-mono text-xs text-[#9198A1]">
            No analytics data yet.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Close modal ───────────────────────────────────────────────────────────────

function CloseModal({
  survey,
  isClosing,
  onConfirm,
  onCancel,
}: {
  survey: Survey;
  isClosing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded border border-[#3D444D] bg-[#151B23] p-6 shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-[#9198A1] hover:text-[#F0F6F6]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded border border-ok-danger/25 bg-ok-danger/10">
          <AlertTriangle className="h-4 w-4 text-ok-danger" />
        </div>

        <h3 className="mb-2 font-mono text-sm font-medium text-[#F0F6F6]">
          Close this survey?
        </h3>
        <p className="mb-6 text-xs leading-relaxed text-[#9198A1]">
          This will stop accepting responses and trigger automatic reward
          distribution to{" "}
          <span className="font-mono font-medium text-[#F0F6F6]">
            {survey.responses}
          </span>{" "}
          respondents.
        </p>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={onCancel}
            disabled={isClosing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={onConfirm}
            disabled={isClosing}
          >
            {isClosing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Closing...
              </span>
            ) : (
              "Close and Distribute"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Survey detail ─────────────────────────────────────────────────────────────

function SurveyDetail({
  survey,
  onBack,
  distributionRefreshKey,
  onSurveyUpdated,
  onSurveyDeleted,
}: {
  survey: Survey;
  onBack: () => void;
  /** Forwarded to DistributionTab so it re-fetches when a distribution completes. */
  distributionRefreshKey: number;
  onSurveyUpdated: (updated: Survey) => void;
  onSurveyDeleted: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("responses");

  const tabs: { id: TabId; label: string }[] = [
    { id: "responses", label: "Responses" },
    { id: "analytics", label: "Analytics" },
    ...(survey.status === "closed"
      ? [{ id: "distribution" as TabId, label: "Distribution" }]
      : []),
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#656C76] uppercase tracking-wider transition-colors hover:text-[#F0F6F6]"
        >
          <ArrowLeft className="h-3 w-3" />
          My Surveys
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-lg font-medium text-[#F0F6F6]">
            {survey.title}
          </h1>
          <StatusPill status={survey.status} />
          <span className="font-mono text-[10px] text-[#656C76]">
            Created {survey.createdAt}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#3D444D]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 font-mono text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "text-ok-green"
                : "text-[#9198A1] hover:text-[#F0F6F6]",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ok-green" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "responses" && (
        <ResponsesTab
          formId={survey.id}
          canModerate={survey.status === "closed"}
        />
      )}
      {activeTab === "analytics" && <AnalyticsTab formId={survey.id} />}
      {activeTab === "distribution" && (
        <DistributionTab
          formId={survey.id}
          refreshKey={distributionRefreshKey}
        />
      )}
      {activeTab === "settings" && (
        <SurveySettingsTab
          survey={survey}
          onSurveyUpdated={onSurveyUpdated}
          onSurveyDeleted={() => onSurveyDeleted(survey.id)}
        />
      )}
    </div>
  );
}

// ─── Main dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { closeSurvey, distributeRewards } = useSurveyLifecycle();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeNav, setActiveNav] = useState("surveys");
  const [view, setView] = useState<View>("surveys");
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<Survey | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distError, setDistError] = useState<string | null>(null);
  /** Incremented each time a distribution completes — causes DistributionTab to re-fetch. */
  const [distributionRefreshKey, setDistributionRefreshKey] = useState(0);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const forms = await getForms();
        setSurveys(
          forms.map((f) => ({
            id: f.id,
            title: f.title,
            description: f.description,
            status: f.status as StatusType,
            responses: f.responseCount,
            maxResponses: f.maxResponses,
            rewardPool: f.rewardPool,
            rewardType: f.rewardType as "weighted" | "lucky_draw",
            createdAt: f.createdAt,
            rewardDistributed: f.rewardDistributed,
            creator: f.creator,
            grossRewardPoolLamports: f.grossRewardPoolLamports,
            netRewardPoolLamports: f.netRewardPoolLamports,
            feeLamports: f.feeLamports,
            feeBps: f.feeBps,
            minWalletAge: f.minWalletAge,
            minSolBalance: f.minSolBalance,
            surveyPda: f.surveyPda,
            escrowPda: f.escrowPda,
            closedAt: f.closedAt,
            rewardCurrency: f.rewardCurrency,
            tokenMint: f.tokenMint,
            tokenDecimals: f.tokenDecimals,
            grossRewardPoolUnits: f.grossRewardPoolUnits,
            netRewardPoolUnits: f.netRewardPoolUnits,
            feeUnits: f.feeUnits,
          })),
        );
      } catch {
        setSurveys([]);
      } finally {
        setLoading(false);
      }
    };
    fetchForms();
  }, [user?.wallet]);

  const selectedSurvey = useMemo(
    () => surveys.find((s) => s.id === selectedSurveyId) ?? null,
    [surveys, selectedSurveyId],
  );

  const handleNavChange = (id: string) => {
    setActiveNav(id);
    if (id === "surveys") {
      setView("surveys");
      setSelectedSurveyId(null);
    } else if (id === "home") {
      setView("surveys");
      setSelectedSurveyId(null);
    } else if (id === "drafts") {
      setSelectedSurveyId(null);
    }
  };

  const handleSelectSurvey = (id: string) => {
    setSelectedSurveyId(id);
    setView("detail");
  };

  const handleBack = () => {
    setView("surveys");
    setSelectedSurveyId(null);
  };

  const handleConfirmClose = async () => {
    if (!closeTarget) return;
    setIsClosing(true);
    try {
      await closeSurvey(closeTarget.id);
      setSurveys((prev) =>
        prev.map((s) =>
          s.id === closeTarget.id ? { ...s, status: "closed" } : s,
        ),
      );
      queryClient.invalidateQueries({
        queryKey: responsesQueryKey(closeTarget.id),
      });
      queryClient.invalidateQueries({
        queryKey: distributionQueryKey(closeTarget.id),
      });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setCloseTarget(null);
    } catch (err) {
      console.error("Failed to close survey:", err);
    } finally {
      setIsClosing(false);
    }
  };

  const handleDistribute = async (surveyId: string) => {
    setIsDistributing(true);
    setDistError(null);
    try {
      await distributeRewards(surveyId);

      // Update local state and trigger DistributionTab refresh.
      setSurveys((prev) =>
        prev.map((s) =>
          s.id === surveyId ? { ...s, rewardDistributed: true } : s,
        ),
      );
      setDistributionRefreshKey((k) => k + 1);
      queryClient.invalidateQueries({
        queryKey: responsesQueryKey(surveyId),
      });
      queryClient.invalidateQueries({
        queryKey: distributionQueryKey(surveyId),
      });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    } catch (err) {
      setDistError(
        err instanceof Error
          ? err.message
          : "Distribution failed. Please try again.",
      );
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Sidebar toggle when closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-50 rounded border border-[#3D444D] bg-[#0D1117] p-2 text-[#656C76] hover:text-[#F0F6F6] transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <Sidebar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <main
        className={cn(
          "min-h-screen p-6 transition-all duration-200 lg:p-8",
          sidebarOpen ? "ml-[240px]" : "ml-0",
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#656C76]" />
          </div>
        ) : activeNav === "home" ? (
          <HomeView surveys={surveys} onNavChange={handleNavChange} />
        ) : activeNav === "analytics" ? (
          <AnalyticsView onSelectSurvey={handleSelectSurvey} />
        ) : activeNav === "drafts" ? (
          <DraftsView />
        ) : activeNav === "settings" ? (
          <SettingsView />
        ) : view === "surveys" ? (
          <div className="space-y-6">
            <StatsRow
              totalResponses={surveys.reduce((sum, s) => sum + s.responses, 0)}
              totalMaxResponses={surveys.reduce(
                (sum, s) => sum + s.maxResponses,
                0,
              )}
              lifetimeSurveys={surveys.length}
              totalSolDistributed={surveys
                .filter((s) => s.status === "closed")
                .reduce((sum, s) => sum + s.rewardPool, 0)}
            />
            <SurveysTable
              surveys={surveys}
              onSelect={handleSelectSurvey}
              onCloseRequest={(id) => {
                const survey = surveys.find((s) => s.id === id);
                if (survey) setCloseTarget(survey);
              }}
              onDistributeRequest={handleDistribute}
              isDistributing={isDistributing}
            />
            {distError && (
              <div className="flex items-start gap-3 rounded border border-ok-danger/20 bg-ok-danger/5 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-ok-danger" />
                <p className="flex-1 font-mono text-xs text-ok-danger">
                  {distError}
                </p>
                <button
                  onClick={() => setDistError(null)}
                  className="text-ok-danger/60 hover:text-ok-danger transition-colors"
                  aria-label="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          selectedSurvey && (
            <SurveyDetail
              survey={selectedSurvey}
              onBack={handleBack}
              distributionRefreshKey={distributionRefreshKey}
              onSurveyUpdated={(updated) =>
                setSurveys((prev) =>
                  prev.map((s) =>
                    s.id === updated.id ? { ...s, ...updated } : s,
                  ),
                )
              }
              onSurveyDeleted={(id) => {
                setSurveys((prev) => prev.filter((s) => s.id !== id));
                setView("surveys");
                setSelectedSurveyId(null);
              }}
            />
          )
        )}
      </main>

      {/* Close modal */}
      {closeTarget && (
        <CloseModal
          survey={closeTarget}
          isClosing={isClosing}
          onConfirm={handleConfirmClose}
          onCancel={() => !isClosing && setCloseTarget(null)}
        />
      )}
    </div>
  );
}
