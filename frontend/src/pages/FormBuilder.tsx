import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Trash2,
  Type,
  AlignLeft,
  ListChecks,
  CheckSquare,
  Minus,
  ChevronDown,
  Eye,
  AlertTriangle,
  X,
  Settings,
  ChevronDownSquare,
  ListPlus,
  Hash,
  Mail,
  Phone,
  Link2,
  Upload,
  Calendar,
  Clock,
  SlidersHorizontal,
  Grid,
  Star,
  CreditCard,
  PenTool,
  ArrowDownUp,
  FilePlus,
  Smile,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  Tag,
  Image as ImageIcon,
  Video,
  Music,
  Code,
  GitBranch,
  Calculator,
  EyeOff,
  ShieldCheck,
  Globe
} from "lucide-react";

import { Button, StatusPill } from "@/components/okaform";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type QuestionCategory = "input" | "layout" | "embed" | "advanced";

type QuestionType =
  // Inputs
  | "short_text" | "long_text" | "multiple_choice" | "checkbox" | "dropdown" | "multi_select"
  | "number" | "email" | "phone" | "link" | "file_upload" | "date" | "time"
  | "linear_scale" | "matrix" | "rating" | "payment" | "signature" | "ranking"
  // Layouts
  | "new_page" | "thank_you" | "text" | "h1" | "h2" | "h3" | "divider" | "title" | "label"
  // Embeds
  | "image" | "video" | "audio" | "embed_anything"
  // Advanced
  | "conditional_logic" | "calculated_field" | "hidden_field" | "recaptcha" | "country";

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
  category: QuestionCategory;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const QUESTION_TYPES: QuestionTypeItem[] = [
  // Input blocks
  { type: "short_text", label: "Short answer", icon: Type, category: "input" },
  { type: "long_text", label: "Long answer", icon: AlignLeft, category: "input" },
  { type: "multiple_choice", label: "Multiple choice", icon: ListChecks, category: "input" },
  { type: "checkbox", label: "Checkboxes", icon: CheckSquare, category: "input" },
  { type: "dropdown", label: "Dropdown", icon: ChevronDownSquare, category: "input" },
  { type: "multi_select", label: "Multi-select", icon: ListPlus, category: "input" },
  { type: "number", label: "Number", icon: Hash, category: "input" },
  { type: "email", label: "Email", icon: Mail, category: "input" },
  { type: "phone", label: "Phone number", icon: Phone, category: "input" },
  { type: "link", label: "Link", icon: Link2, category: "input" },
  { type: "file_upload", label: "File upload", icon: Upload, category: "input" },
  { type: "date", label: "Date", icon: Calendar, category: "input" },
  { type: "time", label: "Time", icon: Clock, category: "input" },
  { type: "linear_scale", label: "Linear scale", icon: SlidersHorizontal, category: "input" },
  { type: "matrix", label: "Matrix", icon: Grid, category: "input" },
  { type: "rating", label: "Rating", icon: Star, category: "input" },
  { type: "payment", label: "Payment", icon: CreditCard, category: "input" },
  { type: "signature", label: "Signature", icon: PenTool, category: "input" },
  { type: "ranking", label: "Ranking", icon: ArrowDownUp, category: "input" },

  // Layout blocks
  { type: "new_page", label: "New page", icon: FilePlus, category: "layout" },
  { type: "thank_you", label: "'Thank you' page", icon: Smile, category: "layout" },
  { type: "text", label: "Text", icon: Pilcrow, category: "layout" },
  { type: "h1", label: "Heading 1", icon: Heading1, category: "layout" },
  { type: "h2", label: "Heading 2", icon: Heading2, category: "layout" },
  { type: "h3", label: "Heading 3", icon: Heading3, category: "layout" },
  { type: "divider", label: "Divider", icon: Minus, category: "layout" },
  { type: "title", label: "Title", icon: Type, category: "layout" },
  { type: "label", label: "Label", icon: Tag, category: "layout" },

  // Embed blocks
  { type: "image", label: "Image", icon: ImageIcon, category: "embed" },
  { type: "video", label: "Video", icon: Video, category: "embed" },
  { type: "audio", label: "Audio", icon: Music, category: "embed" },
  { type: "embed_anything", label: "Embed anything", icon: Code, category: "embed" },

  // Advanced blocks
  { type: "conditional_logic", label: "Conditional logic", icon: GitBranch, category: "advanced" },
  { type: "calculated_field", label: "Calculated fields", icon: Calculator, category: "advanced" },
  { type: "hidden_field", label: "Hidden fields", icon: EyeOff, category: "advanced" },
  { type: "recaptcha", label: "reCAPTCHA", icon: ShieldCheck, category: "advanced" },
  { type: "country", label: "Respondent's country", icon: Globe, category: "advanced" },
];

const QUESTION_TYPE_LABEL = QUESTION_TYPES.reduce((acc, curr) => {
  acc[curr.type] = curr.label;
  return acc;
}, {} as Record<QuestionType, string>);

let nextId = 1;
function makeId(): string {
  return `q-${nextId++}`;
}

function createQuestion(type: QuestionType): Question {
  return {
    id: makeId(),
    type,
    label: "",
    required: false,
    options:
      ["multiple_choice", "checkbox", "dropdown", "multi_select", "ranking"].includes(type)
        ? ["Option 1", "Option 2"]
        : [],
    minWords: 0,
    maxWords: 0,
    randomize: false,
  };
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
  const groups: { title: string; items: QuestionTypeItem[]; color: string }[] = [
    { title: "Input blocks", items: QUESTION_TYPES.filter((t) => t.category === "input"), color: "text-ok-green" },
    { title: "Layout blocks", items: QUESTION_TYPES.filter((t) => t.category === "layout"), color: "text-ok-muted" },
    { title: "Embed blocks", items: QUESTION_TYPES.filter((t) => t.category === "embed"), color: "text-ok-purple" },
    { title: "Advanced blocks", items: QUESTION_TYPES.filter((t) => t.category === "advanced"), color: "text-ok-danger" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ok-border/50 px-4 py-3 shrink-0">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-ok-text">
          Add Element
        </h3>
        {onMobileClose && (
          <button onClick={onMobileClose} className="text-ok-dim hover:text-ok-text lg:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-ok-dim/60">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((qt) => (
                <button
                  key={qt.type}
                  onClick={() => {
                    onAdd(qt.type);
                    onMobileClose?.();
                  }}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-ok-inner)] px-3 py-2 text-sm text-ok-dim transition-all duration-200 hover:bg-ok-surface/60 hover:text-ok-text group"
                >
                  <qt.icon className={cn("h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity", group.color)} />
                  {qt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Center canvas — Question cards ────────────────────────────────────────────

function SortableQuestionCard({
  question,
  index,
  selected,
  onSelect,
  onDelete,
  onUpdateLabel,
}: {
  question: Question;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdateLabel: (label: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const isLayout = QUESTION_TYPES.find(q => q.type === question.type)?.category === "layout";
  const isEmbed = QUESTION_TYPES.find(q => q.type === question.type)?.category === "embed";
  const isAdvanced = QUESTION_TYPES.find(q => q.type === question.type)?.category === "advanced";
  
  const isNonInput = isLayout || isEmbed || isAdvanced;

  const getPlaceholderText = () => {
    switch (question.type) {
      case "h1": return "Heading 1...";
      case "h2": return "Heading 2...";
      case "h3": return "Heading 3...";
      case "title": return "Form Title...";
      case "text": return "Type your text here...";
      case "new_page": return "New Page break description...";
      case "thank_you": return "Thank you message...";
      case "image": return "Image URL or description...";
      case "video": return "Video URL...";
      case "conditional_logic": return "Logic rule description...";
      case "calculated_field": return "Calculation formula...";
      default: return "Enter your prompt here...";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex rounded-[var(--radius-ok-outer)] border transition-all duration-200",
        selected
          ? "border-ok-green/30 bg-ok-surface shadow-[inset_3px_0_0_0_var(--color-ok-green)]"
          : "border-ok-border bg-ok-surface/40 hover:border-ok-border-glow hover:bg-ok-surface/60",
        isDragging && "shadow-lg shadow-black/20 ring-2 ring-ok-green/30"
      )}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <div
        className="flex w-8 shrink-0 items-center justify-center cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-ok-muted/40" />
      </div>

      {/* Content */}
      <div className="flex-1 px-2 py-5 pr-4">
        {/* Header line */}
        <div className="mb-2 flex items-center gap-2">
          {!isNonInput && (
            <span className="font-mono text-xs font-semibold text-ok-green">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <span className="text-[10px] font-medium uppercase tracking-wider text-ok-dim">
            {QUESTION_TYPE_LABEL[question.type]}
          </span>
          {question.required && !isNonInput && (
            <span className="text-xs text-ok-danger font-bold leading-none">*</span>
          )}
        </div>

        {/* Editable label */}
        {question.type === "divider" ? (
          <div className="my-4 h-px bg-ok-border/40" />
        ) : question.type === "new_page" ? (
          <div className="my-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-ok-border/40" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-ok-dim">Page Break</span>
            <div className="h-px flex-1 bg-ok-border/40" />
          </div>
        ) : (
          <input
            type="text"
            value={question.label}
            onChange={(e) => onUpdateLabel(e.target.value)}
            placeholder={getPlaceholderText()}
            className={cn(
              "w-full border-none bg-transparent text-sm font-medium text-ok-text placeholder:text-ok-muted/30 focus:outline-none",
              (question.type === "h1" || question.type === "title") && "font-display text-2xl font-bold",
              question.type === "h2" && "font-display text-xl font-bold",
              question.type === "h3" && "font-display text-lg font-semibold",
              question.type === "text" && "font-normal text-ok-muted"
            )}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Input Previews */}
        {!isNonInput && (
          <div className="mt-3">
            {/* Short inputs */}
            {["short_text", "number", "email", "phone", "link", "date", "time", "payment"].includes(question.type) && (
              <div className="flex h-10 items-center rounded-[var(--radius-ok-inner)] border border-ok-border/50 bg-ok-bg/50 px-3 text-xs text-ok-muted/30 pointer-events-none select-none">
                {QUESTION_TYPE_LABEL[question.type]} response field...
              </div>
            )}
            
            {/* Long inputs */}
            {question.type === "long_text" && (
              <div className="h-20 rounded-[var(--radius-ok-inner)] border border-ok-border/50 bg-ok-bg/50 px-3 pt-2.5 text-xs text-ok-muted/30 pointer-events-none select-none">
                Paragraph response field...
              </div>
            )}
            
            {/* Choice / Lists */}
            {["multiple_choice", "checkbox", "ranking"].includes(question.type) && (
              <div className="space-y-1.5">
                {question.options.map((opt, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 rounded-[var(--radius-ok-inner)] border border-ok-border/40 bg-ok-bg/30 px-3 py-2 text-xs text-ok-muted pointer-events-none select-none"
                  >
                    {question.type === "multiple_choice" ? (
                      <span className="h-3 w-3 shrink-0 rounded-full border border-ok-border bg-ok-surface" />
                    ) : question.type === "checkbox" ? (
                      <span className="h-3 w-3 shrink-0 rounded-[3px] border border-ok-border bg-ok-surface" />
                    ) : (
                      <span className="font-mono text-[10px] text-ok-dim">{i + 1}.</span>
                    )}
                    {opt}
                  </div>
                ))}
              </div>
            )}

            {/* Dropdown / Select */}
            {["dropdown", "multi_select"].includes(question.type) && (
              <div className="flex h-10 items-center justify-between rounded-[var(--radius-ok-inner)] border border-ok-border/50 bg-ok-bg/50 px-3 text-xs text-ok-muted/30 pointer-events-none select-none">
                <span>Select option(s)...</span>
                <ChevronDown className="h-4 w-4 text-ok-muted" />
              </div>
            )}

            {/* File Upload */}
            {question.type === "file_upload" && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-ok-inner)] border border-dashed border-ok-border/60 bg-ok-bg/30 py-8 text-xs text-ok-muted/50 pointer-events-none select-none">
                <Upload className="h-5 w-5 mb-1" />
                Click to choose a file or drag here
              </div>
            )}

            {/* Matrix */}
            {question.type === "matrix" && (
              <div className="w-full overflow-hidden rounded-[var(--radius-ok-inner)] border border-ok-border/50 bg-ok-bg/30 pointer-events-none select-none">
                <div className="grid grid-cols-4 border-b border-ok-border/30 p-2 text-[10px] uppercase text-ok-dim">
                  <div /><div>Col 1</div><div>Col 2</div><div>Col 3</div>
                </div>
                <div className="grid grid-cols-4 border-b border-ok-border/30 p-2 text-xs text-ok-muted">
                  <div className="font-medium">Row 1</div><div>○</div><div>○</div><div>○</div>
                </div>
                <div className="grid grid-cols-4 p-2 text-xs text-ok-muted">
                  <div className="font-medium">Row 2</div><div>○</div><div>○</div><div>○</div>
                </div>
              </div>
            )}

            {/* Linear Scale / Rating */}
            {(question.type === "linear_scale" || question.type === "rating") && (
              <div className="flex items-center gap-3 pointer-events-none select-none mt-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div key={num} className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-ok-inner)] border border-ok-border/50 bg-ok-bg/50 text-xs text-ok-muted">
                    {question.type === "rating" ? <Star className="h-4 w-4" /> : num}
                  </div>
                ))}
              </div>
            )}

            {/* Signature */}
            {question.type === "signature" && (
              <div className="flex items-center justify-center rounded-[var(--radius-ok-inner)] border border-ok-border/50 bg-ok-bg/50 h-24 text-xs text-ok-muted/30 pointer-events-none select-none">
                Draw signature here...
              </div>
            )}
          </div>
        )}
        
        {/* Placeholder for complex embeds / advanced blocks */}
        {isEmbed && (
           <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-ok-inner)] border border-dashed border-ok-purple/30 bg-ok-purple/5 px-4 py-6 text-xs text-ok-purple/70 pointer-events-none select-none">
             <Code className="h-5 w-5" />
             Configure {QUESTION_TYPE_LABEL[question.type]} settings in the side panel
           </div>
        )}

        {isAdvanced && question.type !== "country" && question.type !== "recaptcha" && (
           <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-ok-inner)] border border-dashed border-ok-danger/30 bg-ok-danger/5 px-4 py-4 text-xs text-ok-danger/70 pointer-events-none select-none">
             <Settings className="h-4 w-4" />
             Logic / Calculation block (Invisible to respondents)
           </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 border-l border-ok-border/10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-1 text-ok-dim transition-colors hover:bg-ok-danger/10 hover:text-ok-danger"
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
  onReorder,
  onUpdateLabel,
  onUpdateTitle,
  onAddBetween,
}: {
  questions: Question[];
  selectedId: string | null;
  formTitle: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onUpdateTitle: (title: string) => void;
  onAddBetween: (afterIndex: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const questionIds = useMemo(() => questions.map((q) => q.id), [questions]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-6 max-w-3xl mx-auto w-full">
      {/* Form title wrapper */}
      <input
        type="text"
        value={formTitle}
        onChange={(e) => onUpdateTitle(e.target.value)}
        placeholder="Untitled Campaign Survey"
        className="mb-8 w-full border-none bg-transparent font-display text-2xl font-bold text-ok-text placeholder:text-ok-muted/20 focus:outline-none lg:text-3xl"
      />

      {questions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-ok-outer)] border-2 border-dashed border-ok-border/60 bg-ok-surface/20 px-12 py-16 text-center max-w-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-surface">
              <Plus className="h-5 w-5 text-ok-dim" />
            </div>
            <p className="text-sm font-medium text-ok-text">Build your research pipeline</p>
            <p className="text-xs text-ok-dim leading-relaxed">
              Select an element or input field from the side construction panel to populate your survey structure.
            </p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={questionIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 pb-24">
              {questions.map((q, i) => (
                <div key={q.id} className="relative group/step">
                  <SortableQuestionCard
                    question={q}
                    index={i}
                    selected={selectedId === q.id}
                    onSelect={() => onSelect(q.id)}
                    onDelete={() => onDelete(q.id)}
                    onUpdateLabel={(label) => onUpdateLabel(q.id, label)}
                  />

                  <div className="absolute left-0 right-0 -bottom-[14px] flex justify-center z-10 opacity-0 group-hover/step:opacity-100 transition-opacity duration-150">
                    <button
                      onClick={() => onAddBetween(i)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-ok-border bg-ok-surface text-ok-dim shadow-md transition-all hover:scale-105 hover:border-ok-green/40 hover:text-ok-green"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
        <Settings className="mb-3 h-6 w-6 text-ok-muted/30 animate-spin-slow" />
        <p className="text-xs text-ok-dim">
          Select an active component node to edit field properties.
        </p>
      </div>
    );
  }

  const isLayout = QUESTION_TYPES.find(q => q.type === question.type)?.category === "layout";
  const isEmbed = QUESTION_TYPES.find(q => q.type === question.type)?.category === "embed";
  const isAdvanced = QUESTION_TYPES.find(q => q.type === question.type)?.category === "advanced";
  const isNonInput = isLayout || isEmbed || isAdvanced;

  const isLong = question.type === "long_text";
  const hasOptions = ["multiple_choice", "checkbox", "dropdown", "multi_select", "ranking"].includes(question.type);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-ok-border/50 px-4 py-3 bg-ok-surface/10">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-ok-text">
          Field Configuration
        </h3>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {/* Common: Required toggle (only for inputs) */}
        {!isNonInput && (
          <div className="flex items-center justify-between border-b border-ok-border/20 pb-4">
            <label className="text-xs font-medium text-ok-muted">Enforce Requirement</label>
            <button
              onClick={() => onUpdate(question.id, { required: !question.required })}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none",
                question.required ? "bg-ok-green" : "bg-ok-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-ok-bg transition-transform duration-200",
                  question.required && "translate-x-4"
                )}
              />
            </button>
          </div>
        )}

        {/* Word count limits */}
        {isLong && (
          <div className="space-y-4 border-b border-ok-border/20 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-ok-dim uppercase tracking-wider">Min Words</label>
                <input
                  type="number"
                  min={0}
                  value={question.minWords || ""}
                  onChange={(e) => onUpdate(question.id, { minWords: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-3 py-2 font-mono text-xs text-ok-text focus:border-ok-green/40 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-ok-dim uppercase tracking-wider">Max Words</label>
                <input
                  type="number"
                  min={0}
                  value={question.maxWords || ""}
                  onChange={(e) => onUpdate(question.id, { maxWords: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-3 py-2 font-mono text-xs text-ok-text focus:border-ok-green/40 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-ok-dim">
              Note: Paragraph profiles scoring beneath criteria limits lower the response vector payload value during engine checks.
            </p>
          </div>
        )}

        {/* Options manager */}
        {hasOptions && (
          <div className="space-y-4 border-b border-ok-border/20 pb-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-ok-dim uppercase tracking-wider">Option Mapping</label>
              <div className="space-y-2">
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
                      className="flex-1 rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-3 py-1.5 text-xs text-ok-text focus:border-ok-green/40 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const next = question.options.filter((_, j) => j !== i);
                        onUpdate(question.id, { options: next });
                      }}
                      className="shrink-0 rounded p-1.5 text-ok-muted hover:bg-ok-surface hover:text-ok-danger transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  onUpdate(question.id, {
                    options: [...question.options, `Option ${question.options.length + 1}`],
                  })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-ok-inner)] border border-dashed border-ok-border/60 py-2 text-xs text-ok-dim transition-colors hover:border-ok-green/40 hover:text-ok-green"
              >
                <Plus className="h-3 w-3" />
                Add Selection Variant
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="text-xs font-medium text-ok-muted">Randomize Item Sequence</label>
              <button
                onClick={() => onUpdate(question.id, { randomize: !question.randomize })}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none",
                  question.randomize ? "bg-ok-green" : "bg-ok-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-ok-bg transition-transform duration-200",
                    question.randomize && "translate-x-4"
                  )}
                />
              </button>
            </div>
          </div>
        )}
        
        {/* Placeholder for block-specific settings */}
        {isEmbed && (
          <div className="space-y-3">
             <label className="text-[11px] font-semibold text-ok-dim uppercase tracking-wider">Embed Source URI</label>
             <input type="text" placeholder="https://" className="w-full rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-3 py-2 font-mono text-xs text-ok-text focus:border-ok-green/40 focus:outline-none" />
          </div>
        )}
        
        {question.type === "file_upload" && (
           <div className="space-y-3">
             <label className="text-[11px] font-semibold text-ok-dim uppercase tracking-wider">Size Limit (MB)</label>
             <input type="number" defaultValue={10} className="w-full rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-3 py-2 font-mono text-xs text-ok-text focus:border-ok-green/40 focus:outline-none" />
           </div>
        )}
      </div>
    </div>
  );
}

// ─── Reward settings ───────────────────────────────────────────────────────────

function RewardSettingsPanel({
  settings,
  onUpdate,
}: {
  settings: RewardSettings;
  onUpdate: (updates: Partial<RewardSettings>) => void;
}) {
  return (
    <div className="border-t border-ok-border/60 bg-ok-surface/20 p-4 space-y-4">
      <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-ok-text">
        Protocol Incentives
      </h4>

      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-ok-dim uppercase tracking-wider">Escrow Reservoir Pool</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-ok-green">◎</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={settings.rewardPool || ""}
              onChange={(e) => onUpdate({ rewardPool: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg py-2 pl-8 pr-3 font-mono text-xs text-ok-text focus:border-ok-green/40 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-ok-dim uppercase tracking-wider">Target Threshold Cap</label>
          <input
            type="number"
            min={1}
            value={settings.maxResponses || ""}
            onChange={(e) => onUpdate({ maxResponses: parseInt(e.target.value) || 0 })}
            className="w-full rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-3 py-2 font-mono text-xs text-ok-text focus:border-ok-green/40 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-ok-dim uppercase tracking-wider">Distribution Distribution</label>
          <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg p-1">
            <button
              onClick={() => onUpdate({ rewardType: "weighted" })}
              className={cn(
                "rounded-[var(--radius-ok-inner)] py-1.5 text-xs font-medium transition-colors",
                settings.rewardType === "weighted"
                  ? "bg-ok-green/10 text-ok-green border border-ok-green/20"
                  : "text-ok-dim hover:text-ok-text border border-transparent"
              )}
            >
              Weighted
            </button>
            <button
              onClick={() => onUpdate({ rewardType: "lottery" })}
              className={cn(
                "rounded-[var(--radius-ok-inner)] py-1.5 text-xs font-medium transition-colors",
                settings.rewardType === "lottery"
                  ? "bg-ok-purple/10 text-ok-purple border border-ok-purple/20"
                  : "text-ok-dim hover:text-ok-text border border-transparent"
              )}
            >
              Lottery
            </button>
          </div>
        </div>

        {settings.rewardType === "lottery" && (
          <div className="space-y-1.5 animate-fadeIn">
            <label className="text-[11px] font-semibold text-ok-dim uppercase tracking-wider">Draw Target Winners</label>
            <input
              type="number"
              min={1}
              value={settings.numWinners || ""}
              onChange={(e) => onUpdate({ numWinners: parseInt(e.target.value) || 0 })}
              className="w-full rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-3 py-2 font-mono text-xs text-ok-text focus:border-ok-green/40 focus:outline-none"
            />
          </div>
        )}

        <div className="space-y-2.5 pt-3 border-t border-ok-border/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ok-dim/60">
            Sybil Mitigation Engines
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label className="text-xs text-ok-muted">Min Age (Days)</label>
              <input
                type="number"
                min={0}
                value={settings.minWalletAge || ""}
                onChange={(e) => onUpdate({ minWalletAge: parseInt(e.target.value) || 0 })}
                className="w-24 rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-2.5 py-1.5 font-mono text-xs text-right text-ok-text focus:border-ok-green/40 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-xs text-ok-muted">Min SOL Threshold</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={settings.minSolBalance || ""}
                onChange={(e) => onUpdate({ minSolBalance: parseFloat(e.target.value) || 0 })}
                className="w-24 rounded-[var(--radius-ok-inner)] border border-ok-border bg-ok-bg px-2.5 py-1.5 font-mono text-xs text-right text-ok-text focus:border-ok-green/40 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function FormBuilder() {
  const [formTitle, setFormTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reward, setReward] = useState<RewardSettings>(INITIAL_REWARD);
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

  const addBetween = useCallback((afterIndex: number) => {
    const q = createQuestion("short_text");
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, q);
      return next;
    });
    setSelectedId(q.id);
  }, []);

  const deleteQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const reorderQuestions = useCallback((oldIndex: number, newIndex: number) => {
    setQuestions((prev) => arrayMove(prev, oldIndex, newIndex));
  }, []);

  const updateQuestionLabel = useCallback((id: string, label: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, label } : q)));
  }, []);

  const updateQuestion = useCallback((id: string, updates: Partial<Question>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  }, []);

  return (
    <div className="flex h-screen flex-col bg-ok-bg text-ok-text selection:bg-ok-green/20">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-ok-border bg-ok-surface px-4">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-ok-dim transition-colors hover:text-ok-text">
            <ArrowLeft className="h-3.5 w-3.5" />
            Workspace Dashboard
          </Link>
        </div>
        <StatusPill status="active" className="opacity-70 bg-ok-surface border border-ok-border/80 text-[10px]">
          Draft Config
        </StatusPill>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <Eye className="h-3.5 w-3.5" />
            Simulate Interface
          </Button>
          <Button variant="primary" size="sm">
            Initialize Campaign
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-[260px] shrink-0 border-r border-ok-border bg-ok-bg lg:block">
          <LeftPanel onAdd={addQuestion} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-ok-surface/10">
          <Canvas
            questions={questions}
            selectedId={selectedId}
            formTitle={formTitle}
            onSelect={setSelectedId}
            onDelete={deleteQuestion}
            onReorder={reorderQuestions}
            onUpdateLabel={updateQuestionLabel}
            onUpdateTitle={setFormTitle}
            onAddBetween={addBetween}
          />
        </div>

        <div className="hidden w-[300px] shrink-0 border-l border-ok-border bg-ok-bg lg:flex lg:flex-col">
          <div className="flex-1 overflow-y-auto">
            <QuestionSettings question={selectedQuestion} onUpdate={updateQuestion} />
          </div>
          <RewardSettingsPanel settings={reward} onUpdate={(updates) => setReward((prev) => ({ ...prev, ...updates }))} />
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-30 lg:hidden">
        <button
          onClick={() => setShowMobilePicker(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-green text-ok-bg shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {showMobilePicker && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobilePicker(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] rounded-t-[var(--radius-ok-outer)] border-t border-ok-border bg-ok-bg animate-slideUp">
            <LeftPanel onAdd={addQuestion} onMobileClose={() => setShowMobilePicker(false)} />
          </div>
        </div>
      )}
    </div>
  );
}