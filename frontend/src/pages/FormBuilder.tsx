import { useState, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Trash2,
  Type,
  AlignLeft,
  ListChecks,
  CheckSquare,
  Heading,
  Minus,
  ChevronUp,
  ChevronDown,
  Eye,
  AlertTriangle,
  X,
  Settings,
} from "lucide-react";

import { Button, StatusPill } from "@/components/okaform";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────────
   Form builder — three-panel layout.
   Left: question type picker (260px)
   Center: form canvas (flex-1)
   Right: question settings + reward config (300px)
   ────────────────────────────────────────────────────────────────────────────── */

// ─── Types ─────────────────────────────────────────────────────────────────────

type QuestionType =
  | "short_text"
  | "long_text"
  | "multiple_choice"
  | "checkbox"
  | "section_header"
  | "divider";

interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options: string[];
  minWords: number;
  maxWords: number;
  randomize: boolean;
}

interface RewardSettings {
  rewardPool: number;
  maxResponses: number;
  rewardType: "weighted" | "lottery";
  numWinners: number;
  minWalletAge: number;
  minSolBalance: number;
}

interface QuestionTypeItem {
  type: QuestionType;
  label: string;
  icon: React.FC<{ className?: string }>;
  category: "input" | "display";
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const QUESTION_TYPES: QuestionTypeItem[] = [
  { type: "short_text", label: "Short Answer", icon: Type, category: "input" },
  { type: "long_text", label: "Long Answer", icon: AlignLeft, category: "input" },
  { type: "multiple_choice", label: "Multiple Choice", icon: ListChecks, category: "input" },
  { type: "checkbox", label: "Checkboxes", icon: CheckSquare, category: "input" },
  { type: "section_header", label: "Section Header", icon: Heading, category: "display" },
  { type: "divider", label: "Divider", icon: Minus, category: "display" },
];

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  short_text: "Short Answer",
  long_text: "Long Answer",
  multiple_choice: "Multiple Choice",
  checkbox: "Checkboxes",
  section_header: "Section Header",
  divider: "Divider",
};

let nextId = 1;
function makeId(): string {
  return `q-${nextId++}`;
}

function createQuestion(type: QuestionType): Question {
  const base: Question = {
    id: makeId(),
    type,
    label: "",
    required: false,
    options:
      type === "multiple_choice" || type === "checkbox"
        ? ["Option 1", "Option 2"]
        : [],
    minWords: 0,
    maxWords: 0,
    randomize: false,
  };
  return base;
}

const INITIAL_REWARD: RewardSettings = {
  rewardPool: 10,
  maxResponses: 100,
  rewardType: "weighted",
  numWinners: 10,
  minWalletAge: 30,
  minSolBalance: 1,
};

// ─── Left panel — Question type picker ─────────────────────────────────────────

function LeftPanel({
  onAdd,
  onMobileClose,
}: {
  onAdd: (type: QuestionType) => void;
  onMobileClose?: () => void;
}) {
  const inputTypes = QUESTION_TYPES.filter((t) => t.category === "input");
  const displayTypes = QUESTION_TYPES.filter((t) => t.category === "display");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ok-border px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-ok-text">
          Add Question
        </h3>
        {onMobileClose && (
          <button onClick={onMobileClose} className="text-ok-muted hover:text-ok-text lg:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* Input types */}
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-ok-muted/50">
          Input Types
        </p>
        <div className="space-y-1 mb-5">
          {inputTypes.map((qt) => (
            <button
              key={qt.type}
              onClick={() => {
                onAdd(qt.type);
                onMobileClose?.();
              }}
              className="flex w-full items-center gap-3 rounded-[var(--radius-ok)] px-3 py-2.5 text-sm text-ok-muted transition-colors hover:bg-ok-surface hover:text-ok-text"
            >
              <qt.icon className="h-4 w-4 text-ok-green/70" />
              {qt.label}
            </button>
          ))}
        </div>

        {/* Display types */}
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-ok-muted/50">
          Display Types
        </p>
        <div className="space-y-1">
          {displayTypes.map((qt) => (
            <button
              key={qt.type}
              onClick={() => {
                onAdd(qt.type);
                onMobileClose?.();
              }}
              className="flex w-full items-center gap-3 rounded-[var(--radius-ok)] px-3 py-2.5 text-sm text-ok-muted transition-colors hover:bg-ok-surface hover:text-ok-text"
            >
              <qt.icon className="h-4 w-4 text-ok-muted/50" />
              {qt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Center canvas — Question cards ────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  selected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onUpdateLabel,
}: {
  question: Question;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdateLabel: (label: string) => void;
}) {
  const isDisplay = question.type === "section_header" || question.type === "divider";

  return (
    <div
      className={cn(
        "group relative flex rounded-[var(--radius-ok)] border bg-ok-surface transition-all",
        selected
          ? "border-l-[3px] border-l-ok-green border-ok-green/30 bg-ok-surface"
          : "border-ok-border hover:border-ok-green/20"
      )}
      onClick={onSelect}
    >
      {/* Drag handle — left */}
      <div className="flex w-8 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="h-4 w-4 text-ok-muted/40" />
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4">
        {/* Number + type label */}
        <div className="mb-2 flex items-center gap-2">
          {!isDisplay && (
            <span className="font-mono text-xs text-ok-green">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <span className="text-[10px] text-ok-muted/40">
            {QUESTION_TYPE_LABEL[question.type]}
          </span>
          {question.required && !isDisplay && (
            <span className="text-[10px] text-ok-danger">*</span>
          )}
        </div>

        {/* Editable label */}
        {question.type === "divider" ? (
          <div className="my-2 h-px bg-ok-border" />
        ) : (
          <input
            type="text"
            value={question.label}
            onChange={(e) => onUpdateLabel(e.target.value)}
            placeholder={
              question.type === "section_header"
                ? "Section title"
                : "Question label"
            }
            className={cn(
              "w-full border-none bg-transparent text-sm font-medium text-ok-text placeholder:text-ok-muted/30 focus:outline-none",
              question.type === "section_header" &&
                "font-display text-base font-semibold"
            )}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Input preview */}
        {!isDisplay && question.type === "short_text" && (
          <div className="mt-3 h-9 rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 text-xs text-ok-muted/30">
            Short text response...
          </div>
        )}
        {!isDisplay && question.type === "long_text" && (
          <div className="mt-3 h-20 rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 pt-2 text-xs text-ok-muted/30">
            Long text response...
          </div>
        )}
        {!isDisplay &&
          (question.type === "multiple_choice" || question.type === "checkbox") && (
            <div className="mt-3 space-y-1.5">
              {question.options.map((opt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2 text-xs text-ok-muted/40"
                >
                  {question.type === "multiple_choice" ? (
                    <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-ok-muted/30" />
                  ) : (
                    <span className="h-3 w-3 shrink-0 rounded-[3px] border-[1.5px] border-ok-muted/30" />
                  )}
                  {opt}
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Actions — right edge */}
      <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-1 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={!canMoveUp}
          className="rounded p-0.5 text-ok-muted/40 transition-colors hover:text-ok-text disabled:opacity-20"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={!canMoveDown}
          className="rounded p-0.5 text-ok-muted/40 transition-colors hover:text-ok-text disabled:opacity-20"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-0.5 text-ok-muted/40 transition-colors hover:text-ok-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Canvas({
  questions,
  selectedId,
  formTitle,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdateLabel,
  onUpdateTitle,
  onAddBetween,
}: {
  questions: Question[];
  selectedId: string | null;
  formTitle: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onUpdateTitle: (title: string) => void;
  onAddBetween: (afterIndex: number) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Form title */}
      <input
        type="text"
        value={formTitle}
        onChange={(e) => onUpdateTitle(e.target.value)}
        placeholder="Untitled Survey"
        className="mb-8 w-full border-none bg-transparent font-display text-2xl font-bold text-ok-text placeholder:text-ok-muted/20 focus:outline-none lg:text-3xl"
      />

      {questions.length === 0 ? (
        /* Empty state */
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-ok)] border-2 border-dashed border-ok-border px-12 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-ok-border bg-ok-surface">
              <Plus className="h-5 w-5 text-ok-muted/40" />
            </div>
            <p className="text-sm text-ok-muted/50">Add your first question</p>
            <p className="text-xs text-ok-muted/30">
              Pick a question type from the left panel
            </p>
          </div>
        </div>
      ) : (
        /* Question list */
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={q.id}>
              <QuestionCard
                question={q}
                index={i}
                selected={selectedId === q.id}
                onSelect={() => onSelect(q.id)}
                onDelete={() => onDelete(q.id)}
                onMoveUp={() => onMoveUp(i)}
                onMoveDown={() => onMoveDown(i)}
                canMoveUp={i > 0}
                canMoveDown={i < questions.length - 1}
                onUpdateLabel={(label) => onUpdateLabel(q.id, label)}
              />

              {/* Add between button */}
              <div className="flex justify-center py-1 opacity-0 transition-opacity hover:opacity-100">
                <button
                  onClick={() => onAddBetween(i)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-ok-border bg-ok-surface text-ok-muted/40 transition-colors hover:border-ok-green/30 hover:text-ok-green"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Right panel — Question settings ───────────────────────────────────────────

function QuestionSettings({
  question,
  onUpdate,
}: {
  question: Question | undefined;
  onUpdate: (id: string, updates: Partial<Question>) => void;
}) {
  if (!question) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Settings className="mb-3 h-8 w-8 text-ok-muted/20" />
        <p className="text-sm text-ok-muted/40">
          Select a question to edit its settings
        </p>
      </div>
    );
  }

  const isDisplay =
    question.type === "section_header" || question.type === "divider";
  const isLong = question.type === "long_text";
  const isChoice =
    question.type === "multiple_choice" || question.type === "checkbox";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-b border-ok-border px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-ok-text">
          {QUESTION_TYPE_LABEL[question.type]} Settings
        </h3>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {/* Common: Required toggle (not for display types) */}
        {!isDisplay && (
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-ok-muted">Required</label>
            <button
              onClick={() =>
                onUpdate(question.id, { required: !question.required })
              }
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                question.required ? "bg-ok-green" : "bg-ok-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                  question.required && "translate-x-4"
                )}
              />
            </button>
          </div>
        )}

        {/* Long Answer: word count */}
        {isLong && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ok-muted">
                Minimum word count
              </label>
              <input
                type="number"
                min={0}
                value={question.minWords || ""}
                onChange={(e) =>
                  onUpdate(question.id, {
                    minWords: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2 text-sm text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ok-muted">
                Maximum word count
              </label>
              <input
                type="number"
                min={0}
                value={question.maxWords || ""}
                onChange={(e) =>
                  onUpdate(question.id, {
                    maxWords: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2 text-sm text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-ok-muted/50">
              Responses below the minimum word count will receive a lower
              Response Depth score.
            </p>
          </>
        )}

        {/* Multiple Choice / Checkbox: options */}
        {isChoice && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-ok-muted">
                Options
              </label>
              <div className="space-y-1.5">
                {question.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...question.options];
                        next[i] = e.target.value;
                        onUpdate(question.id, { options: next });
                      }}
                      className="flex-1 rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-1.5 text-xs text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
                    />
                    <button
                      onClick={() => {
                        const next = question.options.filter((_, j) => j !== i);
                        onUpdate(question.id, { options: next });
                      }}
                      className="shrink-0 rounded p-1 text-ok-muted/40 transition-colors hover:text-ok-danger"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  onUpdate(question.id, {
                    options: [
                      ...question.options,
                      `Option ${question.options.length + 1}`,
                    ],
                  })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-ok)] border border-dashed border-ok-border py-2 text-xs text-ok-muted/50 transition-colors hover:border-ok-green/30 hover:text-ok-green"
              >
                <Plus className="h-3 w-3" />
                Add option
              </button>
            </div>

            {/* Randomise toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ok-muted">
                Randomise order
              </label>
              <button
                onClick={() =>
                  onUpdate(question.id, { randomize: !question.randomize })
                }
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  question.randomize ? "bg-ok-green" : "bg-ok-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                    question.randomize && "translate-x-4"
                  )}
                />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Reward settings (always at bottom of right panel) ─────────────────────────

function RewardSettingsPanel({
  settings,
  onUpdate,
}: {
  settings: RewardSettings;
  onUpdate: (updates: Partial<RewardSettings>) => void;
}) {
  return (
    <div className="border-t border-ok-border p-4">
      <h4 className="mb-4 font-display text-xs font-semibold uppercase tracking-widest text-ok-muted/50">
        Reward Settings
      </h4>

      <div className="space-y-4">
        {/* Reward Pool */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-ok-muted">
            Reward Pool
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ok-green">
              ◎
            </span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={settings.rewardPool || ""}
              onChange={(e) =>
                onUpdate({ rewardPool: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg py-2 pl-8 pr-3 text-sm text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
            />
          </div>
        </div>

        {/* Max Responses */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-ok-muted">
            Max Responses
          </label>
          <input
            type="number"
            min={1}
            value={settings.maxResponses || ""}
            onChange={(e) =>
              onUpdate({ maxResponses: parseInt(e.target.value) || 0 })
            }
            className="w-full rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2 text-sm text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
          />
        </div>

        {/* Reward Type */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-ok-muted">
            Reward Type
          </label>
          <div className="grid grid-cols-2 gap-1.5 rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg p-1">
            <button
              onClick={() => onUpdate({ rewardType: "weighted" })}
              className={cn(
                "rounded-[8px] py-1.5 text-xs font-medium transition-colors",
                settings.rewardType === "weighted"
                  ? "bg-ok-green/15 text-ok-green"
                  : "text-ok-muted hover:text-ok-text"
              )}
            >
              Weighted
            </button>
            <button
              onClick={() => onUpdate({ rewardType: "lottery" })}
              className={cn(
                "rounded-[8px] py-1.5 text-xs font-medium transition-colors",
                settings.rewardType === "lottery"
                  ? "bg-ok-purple/15 text-ok-purple"
                  : "text-ok-muted hover:text-ok-text"
              )}
            >
              Lottery
            </button>
          </div>
        </div>

        {/* Lottery: num winners */}
        {settings.rewardType === "lottery" && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-ok-muted">
              Number of winners
            </label>
            <input
              type="number"
              min={1}
              value={settings.numWinners || ""}
              onChange={(e) =>
                onUpdate({ numWinners: parseInt(e.target.value) || 0 })
              }
              className="w-full rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2 text-sm text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
            />
          </div>
        )}

        {/* Sybil Filters */}
        <div className="space-y-2 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ok-muted/40">
            Sybil Filters
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-ok-muted">
                Min wallet age (days)
              </label>
              <input
                type="number"
                min={0}
                value={settings.minWalletAge || ""}
                onChange={(e) =>
                  onUpdate({
                    minWalletAge: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2 text-sm text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-ok-muted">
                Min SOL balance
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={settings.minSolBalance || ""}
                onChange={(e) =>
                  onUpdate({
                    minSolBalance: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg px-3 py-2 text-sm text-ok-text focus:border-ok-green/50 focus:outline-none focus:ring-1 focus:ring-ok-green/30"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Publish modal ─────────────────────────────────────────────────────────────

function PublishModal({
  settings,
  questionCount,
  onConfirm,
  onCancel,
}: {
  settings: RewardSettings;
  questionCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay — glassmorphism */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-[var(--radius-ok)] border border-white/10 bg-ok-surface/95 backdrop-blur-md p-6 shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-ok-muted hover:text-ok-text"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-ok-green/25 bg-ok-green/10">
          <AlertTriangle className="h-5 w-5 text-ok-green" />
        </div>

        <h3 className="mb-4 font-display text-lg font-bold text-ok-text">
          Ready to publish?
        </h3>

        {/* Summary */}
        <div className="mb-4 space-y-2 rounded-[var(--radius-ok)] border border-ok-border bg-ok-bg p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-ok-muted">Questions</span>
            <span className="font-mono text-ok-text">{questionCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ok-muted">Reward Pool</span>
            <span className="font-mono text-ok-green">
              ◎ {settings.rewardPool} SOL
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ok-muted">Max Responses</span>
            <span className="font-mono text-ok-text">
              {settings.maxResponses}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ok-muted">Reward Type</span>
            <span className="capitalize text-ok-text">
              {settings.rewardType}
              {settings.rewardType === "lottery" &&
                ` (${settings.numWinners} winners)`}
            </span>
          </div>
        </div>

        <p className="mb-6 text-xs leading-relaxed text-ok-warning">
          This will lock{" "}
          <span className="font-mono font-medium">◎ {settings.rewardPool} SOL</span>{" "}
          in escrow on Solana devnet.
        </p>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={onConfirm}
          >
            Publish and Lock Escrow
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main form builder ─────────────────────────────────────────────────────────

export default function FormBuilder() {
  const [formTitle, setFormTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reward, setReward] = useState<RewardSettings>(INITIAL_REWARD);
  const [showPublish, setShowPublish] = useState(false);
  const [showMobilePicker, setShowMobilePicker] = useState(false);

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedId),
    [questions, selectedId]
  );

  const addQuestion = useCallback((type: QuestionType) => {
    const q = createQuestion(type);
    setQuestions((prev) => [...prev, q]);
    setSelectedId(q.id);
  }, []);

  const addBetween = useCallback(
    (afterIndex: number) => {
      const q = createQuestion("short_text");
      setQuestions((prev) => {
        const next = [...prev];
        next.splice(afterIndex + 1, 0, q);
        return next;
      });
      setSelectedId(q.id);
    },
    []
  );

  const deleteQuestion = useCallback(
    (id: string) => {
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId]
  );

  const moveQuestion = useCallback((index: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const updateQuestionLabel = useCallback((id: string, label: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, label } : q))
    );
  }, []);

  const updateQuestion = useCallback(
    (id: string, updates: Partial<Question>) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
      );
    },
    []
  );

  return (
    <div className="flex h-screen flex-col bg-ok-bg">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-ok-border bg-ok-surface px-4 py-2.5">
        {/* Left */}
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-ok-muted/60 transition-colors hover:text-ok-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            My Surveys
          </a>
        </div>

        {/* Center */}
        <StatusPill status="active" className="opacity-60">
          Draft
        </StatusPill>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowPublish(true)}
          >
            Publish Survey
          </Button>
        </div>
      </div>

      {/* ── Three-panel layout ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — hidden on mobile */}
        <div className="hidden w-[260px] shrink-0 border-r border-ok-border bg-[#0A1A14] lg:block">
          <LeftPanel onAdd={addQuestion} />
        </div>

        {/* Center canvas */}
        <div className="flex-1 overflow-hidden">
          <Canvas
            questions={questions}
            selectedId={selectedId}
            formTitle={formTitle}
            onSelect={setSelectedId}
            onDelete={deleteQuestion}
            onMoveUp={(i) => moveQuestion(i, -1)}
            onMoveDown={(i) => moveQuestion(i, 1)}
            onUpdateLabel={updateQuestionLabel}
            onUpdateTitle={setFormTitle}
            onAddBetween={addBetween}
          />
        </div>

        {/* Right panel — hidden on mobile */}
        <div className="hidden w-[300px] shrink-0 border-l border-ok-border bg-[#0A1A14] lg:flex lg:flex-col">
          <div className="flex-1 overflow-y-auto">
            <QuestionSettings
              question={selectedQuestion}
              onUpdate={updateQuestion}
            />
          </div>
          <RewardSettingsPanel
            settings={reward}
            onUpdate={(updates) => setReward((prev) => ({ ...prev, ...updates }))}
          />
        </div>
      </div>

      {/* ── Mobile: add button + bottom sheet ────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-30 lg:hidden">
        <button
          onClick={() => setShowMobilePicker(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-green text-ok-bg shadow-lg"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {showMobilePicker && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobilePicker(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] rounded-t-[var(--radius-ok)] border-t border-ok-border bg-[#0A1A14]">
            <LeftPanel
              onAdd={addQuestion}
              onMobileClose={() => setShowMobilePicker(false)}
            />
          </div>
        </div>
      )}

      {/* ── Publish modal ────────────────────────────────────────────────── */}
      {showPublish && (
        <PublishModal
          settings={reward}
          questionCount={questions.length}
          onConfirm={() => setShowPublish(false)}
          onCancel={() => setShowPublish(false)}
        />
      )}
    </div>
  );
}
