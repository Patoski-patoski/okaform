import { Test, TestingModule } from '@nestjs/testing';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { DistributionService } from '../distribution/distribution.service';
import { FeeService } from './fee.service';
import type { UserProfile } from '../common/decorators/current-user.decorator';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

describe('FormsController', () => {
  let controller: FormsController;
  let feeService: jest.Mocked<FeeService>;
  let formsService: jest.Mocked<FormsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormsController],
      providers: [
        {
          provide: FormsService,
          useValue: {
            buildInitializeTx: jest.fn(),
            createForm: jest.fn(),
            buildCloseTx: jest.fn(),
            confirmClose: jest.fn(),
            buildDistributeTx: jest.fn(),
            confirmDistribute: jest.fn(),
            buildCloseEscrowTx: jest.fn(),
            confirmCloseEscrow: jest.fn(),
            getFormsByCreator: jest.fn(),
            getExploreForms: jest.fn(),
            getFormById: jest.fn(),
            getAnalyticsForCreator: jest.fn(),
          },
        },
        {
          provide: DistributionService,
          useValue: {
            getDistributionByForm: jest.fn(),
          },
        },
        {
          provide: FeeService,
          useValue: {
            getFeeBps: jest.fn(),
            getFeeWallet: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FormsController>(FormsController);
    feeService = module.get(FeeService);
    formsService = module.get(FormsService);
  });

  describe('getFormConfig', () => {
    it('should expose the configured protocol fee bps and wallet', () => {
      feeService.getFeeBps.mockReturnValue(500);
      feeService.getFeeWallet.mockReturnValue(
        'FeeWallet111111111111111111111111111111111111',
      );

      const result = controller.getFormConfig();

      expect(result).toEqual({
        protocolFeeBps: 500,
        protocolFeeWallet: 'FeeWallet111111111111111111111111111111111111',
      });
    });

    it('should default to zero bps when no fee is configured', () => {
      feeService.getFeeBps.mockReturnValue(0);

      const result = controller.getFormConfig();

      expect(result.protocolFeeBps).toBe(0);
    });
  });

  describe('getAnalytics', () => {
    it('should delegate to FormsService with the creator wallet', async () => {
      const aggregate = {
        forms: [
          {
            id: 'form123',
            title: 'Test Survey',
            status: 'active',
            maxResponses: 100,
            rewardPool: 10,
            responses: [],
            distributions: [],
          },
        ],
      };
      formsService.getAnalyticsForCreator.mockResolvedValue(aggregate);

      const result = await controller.getAnalytics({
        wallet: 'wallet123',
      } as UserProfile);

      expect(formsService.getAnalyticsForCreator).toHaveBeenCalledWith(
        'wallet123',
      );
      expect(result).toEqual(aggregate);
    });
  });
});
