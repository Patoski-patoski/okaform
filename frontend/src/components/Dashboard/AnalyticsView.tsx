import { useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/okaform";
import solanaLogo from "@/assets/icons/solana-logo.svg";
import { cn } from "@/lib/utils";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const RESPONSE_DATA = [
  { day: "Mon", count: 42 },
  { day: "Tue", count: 67 },
  { day: "Wed", count: 58 },
  { day: "Thu", count: 31 },
  { day: "Fri", count: 24 },
  { day: "Sat", count: 8 },
  { day: "Sun", count: 4 },
];

const BADGE_DISTRIBUTION = [
  { tier: "diamond" as const, label: "Sovereign", count: 89, percent: 8.5 },
  { tier: "gold" as const, label: "Oracle", count: 201, percent: 19.2 },
  { tier: "green" as const, label: "Sentinel", count: 312, percent: 29.8 },
  { tier: "blue" as const, label: "Cipher", count: 287, percent: 27.4 },
  { tier: "grey" as const, label: "Ghost", count: 157, percent: 15.0 },
];

const FLAGGED_STATS = [
  { label: "Similarity flagged", count: 23, percent: 2.2 },
  { label: "Funding-graph risk", count: 8, percent: 0.8 },
  { label: "Sybil rejected", count: 41, percent: 3.9 },
];

const SURVEYS = [
  {
    id: "s1",
    title: "Jupiter Community Pulse",
    status: "active" as const,
    responses: 234,
    maxResponses: 500,
    completion: 78,
    avgScore: 72,
    rewardPool: 50,
  },
  {
    id: "s2",
    title: "Tensor Trader Feedback",
    status: "closed" as const,
    responses: 500,
    maxResponses: 500,
    completion: 100,
    avgScore: 65,
    rewardPool: 30,
  },
  {
    id: "s3",
    title: "Drift Protocol UX Survey",
    status: "closed" as const,
    responses: 312,
    maxResponses: 400,
    completion: 78,
    avgScore: 58,
    rewardPool: 45.5,
  },
];

const TIME_RANGES = ["7D", "30D", "90D", "ALL"] as const;

type TimeRange = typeof TIME_RANGES[number];

// ─── AnalyticsView component ───────────────────────────────────────────────────

export default function AnalyticsView() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7D");

  const maxCount = Math.max(...RESPONSE_DATA.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            ANALYTICS
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#F0F6F6]">
            Performance Overview
          </h1>
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "rounded px-3 py-1.5 font-mono text-xs transition-all",
                timeRange === range
                  ? "bg-ok-green/10 text-ok-green border border-ok-green/20"
                  : "text-[#656C76] hover:text-[#9198A1]"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* ── SECTION 2: Key Metrics Row ────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Response Volume */}
        <div className="rounded border border-[#3D444D] bg-[#151B23] p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            TOTAL RESPONSES
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-[#F0F6F6]">
            1,046
          </p>
          <div className="mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-ok-green" />
            <span className="font-mono text-[10px] text-ok-green">
              +12.4% vs last period
            </span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="rounded border border-[#3D444D] bg-[#151B23] p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            AVG COMPLETION RATE
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-[#F0F6F6]">
            78.3%
          </p>
          <div className="mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-ok-green" />
            <span className="font-mono text-[10px] text-ok-green">
              +2.1%
            </span>
          </div>
        </div>

        {/* Avg Time to Complete */}
        <div className="rounded border border-[#3D444D] bg-[#151B23] p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            AVG COMPLETION TIME
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-[#F0F6F6]">
            4m 32s
          </p>
          <div className="mt-1 flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-ok-green" />
            <span className="font-mono text-[10px] text-ok-green">
              -18s (faster)
            </span>
          </div>
        </div>

        {/* SOL Distributed */}
        <div className="rounded border border-[#3D444D] bg-[#151B23] p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            SOL DISTRIBUTED
          </p>
          <p className="mt-2 font-mono text-2xl font-bold">
            <img src={solanaLogo} alt="Solana" className="inline h-5 w-5" />{" "}
            <span className="text-[#F0F6F6]">125.5</span>
          </p>
          <div className="mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-ok-green" />
            <span className="font-mono text-[10px] text-ok-green">
              + <img src={solanaLogo} alt="Solana" className="inline h-2 w-2" />{" "}
              45.5 this period
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Response Volume Chart ───────────────────────────────── */}
      <div className="rounded border border-[#3D444D] bg-[#151B23] p-5">
        <div className="mb-6 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            RESPONSE VOLUME
          </p>
          <span className="rounded border border-[#3D444D] bg-[#0D1117] px-2 py-0.5 font-mono text-[9px] text-[#656C76]">
            Last 7 days
          </span>
        </div>

        <div className="relative flex items-end justify-between gap-2 h-36">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className="relative border-t border-[#3D444D]/30"
              >
                <span className="absolute -top-2.5 -left-1 font-mono text-[9px] text-[#656C76]">
                  {Math.round((maxCount * pct) / 100)}
                </span>
              </div>
            ))}
          </div>

          {/* Bars */}
          {RESPONSE_DATA.map((d) => (
            <div
              key={d.day}
              className="group relative flex flex-1 flex-col items-center gap-1"
            >
              {/* Value on hover */}
              <span className="absolute -top-6 font-mono text-[10px] text-ok-green opacity-0 transition-opacity group-hover:opacity-100">
                {d.count}
              </span>
              {/* Bar */}
              <div
                className="w-8 rounded-sm bg-ok-green/30 transition-colors group-hover:bg-ok-green/60"
                style={{ height: `${(d.count / maxCount) * 120}px` }}
              />
              {/* Day label */}
              <span className="font-mono text-[10px] text-[#656C76]">
                {d.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 4: Two Column Split ────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Badge Distribution */}
        <div className="flex-1 rounded border border-[#3D444D] bg-[#151B23] p-5">
          <p className="mb-5 font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            RESPONDENT QUALITY
          </p>
          <div className="space-y-4">
            {BADGE_DISTRIBUTION.map((b) => (
              <div key={b.tier} className="flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <Badge tier={b.tier} className="text-[10px]" />
                </div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-[#3D444D]/50">
                    <div
                      className="h-full rounded-full bg-ok-green transition-all"
                      style={{ width: `${b.percent}%` }}
                    />
                  </div>
                </div>
                <div className="w-24 shrink-0 text-right">
                  <span className="font-mono text-xs text-[#9198A1]">
                    {b.count}{" "}
                    <span className="text-[#656C76]">({b.percent}%)</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Flagged Responses */}
        <div className="w-full shrink-0 rounded border border-[#3D444D] bg-[#151B23] p-5 lg:w-72">
          <p className="mb-5 font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            QUALITY FLAGS
          </p>
          <div className="space-y-0">
            {FLAGGED_STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  "flex items-center justify-between py-3",
                  i < FLAGGED_STATS.length - 1 && "border-b border-[#3D444D]/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-ok-warning" />
                  <span className="text-xs text-[#9198A1]">{stat.label}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-medium text-[#F0F6F6]">
                    {stat.count}
                  </span>
                  <span className="ml-1 font-mono text-[10px] text-[#656C76]">
                    ({stat.percent}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-[#3D444D]/30 pt-4 text-[10px] leading-relaxed text-[#656C76]">
            Flagged responses are visible to creators. Sybil rejections never reach the survey.
          </p>
        </div>
      </div>

      {/* ── SECTION 5: Survey Performance Table ────────────────────────────── */}
      <div className="rounded border border-[#3D444D]/80 bg-[#151B23]/20">
        <div className="border-b border-[#3D444D] px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            SURVEY BREAKDOWN
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#3D444D] bg-[#151B23]/50 text-[10px] text-[#656C76] uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">Survey</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Responses</th>
                <th className="px-5 py-3 font-medium">Completion</th>
                <th className="px-5 py-3 font-medium">Avg Score</th>
                <th className="px-5 py-3 font-medium">SOL Pool</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3D444D]/30">
              {SURVEYS.map((survey) => (
                <tr
                  key={survey.id}
                  className="transition-colors hover:bg-[#151B23]/40"
                >
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-medium text-[#F0F6F6]">
                    {survey.title}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                        survey.status === "active"
                          ? "border-ok-green/20 bg-ok-green/10 text-ok-green"
                          : "border-[#3D444D] bg-[#0D1117] text-[#656C76]"
                      )}
                    >
                      {survey.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-[#9198A1]">
                    <span className="text-[#F0F6F6]">{survey.responses}</span>{" "}
                    / {survey.maxResponses}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[#9198A1]">
                    {survey.completion}%
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[#9198A1]">
                    {survey.avgScore}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs font-medium text-ok-green">
                      ◎ {survey.rewardPool}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      to="/dashboard"
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-[#9198A1] transition-colors hover:text-[#F0F6F6]"
                    >
                      View Survey →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
