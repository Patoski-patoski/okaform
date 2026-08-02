import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthService } from './auth.service';
import { User, UserDocument } from '../common/schemas/user.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../common/schemas/refresh-token.schema';
import { NonceNotRequestedException } from '../common/exceptions/auth/nonce-not-requested.exception';
import { InvalidNonceException } from '../common/exceptions/auth/invalid-nonce.exception';
import { NonceExpiredException } from '../common/exceptions/auth/nonce-expired.exception';
import { InvalidRefreshTokenException } from '../common/exceptions/auth/invalid-refresh-token.exception';
import { RefreshTokenExpiredException } from '../common/exceptions/auth/refresh-token-expired.exception';
import { UserNotFoundException } from '../common/exceptions/auth/user-not-found.exception';
import { UnauthorizedException } from '@nestjs/common';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';

describe('AuthService', () => {
  let service: AuthService;
  let userModel: jest.Mocked<Model<UserDocument>>;
  let refreshTokenModel: jest.Mocked<Model<RefreshTokenDocument>>;
  let jwtService: jest.Mocked<JwtService>;

  const TEST_WALLET = 'ABC123DEF456GHI789JKL012MNO345PQR678STU901';

  const mockUser: Partial<UserDocument> = {
    _id: { toString: () => 'user123' } as any,
    id: 'user123',
    wallet: TEST_WALLET,
    username: 'testuser',
    globalScore: 75,
    surveysCompleted: 12,
    badgeTier: 'Oracle' as any,
    siwsNonce: null,
    siwsNonceExpiresAt: null,
    lastLoginAt: null,
    tokenVersion: 0,
    tokenFamily: 0,
    save: jest.fn() as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
          },
        },
        {
          provide: getModelToken(RefreshToken.name),
          useValue: {
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
            create: jest.fn(),
            updateMany: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userModel = module.get(getModelToken(User.name));
    refreshTokenModel = module.get(getModelToken(RefreshToken.name));
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateNonce', () => {
    it('should generate a nonce and SIWS message for a wallet', async () => {
      userModel.findOneAndUpdate.mockResolvedValue(mockUser);

      const result = await service.generateNonce(TEST_WALLET);

      expect(result.nonce).toBeDefined();
      expect(typeof result.nonce).toBe('string');
      expect(result.message).toContain(TEST_WALLET);
      expect(result.message).toContain('Sign in to Okaform');
      expect(result.message).toContain('Nonce:');
      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { wallet: TEST_WALLET },
        expect.objectContaining({
          $set: expect.objectContaining({ wallet: TEST_WALLET }),
        }),
        { upsert: true, new: true },
      );
    });

    it('should store nonce with expiration in DB', async () => {
      userModel.findOneAndUpdate.mockResolvedValue(mockUser);

      await service.generateNonce(TEST_WALLET);

      const updateCall = userModel.findOneAndUpdate.mock.calls[0];
      const updateData = updateCall[1] as { $set: Record<string, unknown> };
      expect(updateData.$set.siwsNonce).toBeDefined();
      expect(updateData.$set.siwsNonceExpiresAt).toBeInstanceOf(Date);
    });
  });

  describe('verifySignature', () => {
    it('should throw NonceNotRequestedException if user not found', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.verifySignature({
          wallet: TEST_WALLET,
          message: 'some message',
          signature: 'some sig',
        }),
      ).rejects.toThrow(NonceNotRequestedException);
    });

    it('should throw InvalidNonceException if message has no nonce', async () => {
      userModel.findOne.mockResolvedValue({
        ...mockUser,
        siwsNonce: 'valid-nonce',
        siwsNonceExpiresAt: new Date(Date.now() + 60000),
      } as UserDocument);

      await expect(
        service.verifySignature({
          wallet: TEST_WALLET,
          message: 'No nonce in this message',
          signature: 'some sig',
        }),
      ).rejects.toThrow(InvalidNonceException);
    });

    it('should throw InvalidNonceException if nonce does not match', async () => {
      userModel.findOne.mockResolvedValue({
        ...mockUser,
        siwsNonce: 'stored-nonce',
        siwsNonceExpiresAt: new Date(Date.now() + 60000),
      } as UserDocument);

      await expect(
        service.verifySignature({
          wallet: TEST_WALLET,
          message: 'Sign in\nNonce: different-nonce',
          signature: 'some sig',
        }),
      ).rejects.toThrow(InvalidNonceException);
    });

    it('should throw NonceExpiredException if nonce has expired', async () => {
      const expiredDate = new Date(Date.now() - 10000);
      userModel.findOne.mockResolvedValue({
        ...mockUser,
        siwsNonce: 'valid-nonce',
        siwsNonceExpiresAt: expiredDate,
      } as UserDocument);

      await expect(
        service.verifySignature({
          wallet: TEST_WALLET,
          message: 'Sign in\nNonce: valid-nonce',
          signature: 'some sig',
        }),
      ).rejects.toThrow(NonceExpiredException);
    });

    it('should throw InvalidSignatureException if message missing wallet', async () => {
      userModel.findOne.mockResolvedValue({
        ...mockUser,
        siwsNonce: 'valid-nonce',
        siwsNonceExpiresAt: new Date(Date.now() + 60000),
      } as UserDocument);

      await expect(
        service.verifySignature({
          wallet: TEST_WALLET,
          message: 'Sign in\nNonce: valid-nonce\nNo wallet here',
          signature: 'some sig',
        }),
      ).rejects.toThrow();
    });
  });

  describe('refreshTokens', () => {
    it('should throw InvalidRefreshTokenException if token not found', async () => {
      refreshTokenModel.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });

    it('should throw RefreshTokenExpiredException if token expired', async () => {
      refreshTokenModel.findOne.mockResolvedValue({
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 10000),
        userId: 'user123',
        revokedAt: null,
      } as any);

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        RefreshTokenExpiredException,
      );
    });

    it('should revoke old token and issue new tokens', async () => {
      const mockStoredToken = {
        token: 'old-token',
        expiresAt: new Date(Date.now() + 60000),
        userId: 'user123',
        tokenFamily: 0,
        revokedAt: null,
        save: jest.fn(),
      };

      refreshTokenModel.findOne.mockResolvedValue(mockStoredToken as any);
      userModel.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('new-access-token');
      refreshTokenModel.create.mockResolvedValue({} as any);

      const result = await service.refreshTokens('old-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(mockStoredToken.revokedAt).toBeInstanceOf(Date);
      expect(mockStoredToken.save).toHaveBeenCalled();
    });

    it('should detect family mismatch and revoke all tokens', async () => {
      const mockStoredToken = {
        token: 'stolen-token',
        expiresAt: new Date(Date.now() + 60000),
        userId: 'user123',
        tokenFamily: 0,
        revokedAt: null,
        save: jest.fn(),
      };

      const userWithMismatch = {
        ...mockUser,
        tokenFamily: 1,
        save: jest.fn(),
      };

      refreshTokenModel.findOne.mockResolvedValue(mockStoredToken as any);
      userModel.findById.mockResolvedValue(userWithMismatch);
      jwtService.sign.mockReturnValue('new-access-token');
      refreshTokenModel.create.mockResolvedValue({} as any);
      refreshTokenModel.updateMany.mockResolvedValue({} as any);

      const result = await service.refreshTokens('stolen-token');

      expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
        { userId: userWithMismatch._id, revokedAt: null },
        { revokedAt: expect.any(Date) },
      );
      expect(userWithMismatch.tokenVersion).toBe(1);
      expect(userWithMismatch.tokenFamily).toBe(2);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UserNotFoundException if user not found after token revoke', async () => {
      const mockStoredToken = {
        token: 'old-token',
        expiresAt: new Date(Date.now() + 60000),
        userId: 'nonexistent-user',
        tokenFamily: 0,
        revokedAt: null,
        save: jest.fn(),
      };

      refreshTokenModel.findOne.mockResolvedValue(mockStoredToken as any);
      userModel.findById.mockResolvedValue(null);

      await expect(service.refreshTokens('old-token')).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });

  describe('issueTokens', () => {
    it('should include tv in JWT payload', async () => {
      userModel.findOneAndUpdate.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('access-token');
      refreshTokenModel.create.mockResolvedValue({} as any);

      const tokens = await (service as any).issueTokens(mockUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tv: 0 }),
        expect.any(Object),
      );
      expect(tokens.accessToken).toBe('access-token');
    });

    it('should stamp refresh token with tokenFamily', async () => {
      userModel.findOneAndUpdate.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('access-token');
      refreshTokenModel.create.mockResolvedValue({} as any);

      await (service as any).issueTokens(mockUser);

      expect(refreshTokenModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ tokenFamily: 0 }),
      );
    });
  });

  describe('validateUser', () => {
    it('should return user profile for valid payload', async () => {
      userModel.findById.mockResolvedValue(mockUser);

      const result = await service.validateUser({
        sub: 'user123',
        wallet: TEST_WALLET,
        tv: 0,
      });

      expect(result.wallet).toBe(TEST_WALLET);
      expect(result.username).toBe('testuser');
      expect(result.badgeTier).toBe('Oracle');
      expect(result.id).toBe('user123');
    });

    it('should throw UserNotFoundException if user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        service.validateUser({
          sub: 'nonexistent',
          wallet: TEST_WALLET,
          tv: 0,
        }),
      ).rejects.toThrow(UserNotFoundException);
    });

    it('should throw UnauthorizedException if token version mismatches', async () => {
      userModel.findById.mockResolvedValue({
        ...mockUser,
        tokenVersion: 2,
      });

      await expect(
        service.validateUser({ sub: 'user123', wallet: TEST_WALLET, tv: 0 }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUserByWallet', () => {
    it('should return user profile for valid wallet', async () => {
      userModel.findOne.mockResolvedValue(mockUser as UserDocument);

      const result = await service.getUserByWallet(TEST_WALLET);

      expect(result).not.toBeNull();
      expect(result!.wallet).toBe(TEST_WALLET);
      expect(result!.username).toBe('testuser');
    });

    it('should return null for unknown wallet', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await service.getUserByWallet('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should revoke refresh token and increment tokenVersion', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue({
        userId: 'user123',
      });
      userModel.findById.mockResolvedValue(mockUser);

      await service.logout('some-token');

      expect(refreshTokenModel.findOneAndUpdate).toHaveBeenCalledWith(
        { token: 'some-token' },
        { revokedAt: expect.any(Date) },
      );
      expect(userModel.findById).toHaveBeenCalledWith('user123');
      expect(mockUser.tokenVersion).toBe(1);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('should revoke all refresh tokens and increment tokenVersion and tokenFamily', async () => {
      refreshTokenModel.updateMany.mockResolvedValue({} as any);
      userModel.findByIdAndUpdate.mockResolvedValue({});

      await service.logoutAll('user123');

      expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user123', revokedAt: null },
        { revokedAt: expect.any(Date) },
      );
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
        $inc: { tokenVersion: 1, tokenFamily: 1 },
      });
    });
  });
});
