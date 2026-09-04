import { ScoreService, type CalculateScoreParams } from './score.service';

describe('ScoreService', () => {
  let service: ScoreService;

  const baseParams: CalculateScoreParams = {
    questions: [],
    answers: [],
    submittedAt: new Date('2025-01-01T00:10:00Z'),
    openedAt: new Date('2025-01-01T00:00:00Z').getTime(),
    sybilResult: {
      details: { walletAgeDays: 0, solBalance: 0 },
    },
  };

  beforeEach(() => {
    service = new ScoreService();
  });

  function question(
    id: string,
    overrides: Partial<{
      type: string;
      required: boolean;
      minWords: number;
    }> = {},
  ): CalculateScoreParams['questions'][number] {
    return {
      id,
      type: overrides.type ?? 'short_text',
      required: overrides.required ?? false,
      minWords: overrides.minWords ?? 0,
    };
  }

  function answer(
    questionId: string,
    value: unknown,
  ): CalculateScoreParams['answers'][number] {
    return { questionId, value };
  }

  describe('completionRate', () => {
    it('should return 1.0 when all required questions are answered', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [
          question('q1', { required: true }),
          question('q2', { required: true }),
        ],
        answers: [answer('q1', 'yes'), answer('q2', 'no')],
      });

      expect(result.breakdown.completionRate).toBe(1.0);
    });

    it('should return 0.5 when at least 70% of required questions are answered', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [
          question('q1', { required: true }),
          question('q2', { required: true }),
          question('q3', { required: true }),
          question('q4', { required: true }),
        ],
        answers: [
          answer('q1', 'yes'),
          answer('q2', 'yes'),
          answer('q3', 'yes'),
        ],
      });

      expect(result.breakdown.completionRate).toBe(0.5);
    });

    it('should return 0.0 when fewer than 70% of required questions are answered', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [
          question('q1', { required: true }),
          question('q2', { required: true }),
          question('q3', { required: true }),
          question('q4', { required: true }),
        ],
        answers: [answer('q1', 'yes'), answer('q2', 'yes')],
      });

      expect(result.breakdown.completionRate).toBe(0.0);
    });

    it('should return 1.0 when there are no required questions', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [question('q1'), question('q2')],
        answers: [],
      });

      expect(result.breakdown.completionRate).toBe(1.0);
    });

    it('should treat empty string and empty array answers as unanswered', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [
          question('q1', { required: true }),
          question('q2', { required: true }),
        ],
        answers: [answer('q1', '   '), answer('q2', [])],
      });

      expect(result.breakdown.completionRate).toBe(0.0);
    });
  });

  describe('responseDepth', () => {
    it('should return 1.0 when there are no long_text questions with minWords', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [question('q1')],
        answers: [answer('q1', 'hi')],
      });

      expect(result.breakdown.responseDepth).toBe(1.0);
    });

    it('should return 1.0 when all long_text answers meet minWords', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [
          question('q1', { type: 'long_text', minWords: 5 }),
          question('q2', { type: 'long_text', minWords: 3 }),
        ],
        answers: [
          answer('q1', 'one two three four five six'),
          answer('q2', 'a b c d'),
        ],
      });

      expect(result.breakdown.responseDepth).toBe(1.0);
    });

    it('should return 0.5 when all answers reach at least 80% of minWords', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [question('q1', { type: 'long_text', minWords: 10 })],
        answers: [answer('q1', 'one two three four five six seven eight')],
      });

      expect(result.breakdown.responseDepth).toBe(0.5);
    });

    it('should return 0.0 when any long_text answer fails the 80% threshold', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [
          question('q1', { type: 'long_text', minWords: 10 }),
          question('q2', { type: 'long_text', minWords: 10 }),
        ],
        answers: [
          answer('q1', 'one two three four five'),
          answer('q2', 'one two three four five six seven eight'),
        ],
      });

      expect(result.breakdown.responseDepth).toBe(0.0);
    });

    it('should treat a missing long_text answer as failing', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [question('q1', { type: 'long_text', minWords: 5 })],
        answers: [],
      });

      expect(result.breakdown.responseDepth).toBe(0.0);
    });
  });

  describe('consistency', () => {
    it('should return 1.0 when elapsed time is within the expected window', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [question('q1'), question('q2'), question('q3')],
        openedAt: new Date('2025-01-01T00:00:00Z').getTime(), // 600s elapsed, min = 45s
      });

      expect(result.breakdown.consistency).toBe(1.0);
    });

    it('should return 0.0 when submitted too fast (below minimum expected seconds)', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [question('q1'), question('q2'), question('q3')],
        openedAt: new Date('2025-01-01T00:09:55Z').getTime(), // 5s elapsed, min = 45s
      });

      expect(result.breakdown.consistency).toBe(0.0);
    });

    it('should return 0.5 when elapsed time exceeds the maximum window', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        questions: [question('q1')],
        openedAt: new Date('2024-12-01T00:00:00Z').getTime(), // > 604800s
      });

      expect(result.breakdown.consistency).toBe(0.5);
    });
  });

  describe('walletHistory', () => {
    it('should return 1.0 for mature wallet with high SOL balance', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        sybilResult: {
          details: { walletAgeDays: 90, solBalance: 2.0 },
        },
      });

      expect(result.breakdown.walletHistory).toBe(1.0);
    });

    it('should return 1.0 when average of age and balance scores is >= 0.75', () => {
      // age >= 90 -> 1.0, balance >= 0.1 -> 0.5; avg = 0.75
      const result = service.calculateSubmissionScore({
        ...baseParams,
        sybilResult: {
          details: { walletAgeDays: 95, solBalance: 0.5 },
        },
      });

      expect(result.breakdown.walletHistory).toBe(1.0);
    });

    it('should return 0.5 when average of age and balance scores is >= 0.25', () => {
      // age >= 30 -> 0.5, balance < 0.1 -> 0.0; avg = 0.25
      const result = service.calculateSubmissionScore({
        ...baseParams,
        sybilResult: {
          details: { walletAgeDays: 30, solBalance: 0.05 },
        },
      });

      expect(result.breakdown.walletHistory).toBe(0.5);
    });

    it('should return 0.0 for a fresh wallet with no balance', () => {
      const result = service.calculateSubmissionScore({
        ...baseParams,
        sybilResult: {
          details: { walletAgeDays: 5, solBalance: 0.0 },
        },
      });

      expect(result.breakdown.walletHistory).toBe(0.0);
    });
  });

  describe('creatorRating', () => {
    it('should default to 1.0', () => {
      const result = service.calculateSubmissionScore(baseParams);

      expect(result.breakdown.creatorRating).toBe(1.0);
    });
  });

  describe('total', () => {
    it('should return 5.0 (delta 50) for a perfect submission', () => {
      const result = service.calculateSubmissionScore({
        questions: [
          question('q1', { required: true }),
          question('q2', { required: true }),
          question('q3', { type: 'long_text', minWords: 5 }),
        ],
        answers: [
          answer('q1', 'yes'),
          answer('q2', 'no'),
          answer('q3', 'one two three four five six'),
        ],
        submittedAt: new Date('2025-01-01T00:10:00Z'),
        openedAt: new Date('2025-01-01T00:00:00Z').getTime(),
        sybilResult: {
          details: { walletAgeDays: 100, solBalance: 5.0 },
        },
      });

      expect(result.total).toBe(5.0);
      expect(Math.round(result.total * 10)).toBe(50);
    });

    it('should return 2.5 (delta 25) for a mediocre submission', () => {
      const result = service.calculateSubmissionScore({
        questions: [
          question('q1', { required: true }),
          question('q2', { required: true }),
          question('q3', { required: true }),
          question('q4', { required: true }),
          question('q5', { type: 'long_text', minWords: 10 }),
        ],
        answers: [
          answer('q1', 'yes'),
          answer('q2', 'yes'),
          answer('q3', 'yes'),
          answer('q5', 'one two three four five six seven eight'),
        ],
        submittedAt: new Date('2025-01-01T00:00:30Z'),
        openedAt: new Date('2025-01-01T00:00:00Z').getTime(), // 30s, min = 75s -> consistency 0.0
        sybilResult: {
          details: { walletAgeDays: 30, solBalance: 0.5 }, // avg 0.5 -> 0.5
        },
      });

      // completion 0.5 + depth 0.5 + consistency 0.0 + wallet 0.5 + creator 1.0
      expect(result.total).toBe(2.5);
      expect(Math.round(result.total * 10)).toBe(25);
    });

    it('should return 1.0 (delta 10) for a bot-like submission', () => {
      const result = service.calculateSubmissionScore({
        questions: [
          question('q1', { required: true }),
          question('q2', { type: 'long_text', minWords: 10 }),
        ],
        answers: [],
        submittedAt: new Date('2025-01-01T00:00:10Z'),
        openedAt: new Date('2025-01-01T00:00:00Z').getTime(), // 10s, min = 30s -> 0.0
        sybilResult: {
          details: { walletAgeDays: 0, solBalance: 0.0 }, // -> 0.0
        },
      });

      // completion 0.0 + depth 0.0 + consistency 0.0 + wallet 0.0 + creator 1.0
      expect(result.total).toBe(1.0);
      expect(Math.round(result.total * 10)).toBe(10);
    });

    it('should round totals to one decimal place', () => {
      const result = service.calculateSubmissionScore({
        questions: [
          question('q1', { required: true }),
          question('q2', { required: true }),
          question('q3', { required: true }),
          question('q4', { required: true }),
        ],
        answers: [
          answer('q1', 'yes'),
          answer('q2', 'yes'),
          answer('q3', 'yes'),
        ],
        submittedAt: new Date('2025-01-01T00:10:00Z'),
        openedAt: new Date('2025-01-01T00:00:00Z').getTime(),
        sybilResult: {
          details: { walletAgeDays: 30, solBalance: 0.5 },
        },
      });

      // completion 0.5 + depth 1.0 + consistency 1.0 + wallet 0.5 + creator 1.0
      expect(result.total).toBe(4.0);
    });
  });
});
