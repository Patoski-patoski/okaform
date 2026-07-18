import { useState, useMemo, useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
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
import type { Question } from "@/types/survey";

// ─── Mock data ─────────────────────────────────────────────────────────────────

const SURVEY_QUESTIONS: Question[] = [
  {
    id: "q1",
    type: "short_text",
    label: "What is your primary role in the Solana ecosystem?",
    required: true,
    placeholder: "e.g. Developer, DAO contributor, Trader...",
  },
  {
    id: "q2",
    type: "long_text",
    label: "Describe your experience with Jupiter's governance process.",
    required: true,
    minWords: 50,
    maxWords: 300,
    placeholder: "Share your thoughts on proposal quality, voting UX, and community engagement...",
  },
  {
    id: "q3",
    type: "multiple_choice",
    label: "How often do you participate in governance voting?",
    required: true,
    options: [
      { id: "q3-a", label: "Every proposal" },
      { id: "q3-b", label: "Most proposals" },
      { id: "q3-c", label: "Only topics I care about" },
      { id: "q3-d", label: "Rarely" },
    ],
  },
  {
    id: "q4",
    type: "multi_select",
    label: "Which Jupiter features do you use regularly?",
    required: false,
    options: [
      { id: "q4-a", label: "Swap" },
      { id: "q4-b", label: "Limit Orders" },
      { id: "q4-c", label: "DCA (Dollar Cost Average)" },
      { id: "q4-d", label: "Perps" },
      { id: "q4-e", label: "Governance voting" },
    ],
  },
  {
    id: "q5",
    type: "linear_scale",
    label: "How likely are you to recommend Jupiter to a fellow Solana user?",
    required: true,
    ratingMax: 5,
    lowLabel: "Not likely",
    highLabel: "Very likely",
  },
];

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
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  const wallet = publicKey?.toBase58() ?? "";
  const score = 0; // TODO: fetch from backend

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

  const handleSubmit = useCallback(() => {
    const validationErrors = validateAnswers(answers, SURVEY_QUESTIONS);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setSubmitted(true);
  }, [answers]);

  const progress = useMemo(() => {
    const required = SURVEY_QUESTIONS.filter((q) => q.required);
    const answered = required.filter((q) => {
      const a = answers[q.id];
      if (a === undefined || a === "") return false;
      if (Array.isArray(a) && a.length === 0) return false;
      return true;
    });
    return required.length === 0
      ? 0
      : Math.round((answered.length / required.length) * 100);
  }, [answers]);

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
        {submitted ? (
          <SuccessScreen scoreDelta={3} newScore={score + 3} />
        ) : (
          <div className="space-y-6">
            <div className="space-y-4 pb-2">
              <div className="flex items-center gap-2.5">
                <OkaformLogo variant="wordmark" height={32} />
              </div>

              <h1 className="font-display text-3xl font-semibold tracking-tight text-ok-text sm:text-4xl">
                Jupiter Community Pulse
              </h1>

              <RewardBanner />
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
              {SURVEY_QUESTIONS.map((q, i) => (
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
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleSubmit}
                >
                  Submit Response
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

// ─── Reward banner (inline — small enough to keep here) ───────────────────────

function RewardBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-ok)] border border-ok-border bg-ok-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/10">
          <img src={solanaLogo} alt="SOL" className="h-5 w-auto" />
        </div>
        <div>
          <p className="text-xs text-ok-muted">Reward Pool</p>
          <span className="font-mono text-base font-semibold text-ok-text">50.00 SOL</span>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-ok-green/25 bg-ok-green/10 px-3 py-1 text-xs font-medium text-ok-green sm:self-auto">
        <span className="h-1.5 w-1.5 rounded-full bg-ok-green" />
        Reputation-Weighted Rewards
      </span>
    </div>
  );
}
