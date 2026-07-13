import type { Question } from "@/types/survey";

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

export function validateAnswers(
  answers: Record<string, string | string[]>,
  questions: Question[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const q of questions) {
    const a = answers[q.id];

    if (q.required) {
      const isEmpty =
        a === undefined || a === "" || (Array.isArray(a) && a.length === 0);
      if (isEmpty) {
        errors[q.id] = "This question is required";
        continue;
      }
    }

    if (q.type === "long_text" && typeof a === "string" && a.trim() !== "") {
      const words = countWords(a);
      if (q.minWords && words < q.minWords) {
        errors[q.id] =
          `Minimum ${q.minWords} words required (${words} entered)`;
      } else if (q.maxWords && words > q.maxWords) {
        errors[q.id] = `Maximum ${q.maxWords} words allowed (${words} entered)`;
      }
    }
  }

  return errors;
}
