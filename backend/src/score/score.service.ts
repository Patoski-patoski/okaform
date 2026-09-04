import { Injectable } from '@nestjs/common';

export interface ScoreQuestion {
  id: string;
  type: string;
  required: boolean;
  minWords: number;
}

export interface ScoreAnswer {
  questionId: string;
  value: unknown;
}

export interface ScoreSybilDetails {
  walletAgeDays: number;
  solBalance: number;
}

export interface CalculateScoreParams {
  questions: ScoreQuestion[];
  answers: ScoreAnswer[];
  submittedAt: Date;
  openedAt: number;
  sybilResult: { details: ScoreSybilDetails };
}

export interface ScoreBreakdown {
  completionRate: number;
  responseDepth: number;
  consistency: number;
  walletHistory: number;
  creatorRating: number;
}

export interface SubmissionScore {
  total: number;
  breakdown: ScoreBreakdown;
}

const DEPTH_WORD_RATIO_THRESHOLD = 0.8;
const CONSISTENCY_MAX_SECONDS = 604800;
const MAX_WALLET_HISTORY_SCORE = 0.75;
const MIN_WALLET_HISTORY_SCORE = 0.25;

function isNonEmpty(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== undefined && value !== null;
}

function wordCount(value: unknown): number {
  if (typeof value !== 'string') {
    return 0;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function roundScore(total: number): number {
  return Math.round(total * 10) / 10;
}

function completionRateMetric(
  questions: ScoreQuestion[],
  answers: ScoreAnswer[],
): number {
  const requiredQuestions = questions.filter((q) => q.required);
  const answeredRequired = requiredQuestions.filter((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    return answer !== undefined && isNonEmpty(answer.value);
  }).length;

  if (answeredRequired === requiredQuestions.length) {
    return 1.0;
  }
  if (
    requiredQuestions.length > 0 &&
    answeredRequired / requiredQuestions.length >= 0.7
  ) {
    return 0.5;
  }
  return 0.0;
}

function responseDepthMetric(
  questions: ScoreQuestion[],
  answers: ScoreAnswer[],
): number {
  const depthQuestions = questions.filter(
    (q) => q.type === 'long_text' && q.minWords > 0,
  );

  if (depthQuestions.length === 0) {
    return 1.0;
  }

  const counts = depthQuestions.map((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    return {
      minWords: q.minWords,
      words: answer !== undefined ? wordCount(answer.value) : 0,
    };
  });

  const allPass = counts.every((c) => c.words >= c.minWords);
  if (allPass) {
    return 1.0;
  }

  const allAboveThreshold = counts.every(
    (c) => c.words >= c.minWords * DEPTH_WORD_RATIO_THRESHOLD,
  );
  if (allAboveThreshold) {
    return 0.5;
  }

  return 0.0;
}

function consistencyMetric(
  questionCount: number,
  submittedAt: Date,
  openedAt: number,
): number {
  const minExpectedSeconds = questionCount * 15;
  const elapsedSeconds = (submittedAt.getTime() - openedAt) / 1000;

  if (elapsedSeconds < minExpectedSeconds) {
    return 0.0;
  }
  if (elapsedSeconds > CONSISTENCY_MAX_SECONDS) {
    return 0.5;
  }
  return 1.0;
}

function walletHistoryMetric(details: ScoreSybilDetails): number {
  const walletScore =
    details.walletAgeDays >= 90 ? 1.0 : details.walletAgeDays >= 30 ? 0.5 : 0.0;

  const balanceScore =
    details.solBalance >= 1.0 ? 1.0 : details.solBalance >= 0.1 ? 0.5 : 0.0;

  const average = (walletScore + balanceScore) / 2;
  if (average >= MAX_WALLET_HISTORY_SCORE) {
    return 1.0;
  }
  if (average >= MIN_WALLET_HISTORY_SCORE) {
    return 0.5;
  }
  return 0.0;
}

@Injectable()
export class ScoreService {
  calculateSubmissionScore(params: CalculateScoreParams): SubmissionScore {
    const { questions, answers, submittedAt, openedAt, sybilResult } = params;

    const completionRate = completionRateMetric(questions, answers);
    const responseDepth = responseDepthMetric(questions, answers);
    const consistency = consistencyMetric(
      questions.length,
      submittedAt,
      openedAt,
    );
    const walletHistory = walletHistoryMetric(sybilResult.details);
    const creatorRating = 1.0;

    const breakdown: ScoreBreakdown = {
      completionRate,
      responseDepth,
      consistency,
      walletHistory,
      creatorRating,
    };

    const rawTotal =
      completionRate +
      responseDepth +
      consistency +
      walletHistory +
      creatorRating;

    return {
      total: roundScore(rawTotal),
      breakdown,
    };
  }
}
