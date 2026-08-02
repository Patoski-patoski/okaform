import { Test, TestingModule } from '@nestjs/testing';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { DistributionService } from '../distribution/distribution.service';
import { FeeService } from './fee.service';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

describe('FormsController', () => {
  let controller: FormsController;
  let feeService: jest.Mocked<FeeService>;

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
});
