import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SurveyResponse } from '../common/schemas/response.schema';
import { Form } from '../common/schemas/form.schema';
import { SurveyLifecycleService } from '../forms/survey-lifecycle.service';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';
import { FormClosedException } from '../common/exceptions/form/form-closed.exception';
import { FormFullException } from '../common/exceptions/form/form-full.exception';

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let responseModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
  };
  let formModel: {
    findById: jest.Mock;
  };
  let surveyLifecycleService: jest.Mocked<SurveyLifecycleService>;

  const mockSubmission = {
    _id: 'sub123',
    formId: 'form123',
    respondentWallet: 'wallet123',
    answers: [{ questionId: 'q1', value: 'answer' }],
    scoreAtSubmission: 0,
    similarityFlag: false,
    submittedAt: new Date('2025-01-01'),
  };

  const mockForm = {
    _id: 'form123',
    status: 'active',
    maxResponses: 10,
  };

  beforeEach(async () => {
    responseModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    formModel = {
      findById: jest.fn(),
    };

    surveyLifecycleService = {
      checkAndCloseIfFull: jest.fn(),
    } as unknown as jest.Mocked<SurveyLifecycleService>;

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
      ],
    }).compile();

    service = module.get<SubmissionsService>(SubmissionsService);
  });

  describe('createSubmission', () => {
    beforeEach(() => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockForm),
        }),
      });
      responseModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5), // below maxResponses
      });
    });

    it('should create a new submission when no duplicate exists and form is valid', async () => {
      responseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const mockDoc = {
        ...mockSubmission,
        save: jest.fn().mockResolvedValue(mockSubmission),
      };
      responseModel.create.mockResolvedValue(mockDoc);

      const result = await service.createSubmission('form123', 'wallet123', [
        { questionId: 'q1', value: 'answer' },
      ]);

      expect(result.id).toBe('sub123');
      expect(result.respondentWallet).toBe('wallet123');
      expect(responseModel.findOne).toHaveBeenCalledWith({
        formId: 'form123',
        respondentWallet: 'wallet123',
      });
    });

    it('should throw FormNotFoundException if form does not exist', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.createSubmission('form123', 'wallet123', []),
      ).rejects.toThrow(FormNotFoundException);
    });

    it('should throw FormClosedException if form is not active', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockForm, status: 'closed' }),
        }),
      });

      await expect(
        service.createSubmission('form123', 'wallet123', []),
      ).rejects.toThrow(FormClosedException);
    });

    it('should throw FormFullException if form has reached maxResponses', async () => {
      responseModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(10), // equal to maxResponses
      });

      await expect(
        service.createSubmission('form123', 'wallet123', []),
      ).rejects.toThrow(FormFullException);
    });

    it('should throw ConflictException for duplicate submission', async () => {
      responseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSubmission),
      });

      await expect(
        service.createSubmission('form123', 'wallet123', []),
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
