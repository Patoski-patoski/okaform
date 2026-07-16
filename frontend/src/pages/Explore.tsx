import { useState, useMemo } from "react";
import {
  Search,
  Clock,
  Users,
  Wallet,
  ChevronDown,
  X,
  ArrowRight,
  Link2,
  Bot,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button, Badge, getBadgeTier } from "@/components/okaform";
import { useWallet } from "@/components/WalletProvider";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

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
  closesAt: Date;
  status: "active" | "ending_soon" | "closed";
  requirements: Requirement[];
  previewQuestion?: string;
}

// ─── Sample data ───────────────────────────────────────────────────────────────

const SURVEYS: SurveyListing[] = [
  {
    id: "s1",
    featured: true,
    protocol: "Jupiter",
    protocolColor: "#f7931a",
    title: "Jupiter Q3 Governance Pulse",
    rewardPool: 50,
    rewardType: "weighted",
    responses: 234,
    maxResponses: 500,
    closesAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: "active",
    requirements: [
      { type: "token_hold", label: "JUP holder", symbol: "JUP" },
    ],
    previewQuestion: "How would you rate the current governance proposal quality?",
  },
  {
    id: "s2",
    protocol: "Tensor",
    protocolColor: "#8b5cf6",
    title: "Tensor Trader Experience Survey",
    rewardPool: 30,
    rewardType: "weighted",
    responses: 500,
    maxResponses: 500,
    closesAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: "closed",
    requirements: [
      { type: "wallet_age", label: "Wallet age > 30 days" },
      { type: "min_sol", label: "Min 1 SOL" },
    ],
  },
  {
    id: "s3",
    protocol: "Marinade Finance",
    protocolColor: "#14f195",
    title: "Marinade Finance Product Feedback",
    rewardPool: 15,
    rewardType: "weighted",
    responses: 89,
    maxResponses: 200,
    closesAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: "active",
    requirements: [
      { type: "wallet_age", label: "Wallet age > 14 days" },
    ],
  },
  {
    id: "s4",
    protocol: "Drift Protocol",
    protocolColor: "#3b82f6",
    title: "Drift Protocol UX Research",
    rewardPool: 45,
    rewardType: "weighted",
    responses: 312,
    maxResponses: 400,
    closesAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    status: "ending_soon",
    requirements: [
      { type: "wallet_age", label: "Wallet age > 7 days" },
      { type: "min_sol", label: "Min 0.5 SOL" },
    ],
  },
  {
    id: "s5",
    protocol: "Orca",
    protocolColor: "#ff7b9c",
    title: "Orca DEX Feature Prioritisation",
    rewardPool: 20,
    rewardType: "weighted",
    responses: 45,
    maxResponses: 150,
    closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "active",
    requirements: [
      { type: "token_hold", label: "ORCA holder", symbol: "ORCA" },
    ],
  },
  {
    id: "s6",
    protocol: "Kamino",
    protocolColor: "#a78bfa",
    title: "Kamino Lending Risk Survey",
    rewardPool: 25,
    rewardType: "lottery",
    numWinners: 5,
    responses: 178,
    maxResponses: 300,
    closesAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    status: "active",
    requirements: [
      { type: "wallet_age", label: "Wallet age > 30 days" },
      { type: "min_sol", label: "Min 1 SOL" },
    ],
  },
  {
    id: "s7",
    protocol: "Solana Mobile",
    protocolColor: "#999",
    title: "Solana Mobile Community Survey",
    rewardPool: 10,
    rewardType: "weighted",
    responses: 67,
    maxResponses: 100,
    closesAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    status: "active",
    requirements: [],
  },
  {
    id: "s8",
    protocol: "Raydium",
    protocolColor: "#4ade80",
    title: "Raydium LP Incentives Feedback",
    rewardPool: 35,
    rewardType: "weighted",
    responses: 290,
    maxResponses: 350,
    closesAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    status: "ending_soon",
    requirements: [
      { type: "wallet_age", label: "Wallet age > 14 days" },
      { type: "token_hold", label: "RAY holder", symbol: "RAY" },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const filterOptions = ["All", "Open to All", "Token Gated", "High Reward", "Ending Soon"] as const;
type FilterLabel = (typeof filterOptions)[number];

type SortKey = "latest" | "highest_reward" | "most_responses" | "ending_soon";

function formatTimeRemaining(date: Date): string {
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff <= 0) return "Closed";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "Soon";
}

function StatusPill({ status }: { status: SurveyListing["status"] }) {
  const config = {
    active: { dot: "bg-ok-green", text: "text-ok-green", label: "Active" },
    ending_soon: { dot: "bg-ok-warning", text: "text-ok-warning", label: "Ending" },
    closed: { dot: "bg-[#656C76]", text: "text-[#656C76]", label: "Closed" },
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider", config.text)}>
      <span className={cn("h-1 w-1 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

function ProtocolLogo({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-mono font-bold"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function WalletBadge() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const wallet = publicKey?.toBase58() ?? "";

  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="inline-flex items-center gap-2 border-b border-[#3D444D] pb-0.5 font-mono text-xs text-[#656C76] transition-colors hover:text-[#F0F6F6]"
      >
        <Wallet className="h-3.5 w-3.5" />
        Connect Identity Wallet
      </button>
    );
  }

  const { user } = useAuth();
  const score = user?.globalScore ?? 0;
  const tier = getBadgeTier(score);
  const truncated = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  return (
    <div className="inline-flex items-center gap-3 rounded border border-[#3D444D] bg-[#151B23] px-3 py-1.5">
      <span className="font-mono text-xs text-[#F0F6F6]">{truncated}</span>
      <span className="h-3.5 w-px bg-[#3D444D]" />
      <Badge tier={tier} className="text-xs" />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SurveyRow({
  survey,
}: {
  survey: SurveyListing;
}) {
  const isOpen = survey.status !== "closed";
  const responsePercent = Math.round((survey.responses / survey.maxResponses) * 100);

  return (
    <Link
      to={isOpen ? `/form/${survey.id}` : "#"}
      className={cn(
        "group block border-t border-[#3D444D] py-6 transition-colors first:border-t-0",
        isOpen ? "hover:bg-[#151B23]/30" : "opacity-30 pointer-events-none"
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        
        {/* Left Section: Core Info & Identity */}
        <div className="flex flex-1 items-start gap-4 min-w-0">
          <ProtocolLogo name={survey.protocol} color={survey.protocolColor} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs font-medium text-[#656C76]">
                {survey.protocol}
              </span>
              <StatusPill status={survey.status} />
              {survey.featured && (
                <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-ok-purple">
                  [ Featured Campaign ]
                </span>
              )}
            </div>
            
            <h3 className="text-base font-medium tracking-tight text-[#F0F6F6] transition-colors group-hover:text-ok-green">
              {survey.title}
            </h3>

            {survey.featured && survey.previewQuestion && (
              <p className="text-xs text-[#9198A1] line-clamp-1 border-l border-[#3D444D] pl-3 mt-1.5">
                &ldquo;{survey.previewQuestion}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Middle Section: Criteria Gates & Volume Metrics */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 lg:justify-end flex-1 min-w-0">
          
          {/* Target / Progress Meter */}
          <div className="flex w-full flex-col gap-1.5 sm:w-44">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#656C76]">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {survey.responses} / {survey.maxResponses}
              </span>
              <span>{responsePercent}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[#3D444D]">
              <div
                className="h-full bg-ok-green/60 transition-all group-hover:bg-ok-green"
                style={{ width: `${responsePercent}%` }}
              />
            </div>
          </div>

          {/* Verification gates */}
          <div className="flex flex-wrap gap-1.5 min-w-[120px]">
            {survey.requirements.length > 0 ? (
              survey.requirements.map((req, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-[10px] font-medium tracking-wide",
                    req.type === "token_hold"
                      ? "text-ok-purple"
                      : "text-[#9198A1]"
                  )}
                >
                  {req.type === "token_hold" && <Bot className="h-3 w-3" />}
                  {req.label}
                </span>
              ))
            ) : (
              <span className="font-mono text-[10px] text-[#656C76]">Open Eligibility</span>
            )}
          </div>

          {/* Temporal constraints */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-[#9198A1] min-w-[80px]">
            <Clock className="h-3.5 w-3.5 text-[#656C76]" />
            <span>{isOpen ? formatTimeRemaining(survey.closesAt) : "Concluded"}</span>
          </div>
        </div>

        {/* Right Section: Pool Parameters & Execution Trigger */}
        <div className="flex items-center justify-between border-t border-[#3D444D]/40 pt-4 lg:border-t-0 lg:pt-0 lg:justify-end gap-6 shrink-0">
          <div className="flex flex-col lg:items-end">
            <span className="font-mono text-base font-medium text-ok-green">
              {survey.rewardPool.toFixed(2)} SOL
            </span>
            <span className="font-mono text-[10px] text-[#656C76] uppercase tracking-wider">
              {survey.rewardType === "weighted"
                ? "Weighted Allocation"
                : `${survey.numWinners ?? 5} Payout Targets`}
            </span>
          </div>

          <div className="h-8 w-8 hidden sm:flex items-center justify-center rounded border border-[#3D444D] bg-[#151B23] transition-colors group-hover:border-[#9198A1]">
            <ArrowRight className="h-3.5 w-3.5 text-[#656C76] transition-transform group-hover:translate-x-0.5 group-hover:text-[#F0F6F6]" />
          </div>
        </div>

      </div>
    </Link>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Explore() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterLabel>("All");
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);

  const sortOptions: { label: string; value: SortKey }[] = [
    { label: "Latest Deployment", value: "latest" },
    { label: "Highest Value Pool", value: "highest_reward" },
    { label: "Maximum Response Density", value: "most_responses" },
    { label: "Ending Soon", value: "ending_soon" },
  ];

  const filtered = useMemo(() => {
    let list = [...SURVEYS];

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
      if (sortKey === "latest") return b.closesAt.getTime() - a.closesAt.getTime();
      if (sortKey === "highest_reward") return b.rewardPool - a.rewardPool;
      if (sortKey === "most_responses") return b.responses - a.responses;
      if (sortKey === "ending_soon") return a.closesAt.getTime() - b.closesAt.getTime();
      return 0;
    });

    return list;
  }, [search, activeFilter, sortKey]);

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
          className="group flex items-center gap-3 text-sm font-medium text-[#9198A1] transition-colors hover:text-[#F0F6F6]"
        >
          <Link2 className="h-4 w-4 text-ok-green" />
          <span className="tracking-tight text-[#F0F6F6]">Okaform</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/how-it-works"
            className="font-mono text-xs text-[#9198A1] transition-colors hover:text-[#F0F6F6]"
          >
            How It Works
          </Link>
          <Link to="/create">
            <Button variant="primary" size="sm">
              Create Survey
            </Button>
          </Link>
        </div>
      </nav>

      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-8 pt-20 pb-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <span className="font-mono text-xs text-ok-green tracking-wider uppercase">[ Public Index ]</span>
            <h1 className="text-3xl font-medium tracking-tight text-[#F0F6F6] sm:text-4xl">
              Verified Campaigns
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-[#9198A1]">
              Cryptographically audited community parameters directly tied to the Solana account ledger.
            </p>
          </div>
          <div className="shrink-0">
            <WalletBadge />
          </div>
        </div>
      </div>

      {/* ─── FILTER BAR ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-y border-[#3D444D] bg-[#0D1117]/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-8 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-6">
              
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#656C76]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Query vector identifier..."
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

              {/* Filter pills */}
              <div className="flex flex-wrap gap-1">
                {filterOptions.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors",
                      activeFilter === f
                        ? "bg-ok-green/10 text-ok-green"
                        : "text-[#656C76] hover:text-[#F0F6F6]"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort + count */}
            <div className="flex items-center justify-between md:justify-end gap-6 border-t border-[#3D444D]/40 pt-3 md:border-t-0 md:pt-0">
              <span className="font-mono text-[11px] text-[#656C76]">
                {filtered.length} Segment{filtered.length !== 1 ? "s" : ""} Found
              </span>
              <div className="relative">
                <button
                  onClick={() => setShowSortDropdown((v) => !v)}
                  className="flex items-center gap-1.5 border-b border-transparent py-1 font-mono text-[11px] uppercase tracking-wide text-[#9198A1] transition-colors hover:border-[#656C76] hover:text-[#F0F6F6]"
                >
                  {sortOptions.find((o) => o.value === sortKey)?.label}
                  <ChevronDown className="h-3 w-3 text-[#656C76]" />
                </button>
                {showSortDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSortDropdown(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-2 w-52 border border-[#3D444D] bg-[#151B23] shadow-2xl">
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

      {/* ─── SURVEY LIST ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-8 pb-24">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-32 text-center">
            <Search className="h-5 w-5 text-[#656C76]" />
            <h3 className="text-base font-medium text-[#F0F6F6]">
              Zero Active Queries Found
            </h3>
            <p className="text-sm text-[#9198A1]">
              No database blocks match the active sorting/filter matrices.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setActiveFilter("All");
              }}
              className="mt-2 font-mono text-xs text-ok-green border-b border-transparent hover:border-ok-green transition-colors"
            >
              [ Flush Pipeline Parameters ]
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#3D444D]/50">
            {displayed.map((survey) => (
              <SurveyRow
                key={survey.id}
                survey={survey}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {visibleCount < filtered.length && (
          <div className="pt-12 text-center border-t border-[#3D444D]">
            <button
              onClick={() => setVisibleCount((v) => v + 8)}
              className="font-mono text-xs text-[#9198A1] border border-[#3D444D] bg-[#151B23] px-6 py-2.5 transition-colors hover:border-[#9198A1] hover:text-[#F0F6F6]"
            >
              Load Additional Indexes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}