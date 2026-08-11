import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAnalytics,
  type AnalyticsResponseItem,
  type AnalyticsDistributionItem,
} from "@/lib/forms";
import { getBadgeTier, type BadgeTier } from "@/lib/tiers";

export type TimeRange = "7D" | "30D" | "90D" | "ALL";

export interface VolumePoint {
  label: string;
  count: number;
}

export interface BadgeBucket {
  tier: BadgeTier;
  count: number;
  percent: number;
}

export interface FlagStat {
  label: string;
  count: number;
  percent: number;
}

export interface SurveyRow {
  id: string;
  title: string;
  status: string;
  responseCount: number;
  maxResponses: number;
  completion: number;
  avgScore: number | null;
  rewardPool: number;
}

export interface AnalyticsDeltas {
  responses: number | null;
  completion: number | null;
  score: number | null;
  sol: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_TIME = 5 * 60_000;
const RANGE_MS: Record<Exclude<TimeRange, "ALL">, number> = {
  "7D": 7 * DAY_MS,
  "30D": 30 * DAY_MS,
  "90D": 90 * DAY_MS,
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIER_ORDER: BadgeTier[] = ["diamond", "gold", "green", "blue", "grey"];

const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const pctChange = (current: number, previous: number): number | null =>
  previous > 0
    ? Math.round(((current - previous) / previous) * 1000) / 10
    : null;

const mean = (values: number[]): number | null =>
  values.length > 0
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : null;

function weekBuckets(
  startMs: number,
  nowMs: number,
): { start: number; label: string }[] {
  const buckets: { start: number; label: string }[] = [];
  const diffToMonday = (new Date(startMs).getDay() + 6) % 7;
  let cursor = startOfDay(startMs) - diffToMonday * DAY_MS;
  while (cursor <= nowMs) {
    const label = new Date(cursor).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    buckets.push({ start: cursor, label });
    cursor += 7 * DAY_MS;
  }
  return buckets;
}

function monthBuckets(
  startMs: number,
  nowMs: number,
): { start: number; label: string }[] {
  const buckets: { start: number; label: string }[] = [];
  const first = new Date(startMs);
  let cursor = new Date(first.getFullYear(), first.getMonth(), 1).getTime();
  const sameYear =
    new Date(cursor).getFullYear() === new Date(nowMs).getFullYear();
  while (cursor <= nowMs) {
    const label = new Date(cursor).toLocaleDateString("en-US", {
      month: "short",
      ...(sameYear ? {} : { year: "2-digit" }),
    });
    buckets.push({ start: cursor, label });
    cursor = new Date(
      new Date(cursor).getFullYear(),
      new Date(cursor).getMonth() + 1,
      1,
    ).getTime();
  }
  return buckets;
}

function countBuckets(
  buckets: { start: number; label: string }[],
  times: number[],
  nowMs: number,
): VolumePoint[] {
  return buckets.map((b, i) => {
    const end = i < buckets.length - 1 ? buckets[i + 1].start : nowMs + 1;
    return {
      label: b.label,
      count: times.filter((t) => t >= b.start && t < end).length,
    };
  });
}

function buildVolumeSeries(
  responses: AnalyticsResponseItem[],
  timeRange: TimeRange,
  nowMs: number,
): VolumePoint[] {
  const times = responses.map((r) => new Date(r.submittedAt).getTime());

  if (timeRange === "7D") {
    const dayStart = startOfDay(nowMs);
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const start = dayStart - (6 - i) * DAY_MS;
      return { start, label: WEEKDAY[new Date(start).getDay()] ?? "" };
    });
    return countBuckets(buckets, times, nowMs);
  }

  if (timeRange === "30D") {
    return countBuckets(
      weekBuckets(nowMs - RANGE_MS["30D"], nowMs),
      times,
      nowMs,
    );
  }

  const rangeStart =
    timeRange === "90D"
      ? nowMs - RANGE_MS["90D"]
      : times.length > 0
        ? Math.min(...times)
        : nowMs - 365 * DAY_MS;
  return countBuckets(monthBuckets(rangeStart, nowMs), times, nowMs);
}

type ResponseWithFormId = AnalyticsResponseItem & { formId: string };

export function useAnalytics(timeRange: TimeRange) {
  const analyticsQuery = useQuery({
    queryKey: ["analytics"],
    queryFn: getAnalytics,
    staleTime: STALE_TIME,
    retry: false,
  });

  const forms = useMemo(
    () => analyticsQuery.data?.forms ?? [],
    [analyticsQuery.data],
  );

  const allResponses = useMemo<ResponseWithFormId[]>(() => {
    const list: ResponseWithFormId[] = [];
    forms.forEach((form) =>
      form.responses.forEach((r) => list.push({ ...r, formId: form.id })),
    );
    return list;
  }, [forms]);

  const allDistributions = useMemo<AnalyticsDistributionItem[]>(() => {
    const list: AnalyticsDistributionItem[] = [];
    forms.forEach((form) => list.push(...form.distributions));
    return list;
  }, [forms]);

  const rows = useMemo<SurveyRow[]>(
    () =>
      forms.map((form) => {
        const count = form.responses.length;
        const completion =
          form.maxResponses > 0
            ? Math.min(100, Math.round((count / form.maxResponses) * 100))
            : 0;
        const scores = form.responses
          .map((r) => r.scoreAtSubmission)
          .filter((s) => Number.isFinite(s));
        const avgScore = mean(scores);
        return {
          id: form.id,
          title: form.title,
          status: form.status,
          responseCount: count,
          maxResponses: form.maxResponses,
          completion,
          avgScore: avgScore !== null ? Math.round(avgScore) : null,
          rewardPool: form.rewardPool,
        };
      }),
    [forms],
  );

  const metrics = useMemo(() => {
    const nowMs = Date.now();
    const rangeStart = timeRange === "ALL" ? 0 : nowMs - RANGE_MS[timeRange];
    const prevStart =
      timeRange === "ALL" ? null : rangeStart - RANGE_MS[timeRange];

    const inRange = (ts: number, start: number, end: number) =>
      ts >= start && ts < end;

    const current = allResponses.filter((r) => {
      const ts = new Date(r.submittedAt).getTime();
      return ts >= rangeStart && ts <= nowMs;
    });
    const previous =
      prevStart !== null
        ? allResponses.filter((r) => {
            const ts = new Date(r.submittedAt).getTime();
            return inRange(ts, prevStart, rangeStart);
          })
        : [];

    const currentDistributions = allDistributions.filter((d) => {
      const ts = new Date(d.distributedAt).getTime();
      return ts >= rangeStart && ts <= nowMs;
    });
    const previousDistributions =
      prevStart !== null
        ? allDistributions.filter((d) => {
            const ts = new Date(d.distributedAt).getTime();
            return inRange(ts, prevStart, rangeStart);
          })
        : [];

    const completionFor = (subs: ResponseWithFormId[]) => {
      const rates: number[] = [];
      forms.forEach((form) => {
        if (form.maxResponses <= 0) return;
        const count = subs.filter((r) => r.formId === form.id).length;
        rates.push(Math.min(100, (count / form.maxResponses) * 100));
      });
      return mean(rates);
    };

    const avgScoreFor = (subs: ResponseWithFormId[]) =>
      mean(
        subs.map((r) => r.scoreAtSubmission).filter((s) => Number.isFinite(s)),
      );

    const solFor = (dist: AnalyticsDistributionItem[]) =>
      dist.reduce((sum, d) => sum + d.amountLamports, 0) / 1e9;

    const totalResponses = current.length;
    const previousResponses = previous.length;
    const avgCompletionRate = completionFor(current);
    const previousCompletionRate = completionFor(previous);
    const avgScore = avgScoreFor(current);
    const previousAvgScore = avgScoreFor(previous);
    const solDistributed = solFor(currentDistributions);
    const previousSolDistributed = solFor(previousDistributions);

    const deltas: AnalyticsDeltas = {
      responses: pctChange(totalResponses, previousResponses),
      completion:
        avgCompletionRate !== null && previousCompletionRate !== null
          ? pctChange(avgCompletionRate, previousCompletionRate)
          : null,
      score:
        avgScore !== null && previousAvgScore !== null
          ? pctChange(avgScore, previousAvgScore)
          : null,
      sol: pctChange(solDistributed, previousSolDistributed),
    };

    return {
      totalResponses,
      avgCompletionRate:
        avgCompletionRate !== null ? Math.round(avgCompletionRate) : null,
      avgScore: avgScore !== null ? Math.round(avgScore) : null,
      solDistributed,
      deltas,
      volumeSeries: buildVolumeSeries(allResponses, timeRange, nowMs),
    };
  }, [allResponses, allDistributions, forms, timeRange]);

  const quality = useMemo(() => {
    const total = allResponses.length;
    const tierCounts: Record<BadgeTier, number> = {
      grey: 0,
      blue: 0,
      green: 0,
      gold: 0,
      diamond: 0,
    };
    allResponses.forEach((r) => {
      tierCounts[getBadgeTier(r.scoreAtSubmission)] += 1;
    });

    const badgeDistribution: BadgeBucket[] = TIER_ORDER.map((tier) => ({
      tier,
      count: tierCounts[tier],
      percent: total > 0 ? (tierCounts[tier] / total) * 100 : 0,
    }));

    const similarity = allResponses.filter((r) => r.similarityFlag).length;
    const manuallyFlagged = allResponses.filter(
      (r) => r.moderationStatus === "flagged",
    ).length;
    const rejected = allResponses.filter(
      (r) => r.moderationStatus === "rejected",
    ).length;

    const flaggedStats: FlagStat[] = [
      {
        label: "Similarity flagged",
        count: similarity,
        percent: total > 0 ? (similarity / total) * 100 : 0,
      },
      {
        label: "Manually flagged",
        count: manuallyFlagged,
        percent: total > 0 ? (manuallyFlagged / total) * 100 : 0,
      },
      {
        label: "Rejected",
        count: rejected,
        percent: total > 0 ? (rejected / total) * 100 : 0,
      },
    ];

    return { badgeDistribution, flaggedStats };
  }, [allResponses]);

  return {
    rows,
    ...metrics,
    ...quality,
    formCount: forms.length,
    isLoading: analyticsQuery.isPending,
    hasError: analyticsQuery.isError,
  };
}
