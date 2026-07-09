import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService, UserProfile } from './auth.service';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: {
            validateUser: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    const validPayload = {
      sub: 'user-id-123',
      wallet: '5FHwkrdxntdK24hgQU8qgBn3JYQ6gVbFqoXmRpCmHmU',
    };

    it('should return user profile when valid', async () => {
      const expectedProfile: UserProfile = {
        wallet: validPayload.wallet,
        username: 'testuser',
        globalScore: 500,
        surveysCompleted: 5,
        badgeTier: 'Silver',
      };

      authService.validateUser.mockResolvedValue(expectedProfile);

      const result = await strategy.validate(validPayload);

      expect(result).toEqual(expectedProfile);
      expect(authService.validateUser).toHaveBeenCalledWith(validPayload);
    });

    it('should throw UnauthorizedException when validateUser returns null', async () => {
      authService.validateUser.mockResolvedValue(
        null as unknown as UserProfile,
      );

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when validateUser throws', async () => {
      authService.validateUser.mockRejectedValue(new Error('DB error'));

      await expect(strategy.validate(validPayload)).rejects.toThrow('DB error');
    });
  });
});
