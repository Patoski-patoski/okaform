import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generateNonce: jest.fn(),
            verifySignature: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNonce', () => {
    it('should call generateNonce with wallet', async () => {
      authService.generateNonce.mockResolvedValue({
        nonce: 'abc',
        message: 'Sign in',
      });

      const result = await controller.getNonce({ wallet: 'WALLET123' });

      expect(authService.generateNonce).toHaveBeenCalledWith('WALLET123');
      expect(result.nonce).toBe('abc');
    });
  });

  describe('verify', () => {
    it('should call verifySignature with dto', async () => {
      authService.verifySignature.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        user: {
          wallet: 'W',
          username: 'u',
          globalScore: 0,
          surveysCompleted: 0,
          badgeTier: 'Grey',
        },
      });

      const result = await controller.verify({
        wallet: 'W',
        message: 'm',
        signature: 's',
      });

      expect(authService.verifySignature).toHaveBeenCalledWith({
        wallet: 'W',
        message: 'm',
        signature: 's',
      });
      expect(result.accessToken).toBe('token');
    });
  });

  describe('refresh', () => {
    it('should call refreshTokens with refreshToken string', async () => {
      authService.refreshTokens.mockResolvedValue({
        accessToken: 'new',
        refreshToken: 'newrefresh',
      });

      const result = await controller.refresh('old');

      expect(authService.refreshTokens).toHaveBeenCalledWith('old');
      expect(result.accessToken).toBe('new');
    });
  });

  describe('getMe', () => {
    it('should return the user profile from JWT guard', () => {
      const mockUser = {
        wallet: 'WALLET123',
        username: 'testuser',
        globalScore: 75,
        surveysCompleted: 12,
        badgeTier: 'Gold',
      };

      const result = controller.getMe(mockUser);

      expect(result).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should call logout with refreshToken string', async () => {
      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout('token');

      expect(authService.logout).toHaveBeenCalledWith('token');
      expect(result.message).toBe('Logged out successfully');
    });
  });
});
