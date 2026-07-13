export interface QuestionOption {
  id: string;
  label: string;
}

export type QuestionType =
  | "short_text"
  | "long_text"
  | "multiple_choice"
  | "checkbox"
  | "multi_select"
  | "linear_scale";

export interface Question {
  id: string;
  type: QuestionType;
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
