import { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";

import {
  Button,
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
import HomeView from "@/components/Dashboard/HomeView";
import AnalyticsView from "@/components/Dashboard/AnalyticsView";
import SettingsView from "@/components/Dashboard/SettingsView";
import { getForms, getSubmissions, getFormById } from "@/lib/forms";
import type { SubmissionItem, FormDetailQuestion } from "@/lib/forms";

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
  status: StatusType;
  responses: number;
  maxResponses: number;
  rewardPool: number;
  rewardType: "weighted" | "lottery";
  createdAt: string;
}

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
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { user, isAuthenticated, isLoading, login } = useAuth();
  const [copied, setCopied] = useState(false);

  const wallet = publicKey?.toBase58();
  const score = user?.globalScore ?? 0;
  const tier = getBadgeTier(score);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (wallet) {
      navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-[#3D444D] bg-[#0D1117]">
      {/* Logo */}
      <Link to="/" className="flex h-16 items-center border-b border-[#3D444D]/50 px-6 no-underline">
        <OkaformLogo height={48} />
      </Link>

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
                  : "text-[#656C76] hover:bg-[#151B23]/50 hover:text-[#F0F6F6] hover:shadow-[inset_2px_0_0_0_var(--color-ok-border)]"
              )}
            >
              <item.icon 
                className={cn(
                  "h-4 w-4 transition-colors", 
                  active ? "text-ok-green" : "text-[#656C76] group-hover:text-[#9198A1]"
                )} 
              />
              {item.label}
            </button>
          );
        })}
      </nav>

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
                {copied ? 'Copied!' : truncateAddress(wallet ?? '')}
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
                  {copied ? 'Copied!' : truncateAddress(wallet ?? '')}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  disconnect();
                }}
                className="rounded px-1.5 py-0.5 font-mono text-[9px] text-[#656C76] transition-colors hover:bg-ok-danger/10 hover:text-ok-danger"
              >
                Disconnect
              </button>
            </div>
            <div className="flex items-center justify-between border-t border-[#3D444D]/30 pt-2">
              <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">Reputation</span>
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
      <div className="relative overflow-hidden rounded border border-[#3D444D] bg-[#151B23]/40 p-6 lg:col-span-2">
        {/* Decorative corner */}
        <div className="absolute right-0 top-0 h-12 w-12 opacity-10"
             style={{ backgroundImage: 'linear-gradient(225deg, transparent 50%, #14F195 50%)' }} />

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
                234
              </p>
              <p className="font-mono text-sm text-[#656C76]">/ 500 cap</p>
            </div>
          </div>
          
          <div className="flex h-10 w-10 items-center justify-center rounded border border-ok-green/20 bg-ok-green/10">
            <Activity className="h-4 w-4 text-ok-green" />
          </div>
        </div>
        
        {/* Progress */}
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[#3D444D]">
          <div className="h-full w-[46.8%] rounded-full bg-ok-green shadow-[0_0_10px_rgba(20,241,149,0.5)]" />
        </div>

        <div className="mt-4 flex items-center justify-between font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
          <span>Data Vectors Ingested</span>
          <span className="text-ok-green">46.8%</span>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="flex flex-col gap-4">
        <div className="relative flex-1 overflow-hidden rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-4">
          <div className="absolute right-0 top-0 h-8 w-8 opacity-10"
               style={{ backgroundImage: 'linear-gradient(225deg, transparent 50%, #A371F7 50%)' }} />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              Total SOL Distributed
            </span>
            <Database className="h-3.5 w-3.5 text-[#656C76]" />
          </div>
          <SOLAmount
            amount={125.5}
            unit="sol"
            className="mt-2 font-mono text-2xl font-semibold text-[#F0F6F6]"
          />
        </div>

        <div className="relative flex-1 overflow-hidden rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-4">
          <div className="absolute right-0 top-0 h-8 w-8 opacity-10"
               style={{ backgroundImage: 'linear-gradient(225deg, transparent 50%, #14F195 50%)' }} />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              Lifetime Surveys
            </span>
            <Server className="h-3.5 w-3.5 text-[#656C76]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F0F6F6]">
            3
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
}: {
  surveys: Survey[];
  onSelect: (id: string) => void;
  onCloseRequest: (id: string) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded border border-[#3D444D]/80 bg-[#151B23]/20">
      {/* Decorative corner */}
      <div className="absolute right-0 top-0 h-12 w-12 opacity-10"
           style={{ backgroundImage: 'linear-gradient(225deg, transparent 50%, #3D444D 50%)' }} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3D444D] px-5 py-4">
        <h2 className="font-mono text-sm text-[#F0F6F6] flex items-center gap-2">
          <FileText className="h-4 w-4 text-ok-green" />
          [ My Surveys ]
        </h2>
        <Link to="/create" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
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
            <p className="mt-1 text-xs text-[#656C76]">Create your first survey to get started</p>
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
                  <span className="text-[#F0F6F6]">{survey.responses}</span> / {survey.maxResponses}
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
                      "inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider",
                      survey.rewardType === "weighted"
                        ? "border-ok-green/25 bg-ok-green/10 text-ok-green"
                        : "border-ok-purple/25 bg-ok-purple/10 text-ok-purple"
                    )}
                  >
                    {survey.rewardType === "weighted" ? "Weighted" : "Lottery"}
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
                    {survey.status === "active" && (
                      <button
                        onClick={() => onCloseRequest(survey.id)}
                        className="inline-flex items-center gap-1.5 rounded border border-ok-danger/20 bg-ok-danger/5 px-2.5 py-1.5 font-mono text-[10px] font-medium text-ok-danger transition-colors hover:bg-ok-danger/15 hover:border-ok-danger/30"
                      >
                        <XCircle className="h-3 w-3" />
                        Close
                      </button>
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
      {copied ? 'Copied!' : truncateAddress(address)}
    </button>
  );
}

function ResponsesTab({ formId }: { formId: string }) {
  const [responses, setResponses] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [badgeFilter, setBadgeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<SubmissionItem | null>(null);
  const [questions, setQuestions] = useState<FormDetailQuestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getSubmissions(formId), getFormById(formId)])
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
    return () => { cancelled = true; };
  }, [formId]);

  const filtered = useMemo(() => {
    let rows = responses;
    const tierFromScore = (score: number): BadgeTier => {
      if (score >= 100) return "diamond";
      if (score >= 80) return "gold";
      if (score >= 60) return "green";
      if (score >= 30) return "blue";
      return "grey";
    };
    if (badgeFilter !== "all") {
      rows = rows.filter((r) => tierFromScore(r.scoreAtSubmission) === badgeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => r.respondentWallet.toLowerCase().includes(q));
    }
    return rows;
  }, [responses, badgeFilter, searchQuery]);

  if (loading) {
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
        <p className="font-mono text-xs text-[#9198A1]">
          No responses yet.
        </p>
      </div>
    );
  }

  const tierFromScore = (score: number): BadgeTier => {
    if (score >= 100) return "diamond";
    if (score >= 80) return "gold";
    if (score >= 60) return "green";
    if (score >= 30) return "blue";
    return "grey";
  };

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
          <div className="mb-4 flex items-center gap-3">
            <CopyableAddress address={selectedResponse.respondentWallet} />
            <Badge tier={tierFromScore(selectedResponse.scoreAtSubmission)} />
            <span className="font-mono text-[10px] text-[#656C76]">
              {new Date(selectedResponse.submittedAt).toLocaleString()}
            </span>
          </div>

          <div className="space-y-4">
            {selectedResponse.answers.map((answer, i) => {
              const q = questions[i];
              return (
                <div key={i}>
                  <p className="mb-1 font-mono text-xs font-medium text-[#F0F6F6]">
                    {q?.label ?? `Question ${i + 1}`}
                  </p>
                  <div className="rounded border border-[#3D444D]/30 bg-[#0D1117]/40 px-3 py-2 font-mono text-xs text-[#9198A1]">
                    {typeof answer.value === 'string' || typeof answer.value === 'number'
                      ? String(answer.value)
                      : JSON.stringify(answer.value ?? answer)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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

        <div className="relative">
          <select className="appearance-none rounded border border-[#3D444D] bg-[#0D1117]/60 px-3 py-2 pr-8 font-mono text-xs text-[#F0F6F6] focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30">
            <option>Sort: Latest</option>
            <option>Sort: Earliest</option>
            <option>Sort: Score ↓</option>
            <option>Sort: Score ↑</option>
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
              <Badge tier={tierFromScore(r.scoreAtSubmission)} />
              <span className="whitespace-nowrap font-mono text-[10px] text-[#656C76]">
                {relativeTime(r.submittedAt)}
              </span>
              {r.similarityFlag && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-ok-warning">
                  <AlertTriangle className="h-3 w-3" />
                  Flagged
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
    return () => { cancelled = true; };
  }, [formId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[#656C76]" />
      </div>
    );
  }

  const totalResponses = responses.length;
  const avgScore = totalResponses > 0
    ? Math.round(responses.reduce((sum, r) => sum + r.scoreAtSubmission, 0) / totalResponses)
    : 0;
  const flaggedCount = responses.filter((r) => r.similarityFlag).length;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Responses", value: String(totalResponses), icon: Activity },
          { label: "Avg Score", value: String(avgScore), icon: BarChart3 },
          { label: "Flagged", value: String(flaggedCount), icon: AlertTriangle },
          { label: "Completion", value: totalResponses > 0 ? "100%" : "0%", icon: CheckCircle2 },
        ].map((m) => (
          <div key={m.label} className="relative overflow-hidden rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-4">
            <div className="absolute right-0 top-0 h-8 w-8 opacity-10"
                 style={{ backgroundImage: 'linear-gradient(225deg, transparent 50%, #14F195 50%)' }} />
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

// ─── Distribution tab ──────────────────────────────────────────────────────────

function DistributionTab({ formId: _formId }: { formId: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Database className="h-8 w-8 text-[#656C76]/30" />
      <p className="font-mono text-xs text-[#9198A1]">
        Distribution history will appear here once rewards are distributed.
      </p>
    </div>
  );
}

// ─── Settings tab (placeholder) ────────────────────────────────────────────────

function SettingsTab() {
  return (
    <div className="rounded border border-[#3D444D]/50 bg-[#151B23]/30 p-8">
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Settings className="h-10 w-10 text-[#656C76]/30" />
        <p className="font-mono text-xs text-[#9198A1]">
          Survey settings will be available here.
        </p>
      </div>
    </div>
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
                : "text-[#9198A1] hover:text-[#F0F6F6]"
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
      {activeTab === "responses" && <ResponsesTab formId={survey.id} />}
      {activeTab === "analytics" && <AnalyticsTab formId={survey.id} />}
      {activeTab === "distribution" && <DistributionTab formId={survey.id} />}
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
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const forms = await getForms();
        setSurveys(
          forms.map((f) => ({
            id: f.id,
            title: f.title,
            status: f.status as StatusType,
            responses: f.responseCount,
            maxResponses: f.maxResponses,
            rewardPool: f.rewardPool,
            rewardType: f.rewardType as "weighted" | "lottery",
            createdAt: f.createdAt,
          }))
        );
      } catch {
        setSurveys([]);
      } finally {
        setLoading(false);
      }
    };
    fetchForms();
  }, []);

  const selectedSurvey = useMemo(
    () => surveys.find((s) => s.id === selectedSurveyId) ?? null,
    [surveys, selectedSurveyId]
  );

  const handleNavChange = (id: string) => {
    setActiveNav(id);
    if (id === "surveys") {
      setView("surveys");
      setSelectedSurveyId(null);
    } else if (id === "home") {
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
    <div className="min-h-screen bg-[#0D1117]">
      <Sidebar
        activeNav={activeNav}
        onNavChange={handleNavChange}
      />

      {/* Main content */}
      <main className="ml-[240px] min-h-screen p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#656C76]" />
          </div>
        ) : activeNav === "home" ? (
          <HomeView />
        ) : activeNav === "analytics" ? (
          <AnalyticsView />
        ) : activeNav === "settings" ? (
          <SettingsView />
        ) : view === "surveys" ? (
          <div className="space-y-6">
            <StatsRow />
            <SurveysTable
              surveys={surveys}
              onSelect={handleSelectSurvey}
              onCloseRequest={(id) => {
                const survey = surveys.find((s) => s.id === id);
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
