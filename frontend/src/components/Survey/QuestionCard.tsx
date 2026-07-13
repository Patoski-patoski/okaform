import { AlertTriangle, X } from "lucide-react";
import { Card } from "@/components/okaform";
import { cn } from "@/lib/utils";
import { countWords } from "@/utils/survey-validation";
import type { Question } from "@/types/survey";

interface QuestionCardProps {
  question: Question;
  index: number;
  answer: string | string[];
  error?: string;
  onChange: (id: string, value: string | string[]) => void;
}

export function QuestionCard({
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
