import { Link } from "react-router-dom";
import {
  FileText,
  Activity,
  Users,
  Server,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { useAuth } from "@/components/AuthProvider";
import { truncateAddress, getBadgeTier } from "@/components/okaform";
import { cn } from "@/lib/utils";
import solanaLogo from "@/assets/icons/solana-logo.svg";


// ─── Mock data ─────────────────────────────────────────────────────────────────

const ACTIVITY_FEED = [
  {
    color: "bg-ok-green",
    text: "Jupiter Community Pulse received 12 new responses",
    time: "2 hours ago",
  },
  {
    color: "bg-ok-warning",
    text: "Tensor Trader Feedback distribution complete — ◎ 30 SOL sent to 500 wallets",
    time: "5 hours ago",
  },
  {
    color: "bg-ok-danger",
    text: "2 flagged responses detected on Jupiter Community Pulse",
    time: "6 hours ago",
  },
  {
    color: "bg-ok-green",
    text: "New Sovereign respondent submitted to Jupiter Community Pulse",
    time: "8 hours ago",
  },
  {
    color: "bg-[#656C76]",
    text: "Drift Protocol UX Survey closed manually",
    time: "12 hours ago",
  },
  {
    color: "bg-ok-green",
    text: "Jupiter Community Pulse published — ◎ 50 SOL escrowed",
    time: "2 days ago",
  },
];

interface SurveySummary {
  id: string;
  title: string;
  status: string;
  responses: number;
  maxResponses: number;
  rewardPool: number;
}

// ─── HomeView component ────────────────────────────────────────────────────────

export default function HomeView({ surveys }: { surveys: SurveySummary[] }) {
  const { publicKey } = useWallet();
  const { user } = useAuth();

  const wallet = publicKey?.toBase58();
  const score = user?.globalScore ?? 0;
  const tier = getBadgeTier(score);
  const surveysCompleted = surveys.length;
  const activeSurveys = surveys.filter((s) => s.status === "active");
  const totalResponses = surveys.reduce((sum, s) => sum + s.responses, 0);
  const solDistributed = surveys
    .filter((s) => s.status === "closed")
    .reduce((sum, s) => sum + s.rewardPool, 0);

  const tierNames: Record<string, string> = {
    grey: "Ghost",
    blue: "Cipher",
    green: "Sentinel",
    gold: "Oracle",
    diamond: "Sovereign",
  };

  const greeting = surveysCompleted > 0 ? tierNames[tier] ?? "Creator" : "Creator";
  const tierEmoji = tier === "diamond" ? " 💎" : tier === "gold" ? " 🏛️" : "";

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: Welcome Header ────────────────────────────────────── */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            DASHBOARD // OKAFORM
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#F0F6F6]">
            Good morning, {greeting}{tierEmoji}
          </h1>
          <p className="mt-1 font-mono text-xs text-[#9198A1]">
            {wallet ? truncateAddress(wallet) : "Not connected"} · Global Score: {score} · {surveysCompleted} surveys completed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded border border-[#3D444D] bg-transparent px-4 py-2 font-mono text-xs text-[#9198A1] transition-colors hover:border-[#656C76] hover:text-[#F0F6F6]"
          >
            View Profile
          </Link>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 rounded bg-ok-green px-4 py-2 font-mono text-xs font-semibold text-[#0D1117] transition-all hover:bg-[#10C97A] hover:shadow-[0_0_15px_rgba(20,241,149,0.2)]"
          >
            Create Survey
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── SECTION 2: Quick Stats ────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Surveys */}
        <div className="relative rounded border border-[#3D444D] bg-[#151B23] p-4">
          <div className="absolute right-3 top-3">
            <FileText className="h-4 w-4 text-[#9198A1]" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            TOTAL SURVEYS
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-[#F0F6F6]">
            {surveysCompleted}
          </p>
        </div>

        {/* Active Now */}
        <div className="relative rounded border border-[#3D444D] bg-[#151B23] p-4">
          <div className="absolute right-3 top-3">
            <Activity className="h-4 w-4 text-[#9198A1]" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            ACTIVE NOW
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-ok-green">
            {activeSurveys.length}
          </p>
        </div>

        {/* Total Responses */}
        <div className="relative rounded border border-[#3D444D] bg-[#151B23] p-4">
          <div className="absolute right-3 top-3">
            <Users className="h-4 w-4 text-[#9198A1]" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            RESPONSES COLLECTED
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-[#F0F6F6]">
            {totalResponses.toLocaleString()}
          </p>
        </div>

        {/* SOL Distributed */}
        <div className="relative rounded border border-[#3D444D] bg-[#151B23] p-4">
          <div className="absolute right-3 top-3">
            <Server className="h-4 w-4 text-[#9198A1]" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            SOL DISTRIBUTED
          </p>
          <p className="mt-2 font-mono text-2xl font-bold">
            <span className="inline-flex items-center gap-1.5">
              <img src={solanaLogo} alt="Solana" className="h-5 w-5 text-ok-green" />{" "}
              <span className="text-[#F0F6F6]">{solDistributed}</span>
            </span>
           
          </p>
        </div>
      </div>

      {/* ── SECTION 3: Recent Activity Feed ───────────────────────────────── */}
      <div className="rounded border border-[#3D444D] bg-[#151B23]">
        <div className="flex items-center justify-between border-b border-[#3D444D]/50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            RECENT ACTIVITY
          </p>
          <Link
            to="/dashboard"
            className="font-mono text-[10px] text-[#656C76] transition-colors hover:text-[#F0F6F6]"
          >
            View all →
          </Link>
        </div>
        <div className="divide-y divide-[#3D444D]/30">
          {ACTIVITY_FEED.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.color)} />
              <p className="flex-1 text-xs text-[#9198A1]">{item.text}</p>
              <span className="shrink-0 font-mono text-[10px] text-[#656C76]">
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 4: Active Surveys ─────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            ACTIVE SURVEYS
          </p>
          <Link
            to="/dashboard"
            className="font-mono text-[10px] text-[#656C76] transition-colors hover:text-[#F0F6F6]"
          >
            Go to My Surveys →
          </Link>
        </div>

        {activeSurveys.length > 0 ? (
          <div className="space-y-3">
            {activeSurveys.map((survey) => (
              <div
                key={survey.id}
                className="flex flex-col gap-4 rounded border border-[#3D444D] bg-[#151B23] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#F0F6F6]">
                    {survey.title}
                  </p>
                  <span className="mt-1 inline-flex items-center rounded border border-ok-green/20 bg-ok-green/10 px-1.5 py-0.5 font-mono text-[9px] text-ok-green uppercase tracking-wider">
                    Active
                  </span>
                </div>
                <div className="min-w-[140px]">
                  <p className="font-mono text-xs text-[#9198A1]">
                    {survey.responses} / {survey.maxResponses} responses
                  </p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#3D444D]">
                    <div
                      className="h-full rounded-full bg-ok-green"
                      style={{ width: `${(survey.responses / survey.maxResponses) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-ok-green">
                    <img src={solanaLogo} alt="Solana" className="h-2 w-3" />
                    {survey.rewardPool}
                  </span>
                  <Link
                    to="/dashboard"
                    className="rounded border border-[#3D444D] bg-transparent px-2.5 py-1 font-mono text-[10px] text-[#9198A1] transition-colors hover:border-[#656C76] hover:text-[#F0F6F6]"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded border border-[#3D444D] bg-[#151B23] py-12 text-center">
            <FileText className="h-8 w-8 text-[#656C76]/30" />
            <p className="font-mono text-xs text-[#9198A1]">No active surveys</p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded bg-ok-green px-4 py-2 font-mono text-xs font-semibold text-[#0D1117] transition-all hover:bg-[#10C97A]"
            >
              Create Survey →
            </Link>
          </div>
        )}
      </div>

      {/* ── SECTION 5: Platform Tips ──────────────────────────────────────── */}
      {surveysCompleted < 3 && (
        <div className="rounded border border-ok-green/10 bg-[#151B23] p-5">
          <div className="border-l-2 border-ok-green pl-4">
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-ok-green">
              Getting started
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-ok-green" />
                <span className="text-xs text-[#9198A1]">Connect your wallet</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-ok-green" />
                <span className="text-xs text-[#9198A1]">Create your first survey</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-[#656C76]" />
                <span className="text-xs text-[#9198A1]">Get your first 10 responses</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-[#656C76]" />
                <span className="text-xs text-[#9198A1]">Reach Cipher tier (score 26+)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
