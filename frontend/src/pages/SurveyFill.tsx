import { useState, useMemo, useCallback } from "react";
import {
  Link2,
  Wallet,
  Lock,
  CheckCircle2,
  Circle,
  ChevronLeft,
  AlertTriangle,
  X,
} from "lucide-react";
import { useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  Badge,
  SOLAmount,
  getBadgeTier,
} from "@/components/okaform";
import { cn } from "@/lib/utils";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@/components/WalletProvider";
/* ──────────────────────────────────────────────────────────────────────────────
   Survey fill page — single component, all sections.
   Single column, centered, max-width 680px. Bento grid cards.
   ────────────────────────────────────────────────────────────────────────────── */

// ─── Mock data ─────────────────────────────────────────────────────────────────

interface QuestionOption {
  id: string;
  label: string;
}

interface Question {
  id: string;
  type: "short_text" | "long_text" | "multiple_choice" | "checkbox" | "multi_select" | "linear_scale";
  label: string;
  required: boolean;
  placeholder?: string;
  minWords?: number;
  maxWords?: number;
  options?: QuestionOption[];
  ratingMax?: number;
  lowLabel?: string;
  highLabel?: string;
}

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

// ─── Word count helper ─────────────────────────────────────────────────────────

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateAnswers(
  answers: Record<string, string | string[]>,
  questions: Question[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const q of questions) {
    const a = answers[q.id];

    // Required check
    if (q.required) {
      const isEmpty =
        a === undefined ||
        a === "" ||
        (Array.isArray(a) && a.length === 0);
      if (isEmpty) {
        errors[q.id] = "This question is required";
        continue;
      }
    }

    // Word count checks (long_text only)
    if (q.type === "long_text" && typeof a === "string" && a.trim() !== "") {
      const words = countWords(a);
      if (q.minWords && words < q.minWords) {
        errors[q.id] = `Minimum ${q.minWords} words required (${words} entered)`;
      } else if (q.maxWords && words > q.maxWords) {
        errors[q.id] = `Maximum ${q.maxWords} words allowed (${words} entered)`;
      }
    }
  }

  return errors;
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

// ─── Reward banner ─────────────────────────────────────────────────────────────

function RewardBanner({
  rewardType,
}: {
  rewardType: "weighted" | "lottery";
}) {
  return (
    <Card padding="md" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/10">
          <span className="text-ok-green text-lg">◎</span>
        </div>
        <div>
          <p className="text-xs text-ok-muted">Reward Pool</p>
          <SOLAmount amount={50} unit="sol" className="text-base font-semibold" />
        </div>
      </div>

      {rewardType === "weighted" ? (
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-ok-green/25 bg-ok-green/10 px-3 py-1 text-xs font-medium text-ok-green sm:self-auto">
          <Circle className="h-1.5 w-1.5 fill-ok-green text-ok-green" />
          Reputation-Weighted Rewards
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-ok-purple/25 bg-ok-purple/10 px-3 py-1 text-xs font-medium text-ok-purple sm:self-auto">
          <Circle className="h-1.5 w-1.5 fill-ok-purple text-ok-purple" />
          Lottery — 10 winners
        </span>
      )}
    </Card>
  );
}

// ─── Wallet gate ───────────────────────────────────────────────────────────────

function WalletGate({ onConnect }: { onConnect: () => void }) {
  return (
    <Card padding="lg">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ok-border bg-ok-bg">
          <Lock className="h-6 w-6 text-ok-muted" />
        </div>

        <div>
          <h3 className="mb-1 font-display text-lg font-semibold text-ok-text">
            Connect your wallet to check eligibility
          </h3>
          <p className="text-sm text-ok-muted">
            This survey requires a connected Solana wallet.
          </p>
        </div>

        <Button variant="primary" size="lg" onClick={onConnect}>
          <Wallet className="h-4 w-4" />
          Connect Phantom Wallet
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] text-ok-muted/60">Requires:</span>
          {["Wallet age > 30 days", "Min 1 SOL balance"].map((req) => (
            <span
              key={req}
              className="inline-flex items-center rounded-full border border-ok-border bg-ok-bg px-2.5 py-0.5 text-[11px] text-ok-muted/70"
            >
              {req}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Eligibility pass ──────────────────────────────────────────────────────────

function EligibilityPass({
  wallet,
  score,
}: {
  wallet: string;
  score: number;
}) {
  const tier = getBadgeTier(score);
  const truncated = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-[var(--radius-ok)] border border-ok-green/20 bg-ok-green/5 px-4 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-ok-green" />
        <span className="text-sm font-medium text-ok-green">
          Your wallet is eligible to respond
        </span>
        <span className="ml-auto font-mono text-xs text-ok-muted/60">
          {truncated}
        </span>
      </div>

      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-ok-muted">Your reputation:</span>
        <Badge tier={tier} />
        <span className="font-mono text-xs text-ok-muted">
          · Score {score}
        </span>
      </div>
    </div>
  );
}

// ─── Question renderer ─────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: Question;
  index: number;
  answer: string | string[];
  error?: string;
  onChange: (id: string, value: string | string[]) => void;
}

function QuestionCard({
  question,
  index,
  answer,
  error,
  onChange,
}: QuestionCardProps) {
  return (
    <Card padding="lg" className="space-y-4">
      {/* Label */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-xs text-ok-green/50">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex-1">
          <label className="block text-sm font-medium text-ok-text">
            {question.label}
            {question.required && (
              <span className="ml-1 text-ok-danger">*</span>
            )}
          </label>
        </div>
      </div>

      {/* Short text */}
      {question.type === "short_text" && (
        <div className="pl-7">
          <input
            type="text"
            placeholder={question.placeholder}
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => onChange(question.id, e.target.value)}
            className="w-full rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-4 py-3 text-sm text-ok-text placeholder:text-ok-muted/40 focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
          />
        </div>
      )}

      {/* Long text */}
      {question.type === "long_text" && (
        <div className="pl-7">
          <textarea
            placeholder={question.placeholder}
            rows={5}
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => onChange(question.id, e.target.value)}
            className="w-full resize-none rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-4 py-3 text-sm text-ok-text placeholder:text-ok-muted/40 focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
          />
          {(question.minWords || question.maxWords) && (
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {question.minWords && (
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      countWords(typeof answer === "string" ? answer : "") < question.minWords
                        ? "text-ok-danger/70"
                        : "text-ok-green/70"
                    )}
                  >
                    min {question.minWords}
                  </span>
                )}
                {question.minWords && question.maxWords && (
                  <span className="text-ok-dim/40 text-[11px]">·</span>
                )}
                {question.maxWords && (
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      countWords(typeof answer === "string" ? answer : "") > question.maxWords
                        ? "text-ok-danger/70"
                        : "text-ok-muted/50"
                    )}
                  >
                    max {question.maxWords}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  (() => {
                    const words = countWords(typeof answer === "string" ? answer : "");
                    const min = question.minWords ?? 0;
                    const max = question.maxWords ?? Infinity;
                    if (words < min) return "text-ok-danger/70";
                    if (words > max) return "text-ok-danger/70";
                    if (min > 0 && words >= min) return "text-ok-green/70";
                    return "text-ok-muted/50";
                  })()
                )}
              >
                {countWords(typeof answer === "string" ? answer : "")}{" "}
                {countWords(typeof answer === "string" ? answer : "") === 1 ? "word" : "words"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Multiple choice */}
      {question.type === "multiple_choice" && question.options && (
        <div className="space-y-2 pl-7">
          {question.options.map((opt) => {
            const selected = answer === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange(question.id, opt.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius-ok)] border px-4 py-3 text-left text-sm transition-all",
                  selected
                    ? "border-l-[3px] border-l-ok-green border-ok-green/30 bg-ok-green/5 text-ok-text"
                    : "border-ok-border bg-ok-bg text-ok-muted hover:border-ok-green/20 hover:text-ok-text"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                    selected
                      ? "border-ok-green bg-ok-green"
                      : "border-ok-muted/30"
                  )}
                >
                  {selected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-ok-bg" />
                  )}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Checkbox */}
      {question.type === "checkbox" && question.options && (
        <div className="space-y-2 pl-7">
          {question.options.map((opt) => {
            const selected = Array.isArray(answer) && answer.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const current = Array.isArray(answer) ? answer : [];
                  const next = selected
                    ? current.filter((v) => v !== opt.id)
                    : [...current, opt.id];
                  onChange(question.id, next);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius-ok)] border px-4 py-3 text-left text-sm transition-all",
                  selected
                    ? "border-l-[3px] border-l-ok-green border-ok-green/30 bg-ok-green/5 text-ok-text"
                    : "border-ok-border bg-ok-bg text-ok-muted hover:border-ok-green/20 hover:text-ok-text"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px]",
                    selected
                      ? "border-ok-green bg-ok-green"
                      : "border-ok-muted/30"
                  )}
                >
                  {selected && (
                    <svg
                      className="h-2.5 w-2.5 text-ok-bg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Multi select — chip/tag UI */}
      {question.type === "multi_select" && question.options && (
        <div className="pl-7 space-y-3">
          {/* Selected chips */}
          {Array.isArray(answer) && answer.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {answer.map((selectedId) => {
                const opt = question.options!.find((o) => o.id === selectedId);
                if (!opt) return null;
                return (
                  <span
                    key={selectedId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ok-green/30 bg-ok-green/10 px-3 py-1 text-xs font-medium text-ok-green"
                  >
                    {opt.label}
                    <button
                      type="button"
                      onClick={() => {
                        const current = Array.isArray(answer) ? answer : [];
                        onChange(question.id, current.filter((v) => v !== selectedId));
                      }}
                      className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-ok-green/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Available options */}
          <div className="flex flex-wrap gap-2">
            {question.options.map((opt) => {
              const selected = Array.isArray(answer) && answer.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const current = Array.isArray(answer) ? answer : [];
                    const next = selected
                      ? current.filter((v) => v !== opt.id)
                      : [...current, opt.id];
                    onChange(question.id, next);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    selected
                      ? "border-ok-green/30 bg-ok-green/10 text-ok-green"
                      : "border-ok-border bg-ok-bg text-ok-muted hover:border-ok-green/20 hover:text-ok-text"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Linear scale */}
      {question.type === "linear_scale" && (
        <div className="pl-7 mt-1 w-fit">
          <div className="flex items-center gap-3">
            {Array.from({ length: question.ratingMax || 5 }, (_, i) => i + 1).map((num) => {
              const isSelected = answer === String(num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => onChange(question.id, String(num))}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-[var(--radius-ok)] border text-sm font-medium transition-all duration-150",
                    isSelected
                      ? "border-ok-green/40 bg-ok-green/10 text-ok-green shadow-[0_0_12px_rgba(20,241,149,0.2)]"
                      : "border-ok-border bg-ok-bg text-ok-muted hover:border-ok-green/20 hover:text-ok-text"
                  )}
                >
                  {num}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-ok-dim/60">{question.lowLabel || "Disagree"}</span>
            <span className="text-[10px] text-ok-dim/60">{question.highLabel || "Agree"}</span>
          </div>
        </div>
      )}

      {/* Validation error */}
      {error && (
        <div className="flex items-center gap-1.5 pl-7 text-xs text-ok-danger">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </div>
      )}
    </Card>
  );
}

// ─── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({
  scoreDelta,
  newScore,
}: {
  scoreDelta: number;
  newScore: number;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-8 py-12 text-center">
      {/* Green particle burst */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-ok-green/30 bg-ok-green/10">
          <CheckCircle2 className="h-10 w-10 text-ok-green" />
        </div>
        {/* Static particle dots */}
        {[
          { x: -32, y: -24, delay: "0ms" },
          { x: 28, y: -30, delay: "100ms" },
          { x: -40, y: 16, delay: "200ms" },
          { x: 36, y: 20, delay: "150ms" },
          { x: -16, y: -40, delay: "50ms" },
          { x: 20, y: -38, delay: "250ms" },
          { x: -36, y: -8, delay: "120ms" },
          { x: 40, y: 4, delay: "180ms" },
        ].map((dot, i) => (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-ok-green animate-ping"
            style={{
              left: `calc(50% + ${dot.x}px)`,
              top: `calc(50% + ${dot.y}px)`,
              animationDelay: dot.delay,
              animationDuration: "1.5s",
            }}
          />
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold text-ok-text">
          Response Submitted
        </h2>
        <p className="text-sm text-ok-muted">
          Rewards distribute when the survey closes.
        </p>
      </div>

      <Card padding="md" className="w-full max-w-sm">
        <p className="mb-2 text-xs text-ok-muted">Score Updated</p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg text-ok-green">
            +{scoreDelta}
          </span>
          <span className="text-sm text-ok-muted">→</span>
          <span className="font-display text-xl font-bold text-ok-text">
            {newScore}
          </span>
          <span className="text-xs text-ok-muted">total</span>
        </div>
      </Card>
      <Button
        variant="secondary"
        size="md"
        onClick={() => navigate('/')}>
        Back to Explore
      </Button>
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
  const score = 67; // TODO: fetch from backend

  const handleConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleAnswer = useCallback(
    (id: string, value: string | string[]) => {
      setAnswers((prev) => ({ ...prev, [id]: value }));
      // Clear error for this question on input
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

  // Progress = % of required questions answered
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

      {/* Back link */}
      <div className="mx-auto max-w-[680px] px-6 pt-10 pb-2">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-ok-muted/60 transition-colors hover:text-ok-text"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Okaform
        </a>
      </div>

      <main className="mx-auto max-w-[680px] px-6 pb-24">
        {submitted ? (
          <SuccessScreen scoreDelta={3} newScore={score + 3} />
        ) : (
          <div className="space-y-6">
            {/* ── Top banner ──────────────────────────────────────────────── */}
            <div className="space-y-4 pb-2">
              {/* Logo + title */}
              <div className="flex items-center gap-2.5">
                <Link2
                  className="h-4 w-4 text-ok-green"
                  strokeWidth={2.5}
                />
                <span className="text-xs font-medium text-ok-muted/60">
                  Okaform
                </span>
              </div>

              <h1 className="font-display text-3xl font-semibold tracking-tight text-ok-text sm:text-4xl">
                Jupiter Community Pulse
              </h1>

              <RewardBanner rewardType="weighted" />
            </div>

            {/* ── Wallet gate / eligibility ───────────────────────────────── */}
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

            {/* ── Form questions ─────────────────────────────────────────── */}
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
                  answer={answers[q.id] ?? ((q.type === "checkbox" || q.type === "multi_select") ? [] : "")}
                  error={errors[q.id]}
                  onChange={handleAnswer}
                />
              ))}

              {/* ── Submit ────────────────────────────────────────────── */}
              
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
