import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';

enum BadgeTier {
  GREY = 'Grey',
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum',
}

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getProfileByWallet: jest.fn(),
            setUsername: jest.fn(),
            getSurveyHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile for wallet param', async () => {
      usersService.getProfileByWallet.mockResolvedValue({
        wallet: 'WALLET123',
        username: 'testuser',
        globalScore: 75,
        surveysCompleted: 12,
        badgeTier: BadgeTier.GOLD,
        createdAt: new Date(),
      });

      const result = await controller.getProfile('WALLET123');

      expect(usersService.getProfileByWallet).toHaveBeenCalledWith('WALLET123');
      expect(result.wallet).toBe('WALLET123');
    });
  });

  describe('setUsername', () => {
    it('should call setUsername with user.wallet and dto.username', async () => {
      const mockUser = {
        wallet: 'WALLET123',
        username: 'newname',
        globalScore: 75,
        surveysCompleted: 12,
        badgeTier: BadgeTier.GOLD,
        createdAt: new Date(),
      };
      usersService.setUsername.mockResolvedValue(mockUser);

      const result = await controller.setUsername(
        { sub: 'user123', wallet: 'WALLET123' } as any,
        { username: 'newname' },
      );

      expect(usersService.setUsername).toHaveBeenCalledWith(
        'WALLET123',
        'newname',
      );
      expect(result.username).toBe('newname');
    });
  });

  describe('getHistory', () => {
    it('should call getSurveyHistory with wallet', async () => {
      usersService.getSurveyHistory.mockResolvedValue([
        {
          formId: 'form1',
          formTitle: 'Survey 1',
          submittedAt: new Date(),
          scoreAtSubmission: 85,
        },
      ]);

      const result = await controller.getHistory('WALLET123');

      expect(usersService.getSurveyHistory).toHaveBeenCalledWith('WALLET123');
      expect(result).toHaveLength(1);
    });
  });
});
