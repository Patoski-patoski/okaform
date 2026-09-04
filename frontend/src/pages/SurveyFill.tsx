import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Loader2, ShieldX, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/okaform";
import { cn } from "@/lib/utils";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import OkaformLogo from "@/components/OkaformLogo";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import {
  WalletGate,
  EligibilityPass,
  QuestionCard,
  SuccessScreen,
} from "@/components/Survey";
import { validateAnswers } from "@/utils/survey-validation";
import CurrencyLogo from "@/components/CurrencyLogo";
import type { Question, QuestionType } from "@/types/survey";
import {
  getFormById,
  submitResponse,
  getSubmissions,
  checkSybilEligibility,
  type FormDetail,
} from "@/lib/forms";
import type { QuestionOption } from "@/types/survey";
import { ensureScoreAccountOnChain } from "@/lib/solana/initializeScore";
import { logger } from "@/lib/logger";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toFrontendQuestion(q: FormDetail["questions"][number]): Question {
  const options: QuestionOption[] | undefined = q.options?.length
    ? q.options.map((label, i) => ({ id: `${q.id}-opt-${i}`, label }))
    : undefined;
  return {
    id: q.id,
    type: q.type as QuestionType,
    label: q.label,
    placeholder: q.placeholder || undefined,
    required: q.required,
    options,
    minWords: q.minWords || undefined,
    maxWords: q.maxWords || undefined,
    ratingMax: q.ratingMax || undefined,
    lowLabel: q.lowLabel || undefined,
    highLabel: q.highLabel || undefined,
  };
}

function formatRewardType(rewardType: string): string {
  if (rewardType === "weighted") return "Reputation-Weighted Rewards";
  if (rewardType === "lucky_draw") return "Lucky Draw";
  return rewardType;
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 bg-ok-surface">
      <div
        className="h-full bg-ok-green transition-all duration-300 ease-out"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SurveyFill() {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    scoreDelta: number;
    scoreAtSubmission: number;
  } | null>(null);
  const [sybilCheck, setSybilCheck] = useState<{
    checked: boolean;
    passed: boolean;
    reason?: string;
  }>({ checked: false, passed: false });
  const { connected, publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { user } = useAuth();
  const { connection } = useConnection();
  const openedAt = useRef(Date.now());

  const wallet = publicKey?.toBase58() ?? "";

  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    setLoading(true);
    setFetchError(false);

    getFormById(formId)
      .then((data) => {
        if (!cancelled) setForm(data);
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    if (wallet) {
      getSubmissions(formId)
        .then((subs) => {
          if (!cancelled) {
            setAlreadySubmitted(
              subs.some((s) => s.respondentWallet === wallet),
            );
          }
        })
        .catch(() => {
          /* submissions check requires auth — silently skip */
        });
    }

    return () => {
      cancelled = true;
    };
  }, [formId, wallet]);

  useEffect(() => {
    if (!formId || !wallet || !form) return;
    let cancelled = false;

    // Check sybil eligibility before showing survey
    checkSybilEligibility(
      wallet,
      form.minWalletAge ?? 0,
      form.minSolBalance ?? 0,
    )
      .then((result) => {
        if (!cancelled) {
          setSybilCheck({
            checked: true,
            passed: result.passed,
            reason: result.reason,
          });
        }
      })
      .catch(() => {
        // If sybil check fails to load, allow the user to try submitting
        // (backend will enforce the check anyway)
        if (!cancelled) {
          setSybilCheck({ checked: true, passed: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formId, wallet, form]);

  const surveyQuestions = useMemo(
    () => form?.questions.map(toFrontendQuestion) ?? [],
    [form],
  );

  const handleConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleAnswer = useCallback((id: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateAnswers(answers, surveyQuestions);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    if (!formId || !wallet) return;
    if (!publicKey || !signTransaction) {
      setSubmitError("Wallet not connected. Please reconnect and try again.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Best-effort: ensure the respondent's on-chain score account exists so
      // the backend can apply the reputation delta. Failures are non-fatal —
      // the backend handles a missing account gracefully.
      try {
        await ensureScoreAccountOnChain(
          { publicKey, signTransaction },
          connection,
        );
      } catch (err) {
        logger.warn("Score account init skipped:", err);
      }

      const submission = await submitResponse(formId, {
        answers: Object.entries(answers).map(([questionId, value]) => ({
          questionId,
          value,
        })),
        respondentWallet: wallet,
        openedAt: openedAt.current,
      });
      setSubmissionResult({
        scoreDelta: submission.scoreDelta,
        scoreAtSubmission: submission.scoreAtSubmission,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }, [
    answers,
    surveyQuestions,
    formId,
    wallet,
    publicKey,
    signTransaction,
    connection,
  ]);

  const progress = useMemo(() => {
    const required = surveyQuestions.filter((q) => q.required);
    const answered = required.filter((q) => {
      const a = answers[q.id];
      if (a === undefined || a === "") return false;
      if (Array.isArray(a) && a.length === 0) return false;
      return true;
    });
    return required.length === 0
      ? 0
      : Math.round((answered.length / required.length) * 100);
  }, [answers, surveyQuestions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ok-bg flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ok-muted" />
      </div>
    );
  }

  if (fetchError || !form) {
    return (
      <div className="min-h-screen bg-ok-bg flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-ok-muted">Failed to load survey.</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const isCreator = publicKey !== null && publicKey.toBase58() === form.creator;

  if (isCreator) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ok-bg px-4">
        <div className="w-full max-w-md rounded border border-ok-danger/20 bg-ok-surface p-8 text-center">
          <ShieldX className="mx-auto mb-4 h-10 w-10 text-ok-danger/60" />
          <h2 className="mb-2 font-display text-lg font-semibold text-ok-text">
            You created this survey
          </h2>
          <p className="mb-6 text-sm text-ok-muted">
            Survey creators cannot submit responses to their own surveys. This
            protects the integrity of your community data.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded bg-ok-green/10 px-4 py-2 font-mono text-sm text-ok-green hover:bg-ok-green/20 transition-colors"
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ok-bg">
      <ProgressBar percent={submitted ? 100 : progress} />

      <main className="mx-auto max-w-[680px] px-6 pb-24 pt-10">
        {alreadySubmitted ? (
          <div className="flex flex-col items-center gap-6 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-ok-green/20 bg-ok-green/5">
              <CheckCircle2 className="h-8 w-8 text-ok-green" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-ok-text">
                Already Submitted
              </h2>
              <p className="max-w-sm text-sm text-ok-muted">
                You've already shared your feedback on this survey. Each wallet
                is limited to one response.
              </p>
            </div>
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 rounded-lg border border-ok-border bg-ok-surface px-5 py-2.5 text-sm font-medium text-ok-text transition-all duration-200 hover:border-ok-green/30 hover:bg-ok-green/5 hover:text-ok-green"
            >
              Browse More Surveys
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : submitted ? (
          <SuccessScreen
            scoreDelta={submissionResult?.scoreDelta ?? 0}
            newScore={submissionResult?.scoreAtSubmission ?? 0}
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-4 pb-2">
              <div className="flex items-center gap-2.5">
                <OkaformLogo variant="wordmark" height={32} />
              </div>

              <h1 className="font-display text-3xl font-semibold tracking-tight text-ok-text sm:text-4xl">
                {form.title}
              </h1>

              <RewardBanner
                rewardPool={form.rewardPool}
                rewardCurrency={form.rewardCurrency}
                rewardType={form.rewardType}
                maxResponses={form.maxResponses}
              />
            </div>

            <div className="transition-all duration-500 ease-in-out">
              {!connected ? (
                <div className="animate-fadeIn" key="wallet-gate">
                  <WalletGate onConnect={handleConnect} />
                </div>
              ) : !sybilCheck.checked ? (
                <div
                  className="animate-fadeIn flex items-center gap-3 rounded border border-[#3D444D] bg-[#151B23] px-4 py-3"
                  key="checking"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-[#656C76]" />
                  <span className="text-xs text-[#9198A1]">
                    Checking eligibility...
                  </span>
                </div>
              ) : !sybilCheck.passed ? (
                <div
                  className="animate-fadeIn rounded border border-ok-danger/20 bg-ok-danger/5 p-5"
                  key="eligibility-fail"
                >
                  <div className="flex items-start gap-3">
                    <ShieldX className="h-5 w-5 shrink-0 text-ok-danger" />
                    <div>
                      <p className="text-sm font-medium text-ok-danger">
                        Eligibility requirements not met
                      </p>
                      <p className="mt-1 text-xs text-[#9198A1]">
                        {sybilCheck.reason}
                      </p>
                      <p className="mt-2 text-[10px] text-[#656C76]">
                        This survey has minimum wallet requirements set by the
                        creator.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-fadeIn" key="eligibility-pass">
                  <EligibilityPass
                    wallet={wallet}
                    score={user?.globalScore ?? 0}
                    username={user?.username}
                  />
                </div>
              )}
            </div>

            <div
              className={cn(
                "space-y-5 pt-2 transition-all duration-500 ease-in-out",
                connected && sybilCheck.passed
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none h-0 overflow-hidden",
              )}
            >
              {surveyQuestions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i}
                  answer={
                    answers[q.id] ??
                    (q.type === "checkbox" || q.type === "multi_select"
                      ? []
                      : "")
                  }
                  error={errors[q.id]}
                  onChange={handleAnswer}
                />
              ))}

              <div className="space-y-3 pt-4">
                {submitError && (
                  <div className="rounded border border-ok-danger/20 bg-ok-danger/5 px-4 py-2 text-xs text-ok-danger">
                    {submitError}
                  </div>
                )}
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : "Submit Response"}
                </Button>
                <p className="text-center text-[11px] text-ok-muted/50">
                  Submitting signs a message with your wallet. No transaction
                  fee required.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Reward banner ───────────────────────────────────────────────────────────────

function RewardBanner({
  rewardPool,
  rewardCurrency,
  rewardType,
  maxResponses,
}: {
  rewardPool: number;
  rewardCurrency?: string;
  rewardType: string;
  maxResponses: number;
}) {
  const currency = rewardCurrency || "SOL";
  const formattedAmount = rewardPool.toFixed(2);

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-ok)] border border-ok-border bg-ok-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/10">
          <CurrencyLogo currency={currency} className="h-5 w-auto" />
        </div>
        <div>
          <p className="text-xs text-ok-muted">Reward Pool</p>
          <span className="font-mono text-base font-semibold text-ok-text">
            {formattedAmount} {currency}
          </span>
          <p className="text-[10px] text-ok-muted/50">
            Max {maxResponses} responses
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-ok-green/25 bg-ok-green/10 px-3 py-1 text-xs font-medium text-ok-green sm:self-auto">
        <span className="h-1.5 w-1.5 rounded-full bg-ok-green" />
        {formatRewardType(rewardType)}
      </span>
    </div>
  );
}
