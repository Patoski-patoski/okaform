import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Link2,
  Home,
  FileText,
  PlusCircle,
  BarChart3,
  Settings,
  Wallet,
  ArrowLeft,
  Search,
  ChevronDown,
  ExternalLink,
  Download,
  AlertTriangle,
  X,
  CheckCircle2,
  Eye,
  XCircle,
  Loader2,
} from "lucide-react";

import {
  Button,
  Card,
  Badge,
  StatusPill,
  SOLAmount,
  truncateAddress,
  getBadgeTier,
} from "@/components/okaform";
import type { BadgeTier, StatusType } from "@/components/okaform";
import { buttonVariants } from "@/components/okaform";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { useWallet } from "@/components/WalletProvider";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

/* ──────────────────────────────────────────────────────────────────────────────
   Creator dashboard — single component, two-panel layout.
   Left sidebar (240px fixed) + main content area.
   ────────────────────────────────────────────────────────────────────────────── */

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabId = "responses" | "analytics" | "distribution" | "settings";
type View = "surveys" | "detail";

interface Survey {
  id: string;
  title: string;
  status: StatusType;
  responses: number;
  maxResponses: number;
  rewardPool: number;
  rewardType: "weighted" | "lottery";
  createdAt: string;
}

interface SurveyResponse {
  id: string;
  wallet: string;
  tier: BadgeTier;
  submittedAt: string;
  flagged: boolean;
  score: number;
}

interface DistributionRow {
  wallet: string;
  tier: BadgeTier;
  amount: number;
  txSignature: string;
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const SURVEYS: Survey[] = [
  {
    id: "s1",
    title: "Jupiter Community Pulse",
    status: "active",
    responses: 234,
    maxResponses: 500,
    rewardPool: 50,
    rewardType: "weighted",
    createdAt: "2 days ago",
  },
  {
    id: "s2",
    title: "Tensor Trader Feedback",
    status: "closed",
    responses: 500,
    maxResponses: 500,
    rewardPool: 30,
    rewardType: "lottery",
    createdAt: "5 days ago",
  },
  {
    id: "s3",
    title: "Drift Protocol UX Survey",
    status: "closed",
    responses: 312,
    maxResponses: 400,
    rewardPool: 45.5,
    rewardType: "weighted",
    createdAt: "12 days ago",
  },
];

const MOCK_RESPONSES: SurveyResponse[] = [
  { id: "r1", wallet: "7xKpT9mQr3nBv2Ys8kLw4jF6hD1cX5eZ", tier: "diamond", submittedAt: "2 hours ago", flagged: false, score: 112 },
  { id: "r2", wallet: "9Yn2Bv8kLw4jF6hD1cX5eZ7xKpT9mQr3", tier: "gold", submittedAt: "3 hours ago", flagged: false, score: 88 },
  { id: "r3", wallet: "4Vb1Nf6xNf8kLw4jF6hD1cX5eZ7xKp", tier: "green", submittedAt: "5 hours ago", flagged: false, score: 64 },
  { id: "r4", wallet: "2Xc5Hd3mQr7xKpT9nBv8kLw4jF6hD1c", tier: "blue", submittedAt: "6 hours ago", flagged: true, score: 31 },
  { id: "r5", wallet: "8Kw4Jf6hD1cX5eZ7xKpT9mQr3nBv2Ys", tier: "grey", submittedAt: "8 hours ago", flagged: false, score: 12 },
  { id: "r6", wallet: "5EdZ7xKpT9mQr3nBv2Ys8kLw4jF6hD", tier: "green", submittedAt: "10 hours ago", flagged: false, score: 58 },
  { id: "r7", wallet: "1ChD1cX5eZ7xKpT9mQr3nBv2Ys8kLw", tier: "diamond", submittedAt: "12 hours ago", flagged: false, score: 105 },
  { id: "r8", wallet: "6FhD1cX5eZ7xKpT9mQr3nBv2Ys8kLw4", tier: "gold", submittedAt: "1 day ago", flagged: true, score: 79 },
];

const MOCK_DISTRIBUTION: DistributionRow[] = [
  { wallet: "7xKpT9mQr3nBv2Ys8kLw4jF6hD1cX5eZ", tier: "diamond", amount: 4.2, txSignature: "5Kj8...mN2x" },
  { wallet: "9Yn2Bv8kLw4jF6hD1cX5eZ7xKpT9mQr3", tier: "gold", amount: 3.1, txSignature: "8Lp3...qR7w" },
  { wallet: "4Vb1Nf6xNf8kLw4jF6hD1cX5eZ7xKp", tier: "green", amount: 2.0, txSignature: "2Mn5...tY9u" },
  { wallet: "2Xc5Hd3mQr7xKpT9nBv8kLw4jF6hD1c", tier: "blue", amount: 1.5, txSignature: "9Qr7...wZ4x" },
  { wallet: "8Kw4Jf6hD1cX5eZ7xKpT9mQr3nBv2Ys", tier: "grey", amount: 1.0, txSignature: "3St1...yU6v" },
];

const RESPONSES_PER_DAY = [
  { day: "Mon", count: 42 },
  { day: "Tue", count: 67 },
  { day: "Wed", count: 58 },
  { day: "Thu", count: 31 },
  { day: "Fri", count: 24 },
  { day: "Sat", count: 8 },
  { day: "Sun", count: 4 },
];

const MCQ_BREAKDOWN = [
  { option: "Every proposal", percent: 18 },
  { option: "Most proposals", percent: 34 },
  { option: "Only topics I care about", percent: 38 },
  { option: "Rarely", percent: 10 },
];

const SIDEBAR_NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "surveys", label: "My Surveys", icon: FileText },
  { id: "create", label: "Create Survey", icon: PlusCircle },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

// ─── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  activeNav,
  onNavChange,
}: {
  activeNav: string;
  onNavChange: (id: string) => void;
}) {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { user, isAuthenticated, isLoading, login } = useAuth();

  const wallet = publicKey?.toBase58();
  const score = user?.globalScore ?? 0;
  const tier = getBadgeTier(score);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-ok-border bg-ok-bg">
      {/* Logo */}
      <Link to="/" className="flex h-16 items-center gap-2.5 border-b border-ok-border/50 px-6 no-underline">
        <Link2 className="h-5 w-5 text-ok-green" strokeWidth={2.5} />
        <span className="font-display text-xl font-bold tracking-tight text-ok-text">
          Okaform
        </span>
      </Link>

      {/* Nav items */}
      <nav className="flex-1 space-y-1.5 px-4 py-6">
        {SIDEBAR_NAV.map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-[var(--radius-ok-inner)] px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-ok-green/10 text-ok-green shadow-[inset_2px_0_0_0_var(--color-ok-green)]"
                  : "text-ok-dim hover:bg-ok-surface/50 hover:text-ok-text hover:shadow-[inset_2px_0_0_0_var(--color-ok-border)]"
              )}
            >
              <item.icon 
                className={cn(
                  "h-4 w-4 transition-colors", 
                  active ? "text-ok-green" : "text-ok-dim group-hover:text-ok-muted"
                )} 
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Wallet / Reputation */}
      <div className="border-t border-ok-border/50 p-4">
        {!connected ? (
          <button
            onClick={() => setVisible(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-ok)] border border-dashed border-ok-border bg-ok-surface/20 px-3 py-2.5 text-sm font-medium text-ok-muted transition-colors hover:border-ok-green/40 hover:text-ok-green"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </button>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-[var(--radius-ok)] border border-ok-border bg-ok-surface/20 px-3 py-2.5 text-xs text-ok-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Signing in...
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col gap-2 rounded-[var(--radius-ok-outer)] border border-ok-border/50 bg-ok-surface/30 p-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-ok-muted" />
              <p className="truncate font-mono text-xs font-medium text-ok-text">
                {truncateAddress(wallet ?? '')}
              </p>
            </div>
            <button
              onClick={() => login()}
              className="mt-1 w-full rounded-[var(--radius-ok-inner)] bg-ok-green/10 px-2 py-1.5 text-xs font-medium text-ok-green transition-colors hover:bg-ok-green/20"
            >
              Sign In with Solana
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-[var(--radius-ok-outer)] border border-ok-border/50 bg-ok-surface/30 p-3 transition-colors hover:border-ok-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-ok-muted" />
                <p className="truncate font-mono text-xs font-medium text-ok-text">
                  {truncateAddress(wallet ?? '')}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-ok-border/30 pt-2">
              <span className="text-[10px] uppercase tracking-wider text-ok-dim">Reputation</span>
              <Badge tier={tier} className="scale-90 origin-right" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Stats row ─────────────────────────────────────────────────────────────────

function StatsRow() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Hero Stat: The Pulse (Spans 2 columns) */}
      <Card 
        padding="lg" 
        className="lg:col-span-2 relative overflow-hidden rounded-[var(--radius-ok-outer)] border-ok-border-glow bg-gradient-to-br from-ok-surface to-ok-bg"
      >
        {/* Subtle background glow effect */}
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-ok-green/5 blur-3xl pointer-events-none" />
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok-green opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ok-green"></span>
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider text-ok-green">Live Now</p>
            </div>
            <p className="mt-4 text-sm text-ok-dim">Active Responses (Jupiter Pulse)</p>
            <div className="mt-1 flex items-baseline gap-3">
              <p className="font-display text-5xl font-bold tracking-tight text-ok-text">
                234
              </p>
              <p className="font-mono text-sm text-ok-muted">/ 500 cap</p>
            </div>
          </div>
          
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-ok-inner)] border border-ok-green/20 bg-ok-green/10">
            <CheckCircle2 className="h-5 w-5 text-ok-green" />
          </div>
        </div>
        
        {/* Visual Progress */}
        <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-ok-border">
          <div className="h-full w-[46.8%] rounded-full bg-ok-green shadow-[0_0_10px_rgba(20,241,149,0.5)]" />
        </div>
      </Card>

      {/* Secondary Stats Grouped */}
      <div className="flex flex-col gap-4">
        <Card padding="md" className="flex-1 rounded-[var(--radius-ok-outer)] bg-ok-surface/40">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ok-dim">Total SOL Distributed</p>
            <Wallet className="h-4 w-4 text-ok-dim" />
          </div>
          <SOLAmount
            amount={125.5}
            unit="sol"
            className="mt-2 text-2xl font-bold text-ok-text"
          />
        </Card>

        <Card padding="md" className="flex-1 rounded-[var(--radius-ok-outer)] bg-ok-surface/40">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ok-dim">Lifetime Surveys</p>
            <FileText className="h-4 w-4 text-ok-dim" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-ok-text">
            3
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─── Surveys table ─────────────────────────────────────────────────────────────

function SurveysTable({
  onSelect,
  onCloseRequest,
}: {
  onSelect: (id: string) => void;
  onCloseRequest: (id: string) => void;
}) {
  return (
    <Card padding="none" className="overflow-hidden rounded-[var(--radius-ok-outer)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ok-border/50 bg-ok-surface/20 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-ok-text">
          My Surveys
        </h2>
        <Link to="/create" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
          <PlusCircle className="h-3.5 w-3.5" />
          Create Survey
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ok-border/50 text-xs text-ok-dim uppercase tracking-wider">
              <th className="px-5 py-4 font-medium">Title</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Responses</th>
              <th className="px-5 py-4 font-medium">Reward Pool</th>
              <th className="px-5 py-4 font-medium">Reward Type</th>
              <th className="px-5 py-4 font-medium">Created</th>
              <th className="px-5 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ok-border/30">
            {SURVEYS.map((survey) => (
              <tr
                key={survey.id}
                className="group transition-all duration-200 hover:bg-ok-surface/40 hover:shadow-[inset_2px_0_0_0_var(--color-ok-green)]"
              >
                <td className="whitespace-nowrap px-5 py-4 font-display font-medium text-ok-text">
                  {survey.title}
                </td>
                <td className="px-5 py-4">
                  <StatusPill status={survey.status} />
                </td>
                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-ok-muted">
                  <span className="text-ok-text">{survey.responses}</span> / {survey.maxResponses}
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
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      survey.rewardType === "weighted"
                        ? "border-ok-green/25 bg-ok-green/10 text-ok-green"
                        : "border-ok-purple/25 bg-ok-purple/10 text-ok-purple"
                    )}
                  >
                    {survey.rewardType === "weighted"
                      ? "Weighted"
                      : "Lottery"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-ok-dim">
                  {survey.createdAt}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 opacity-80 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => onSelect(survey.id)}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-2.5 py-1.5 text-xs font-medium text-ok-muted transition-colors hover:border-ok-green/40 hover:text-ok-text"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {survey.status === "active" ? "View" : "Results"}
                    </button>
                    {survey.status === "active" && (
                      <button
                        onClick={() => onCloseRequest(survey.id)}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-ok-inner)] border border-ok-danger/20 bg-ok-danger/5 px-2.5 py-1.5 text-xs font-medium text-ok-danger transition-colors hover:bg-ok-danger/15 hover:border-ok-danger/30"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Close
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Responses tab ─────────────────────────────────────────────────────────────

function ResponsesTab() {
  const [badgeFilter, setBadgeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let rows = MOCK_RESPONSES;
    if (badgeFilter !== "all") {
      rows = rows.filter((r) => r.tier === badgeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => r.wallet.toLowerCase().includes(q));
    }
    return rows;
  }, [badgeFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={badgeFilter}
            onChange={(e) => setBadgeFilter(e.target.value)}
            className="appearance-none rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2 pr-8 text-xs text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
          >
            <option value="all">All Badges</option>
            <option value="grey">Ghost</option>
            <option value="blue">Cipher</option>
            <option value="green"> Sentinel</option>
            <option value="gold">Oracle</option>
            <option value="diamond">Sovereign</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ok-muted" />
        </div>

        <div className="relative">
          <select className="appearance-none rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2 pr-8 text-xs text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30">
            <option>Sort: Latest</option>
            <option>Sort: Earliest</option>
            <option>Sort: Score ↓</option>
            <option>Sort: Score ↑</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ok-muted" />
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ok-muted" />
          <input
            type="text"
            placeholder="Search by wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg py-2 pl-9 pr-3 text-xs text-ok-text placeholder:text-ok-muted/40 focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
          />
        </div>
      </div>

      {/* Response rows */}
      <Card padding="none">
        <div className="divide-y divide-ok-border">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ok-surface/50"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ok-muted">
                {truncateAddress(r.wallet)}
              </span>
              <Badge tier={r.tier} />
              <span className="whitespace-nowrap text-xs text-ok-muted/60">
                {r.submittedAt}
              </span>
              {r.flagged && (
                <span className="inline-flex items-center gap-1 text-xs text-ok-warning">
                  <AlertTriangle className="h-3 w-3" />
                  Flagged
                </span>
              )}
              <button className="rounded-[var(--radius-ok)] border border-ok-border px-2.5 py-1 text-[10px] font-medium text-ok-muted transition-colors hover:border-ok-green/30 hover:text-ok-text">
                View
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const maxCount = Math.max(...RESPONSES_PER_DAY.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Responses", value: "234" },
          { label: "Completion Rate", value: "78%" },
          { label: "Avg Score", value: "62.4" },
          { label: "Time to Complete", value: "4.2m" },
        ].map((m) => (
          <Card key={m.label} padding="md">
            <p className="text-xs text-ok-muted">{m.label}</p>
            <p className="mt-1 font-display text-xl font-bold text-ok-text">
              {m.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Bar chart — responses per day */}
      <Card padding="lg">
        <h3 className="mb-4 font-display text-sm font-semibold text-ok-text">
          Responses per Day
        </h3>
        <div className="flex items-end gap-3 h-40">
          {RESPONSES_PER_DAY.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-[10px] text-ok-muted">
                {d.count}
              </span>
              <div
                className="w-full rounded-[4px] bg-ok-green/80 transition-all"
                style={{ height: `${(d.count / maxCount) * 100}%` }}
              />
              <span className="text-[10px] text-ok-muted/60">{d.day}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* MCQ breakdown */}
      <Card padding="lg">
        <h3 className="mb-4 font-display text-sm font-semibold text-ok-text">
          Q3: How often do you participate in governance voting?
        </h3>
        <div className="space-y-3">
          {MCQ_BREAKDOWN.map((opt) => (
            <div key={opt.option} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ok-muted">{opt.option}</span>
                <span className="font-mono text-ok-text">{opt.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ok-border">
                <div
                  className="h-full rounded-full bg-ok-green/80"
                  style={{ width: `${opt.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Distribution tab ──────────────────────────────────────────────────────────

function DistributionTab() {
  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="flex items-center justify-between rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/5 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-ok-green" />
          <span className="text-sm font-medium text-ok-green">
            Distribution Complete
          </span>
        </div>
        <span className="font-mono text-xs text-ok-muted">
          tx: 5Kj8mN2x...qR7wY9u
        </span>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Distribution table */}
      <Card padding="none">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ok-border text-xs text-ok-muted">
              <th className="px-5 py-3 font-medium">Wallet</th>
              <th className="px-5 py-3 font-medium">Badge</th>
              <th className="px-5 py-3 font-medium">Amount Received</th>
              <th className="px-5 py-3 font-medium">Tx Signature</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ok-border">
            {MOCK_DISTRIBUTION.map((row) => (
              <tr key={row.txSignature} className="hover:bg-ok-surface/50">
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ok-muted">
                  {truncateAddress(row.wallet)}
                </td>
                <td className="px-5 py-3">
                  <Badge tier={row.tier} />
                </td>
                <td className="px-5 py-3">
                  <SOLAmount
                    amount={row.amount}
                    unit="sol"
                    className="text-xs"
                  />
                </td>
                <td className="whitespace-nowrap px-5 py-3">
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-ok-muted">
                    {row.txSignature}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Settings tab (placeholder) ────────────────────────────────────────────────

function SettingsTab() {
  return (
    <Card padding="lg">
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Settings className="h-10 w-10 text-ok-muted/30" />
        <p className="text-sm text-ok-muted">
          Survey settings will be available here.
        </p>
      </div>
    </Card>
  );
}

// ─── Close modal ───────────────────────────────────────────────────────────────

function CloseModal({
  survey,
  onConfirm,
  onCancel,
}: {
  survey: Survey;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay — glassmorphism */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-[var(--radius-ok)] border border-white/10 bg-ok-surface/95 backdrop-blur-md p-6 shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-ok-muted hover:text-ok-text"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-ok-danger/25 bg-ok-danger/10">
          <AlertTriangle className="h-5 w-5 text-ok-danger" />
        </div>

        <h3 className="mb-2 font-display text-lg font-bold text-ok-text">
          Close this survey?
        </h3>
        <p className="mb-6 text-sm leading-relaxed text-ok-muted">
          This will stop accepting responses and trigger automatic reward
          distribution to{" "}
          <span className="font-mono font-medium text-ok-text">
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
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={onConfirm}
          >
            Close and Distribute
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
}: {
  survey: Survey;
  onBack: () => void;
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
          className="inline-flex items-center gap-1.5 text-xs text-ok-muted/60 transition-colors hover:text-ok-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          My Surveys
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-ok-text">
            {survey.title}
          </h1>
          <StatusPill status={survey.status} />
          <span className="text-xs text-ok-muted/50">
            Created {survey.createdAt}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ok-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "text-ok-green"
                : "text-ok-muted hover:text-ok-text"
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
      {activeTab === "responses" && <ResponsesTab />}
      {activeTab === "analytics" && <AnalyticsTab />}
      {activeTab === "distribution" && <DistributionTab />}
      {activeTab === "settings" && <SettingsTab />}
    </div>
  );
}

// ─── Main dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("surveys");
  const [view, setView] = useState<View>("surveys");
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<Survey | null>(null);



  const selectedSurvey = useMemo(
    () => SURVEYS.find((s) => s.id === selectedSurveyId) ?? null,
    [selectedSurveyId]
  );

  const handleNavChange = (id: string) => {
    setActiveNav(id);
    if (id === "surveys") {
      setView("surveys");
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

  return (
    <div className="min-h-screen bg-ok-bg">
      <Sidebar
        activeNav={activeNav}
        onNavChange={handleNavChange}
      />

      {/* Main content */}
      <main className="ml-[240px] min-h-screen p-6 lg:p-8">
        {view === "surveys" ? (
          <div className="space-y-6">
            <StatsRow />
            <SurveysTable
              onSelect={handleSelectSurvey}
              onCloseRequest={(id) => {
                const survey = SURVEYS.find((s) => s.id === id);
                if (survey) setCloseTarget(survey);
              }}
            />
          </div>
        ) : (
          selectedSurvey && (
            <SurveyDetail survey={selectedSurvey} onBack={handleBack} />
          )
        )}
      </main>

      {/* Close modal */}
      {closeTarget && (
        <CloseModal
          survey={closeTarget}
          onConfirm={() => {
            setCloseTarget(null);
          }}
          onCancel={() => setCloseTarget(null)}
        />
      )}
    </div>
  );
}
