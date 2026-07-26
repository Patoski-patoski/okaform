import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileEdit, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

const DRAFTS_KEY = "okaform_saved_drafts";

export interface SavedDraft {
  id: string;
  name: string;
  formTitle: string;
  questionCount: number;
  savedAt: string;
}

function loadDrafts(): SavedDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDraft(name: string, formTitle: string, questions: unknown[], reward: unknown) {
  const drafts = loadDrafts();
  
  // Check if a draft with this name already exists
  const existingIndex = drafts.findIndex(d => d.name === name);
  
  if (existingIndex >= 0) {
    // Update existing draft
    drafts[existingIndex] = {
      ...drafts[existingIndex],
      formTitle,
      questionCount: questions.length,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(
      `okaform_draft_${drafts[existingIndex].id}`,
      JSON.stringify({ formTitle, questions, reward }),
    );
  } else {
    // Create new draft
    const id = crypto.randomUUID();
    const draft: SavedDraft = {
      id,
      name,
      formTitle,
      questionCount: questions.length,
      savedAt: new Date().toISOString(),
    };
    drafts.unshift(draft);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    localStorage.setItem(
      `okaform_draft_${id}`,
      JSON.stringify({ formTitle, questions, reward }),
    );
  }
  
  return existingIndex >= 0 ? drafts[existingIndex].id : drafts[0].id;
}

export default function DraftsView() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(loadDrafts());
    setLoading(false);
  }, []);

  const handleLoad = (draft: SavedDraft) => {
    try {
      const raw = localStorage.getItem(`okaform_draft_${draft.id}`);
      if (!raw) return;
      localStorage.setItem("okaform_current_draft", raw);
      navigate("/create");
    } catch {
      // ignore
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setTimeout(() => {
      const updated = drafts.filter((d) => d.id !== id);
      setDrafts(updated);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
      localStorage.removeItem(`okaform_draft_${id}`);
      setDeletingId(null);
    }, 200);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#656C76]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#656C76]">
            DASHBOARD // DRAFTS
          </p>
          <h2 className="mt-1 font-display text-xl font-bold text-[#F0F6F6]">
            Saved Drafts
          </h2>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded border border-[#3D444D]/50 bg-[#151B23]/20 py-16 text-center">
          <FileEdit className="mb-4 h-10 w-10 text-[#656C76]/30" />
          <p className="font-mono text-sm text-[#9198A1]">No saved drafts</p>
          <p className="mt-1 text-xs text-[#656C76]">
            Save your current work from the form builder to access it later.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="flex items-center justify-between rounded border border-[#3D444D]/50 bg-[#151B23]/20 px-5 py-4 transition-colors hover:border-[#3D444D]"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium text-[#F0F6F6] truncate">
                  {draft.name || draft.formTitle || "Untitled"}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-[#656C76]">
                  {draft.formTitle || "No title"} · {draft.questionCount} question{draft.questionCount !== 1 ? "s" : ""} · Saved {formatRelativeTime(new Date(draft.savedAt))}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={() => handleLoad(draft)}
                  className="inline-flex items-center gap-1.5 rounded border border-[#3D444D] bg-transparent px-3 py-1.5 font-mono text-[10px] text-ok-green transition-colors hover:border-ok-green/40 hover:bg-ok-green/5"
                >
                  <ExternalLink className="h-3 w-3" />
                  Load
                </button>
                <button
                  onClick={() => handleDelete(draft.id)}
                  disabled={deletingId === draft.id}
                  className="inline-flex items-center gap-1.5 rounded border border-transparent bg-transparent px-3 py-1.5 font-mono text-[10px] text-[#656C76] transition-colors hover:border-ok-danger/20 hover:text-ok-danger"
                >
                  {deletingId === draft.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
