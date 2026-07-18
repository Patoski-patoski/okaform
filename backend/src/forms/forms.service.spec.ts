import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { FormsService } from './forms.service';
import { Form } from '../common/schemas/form.schema';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';

describe('FormsService', () => {
  let service: FormsService;
  let formModel: {
    create: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
  };

  const mockForm = {
    _id: 'form123',
    title: 'Test Survey',
    questions: [
      {
        id: 'q1',
        type: 'short_text',
        label: 'What is your name?',
        required: true,
        options: [],
      },
    ],
    rewardPool: 10,
    maxResponses: 100,
    rewardType: 'weighted',
    numWinners: 1,
    minWalletAge: 0,
    minSolBalance: 0,
    creator: 'wallet123',
    status: 'draft',
    createdAt: new Date('2025-01-01'),
  };

  beforeEach(async () => {
    formModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        {
          provide: getModelToken(Form.name),
          useValue: formModel,
        },
      ],
    }).compile();

    service = module.get<FormsService>(FormsService);
  });

  describe('createForm', () => {
    it('should create a form and return result', async () => {
      const dto = {
        title: 'Test Survey',
        questions: [
          {
            id: 'q1',
            type: 'short_text' as const,
            label: 'What is your name?',
            required: true,
            options: [],
            minWords: 0,
            maxWords: 0,
            randomize: false,
            ratingMax: 5,
            lowLabel: '',
            highLabel: '',
            matrixRows: [],
            matrixColumns: [],
          },
        ],
        rewardPool: 10,
        maxResponses: 100,
        rewardType: 'weighted' as const,
      };

      const mockDoc = {
        ...mockForm,
        save: jest.fn().mockResolvedValue(mockForm),
      };
      formModel.create.mockResolvedValue(mockDoc);

      const result = await service.createForm(dto, 'wallet123');

      expect(result).toEqual({
        id: 'form123',
        title: 'Test Survey',
        status: 'draft',
        createdAt: expect.any(Date),
      });
      expect(formModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Survey',
          creator: 'wallet123',
          status: 'draft',
        }),
      );
    });
  });

  describe('getFormsByCreator', () => {
    it('should return forms for a creator', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockForm]),
      };
      formModel.find.mockReturnValue(mockQuery);

      const result = await service.getFormsByCreator('wallet123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'form123',
        title: 'Test Survey',
        status: 'draft',
        rewardPool: 10,
        maxResponses: 100,
        responseCount: 0,
        rewardType: 'weighted',
        createdAt: expect.any(Date),
      });
      expect(formModel.find).toHaveBeenCalledWith({ creator: 'wallet123' });
    });

    it('should return empty array for creator with no forms', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      formModel.find.mockReturnValue(mockQuery);

      const result = await service.getFormsByCreator('wallet123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getFormById', () => {
    it('should return form details for valid id', async () => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockForm),
      };
      formModel.findById.mockReturnValue(mockQuery);

      const result = await service.getFormById('form123');

      expect(result).toEqual({
        id: 'form123',
        title: 'Test Survey',
        status: 'draft',
        rewardPool: 10,
        maxResponses: 100,
        responseCount: 0,
        rewardType: 'weighted',
        createdAt: expect.any(Date),
        questions: [
          {
            id: 'q1',
            type: 'short_text',
            label: 'What is your name?',
            required: true,
            options: [],
          },
        ],
        minWalletAge: 0,
        minSolBalance: 0,
      });
      expect(formModel.findById).toHaveBeenCalledWith('form123');
    });

    it('should throw FormNotFoundException for invalid id', async () => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      formModel.findById.mockReturnValue(mockQuery);

      await expect(service.getFormById('nonexistent')).rejects.toThrow(
        FormNotFoundException,
      );
    });
  });
});
