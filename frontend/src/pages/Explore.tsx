import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Users,
  Wallet,
  ChevronDown,
  X,
  ArrowRight,
  Bot,
  Activity,
  Lock,
  Terminal,
  Grid,
  List,
  ShieldAlert,
  SlidersHorizontal,
  Loader2,
  LogOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import OkaformLogo from "@/components/OkaformLogo";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button, Badge, getBadgeTier } from "@/components/okaform";
import { useWallet } from "@/components/WalletProvider";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { getExploreForms } from "@/lib/forms";
import type { ExploreFormItem } from "@/lib/forms";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Requirement {
  type: "wallet_age" | "min_sol" | "token_hold";
  label: string;
  symbol?: string;
}

interface SurveyListing {
  id: string;
  featured?: boolean;
  protocol: string;
  protocolColor: string;
  title: string;
  rewardPool: number;
  rewardType: "weighted" | "lottery";
  numWinners?: number;
  responses: number;
  maxResponses: number;
  closesAt: string | null;
  status: "active" | "ending_soon" | "closed";
  requirements: Requirement[];
  previewQuestion?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ORG_COLORS = [
  '#14f195', '#f7931a', '#8b5cf6', '#3b82f6',
  '#4ade80', '#ff7b9c', '#a78bfa', '#f472b6',
  '#06b6d4', '#e879f9', '#fb923c', '#34d399',
];

function orgToColor(org: string): string {
  let hash = 0;
  for (let i = 0; i < org.length; i++) {
    hash = org.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ORG_COLORS[Math.abs(hash) % ORG_COLORS.length] ?? '#999';
}

function deriveStatus(closesAt: string | null): SurveyListing['status'] {
  if (!closesAt) return 'active';
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return 'closed';
  if (diff < 24 * 60 * 60 * 1000) return 'ending_soon';
  return 'active';
}

function buildRequirements(minWalletAge: number, minSolBalance: number): Requirement[] {
  const reqs: Requirement[] = [];
  if (minWalletAge > 0) {
    reqs.push({ type: 'wallet_age', label: `Wallet age > ${minWalletAge} days` });
  }
  if (minSolBalance > 0) {
    reqs.push({ type: 'min_sol', label: `Min ${minSolBalance} SOL` });
  }
  return reqs;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const filterOptions = ["All", "Open to All", "Token Gated", "High Reward", "Ending Soon"] as const;
type FilterLabel = (typeof filterOptions)[number];

type SortKey = "latest" | "highest_reward" | "most_responses" | "ending_soon";

function formatTimeRemaining(date: string | null): string {
  if (!date) return "Open";
  const now = Date.now();
  const diff = new Date(date).getTime() - now;
  if (diff <= 0) return "Closed";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "Soon";
}

function StatusPill({ status }: { status: SurveyListing["status"] }) {
  const config = {
    active: { dot: "bg-ok-green", text: "text-ok-green border-ok-green/20 bg-ok-green/5", label: "Active" },
    ending_soon: { dot: "bg-ok-warning", text: "text-ok-warning border-ok-warning/20 bg-ok-warning/5", label: "Ending" },
    closed: { dot: "bg-[#656C76]", text: "text-[#656C76] border-[#3D444D] bg-transparent", label: "Ended" },
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider", config.text)}>
      <span className={cn("h-1 w-1 rounded-full animate-pulse", config.dot)} />
      {config.label}
    </span>
  );
}

function ProtocolLogo({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#3D444D] text-[11px] font-mono font-bold transition-all group-hover:scale-105"
      style={{ backgroundColor: `${color}10`, color, borderColor: `${color}30` }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function WalletBadge() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded border border-[#3D444D] bg-[#151B23] px-3.5 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9198A1]" />
        <span className="font-mono text-xs text-[#9198A1]">Signing in...</span>
      </div>
    );
  }

  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="inline-flex items-center gap-2 rounded border border-dashed border-[#3D444D] bg-[#151B23]/20 px-3.5 py-2 font-mono text-xs text-[#9198A1] transition-colors hover:border-ok-green/40 hover:text-ok-green"
      >
        <Wallet className="h-3.5 w-3.5" />
        Connect
      </button>
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => login()}
        className="inline-flex items-center gap-2 rounded border border-ok-green/30 bg-ok-green/10 px-3.5 py-2 font-mono text-xs text-ok-green transition-colors hover:bg-ok-green/20"
      >
        Sign In
      </button>
    );
  }

  const wallet = publicKey?.toBase58() ?? "";
  const score = user?.globalScore ?? 0;
  const tier = getBadgeTier(score);
  const truncated = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="inline-flex items-center gap-3 rounded border border-[#3D444D] bg-[#151B23] px-3.5 py-2">
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 cursor-pointer transition-colors hover:text-ok-green"
        title="Click to copy"
      >
        <span className="h-2 w-2 rounded-full bg-ok-green" />
        <span className="font-mono text-xs text-[#F0F6F6]">{copied ? 'Copied!' : truncated}</span>
      </button>
      <span className="h-4 w-px bg-[#3D444D]" />
      <Badge tier={tier} className="text-xs" />
      <span className="h-4 w-px bg-[#3D444D]" />
      <button
        onClick={() => { logout(); disconnect(); }}
        className="flex items-center gap-1 font-mono text-xs text-[#9198A1] transition-colors hover:text-ok-danger cursor-pointer"
        title="Disconnect"
      >
        <LogOut className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Refactored Visual Components ──────────────────────────────────────────────

interface SurveyCardProps {
  survey: SurveyListing;
}

/**
 * Tactical Grid Module Component
 * Replaces generic cards with complex, diagnostic-looking terminal windows.
 */
function SurveyCard({ survey }: SurveyCardProps) {
  const isOpen = survey.status !== "closed";
  const responsePercent = Math.round((survey.responses / survey.maxResponses) * 100);

  // Generate notched visual progress bar [|||||.....]
  const renderNotchedProgress = () => {
    const totalNotches = 15;
    const filledNotches = Math.round((responsePercent / 100) * totalNotches);
    return (
      <div className="flex gap-0.5 font-mono text-xs text-ok-green/40 select-none">
        {Array.from({ length: totalNotches }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "transition-colors duration-300",
              i < filledNotches ? "text-ok-green font-bold" : "text-[#3D444D]"
            )}
          >
            |
          </span>
        ))}
      </div>
    );
  };

  return (
    <Link
      to={isOpen ? `/form/${survey.id}` : "#"}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded border bg-[#151B23]/40 p-5 transition-all duration-300",
        isOpen
          ? "border-[#3D444D] hover:border-ok-green/40 hover:bg-[#151B23]/70 hover:shadow-[0_0_25px_rgba(20,241,149,0.03)]"
          : "border-[#3D444D]/30 opacity-40 pointer-events-none grayscale"
      )}
    >
      {/* Concluded overlay stamp */}
      {!isOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="rotate-[-30deg] font-mono text-[48px] font-bold tracking-[0.3em] text-[#656C76]/10 select-none">
            ENDED
          </span>
        </div>
      )}
      {/* Background Micro-Grid Decorative Line */}
      <div className="absolute right-0 top-0 h-16 w-16 opacity-[0.02] transition-opacity group-hover:opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(var(--tw-gradient-stops), #14F195 1px, transparent 1px)', backgroundSize: '4px 4px' }} />

      {/* Card Header: Node Diagnostic Bar */}
      <div>
        <div className="mb-4 flex items-center justify-between border-b border-[#3D444D]/50 pb-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#656C76]">
            <Terminal className="h-3 w-3 text-[#3D444D]" />
            <span>NODE // {survey.id.toUpperCase()}</span>
          </div>
          <StatusPill status={survey.status} />
        </div>

        {/* Title & Protocol Section */}
        <div className="flex items-start gap-3">
          <ProtocolLogo name={survey.protocol} color={survey.protocolColor} />
          <div className="space-y-1">
            <span className="font-mono text-[11px] font-medium text-[#656C76]">
              {survey.protocol}
            </span>
            <h3 className="text-base font-medium leading-snug tracking-tight text-[#F0F6F6] transition-colors group-hover:text-ok-green">
              {survey.title}
            </h3>
          </div>
        </div>

        {/* Preview Question (Optional and stylised) */}
        {survey.previewQuestion && (
          <p className="mt-3.5 border-l-2 border-[#3D444D] pl-3 font-mono text-xs text-[#9198A1] line-clamp-2 italic">
            &ldquo;{survey.previewQuestion}&rdquo;
          </p>
        )}

        {/* Verification Gates (Middle) */}
        <div className="mt-5 space-y-2 border-t border-[#3D444D]/30 pt-4">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-[#656C76]">
            Cryptographic Criteria Gating
          </span>
          <div className="flex flex-wrap gap-1.5">
            {survey.requirements.length > 0 ? (
              survey.requirements.map((req, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 rounded bg-[#0D1117] border border-[#3D444D]/80 px-2 py-0.5 font-mono text-[10px]",
                    req.type === "token_hold" ? "text-ok-purple border-ok-purple/20" : "text-[#9198A1]"
                  )}
                >
                  {req.type === "token_hold" ? (
                    <Bot className="h-2.5 w-2.5 text-ok-purple/80" />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-[#656C76]" />
                  )}
                  {req.label}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-[#0D1117] border border-ok-green/10 px-2 py-0.5 font-mono text-[10px] text-ok-green">
                <span className="h-1 w-1 rounded-full bg-ok-green animate-pulse" />
                Open Consensus
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress & Target Statistics (Lower) */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <div className="flex items-center gap-1.5 text-[#9198A1]">
            <Users className="h-3.5 w-3.5 text-[#656C76]" />
            <span>Inbound Vectors:</span>
          </div>
          <span className="text-[#F0F6F6]">
            {survey.responses} / {survey.maxResponses}
          </span>
        </div>

        {/* Closes At */}
        <div className="flex items-center justify-between font-mono text-[11px]">
          <div className="flex items-center gap-1.5 text-[#9198A1]">
            <Lock className="h-3.5 w-3.5 text-[#656C76]" />
            <span>Closes:</span>
          </div>
          <span className={cn(
            "text-[10px]",
            survey.status === "ending_soon" ? "text-ok-warning" : survey.status === "closed" ? "text-[#656C76]" : "text-[#F0F6F6]"
          )}>
            {formatTimeRemaining(survey.closesAt)}
          </span>
        </div>
        
        {/* Dynamic bar wrapper */}
        <div className="flex items-center justify-between rounded bg-[#0D1117] px-3 py-1.5 border border-[#3D444D]/40">
          {renderNotchedProgress()}
          <span className="font-mono text-[10px] text-ok-green font-semibold">
            {responsePercent}%
          </span>
        </div>

        {/* Card Footer: Escrow details and action trigger */}
        <div className="mt-4 flex items-center justify-between border-t border-[#3D444D]/50 pt-4">
          <div className="flex flex-col">
            <span className="font-mono text-xs text-[#656C76] uppercase tracking-wider">Escrowed Rewards</span>
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-ok-green/80" />
              <span className="font-display font-mono text-base font-semibold text-ok-green">
                {survey.rewardPool.toFixed(2)} SOL
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[#656C76] uppercase tracking-wider text-right hidden sm:block">
              {survey.rewardType === "weighted" ? "Weighted Yield" : "Lottery Draw"}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3D444D] bg-[#0D1117] transition-all group-hover:border-ok-green/50 group-hover:bg-ok-green/5">
              <ArrowRight className="h-4 w-4 text-[#656C76] transition-transform group-hover:translate-x-0.5 group-hover:text-ok-green" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Compact Monospace Log Stream Row Component
 * Replaces list views with high-density system-trace lines.
 */
function SurveyRow({ survey }: SurveyCardProps) {
  const isOpen = survey.status !== "closed";
  return (
    <Link
      to={isOpen ? `/form/${survey.id}` : "#"}
      className={cn(
        "group flex flex-col gap-4 border-b border-[#3D444D]/40 py-3.5 font-mono text-xs transition-all hover:bg-[#151B23]/30 px-4 md:flex-row md:items-center md:justify-between md:gap-6",
        !isOpen && "opacity-30 pointer-events-none"
      )}
    >
      <div className="flex flex-1 items-center gap-4 min-w-0">
        <span className="text-[#656C76] shrink-0 font-mono">[{survey.id.toUpperCase()}]</span>
        <span className="text-ok-green shrink-0 font-semibold">{survey.rewardPool.toFixed(1)} SOL</span>
        <span className="text-[#9198A1] shrink-0">{survey.protocol}</span>
        <span className="text-[#3D444D] shrink-0">|</span>
        <span className="text-[#F0F6F6] truncate group-hover:text-ok-green transition-colors font-medium">
          {survey.title}
        </span>
      </div>

      <div className="flex items-center justify-between gap-6 shrink-0 border-t border-[#3D444D]/20 pt-2 md:border-0 md:pt-0">
        <div className="flex items-center gap-2 text-[#656C76]">
          <Users className="h-3 w-3" />
          <span>{survey.responses}/{survey.maxResponses}</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={survey.status} />
          <span className="text-[#9198A1] text-[11px]">{isOpen ? formatTimeRemaining(survey.closesAt) : "Concluded"}</span>
          <ArrowRight className="h-3.5 w-3.5 text-[#3D444D] transition-transform group-hover:translate-x-0.5 group-hover:text-ok-green" />
        </div>
      </div>
    </Link>
  );
}

// ─── Main Explore Component ───────────────────────────────────────────────────

export default function Explore() {
  const [surveys, setSurveys] = useState<SurveyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterLabel>("All");
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [visibleCount, setVisibleCount] = useState(6);

  const fetchData = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(false);
    getExploreForms()
      .then((data) => {
        if (!cancelled) {
          setSurveys(
            data.map((f: ExploreFormItem) => ({
              id: f.id,
              title: f.title,
              protocol: f.organization || 'Unknown',
              protocolColor: orgToColor(f.organization || f.id),
              rewardPool: f.rewardPool,
              rewardType: f.rewardType as 'weighted' | 'lottery',
              numWinners: f.numWinners,
              responses: f.responses,
              maxResponses: f.maxResponses,
              closesAt: f.closesAt,
              status: f.status === 'closed' ? 'closed' : deriveStatus(f.closesAt),
              requirements: buildRequirements(f.minWalletAge, f.minSolBalance),
              previewQuestion: f.previewQuestion || undefined,
            }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchData();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) fetchData();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [fetchData]);

  const sortOptions: { label: string; value: SortKey }[] = [
    { label: "Latest Deployment", value: "latest" },
    { label: "Highest Value Pool", value: "highest_reward" },
    { label: "Maximum Response Density", value: "most_responses" },
    { label: "Ending Soon", value: "ending_soon" },
  ];

  const filtered = useMemo(() => {
    let list = [...surveys];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.protocol.toLowerCase().includes(q)
      );
    }

    if (activeFilter === "Open to All") {
      list = list.filter((s) => s.requirements.length === 0);
    } else if (activeFilter === "Token Gated") {
      list = list.filter((s) => s.requirements.some((r) => r.type === "token_hold"));
    } else if (activeFilter === "High Reward") {
      list = list.filter((s) => s.rewardPool >= 30);
    } else if (activeFilter === "Ending Soon") {
      list = list.filter((s) => s.status === "ending_soon");
    }

    list.sort((a, b) => {
      if (sortKey === "latest") {
        const aTime = a.closesAt ? new Date(a.closesAt).getTime() : 0;
        const bTime = b.closesAt ? new Date(b.closesAt).getTime() : 0;
        return bTime - aTime;
      }
      if (sortKey === "highest_reward") return b.rewardPool - a.rewardPool;
      if (sortKey === "most_responses") return b.responses - a.responses;
      if (sortKey === "ending_soon") {
        const aTime = a.closesAt ? new Date(a.closesAt).getTime() : Infinity;
        const bTime = b.closesAt ? new Date(b.closesAt).getTime() : Infinity;
        return aTime - bTime;
      }
      return 0;
    });

    return list;
  }, [surveys, search, activeFilter, sortKey]);

  const displayed = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#F0F6F6] selection:bg-ok-green/20">
      {/* ─── NAV ────────────────────────────────────────────────────────────── */}
      <nav className="flex h-16 items-center justify-between border-b border-[#3D444D] bg-[#151B23]/40 px-8 backdrop-blur-md">
        <Link
          to="/"
          className="group flex items-center text-sm font-medium text-[#9198A1] transition-colors hover:text-[#F0F6F6]"
        >
          <OkaformLogo height={44} />
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/how-it-works"
            className="font-mono text-xs text-[#9198A1] transition-colors hover:text-[#F0F6F6]"
          >
            How It Works
          </Link>
          <Link
            to="/dashboard"
            className="font-mono text-xs text-[#9198A1] transition-colors hover:text-[#F0F6F6]"
          >
            Dashboard
          </Link>
          <Link to="/create">
            <Button variant="primary" size="sm">
              Create Survey
            </Button>
          </Link>
          <WalletBadge />
        </div>
      </nav>

      {/* ─── HEADER & TELEMETRY ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-8 pt-16 pb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <span className="font-mono text-xs text-ok-green tracking-wider uppercase">[ Public Index ]</span>
            <h1 className="text-3xl font-medium tracking-tight text-[#F0F6F6] sm:text-4xl">
              Verified Campaigns
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-[#9198A1]">
              Cryptographically audited community parameters directly tied to the Solana account ledger.
            </p>
          </div>
        </div>

        {/* Technical HUD Telemetry Strip */}
          <div className="mt-8 grid grid-cols-2 gap-4 rounded border border-[#3D444D]/60 bg-[#151B23]/30 p-4 font-mono sm:grid-cols-4">
            <div className="border-r border-[#3D444D]/40 last:border-0 pr-4">
              <span className="block text-[10px] text-[#656C76] uppercase tracking-wider">Active Escrows</span>
              <span className="text-sm font-semibold text-[#F0F6F6] flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ok-green animate-pulse" />
                {!loading ? `${surveys.filter((s) => s.status !== 'closed').length} / ${surveys.length} Nodes Active` : '...'}
              </span>
            </div>
            <div className="sm:border-r border-[#3D444D]/40 last:border-0 pr-4 sm:pl-4">
              <span className="block text-[10px] text-[#656C76] uppercase tracking-wider">Total Pool Value</span>
              <span className="text-sm font-semibold text-ok-green mt-0.5">
                {!loading ? `${surveys.reduce((sum, s) => sum + s.rewardPool, 0).toFixed(2)} SOL` : '...'}
              </span>
            </div>
            <div className="border-r border-[#3D444D]/40 last:border-0 pr-4 sm:pl-4">
              <span className="block text-[10px] text-[#656C76] uppercase tracking-wider">Audited Signatures</span>
              <span className="text-sm font-semibold text-[#F0F6F6] mt-0.5">
                {!loading ? `${surveys.reduce((sum, s) => sum + s.responses, 0).toLocaleString()} Handshakes` : '...'}
              </span>
            </div>
            <div className="pr-4 pl-4 last:border-0">
              <span className="block text-[10px] text-[#656C76] uppercase tracking-wider">Oracle Sync</span>
              <span className="text-sm font-semibold text-ok-purple flex items-center gap-1.5 mt-0.5">
                <Activity className="h-3.5 w-3.5 animate-spin" />
                Mainnet-Beta
              </span>
            </div>
          </div>
      </div>

      {/* ─── FILTER STICKY HUD BAR ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-y border-[#3D444D] bg-[#0D1117]/90 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-8 py-3.5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-5">
              
              {/* Search Vector */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#656C76]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Scan vector signature..."
                  className="w-full border-b border-[#3D444D] bg-transparent py-1.5 pl-6 pr-6 font-mono text-xs text-[#F0F6F6] placeholder:text-[#656C76]/70 focus:border-ok-green/40 focus:outline-none transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-[#656C76] hover:text-[#F0F6F6]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filtering matrices */}
              <div className="flex flex-wrap items-center gap-1">
                {filterOptions.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      "rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-all",
                      activeFilter === f
                        ? "bg-ok-green/10 text-ok-green border border-ok-green/20"
                        : "text-[#656C76] border border-transparent hover:text-[#F0F6F6]"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Sorting & Layout Toggles */}
            <div className="flex items-center justify-between gap-4 border-t border-[#3D444D]/40 pt-3 md:border-t-0 md:pt-0">
              
              {/* Layout Engine Switch */}
              <div className="flex items-center gap-1 rounded bg-[#151B23] p-1 border border-[#3D444D]/50">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-1 rounded transition-colors",
                    viewMode === "grid" ? "bg-[#0D1117] text-ok-green" : "text-[#656C76] hover:text-[#9198A1]"
                  )}
                  title="Tactical Grid Modules"
                >
                  <Grid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1 rounded transition-colors",
                    viewMode === "list" ? "bg-[#0D1117] text-ok-green" : "text-[#656C76] hover:text-[#9198A1]"
                  )}
                  title="Compact Log Stream"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowSortDropdown((v) => !v)}
                  className="flex items-center gap-1.5 border-b border-transparent py-1 font-mono text-[11px] uppercase tracking-wide text-[#9198A1] transition-all hover:border-[#656C76] hover:text-[#F0F6F6]"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#656C76]" />
                  {sortOptions.find((o) => o.value === sortKey)?.label}
                  <ChevronDown className="h-3.5 w-3.5 text-[#656C76]" />
                </button>
                {showSortDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSortDropdown(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-2 w-52 border border-[#3D444D] bg-[#151B23] shadow-2xl rounded">
                      {sortOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setSortKey(opt.value);
                            setShowSortDropdown(false);
                          }}
                          className={cn(
                            "w-full px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wide transition-colors border-b border-[#3D444D]/40 last:border-0",
                            sortKey === opt.value
                              ? "bg-ok-green/5 text-ok-green"
                              : "text-[#9198A1] hover:bg-[#0D1117] hover:text-[#F0F6F6]"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN SURVEY CAMPAIGNS DISPLAY ─────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-8 py-16">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-6 w-6 animate-spin text-[#656C76]" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center gap-3 py-32 text-center rounded border border-dashed border-ok-danger/30">
            <ShieldAlert className="h-6 w-6 text-ok-danger" />
            <h3 className="text-base font-medium text-[#F0F6F6] font-mono">
              [ CONNECTION ERROR ]
            </h3>
            <p className="text-sm text-[#9198A1] max-w-xs">
              Failed to load campaign data. Check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 font-mono text-xs text-ok-green border-b border-transparent hover:border-ok-green transition-colors"
            >
              [ Retry ]
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-32 text-center rounded border border-dashed border-[#3D444D]">
            <ShieldAlert className="h-6 w-6 text-[#656C76] animate-pulse" />
            <h3 className="text-base font-medium text-[#F0F6F6] font-mono">
              {surveys.length === 0 ? '[ NO CAMPAIGNS DEPLOYED ]' : '[ ZERO MATCHING DATA BLOCKS ]'}
            </h3>
            <p className="text-sm text-[#9198A1] max-w-xs">
              {surveys.length === 0
                ? 'No surveys have been deployed yet. Create the first one!'
                : 'No database blocks match the active sorting / filter parameters.'}
            </p>
            <button
              onClick={() => {
                setSearch("");
                setActiveFilter("All");
              }}
              className="mt-3 font-mono text-xs text-ok-green border-b border-transparent hover:border-ok-green transition-colors"
            >
              [ Flush Pipeline Parameters ]
            </button>
          </div>
        ) : (
          <div>
            {viewMode === "grid" ? (
              /* Grid Layout Mode */
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {displayed.map((survey) => (
                  <SurveyCard key={survey.id} survey={survey} />
                ))}
              </div>
            ) : (
              /* High-Density Tabular List Mode */
              <div className="rounded border border-[#3D444D] bg-[#151B23]/20 overflow-hidden divide-y divide-[#3D444D]/30">
                <div className="hidden md:flex items-center justify-between px-4 py-2.5 bg-[#151B23]/60 border-b border-[#3D444D] font-mono text-[10px] uppercase tracking-wider text-[#656C76] select-none">
                  <div className="flex gap-4 flex-1">
                    <span>Node ID</span>
                    <span>Reward Block</span>
                    <span>Issuer Protocol</span>
                    <span>Core Vector Identification</span>
                  </div>
                  <div className="flex gap-14 mr-16">
                    <span>Volume</span>
                    <span>Auditor Gate</span>
                    <span>State</span>
                  </div>
                </div>
                {displayed.map((survey) => (
                  <SurveyRow key={survey.id} survey={survey} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Monospace Load More Indicator */}
        {visibleCount < filtered.length && (
          <div className="mt-12 text-center">
            <button
              onClick={() => setVisibleCount((v) => v + 6)}
              className="font-mono text-xs text-[#9198A1] border border-[#3D444D] bg-[#151B23]/80 px-6 py-2.5 rounded transition-all hover:border-[#656C76] hover:text-[#F0F6F6] hover:shadow-[0_0_15px_rgba(20,241,149,0.02)]"
            >
              [ Read Next Campaign Segment Block ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
}