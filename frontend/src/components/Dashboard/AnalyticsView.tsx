import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/okaform";
import solanaLogo from "@/assets/icons/solana-logo.svg";
import SolanaLogo from "@/components/SolanaLogo";
import { cn } from "@/lib/utils";
import { useAnalytics, type TimeRange } from "@/hooks/useAnalytics";

const TIME_RANGES: TimeRange[] = ["7D", "30D", "90D", "ALL"];

const formatTimeRangeLabel = (range: TimeRange): string => {
  switch (range) {
    case "7D":
      return "Last 7 days";
    case "30D":
      return "Last 30 days";
    case "90D":
      return "Last 90 days";
    case "ALL":
      return "All time";
  }
};

const formatSol = (sol: number): string =>
  sol.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface AnalyticsViewProps {
  onSelectSurvey?: (id: string) => void;
}

// ─── AnalyticsView component ───────────────────────────────────────────────────

export default function AnalyticsView({ onSelectSurvey }: AnalyticsViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("7D");

  const {
    rows,
    totalResponses,
    avgCompletionRate,
    avgScore,
    solDistributed,
    deltas,
    volumeSeries,
    badgeDistribution,
    flaggedStats,
    isLoading,
    hasError,
    formCount,
  } = useAnalytics(timeRange);

  const maxCount = Math.max(0, ...volumeSeries.map((d) => d.count));

  const renderDelta = (delta: number | null) => {
    if (delta === null) {
      return (
        <span className="font-mono text-[10px] text-[#656C76]">Lifetime</span>
      );
    }
    const up = delta >= 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <div className="mt-1 flex items-center gap-1">
        <Icon
          className={cn("h-3 w-3", up ? "text-ok-green" : "text-ok-danger")}
        />
        <span
          className={cn(
            "font-mono text-[10px]",
            up ? "text-ok-green" : "text-ok-danger",
          )}
        >
          {up ? "+" : ""}
          {delta}% vs last period
        </span>
      </div>
    );
  };

  if (formCount === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
              ANALYTICS
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold text-[#F0F6F6]">
              Performance Overview
            </h1>
          </div>
        </div>
        <div className="rounded border border-[#3D444D] bg-[#151B23] p-10 text-center">
          <p className="font-mono text-sm text-[#656C76]">
            No surveys yet — create your first survey to see analytics.
          </p>
        </div>
      </div>
    );
  }

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
                  : "text-[#656C76] hover:text-[#9198A1]",
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#656C76]" />
        </div>
      ) : (
        <>
          {hasError && (
            <div className="rounded border border-ok-warning/30 bg-ok-warning/10 px-4 py-3 text-xs text-ok-warning">
              Some analytics data failed to load and may be incomplete. Please
              try again later.
            </div>
          )}

          {/* ── SECTION 2: Key Metrics Row ────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Response Volume */}
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                TOTAL RESPONSES
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-[#F0F6F6]">
                {totalResponses.toLocaleString()}
              </p>
              {renderDelta(deltas.responses)}
            </div>

            {/* Completion Rate */}
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                AVG COMPLETION RATE
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-[#F0F6F6]">
                {avgCompletionRate !== null ? `${avgCompletionRate}%` : "—"}
              </p>
              {avgCompletionRate !== null
                ? renderDelta(deltas.completion)
                : renderDelta(null)}
            </div>

            {/* Avg Respondent Score */}
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                AVG RESPONDENT SCORE
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-[#F0F6F6]">
                {avgScore !== null ? avgScore : "—"}
              </p>
              {avgScore !== null
                ? renderDelta(deltas.score)
                : renderDelta(null)}
            </div>

            {/* SOL Distributed */}
            <div className="rounded border border-[#3D444D] bg-[#151B23] p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                SOL DISTRIBUTED
              </p>
              <p className="mt-2 font-mono text-2xl font-bold">
                <img src={solanaLogo} alt="Solana" className="inline h-5 w-5" />{" "}
                <span className="text-[#F0F6F6]">
                  {formatSol(solDistributed)}
                </span>
              </p>
              {renderDelta(deltas.sol)}
            </div>
          </div>

          {/* ── SECTION 3: Response Volume Chart ──────────────────────────── */}
          <div className="rounded border border-[#3D444D] bg-[#151B23] p-5">
            <div className="mb-6 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                RESPONSE VOLUME
              </p>
              <span className="rounded border border-[#3D444D] bg-[#0D1117] px-2 py-0.5 font-mono text-[9px] text-[#656C76]">
                {formatTimeRangeLabel(timeRange)}
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
              {volumeSeries.map((d) => (
                <div
                  key={d.label}
                  className="group relative flex flex-1 flex-col items-center gap-1"
                >
                  {/* Value on hover */}
                  <span className="absolute -top-6 font-mono text-[10px] text-ok-green opacity-0 transition-opacity group-hover:opacity-100">
                    {d.count}
                  </span>
                  {/* Bar */}
                  <div
                    className="w-8 rounded-sm bg-ok-green/30 transition-colors group-hover:bg-ok-green/60"
                    style={{
                      height: `${maxCount > 0 ? (d.count / maxCount) * 120 : 0}px`,
                    }}
                  />
                  {/* Label */}
                  <span className="font-mono text-[10px] text-[#656C76]">
                    {d.label}
                  </span>
                </div>
              ))}

              {maxCount === 0 && (
                <p className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-[#656C76]">
                  No responses in this period
                </p>
              )}
            </div>
          </div>

          {/* ── SECTION 4: Two Column Split ────────────────────────────────── */}
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Left: Badge Distribution */}
            <div className="flex-1 rounded border border-[#3D444D] bg-[#151B23] p-5">
              <p className="mb-5 font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
                RESPONDENT QUALITY
              </p>
              <div className="space-y-4">
                {badgeDistribution.map((b) => (
                  <div key={b.tier} className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <Badge tier={b.tier} className="text-[10px]" />
                    </div>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-[#3D444D]/50">
                        <div
                          className="h-full rounded-full bg-ok-green transition-all"
                          style={{ width: `${Math.min(100, b.percent)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <span className="font-mono text-xs text-[#9198A1]">
                        {b.count}{" "}
                        <span className="text-[#656C76]">
                          ({b.percent.toFixed(1)}%)
                        </span>
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
                {flaggedStats.map((stat, i) => (
                  <div
                    key={stat.label}
                    className={cn(
                      "flex items-center justify-between py-3",
                      i < flaggedStats.length - 1 &&
                        "border-b border-[#3D444D]/30",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-ok-warning" />
                      <span className="text-xs text-[#9198A1]">
                        {stat.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-medium text-[#F0F6F6]">
                        {stat.count}
                      </span>
                      <span className="ml-1 font-mono text-[10px] text-[#656C76]">
                        ({stat.percent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-[#3D444D]/30 pt-4 text-[10px] leading-relaxed text-[#656C76]">
                Flagged responses are visible to creators. Sybil rejections
                never reach the survey.
              </p>
            </div>
          </div>

          {/* ── SECTION 5: Survey Performance Table ────────────────────────── */}
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
                  {rows.map((survey) => (
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
                              : "border-[#3D444D] bg-[#0D1117] text-[#656C76]",
                          )}
                        >
                          {survey.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-[#9198A1]">
                        <span className="text-[#F0F6F6]">
                          {survey.responseCount}
                        </span>{" "}
                        / {survey.maxResponses}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[#9198A1]">
                        {survey.completion}%
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[#9198A1]">
                        {survey.avgScore !== null ? survey.avgScore : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs font-medium text-ok-green">
                          <SolanaLogo className="h-3 w-auto" />{" "}
                          {survey.rewardPoolSol.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => onSelectSurvey?.(survey.id)}
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-[#9198A1] transition-colors hover:text-[#F0F6F6]"
                        >
                          View Survey →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
