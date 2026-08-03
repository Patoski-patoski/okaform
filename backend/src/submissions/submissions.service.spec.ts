import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SurveyResponse } from '../common/schemas/response.schema';
import { Form } from '../common/schemas/form.schema';
import { SurveyLifecycleService } from '../forms/survey-lifecycle.service';
import { SybilService } from '../sybil/sybil.service';
import { ScoreService } from '../score/score.service';
import { SolanaService } from '../solana/solana.service';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';
import { FormClosedException } from '../common/exceptions/form/form-closed.exception';
import { FormFullException } from '../common/exceptions/form/form-full.exception';
import { OkaformException } from '../common/exceptions/base.exception';
import type { ModerateResponseDto } from './dto/moderate-response.dto';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let responseModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };
  let formModel: {
    findById: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let surveyLifecycleService: jest.Mocked<SurveyLifecycleService>;
  let sybilService: jest.Mocked<SybilService>;
  let scoreService: jest.Mocked<ScoreService>;
  let solanaService: jest.Mocked<SolanaService>;

  const mockSubmission = {
    _id: 'sub123',
    formId: 'form123',
    respondentWallet: 'wallet123',
    answers: [{ questionId: 'q1', value: 'answer' }],
    scoreAtSubmission: 0,
    similarityFlag: false,
    submittedAt: new Date('2025-01-01'),
    moderationStatus: 'clean',
    moderationReason: null,
    moderationNote: null,
  };

  const mockForm = {
    _id: 'form123',
    status: 'active',
    creator: 'creator123',
    maxResponses: 10,
    minWalletAge: 0,
    minSolBalance: 0,
    rewardType: 'weighted',
    questions: [{ id: 'q1', type: 'long_text', required: true, minWords: 0 }],
  };

  // const mockFormFull = {
  //   _id: 'form123',
  //   status: 'active',
  //   creator: 'creator123',
  //   maxResponses: 10,
  //   responseCount: 10,
  //   minWalletAge: 0,
  //   minSolBalance: 0,
  // };

  beforeEach(async () => {
    responseModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    formModel = {
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    surveyLifecycleService = {
      checkAndCloseIfFull: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<SurveyLifecycleService>;

    sybilService = {
      checkEligibility: jest.fn().mockResolvedValue({
        passed: true,
        details: {
          walletAgeDays: 100,
          solBalance: 2.5,
          requiredAgeDays: 0,
          requiredBalance: 0,
        },
      }),
    } as unknown as jest.Mocked<SybilService>;

    scoreService = {
      calculateSubmissionScore: jest.fn().mockReturnValue({
        total: 3.5,
        breakdown: {
          completionRate: 1.0,
          responseDepth: 1.0,
          consistency: 1.0,
          walletHistory: 0.5,
          creatorRating: 1.0,
        },
      }),
    } as unknown as jest.Mocked<ScoreService>;

    solanaService = {
      scoreAccountExists: jest.fn().mockResolvedValue(true),
      updateScore: jest.fn().mockResolvedValue('txScore123'),
      fetchRespondentScore: jest.fn().mockResolvedValue(385),
    } as unknown as jest.Mocked<SolanaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionsService,
        {
          provide: getModelToken(SurveyResponse.name),
          useValue: responseModel,
        },
        {
          provide: getModelToken(Form.name),
          useValue: formModel,
        },
        {
          provide: SurveyLifecycleService,
          useValue: surveyLifecycleService,
        },
        {
          provide: SybilService,
          useValue: sybilService,
        },
        {
          provide: ScoreService,
          useValue: scoreService,
        },
        {
          provide: SolanaService,
          useValue: solanaService,
        },
      ],
    }).compile();

    service = module.get<SubmissionsService>(SubmissionsService);
  });

  describe('createSubmission', () => {
    beforeEach(() => {
      responseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockForm),
        }),
      });
      formModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockForm, responseCount: 6 }),
      });
      responseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
    });

    it('should create a new submission when no duplicate exists and form is valid', async () => {
      const mockDoc = {
        ...mockSubmission,
        save: jest.fn().mockResolvedValue(mockSubmission),
      };
      responseModel.create.mockResolvedValue(mockDoc);

      const result = await service.createSubmission(
        'form123',
        'wallet123',
        [{ questionId: 'q1', value: 'answer' }],
        new Date('2025-01-01').getTime(),
      );

      expect(result.id).toBe('sub123');
      expect(result.respondentWallet).toBe('wallet123');
      expect(responseModel.findOne).toHaveBeenCalledWith({
        formId: 'form123',
        respondentWallet: 'wallet123',
      });
    });

    it('should compute and persist score for weighted surveys', async () => {
      const mockDoc = {
        ...mockSubmission,
        save: jest.fn().mockResolvedValue(mockSubmission),
      };
      responseModel.create.mockResolvedValue(mockDoc);

      await service.createSubmission(
        'form123',
        'wallet123',
        [{ questionId: 'q1', value: 'answer' }],
        new Date('2025-01-01').getTime(),
      );

      expect(scoreService.calculateSubmissionScore).toHaveBeenCalledTimes(1);
      expect(solanaService.scoreAccountExists).toHaveBeenCalledWith(
        'wallet123',
      );
      expect(solanaService.updateScore).toHaveBeenCalledWith('wallet123', 35);
      expect(solanaService.fetchRespondentScore).toHaveBeenCalledWith(
        'wallet123',
      );
      expect(responseModel.findOneAndUpdate).toHaveBeenCalledWith(
        { formId: 'form123', respondentWallet: 'wallet123' },
        {
          $set: {
            scoreBreakdown: {
              completionRate: 1.0,
              responseDepth: 1.0,
              consistency: 1.0,
              walletHistory: 0.5,
              creatorRating: 1.0,
            },
            scoreDelta: 3.5,
            scoreDeltaInt: 35,
            scoreUpdatedAt: expect.any(Date),
            scoreUpdateTx: 'txScore123',
            scoreAtSubmission: 385,
          },
        },
        { new: false },
      );
    });

    it('should return the snapshot score in the submission result', async () => {
      const mockDoc = {
        ...mockSubmission,
        save: jest.fn().mockResolvedValue(mockSubmission),
      };
      responseModel.create.mockResolvedValue(mockDoc);

      const result = await service.createSubmission(
        'form123',
        'wallet123',
        [{ questionId: 'q1', value: 'answer' }],
        new Date('2025-01-01').getTime(),
      );

      expect(result.scoreAtSubmission).toBe(385);
    });

    it('should persist a zero score snapshot when on-chain read fails', async () => {
      const mockDoc = {
        ...mockSubmission,
        save: jest.fn().mockResolvedValue(mockSubmission),
      };
      responseModel.create.mockResolvedValue(mockDoc);
      solanaService.fetchRespondentScore.mockResolvedValue(null);

      await service.createSubmission(
        'form123',
        'wallet123',
        [{ questionId: 'q1', value: 'answer' }],
        new Date('2025-01-01').getTime(),
      );

      expect(responseModel.findOneAndUpdate).toHaveBeenCalledWith(
        { formId: 'form123', respondentWallet: 'wallet123' },
        expect.objectContaining({
          $set: expect.objectContaining({ scoreAtSubmission: 0 }),
        }),
        { new: false },
      );
    });

    it('should skip update_score when score account does not exist', async () => {
      const mockDoc = {
        ...mockSubmission,
        save: jest.fn().mockResolvedValue(mockSubmission),
      };
      responseModel.create.mockResolvedValue(mockDoc);
      solanaService.scoreAccountExists.mockResolvedValue(false);

      await service.createSubmission(
        'form123',
        'wallet123',
        [{ questionId: 'q1', value: 'answer' }],
        new Date('2025-01-01').getTime(),
      );

      expect(solanaService.updateScore).not.toHaveBeenCalled();
      expect(responseModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('should swallow score update failures without failing the submission', async () => {
      const mockDoc = {
        ...mockSubmission,
        save: jest.fn().mockResolvedValue(mockSubmission),
      };
      responseModel.create.mockResolvedValue(mockDoc);
      solanaService.updateScore.mockRejectedValue(new Error('rpc down'));

      const result = await service.createSubmission(
        'form123',
        'wallet123',
        [{ questionId: 'q1', value: 'answer' }],
        new Date('2025-01-01').getTime(),
      );

      expect(result.id).toBe('sub123');
      expect(responseModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('should skip scoring entirely for lucky draw surveys', async () => {
      const lotteryForm = {
        ...mockForm,
        rewardType: 'lucky_draw',
      };
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(lotteryForm),
        }),
      });
      const mockDoc = {
        ...mockSubmission,
        save: jest.fn().mockResolvedValue(mockSubmission),
      };
      responseModel.create.mockResolvedValue(mockDoc);

      await service.createSubmission(
        'form123',
        'wallet123',
        [{ questionId: 'q1', value: 'answer' }],
        new Date('2025-01-01').getTime(),
      );

      expect(scoreService.calculateSubmissionScore).not.toHaveBeenCalled();
      expect(solanaService.updateScore).not.toHaveBeenCalled();
    });

    it('should throw FormNotFoundException if form does not exist', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.createSubmission(
          'form123',
          'wallet123',
          [],
          new Date('2025-01-01').getTime(),
        ),
      ).rejects.toThrow(FormNotFoundException);
    });

    it('should throw FormClosedException if form is not active', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockForm, status: 'closed' }),
        }),
      });

      await expect(
        service.createSubmission(
          'form123',
          'wallet123',
          [],
          new Date('2025-01-01').getTime(),
        ),
      ).rejects.toThrow(FormClosedException);
    });

    it('should throw FormFullException if form has reached maxResponses', async () => {
      formModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createSubmission(
          'form123',
          'wallet123',
          [],
          new Date('2025-01-01').getTime(),
        ),
      ).rejects.toThrow(FormFullException);
    });

    it('should throw ConflictException for duplicate submission', async () => {
      responseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSubmission),
      });

      await expect(
        service.createSubmission(
          'form123',
          'wallet123',
          [],
          new Date('2025-01-01').getTime(),
        ),
      ).rejects.toThrow(ConflictException);

      expect(responseModel.create).not.toHaveBeenCalled();
    });
  });

  describe('getSubmissionsByForm', () => {
    it('should return submissions for a form', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockSubmission]),
      };
      responseModel.find.mockReturnValue(mockQuery);

      const result = await service.getSubmissionsByForm('form123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sub123');
      expect(result[0].respondentWallet).toBe('wallet123');
      expect(responseModel.find).toHaveBeenCalledWith({ formId: 'form123' });
    });

    it('should filter by moderation status when provided', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockSubmission]),
      };
      responseModel.find.mockReturnValue(mockQuery);

      const result = await service.getSubmissionsByForm('form123', 'flagged');

      expect(result).toHaveLength(1);
      expect(responseModel.find).toHaveBeenCalledWith({
        formId: 'form123',
        moderationStatus: 'flagged',
      });
    });

    it('should not filter when moderationStatus is all', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      responseModel.find.mockReturnValue(mockQuery);

      await service.getSubmissionsByForm('form123', 'all');

      expect(responseModel.find).toHaveBeenCalledWith({ formId: 'form123' });
    });

    it('should return empty array for form with no submissions', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      responseModel.find.mockReturnValue(mockQuery);

      const result = await service.getSubmissionsByForm('form123');

      expect(result).toHaveLength(0);
    });
  });

  describe('moderateResponse', () => {
    const closedForm = {
      _id: 'form123',
      status: 'closed',
      creator: 'creator123',
    };

    const moderationResponse = {
      _id: 'resp123',
      formId: 'form123',
      respondentWallet: 'wallet123',
      scoreDeltaInt: 35,
      moderationStatus: 'clean',
      moderationReason: null,
      moderationNote: null,
    };

    const defaultModerateDto: ModerateResponseDto = {
      status: 'flagged',
    };

    const mockFormQuery = (form: unknown) => ({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(form),
      }),
    });

    const mockResponseQuery = (response: unknown) => ({
      exec: jest.fn().mockResolvedValue(response),
    });

    beforeEach(() => {
      solanaService.updateScore.mockResolvedValue('txMod123');
      responseModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
    });

    it('should throw FormNotFoundException if form does not exist', async () => {
      formModel.findById.mockReturnValue(mockFormQuery(null));

      await expect(
        service.moderateResponse(
          'form123',
          'resp123',
          'creator123',
          defaultModerateDto,
        ),
      ).rejects.toThrow(FormNotFoundException);
    });

    it('should throw FORBIDDEN if caller is not the creator', async () => {
      formModel.findById.mockReturnValue(mockFormQuery(closedForm));

      await expect(
        service.moderateResponse(
          'form123',
          'resp123',
          'other-wallet',
          defaultModerateDto,
        ),
      ).rejects.toThrow(OkaformException);
    });

    it('should allow moderating a response while the survey is active', async () => {
      formModel.findById.mockReturnValue(
        mockFormQuery({ ...closedForm, status: 'active' }),
      );
      responseModel.findById.mockReturnValue(
        mockResponseQuery(moderationResponse),
      );

      await service.moderateResponse('form123', 'resp123', 'creator123', {
        status: 'flagged',
        reason: 'spam',
      });

      expect(responseModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(solanaService.updateScore).not.toHaveBeenCalled();
    });

    it('should throw RESPONSE_NOT_FOUND if response does not exist', async () => {
      formModel.findById.mockReturnValue(mockFormQuery(closedForm));
      responseModel.findById.mockReturnValue(mockResponseQuery(null));

      await expect(
        service.moderateResponse(
          'form123',
          'resp123',
          'creator123',
          defaultModerateDto,
        ),
      ).rejects.toThrow(OkaformException);
    });

    it('should flag a response without triggering a penalty', async () => {
      formModel.findById.mockReturnValue(mockFormQuery(closedForm));
      responseModel.findById.mockReturnValue(
        mockResponseQuery(moderationResponse),
      );

      await service.moderateResponse('form123', 'resp123', 'creator123', {
        status: 'flagged',
        reason: 'spam',
      });

      expect(responseModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(solanaService.updateScore).not.toHaveBeenCalled();
    });

    it('should apply a penalty when rejecting a response', async () => {
      formModel.findById.mockReturnValue(mockFormQuery(closedForm));
      responseModel.findById.mockReturnValue(
        mockResponseQuery(moderationResponse),
      );

      await service.moderateResponse('form123', 'resp123', 'creator123', {
        status: 'rejected',
        reason: 'bot',
      });

      // original delta +35 → penalty = -(35 + 10) = -45
      expect(solanaService.updateScore).toHaveBeenCalledWith('wallet123', -45);
      expect(responseModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('should remove a penalty when restoring to clean', async () => {
      formModel.findById.mockReturnValue(mockFormQuery(closedForm));
      responseModel.findById.mockReturnValue(
        mockResponseQuery({
          ...moderationResponse,
          moderationStatus: 'rejected',
        }),
      );

      await service.moderateResponse('form123', 'resp123', 'creator123', {
        status: 'clean',
      });

      // original delta +35 → restore = 35 + 10 = 45
      expect(solanaService.updateScore).toHaveBeenCalledWith('wallet123', 45);
    });

    it('should not apply penalty twice if already rejected', async () => {
      formModel.findById.mockReturnValue(mockFormQuery(closedForm));
      responseModel.findById.mockReturnValue(
        mockResponseQuery({
          ...moderationResponse,
          moderationStatus: 'rejected',
        }),
      );

      await service.moderateResponse('form123', 'resp123', 'creator123', {
        status: 'rejected',
        reason: 'duplicate',
      });

      expect(solanaService.updateScore).not.toHaveBeenCalled();
    });

    it('should not fail moderation when penalty on-chain call throws', async () => {
      formModel.findById.mockReturnValue(mockFormQuery(closedForm));
      responseModel.findById.mockReturnValue(
        mockResponseQuery(moderationResponse),
      );
      solanaService.updateScore.mockRejectedValue(new Error('rpc down'));

      await expect(
        service.moderateResponse('form123', 'resp123', 'creator123', {
          status: 'rejected',
          reason: 'other',
        }),
      ).resolves.toBeUndefined();

      expect(responseModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('countByForm', () => {
    it('should return count of submissions for a form', async () => {
      responseModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });

      const result = await service.countByForm('form123');

      expect(result).toBe(5);
    });
  });
});
