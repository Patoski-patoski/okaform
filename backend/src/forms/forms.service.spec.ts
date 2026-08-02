import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { FormsService } from './forms.service';
import { Form } from '../common/schemas/form.schema';
import { SurveyResponse } from '../common/schemas/response.schema';
import { FormNotFoundException } from '../common/exceptions/form/form-not-found.exception';
import { InvalidExpirationException } from '../common/exceptions/form/invalid-expiration.exception';
import { SurveyStillActiveException } from '../common/exceptions/form/survey-still-active.exception';
import { SolanaService } from '../solana/solana.service';
import { SurveyLifecycleService } from './survey-lifecycle.service';
import { FeeService } from './fee.service';
import { DistributionService } from '../distribution/distribution.service';

describe('FormsService', () => {
  let service: FormsService;
  let module: TestingModule;
  let formModel: {
    create: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    deleteOne: jest.Mock;
  };
  let distributionService: {
    deleteByForm: jest.Mock;
  };

  const mockForm = {
    _id: 'form123',
    title: 'Test Survey',
    description: '',
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
    grossRewardPoolLamports: 10_000_000_000,
    netRewardPoolLamports: 10_000_000_000,
    feeLamports: 0,
    feeBps: 0,
    feeWallet: '',
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
    closedAt: null,
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
      deleteOne: jest.fn(),
    };

    distributionService = {
      deleteByForm: jest.fn().mockResolvedValue(0),
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
            verifyInitializeSurveyTx: jest.fn().mockResolvedValue(undefined),
            initializeSurvey: jest.fn().mockResolvedValue({
              surveyId: 'survey_abc123',
              surveyPda: 'pda123',
              escrowVault: 'escrow123',
              txSignature: 'tx123',
            }),
            collectProtocolFee: jest.fn().mockResolvedValue('fee-tx123'),
          },
        },
        {
          provide: FeeService,
          useValue: {
            computeFee: jest.fn().mockReturnValue({
              feeLamports: 0,
              netRewardPoolLamports: 10_000_000_000,
            }),
            getFeeBps: jest.fn().mockReturnValue(0),
            getFeeWallet: jest
              .fn()
              .mockReturnValue('FeeWallet111111111111111111111111111111111111'),
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
            deleteMany: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ deletedCount: 2 }),
            }),
          },
        },
        {
          provide: DistributionService,
          useValue: distributionService,
        },
        {
          provide: SurveyLifecycleService,
          useValue: {
            buildCloseTx: jest.fn(),
            confirmClose: jest.fn(),
            buildCloseEscrowTx: jest.fn().mockResolvedValue({
              tx: 'escrow-close-tx',
            }),
            confirmCloseEscrow: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<FormsService>(FormsService);
  });

  describe('createForm', () => {
    it('should create a form and call on-chain initialization', async () => {
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
        surveyId: 'survey_12345_abc',
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
        surveyId: 'survey_12345_abc',
        surveyPda: 'pda123',
        escrowVault: 'escrow123',
        txSignature: 'tx123',
      });
    });

    it('should collect the protocol fee when BPS is greater than zero', async () => {
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
        surveyId: 'survey_12345_abc',
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
        initTxSignature: 'tx123',
      };

      const feeService = module.get<FeeService>(FeeService);
      const solanaService = module.get<SolanaService>(SolanaService);
      feeService.computeFee = jest.fn().mockReturnValue({
        feeLamports: 50_000_000,
        netRewardPoolLamports: 9_950_000_000,
      });

      const mockDoc = {
        ...mockForm,
        save: jest.fn().mockResolvedValue(mockForm),
      };
      formModel.create.mockResolvedValue(mockDoc);

      await service.createForm(dto, 'wallet123');

      expect(solanaService.collectProtocolFee).toHaveBeenCalledWith(
        50_000_000,
        'survey_12345_abc',
        'pda123',
        'escrow123',
      );
      expect(formModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          grossRewardPoolLamports: 10_000_000_000,
          netRewardPoolLamports: 9_950_000_000,
          feeLamports: 50_000_000,
          feeBps: 0,
          feeTxSignature: 'fee-tx123',
        }),
      );
    });

    it('should skip fee collection at 0 BPS', async () => {
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
        surveyId: 'survey_12345_abc',
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
        initTxSignature: 'tx123',
      };

      const solanaService = module.get<SolanaService>(SolanaService);
      const mockDoc = {
        ...mockForm,
        save: jest.fn().mockResolvedValue(mockForm),
      };
      formModel.create.mockResolvedValue(mockDoc);

      await service.createForm(dto, 'wallet123');

      expect(solanaService.collectProtocolFee).not.toHaveBeenCalled();
      expect(formModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          feeLamports: 0,
          feeTxSignature: null,
        }),
      );
    });

    it('should throw when initialize survey tx failed on-chain', async () => {
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
        surveyId: 'survey_12345_abc',
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
        initTxSignature: 'tx123',
      };

      const solanaService = module.get<SolanaService>(SolanaService);
      jest
        .spyOn(solanaService, 'verifyInitializeSurveyTx')
        .mockRejectedValue(new Error('Transaction failed'));

      await expect(service.createForm(dto, 'wallet123')).rejects.toThrow(
        'Transaction failed',
      );
      expect(formModel.create).not.toHaveBeenCalled();
    });

    it('should throw when closesAt is less than 24 hours from now', async () => {
      const dto = {
        title: 'Test Survey',
        questions: [
          {
            id: 'q1',
            type: 'short_text' as const,
            label: 'Q',
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
        surveyId: 'survey_12345_abc',
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
        initTxSignature: 'tx123',
        closesAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
      };

      await expect(service.createForm(dto, 'wallet123')).rejects.toThrow(
        InvalidExpirationException,
      );
    });

    it('should throw when closesAt is more than 30 days from now', async () => {
      const dto = {
        title: 'Test Survey',
        questions: [
          {
            id: 'q1',
            type: 'short_text' as const,
            label: 'Q',
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
        surveyId: 'survey_12345_abc',
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
        initTxSignature: 'tx123',
        closesAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days
      };

      await expect(service.createForm(dto, 'wallet123')).rejects.toThrow(
        InvalidExpirationException,
      );
    });

    it('should throw when closesAt is an invalid date string', async () => {
      const dto = {
        title: 'Test Survey',
        questions: [
          {
            id: 'q1',
            type: 'short_text' as const,
            label: 'Q',
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
        surveyId: 'survey_12345_abc',
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
        initTxSignature: 'tx123',
        closesAt: 'not-a-valid-date',
      };

      await expect(service.createForm(dto, 'wallet123')).rejects.toThrow(
        InvalidExpirationException,
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
        description: '',
        creator: 'wallet123',
        grossRewardPoolLamports: 10_000_000_000,
        netRewardPoolLamports: 10_000_000_000,
        feeLamports: 0,
        feeBps: 0,
        feeWallet: '',
        minWalletAge: 0,
        minSolBalance: 0,
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
        closedAt: null,
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
        .mockResolvedValue({
          tx: 'mock-base64-tx',
          surveyPda: 'pda123',
          escrowPda: 'escrow123',
        });

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
      expect(result).toEqual({
        tx: 'mock-base64-tx',
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
      });
    });

    it('should throw when closesAt is less than 24 hours from now', async () => {
      const dto = {
        surveyId: '123',
        rewardPoolSol: 10,
        rewardType: 'weighted' as const,
        maxResponses: 100,
        creator: 'wallet123',
        blockhash: 'hash123',
        closesAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      };

      await expect(service.buildInitializeTx(dto)).rejects.toThrow(
        InvalidExpirationException,
      );
    });

    it('should throw when closesAt is more than 30 days from now', async () => {
      const dto = {
        surveyId: '123',
        rewardPoolSol: 10,
        rewardType: 'weighted' as const,
        maxResponses: 100,
        creator: 'wallet123',
        blockhash: 'hash123',
        closesAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await expect(service.buildInitializeTx(dto)).rejects.toThrow(
        InvalidExpirationException,
      );
    });

    it('should throw when closesAt is an invalid date string', async () => {
      const dto = {
        surveyId: '123',
        rewardPoolSol: 10,
        rewardType: 'weighted' as const,
        maxResponses: 100,
        creator: 'wallet123',
        blockhash: 'hash123',
        closesAt: 'not-a-valid-date',
      };

      await expect(service.buildInitializeTx(dto)).rejects.toThrow(
        InvalidExpirationException,
      );
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
        description: '',
        grossRewardPoolLamports: 10_000_000_000,
        netRewardPoolLamports: 10_000_000_000,
        feeLamports: 0,
        feeBps: 0,
        feeWallet: '',
        minWalletAge: 0,
        minSolBalance: 0,
        surveyPda: 'pda123',
        escrowPda: 'escrow123',
        closedAt: null,
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
          rewardType: 'lucky_draw',
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

  describe('buildCloseEscrowTx', () => {
    it('should delegate to SurveyLifecycleService for the creator', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ creator: 'wallet123' }),
      });
      const lifecycle = module.get<SurveyLifecycleService>(
        SurveyLifecycleService,
      );
      const spy = jest
        .spyOn(lifecycle, 'buildCloseEscrowTx')
        .mockResolvedValue({ tx: 'escrow-close-tx' });

      const result = await service.buildCloseEscrowTx(
        'form123',
        'wallet123',
        'blockhash123',
      );

      expect(spy).toHaveBeenCalledWith('form123', 'wallet123', 'blockhash123');
      expect(result).toEqual({ tx: 'escrow-close-tx' });
    });

    it('should throw FormNotFoundException when form does not exist', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.buildCloseEscrowTx('nope', 'wallet123', 'blockhash123'),
      ).rejects.toThrow(FormNotFoundException);
    });

    it('should reject when called by non-creator', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ creator: 'wallet123' }),
      });

      await expect(
        service.buildCloseEscrowTx('form123', 'other123', 'blockhash123'),
      ).rejects.toThrow('Only the form creator can close the escrow.');
    });
  });

  describe('confirmCloseEscrow', () => {
    it('should delegate to SurveyLifecycleService for the creator', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ creator: 'wallet123' }),
      });
      const lifecycle = module.get<SurveyLifecycleService>(
        SurveyLifecycleService,
      );
      const spy = jest
        .spyOn(lifecycle, 'confirmCloseEscrow')
        .mockResolvedValue(undefined);

      await service.confirmCloseEscrow('form123', 'wallet123', 'txsig123');

      expect(spy).toHaveBeenCalledWith('form123', 'wallet123', 'txsig123');
    });

    it('should throw FormNotFoundException when form does not exist', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.confirmCloseEscrow('nope', 'wallet123', 'txsig123'),
      ).rejects.toThrow(FormNotFoundException);
    });

    it('should reject when called by non-creator', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ creator: 'wallet123' }),
      });

      await expect(
        service.confirmCloseEscrow('form123', 'other123', 'txsig123'),
      ).rejects.toThrow('Only the form creator can close the escrow.');
    });
  });

  describe('updateSurveySettings', () => {
    it('should update title and description for the creator', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const formDoc = {
        ...mockForm,
        title: 'Test Survey',
        description: '',
        save,
      };
      formModel.findById
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(formDoc),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue({
            ...mockForm,
            title: 'New Title',
            description: 'New Desc',
          }),
        });

      const result = await service.updateSurveySettings(
        'form123',
        'wallet123',
        { title: 'New Title', description: 'New Desc' },
      );

      expect(formDoc.title).toBe('New Title');
      expect(formDoc.description).toBe('New Desc');
      expect(save).toHaveBeenCalled();
      expect(result.title).toBe('New Title');
      expect(result.description).toBe('New Desc');
    });

    it('should never modify on-chain fields', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const formDoc = { ...mockForm, save };
      formModel.findById
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(formDoc),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockForm),
        });

      await service.updateSurveySettings('form123', 'wallet123', {
        description: 'Only desc changed',
      });

      expect(formDoc.rewardPool).toBe(mockForm.rewardPool);
      expect(formDoc.onChain).toEqual(mockForm.onChain);
      expect(formDoc.feeBps).toBe(mockForm.feeBps);
    });

    it('should throw FormNotFoundException when form does not exist', async () => {
      formModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateSurveySettings('nope', 'wallet123', {
          title: 'New Title',
        }),
      ).rejects.toThrow(FormNotFoundException);
    });

    it('should reject when called by non-creator', async () => {
      formModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockForm),
      });

      await expect(
        service.updateSurveySettings('form123', 'other123', {
          title: 'New Title',
        }),
      ).rejects.toThrow('Only the form creator can update survey settings.');
    });
  });

  describe('deleteSurveyData', () => {
    it('should delete responses, distribution records and the form', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...mockForm, status: 'closed' }),
      });
      formModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });
      distributionService.deleteByForm.mockResolvedValue(3);

      const result = await service.deleteSurveyData('form123', 'wallet123');

      expect(result).toEqual({
        responsesDeleted: 2,
        distributionRecordsDeleted: 3,
      });
      expect(formModel.deleteOne).toHaveBeenCalledWith({ _id: 'form123' });
      expect(distributionService.deleteByForm).toHaveBeenCalledWith('form123');
    });

    it('should throw SurveyStillActiveException when survey is still active', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockForm),
      });

      await expect(
        service.deleteSurveyData('form123', 'wallet123'),
      ).rejects.toThrow(SurveyStillActiveException);
    });

    it('should throw FormNotFoundException when form does not exist', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.deleteSurveyData('nope', 'wallet123'),
      ).rejects.toThrow(FormNotFoundException);
    });

    it('should reject when called by non-creator', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockForm),
      });

      await expect(
        service.deleteSurveyData('form123', 'other123'),
      ).rejects.toThrow('Only the form creator can delete survey data.');
    });

    it('should not make any Solana calls', async () => {
      formModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...mockForm, status: 'closed' }),
      });
      formModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      const solana = module.get<SolanaService>(SolanaService) as unknown as {
        verifyInitializeSurveyTx: jest.Mock;
        collectProtocolFee: jest.Mock;
      };

      await service.deleteSurveyData('form123', 'wallet123');

      expect(solana.verifyInitializeSurveyTx).not.toHaveBeenCalled();
      expect(solana.collectProtocolFee).not.toHaveBeenCalled();
    });
  });
});
