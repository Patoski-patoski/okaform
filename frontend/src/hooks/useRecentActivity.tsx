import { useMemo, type ReactNode } from "react";
import { useQueries, useQueryClient, type Query } from "@tanstack/react-query";
import { getSubmissions } from "@/lib/forms";
import { getFormDistribution } from "@/lib/distribution";
import { getBadgeTier } from "@/lib/tiers";
import SolanaLogo from "@/components/SolanaLogo";

export interface RecentActivityItem {
  id: string;
  color: string;
  text: ReactNode;
  time: Date;
}

interface SurveySummary {
  id: string;
  title: string;
  rewardPool: number;
  createdAt: string;
  closedAt: string | null;
}

export const responsesQueryKey = (formId: string) =>
  ["responses", formId] as const;

export const distributionQueryKey = (formId: string) =>
  ["distribution", formId] as const;

const TIER_NAMES: Record<string, string> = {
  grey: "Ghost",
  blue: "Cipher",
  green: "Sentinel",
  gold: "Oracle",
  diamond: "Sovereign",
};

const PREMIUM_TIERS = new Set(["gold", "diamond"]);

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_TIME = 30_000;
const REFETCH_INTERVAL = 60_000;

export function useRecentActivity(surveys: SurveySummary[]) {
  const queryClient = useQueryClient();

  const recent = useMemo(
    () =>
      [...surveys]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5),
    [surveys],
  );

  const responseQueries = useQueries({
    queries: recent.map((survey) => ({
      queryKey: responsesQueryKey(survey.id),
      queryFn: () => getSubmissions(survey.id),
      staleTime: STALE_TIME,
      retry: false,
      refetchInterval: (query: Query) =>
        query.state.status === "error" ? false : REFETCH_INTERVAL,
    })),
  });

  const distributionQueries = useQueries({
    queries: recent.map((survey) => ({
      queryKey: distributionQueryKey(survey.id),
      queryFn: () => getFormDistribution(survey.id),
      staleTime: STALE_TIME,
      retry: false,
      refetchInterval: (query: Query) =>
        query.state.status === "error" ? false : REFETCH_INTERVAL,
    })),
  });

  const activity = useMemo<RecentActivityItem[]>(() => {
    const items: RecentActivityItem[] = [];
    const now = Date.now();

    recent.forEach((survey, i) => {
      const responses = responseQueries[i]?.data ?? [];
      const distribution = distributionQueries[i]?.data ?? [];

      items.push({
        id: `${survey.id}-published`,
        color: "bg-ok-green",
        text: (
          <>
            {survey.title} published — <SolanaLogo className="h-3 w-auto" />{" "}
            {survey.rewardPool} SOL escrowed
          </>
        ),
        time: new Date(survey.createdAt),
      });

      if (survey.closedAt) {
        items.push({
          id: `${survey.id}-closed`,
          color: "bg-[#656C76]",
          text: `${survey.title} closed`,
          time: new Date(survey.closedAt),
        });
      }

      if (distribution.length > 0) {
        const totalLamports = distribution.reduce(
          (sum, d) => sum + d.amountLamports,
          0,
        );
        const wallets = new Set(distribution.map((d) => d.recipientWallet));
        const latest = new Date(
          Math.max(
            ...distribution.map((d) => new Date(d.distributedAt).getTime()),
          ),
        );
        items.push({
          id: `${survey.id}-distributed`,
          color: "bg-ok-green",
          text: (
            <>
              {survey.title} distribution complete —{" "}
              <SolanaLogo className="h-3 w-auto" />{" "}
              {(totalLamports / 1e9).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              SOL sent to {wallets.size} wallet
              {wallets.size === 1 ? "" : "s"}
            </>
          ),
          time: latest,
        });
      }

      const recentResponses = responses.filter(
        (r) => now - new Date(r.submittedAt).getTime() <= DAY_MS,
      );
      if (recentResponses.length > 0) {
        items.push({
          id: `${survey.id}-new-responses`,
          color: "bg-ok-green",
          text: `${survey.title} received ${recentResponses.length} new response${recentResponses.length === 1 ? "" : "s"}`,
          time: new Date(
            Math.max(
              ...recentResponses.map((r) => new Date(r.submittedAt).getTime()),
            ),
          ),
        });
      }

      const premium = responses
        .filter((r) => PREMIUM_TIERS.has(getBadgeTier(r.scoreAtSubmission)))
        .sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() -
            new Date(a.submittedAt).getTime(),
        )[0];
      if (premium) {
        items.push({
          id: `${survey.id}-premium-${premium.id}`,
          color: "bg-ok-green",
          text: `New ${TIER_NAMES[getBadgeTier(premium.scoreAtSubmission)] ?? "top-tier"} respondent submitted to ${survey.title}`,
          time: new Date(premium.submittedAt),
        });
      }

      const flagged = responses.filter((r) => r.moderationStatus === "flagged");
      if (flagged.length > 0) {
        items.push({
          id: `${survey.id}-flagged`,
          color: "bg-ok-danger",
          text: `${flagged.length} flagged response${flagged.length === 1 ? "" : "s"} detected on ${survey.title}`,
          time: new Date(
            Math.max(...flagged.map((r) => new Date(r.submittedAt).getTime())),
          ),
        });
      }
    });

    return items
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 8);
  }, [recent, responseQueries, distributionQueries]);

  const isLoading =
    responseQueries.some((q) => q.isPending) ||
    distributionQueries.some((q) => q.isPending);

  const hasError =
    responseQueries.some((q) => q.isError) ||
    distributionQueries.some((q) => q.isError);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["responses"] });
    queryClient.invalidateQueries({ queryKey: ["distribution"] });
  };

  return { activity, isLoading, hasError, invalidate };
}
