import { useState, useMemo, useCallback, useEffect } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/okaform";
import { cn } from "@/lib/utils";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import OkaformLogo from "@/components/OkaformLogo";
import { useWallet } from "@/components/WalletProvider";
import {
  WalletGate,
  EligibilityPass,
  QuestionCard,
  SuccessScreen,
} from "@/components/Survey";
import { validateAnswers } from "@/utils/survey-validation";
import solanaLogo from "@/assets/icons/solana-logo.svg";
import type { Question, QuestionType } from "@/types/survey";
import { getFormById, submitResponse, getSubmissions, type FormDetail } from "@/lib/forms";
import type { QuestionOption } from "@/types/survey";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toFrontendQuestion(q: FormDetail['questions'][number]): Question {
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
  if (rewardType === 'weighted') return 'Reputation-Weighted Rewards';
  if (rewardType === 'lottery') return 'Lottery Draw';
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
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  const wallet = publicKey?.toBase58() ?? "";
  const score = 0; // TODO: fetch from backend

  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    setLoading(true);
    setFetchError(false);
    Promise.all([
      getFormById(formId),
      wallet ? getSubmissions(formId).then((subs) =>
        subs.some((s) => s.respondentWallet === wallet)
      ) : Promise.resolve(false),
    ])
      .then(([data, alreadyDid]) => {
        if (!cancelled) {
          setForm(data);
          setAlreadySubmitted(alreadyDid);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [formId, wallet]);

  const surveyQuestions = useMemo(
    () => form?.questions.map(toFrontendQuestion) ?? [],
    [form]
  );

  const handleConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleAnswer = useCallback(
    (id: string, value: string | string[]) => {
      setAnswers((prev) => ({ ...prev, [id]: value }));
      setErrors((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateAnswers(answers, surveyQuestions);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    if (!formId || !wallet) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitResponse(formId, {
        answers: Object.entries(answers).map(([questionId, value]) => {
          const q = surveyQuestions.find((q) => q.id === questionId);
          if (q && (q.type === 'checkbox' || q.type === 'multi_select') && Array.isArray(value) && q.options) {
            const labelMap = new Map(q.options.map((o) => [o.id, o.label]));
            return { questionId, value: value.map((v) => labelMap.get(v) ?? v) };
          }
          return { questionId, value };
        }),
        respondentWallet: wallet,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }, [answers, surveyQuestions, formId, wallet]);

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

  return (
    <div className="min-h-screen bg-ok-bg">
      <ProgressBar percent={submitted ? 100 : progress} />

      <div className="mx-auto max-w-[680px] px-6 pt-10 pb-2">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs text-ok-muted/60 transition-colors hover:text-ok-text"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Explore
        </Link>
      </div>

      <main className="mx-auto max-w-[680px] px-6 pb-24">
        {alreadySubmitted ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-sm text-ok-muted">You have already submitted this survey.</p>
            <Link to="/explore" className="text-xs text-ok-green border-b border-transparent hover:border-ok-green transition-colors">
              Back to Explore
            </Link>
          </div>
        ) : submitted ? (
          <SuccessScreen scoreDelta={3} newScore={score + 3} />
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
                rewardType={form.rewardType}
                maxResponses={form.maxResponses}
              />
            </div>

            <div className="transition-all duration-500 ease-in-out">
              {!connected ? (
                <div className="animate-fadeIn" key="wallet-gate">
                  <WalletGate onConnect={handleConnect} />
                </div>
              ) : (
                <div className="animate-fadeIn" key="eligibility-pass">
                  <EligibilityPass wallet={wallet} score={score} />
                </div>
              )}
            </div>

            <div
              className={cn(
                "space-y-5 pt-2 transition-all duration-500 ease-in-out",
                connected
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none h-0 overflow-hidden"
              )}
            >
              {surveyQuestions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i}
                  answer={answers[q.id] ?? (q.type === "checkbox" || q.type === "multi_select" ? [] : "")}
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
                  {submitting ? 'Submitting…' : 'Submit Response'}
                </Button>
                <p className="text-center text-[11px] text-ok-muted/50">
                  Submitting signs a message with your wallet. No
                  transaction fee required.
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

function RewardBanner({ rewardPool, rewardType, maxResponses }: { rewardPool: number; rewardType: string; maxResponses: number }) {
  const solAmount = rewardPool.toFixed(2);

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-ok)] border border-ok-border bg-ok-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/10">
          <img src={solanaLogo} alt="SOL" className="h-5 w-auto" />
        </div>
        <div>
          <p className="text-xs text-ok-muted">Reward Pool</p>
          <span className="font-mono text-base font-semibold text-ok-text">{solAmount} SOL</span>
          <p className="text-[10px] text-ok-muted/50">Max {maxResponses} responses</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-ok-green/25 bg-ok-green/10 px-3 py-1 text-xs font-medium text-ok-green sm:self-auto">
        <span className="h-1.5 w-1.5 rounded-full bg-ok-green" />
        {formatRewardType(rewardType)}
      </span>
    </div>
  );
}
