import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { FormsService } from './forms.service';
import { Form } from '../common/schemas/form.schema';
import { SurveyResponse } from '../common/schemas/response.schema';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';
import { SolanaService } from '../solana/solana.service';
import { SurveyLifecycleService } from './survey-lifecycle.service';

describe('FormsService', () => {
  let service: FormsService;
  let module: TestingModule;
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
    organization: '',
    closesAt: null,
    previewQuestion: '',
    creator: 'wallet123',
    status: 'active',
    createdAt: new Date('2025-01-01'),
    onChain: {
      surveyId: 'survey_abc123',
      surveyPda: 'pda123',
      escrowVault: 'escrow123',
      txSignature: 'tx123',
    },
  };

  beforeEach(async () => {
    formModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        FormsService,
        {
          provide: getModelToken(Form.name),
          useValue: formModel,
        },
        {
          provide: SolanaService,
          useValue: {
            buildInitializeSurveyTx: jest.fn(),
          },
        },
        {
          provide: getModelToken(SurveyResponse.name),
          useValue: {
            countDocuments: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(0),
            }),
            aggregate: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: SurveyLifecycleService,
          useValue: {
            buildCloseTx: jest.fn(),
            confirmClose: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FormsService>(FormsService);
  });

  describe('createForm', () => {
    it('should create a form from frontend-provided on-chain data', async () => {
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
        surveyId: 'survey_abc123',
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
        initTxSignature: 'tx123',
      };

      const mockDoc = {
        ...mockForm,
        save: jest.fn().mockResolvedValue(mockForm),
      };
      formModel.create.mockResolvedValue(mockDoc);

      const result = await service.createForm(dto, 'wallet123');

      expect(result.onChain).toEqual({
        surveyId: 'survey_abc123',
        surveyPda: 'pda123',
        escrowVault: 'escrow123',
        txSignature: 'tx123',
      });
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
        status: 'active',
        organization: '',
        rewardPool: 10,
        maxResponses: 100,
        responseCount: 0,
        rewardType: 'weighted',
        createdAt: expect.any(Date),
        closesAt: null,
        previewQuestion: '',
        rewardDistributed: false,
      });
      expect(formModel.find).toHaveBeenCalledWith({
        creator: 'wallet123',
        status: { $ne: 'draft' },
      });
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

  describe('buildInitializeTx', () => {
    it('should delegate to SolanaService.buildInitializeSurveyTx', async () => {
      const solanaService = module.get<SolanaService>(SolanaService);
      const buildSpy = jest
        .spyOn(solanaService, 'buildInitializeSurveyTx')
        .mockResolvedValue('mock-base64-tx');

      const dto = {
        surveyId: 'survey_abc123',
        rewardPoolSol: 10,
        rewardType: 'weighted' as const,
        maxResponses: 100,
        creator: 'wallet123',
        blockhash: 'blockhash123',
      };

      const result = await service.buildInitializeTx(dto);

      expect(buildSpy).toHaveBeenCalledWith(
        'wallet123',
        'survey_abc123',
        10,
        'weighted',
        100,
        'blockhash123',
      );
      expect(result).toEqual({ tx: 'mock-base64-tx' });
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
        creator: 'wallet123',
        status: 'active',
        organization: '',
        rewardPool: 10,
        maxResponses: 100,
        responseCount: 0,
        rewardType: 'weighted',
        createdAt: expect.any(Date),
        closesAt: null,
        previewQuestion: '',
        rewardDistributed: false,
        questions: [
          {
            id: 'q1',
            type: 'short_text',
            label: 'What is your name?',
            placeholder: undefined,
            required: true,
            options: [],
            minWords: undefined,
            maxWords: undefined,
            ratingMax: undefined,
            lowLabel: undefined,
            highLabel: undefined,
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

  describe('getExploreForms', () => {
    it('should return active and closed forms with response counts', async () => {
      const forms = [
        {
          _id: 'f1',
          title: 'Survey 1',
          organization: 'Org1',
          status: 'active',
          rewardPool: 10,
          maxResponses: 100,
          rewardType: 'weighted',
          numWinners: 1,
          minWalletAge: 0,
          minSolBalance: 0,
          closesAt: null,
          previewQuestion: '',
          createdAt: new Date('2025-01-01'),
        },
        {
          _id: 'f2',
          title: 'Survey 2',
          organization: 'Org2',
          status: 'closed',
          rewardPool: 20,
          maxResponses: 50,
          rewardType: 'lottery',
          numWinners: 5,
          minWalletAge: 7,
          minSolBalance: 1,
          closesAt: new Date('2025-01-10'),
          previewQuestion: 'Preview?',
          createdAt: new Date('2025-01-02'),
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(forms),
      };
      formModel.find.mockReturnValue(mockQuery);

      const counts = [
        { _id: 'f1', count: 10 },
        { _id: 'f2', count: 5 },
      ];
      const mockAggregate = {
        exec: jest.fn().mockResolvedValue(counts),
      };
      const responseModel = module.get(getModelToken(SurveyResponse.name));
      responseModel.aggregate.mockReturnValue(mockAggregate);

      const result = await service.getExploreForms();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Survey 1');
      expect(result[0].responses).toBe(10);
      expect(result[1].title).toBe('Survey 2');
      expect(result[1].responses).toBe(5);
      expect(result[1].closesAt).toBe('2025-01-10T00:00:00.000Z');
      expect(result[1].previewQuestion).toBe('Preview?');
      expect(formModel.find).toHaveBeenCalledWith({
        status: { $in: ['active', 'closed'] },
      });
    });

    it('should return empty array when no forms exist', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      formModel.find.mockReturnValue(mockQuery);

      const mockAggregate = {
        exec: jest.fn().mockResolvedValue([]),
      };
      const responseModel = module.get(getModelToken(SurveyResponse.name));
      responseModel.aggregate.mockReturnValue(mockAggregate);

      const result = await service.getExploreForms();

      expect(result).toHaveLength(0);
    });
  });
});
