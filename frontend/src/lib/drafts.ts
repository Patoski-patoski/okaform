export const DRAFTS_KEY = "okaform_saved_drafts";

export interface SavedDraft {
  id: string;
  name: string;
  formTitle: string;
  questionCount: number;
  savedAt: string;
}

export function loadDrafts(): SavedDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDraft(
  name: string,
  formTitle: string,
  questions: unknown[],
  reward: unknown,
) {
  const drafts = loadDrafts();

  const existingIndex = drafts.findIndex((d) => d.name === name);

  if (existingIndex >= 0) {
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
