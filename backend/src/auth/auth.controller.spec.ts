import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';

function mockResponse() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
}

function mockRequest(cookies: Record<string, string | undefined> = {}) {
  return { cookies } as unknown as Request;
}

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
    it('should call verifySignature with dto and set cookie', async () => {
      authService.verifySignature.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        user: {
          wallet: 'W',
          username: 'u',
          globalScore: 0,
          surveysCompleted: 0,
          badgeTier: 'Ghost',
        },
      });

      const res = mockResponse();
      const result = await controller.verify(
        { wallet: 'W', message: 'm', signature: 's' },
        res,
      );

      expect(authService.verifySignature).toHaveBeenCalledWith({
        wallet: 'W',
        message: 'm',
        signature: 's',
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh',
        expect.any(Object),
      );
      expect(result.accessToken).toBe('token');
    });
  });

  describe('refresh', () => {
    it('should call refreshTokens with token from cookie', async () => {
      authService.refreshTokens.mockResolvedValue({
        accessToken: 'new',
        refreshToken: 'newrefresh',
      });

      const req = mockRequest({ refreshToken: 'old' });
      const res = mockResponse();
      const result = await controller.refresh(req, res);

      expect(authService.refreshTokens).toHaveBeenCalledWith('old');
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'newrefresh',
        expect.any(Object),
      );
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
        badgeTier: 'Oracle',
      };

      const result = controller.getMe(mockUser);

      expect(result).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should call logout with token from cookie and clear it', async () => {
      authService.logout.mockResolvedValue(undefined);

      const req = mockRequest({ refreshToken: 'token' });
      const res = mockResponse();
      const result = await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith('token');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/auth',
      });
      expect(result.message).toBe('Logged out successfully');
    });
  });
});
