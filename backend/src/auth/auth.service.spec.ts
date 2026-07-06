import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthService } from './auth.service';
import { User, UserDocument, BadgeTier } from '../common/schemas/user.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../common/schemas/refresh-token.schema';
import { NonceNotRequestedException } from '../common/exceptions/auth/nonce-not-requested.exception';
import { InvalidNonceException } from '../common/exceptions/auth/invalid-nonce.exception';
import { NonceExpiredException } from '../common/exceptions/auth/nonce-expired.exception';
import { InvalidSignatureException } from '../common/exceptions/wallet/invalid-signature.exception';
import { InvalidRefreshTokenException } from '../common/exceptions/auth/invalid-refresh-token.exception';
import { RefreshTokenExpiredException } from '../common/exceptions/auth/refresh-token-expired.exception';
import { UserNotFoundException } from '../common/exceptions/auth/user-not-found.exception';
import type { VerifySignatureDto } from './dto/verify-signature.dto';

jest.mock('tweetnacl', () => ({
  sign: {
    detached: {
      verify: jest.fn(),
    },
  },
}));

jest.mock('bs58', () => ({
  decode: jest.fn().mockReturnValue(new Uint8Array(64).fill(1)),
}));

jest.mock('@solana/web3.js', () => ({
  PublicKey: jest.fn().mockImplementation(() => ({
    toBytes: () => new Uint8Array(32).fill(1),
  })),
}));

const mockNaclVerify = jest.requireMock('tweetnacl').sign.detached.verify;

const TEST_WALLET = '5FHwkrdxntdK24hgQU8qgBn3JYQ6gVbFqoXmRpCmHmU';
const TEST_NONCE = 'test-nonce-abc';

const buildMessage = (wallet: string, nonce: string): string =>
  `okaform.com wants you to sign in with your Solana account:\n${wallet}\n\nSign in to Okaform\n\nURI: https://okaform.com\nVersion: 1\nChain ID: solana:mainnet-beta\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

const mockSave = jest.fn();

const createMockUser = (overrides?: Partial<UserDocument>): UserDocument =>
  ({
    _id: { toString: () => 'user-id-123' },
    wallet: TEST_WALLET,
    username: null,
    globalScore: 0,
    surveysCompleted: 0,
    badgeTier: BadgeTier.GREY,
    lastLoginAt: null,
    siwsNonce: TEST_NONCE,
    siwsNonceExpiresAt: new Date(Date.now() + 300_000),
    save: mockSave,
    ...overrides,
  }) as unknown as UserDocument;

const createMockRefreshToken = (
  overrides?: Partial<RefreshTokenDocument>,
): RefreshTokenDocument =>
  ({
    _id: { toString: () => 'token-id-123' },
    userId: { toString: () => 'user-id-123' },
    token: 'mock-refresh-token-hex',
    expiresAt: new Date(Date.now() + 604_800_000),
    revokedAt: null,
    save: mockSave,
    ...overrides,
  }) as unknown as RefreshTokenDocument;

describe('AuthService', () => {
  let service: AuthService;
  let userModel: jest.Mocked<Model<UserDocument>>;
  let refreshTokenModel: jest.Mocked<Model<RefreshTokenDocument>>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOneAndUpdate: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: getModelToken(RefreshToken.name),
          useValue: {
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
            create: jest.fn(),
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

  describe('generateNonce', () => {
    it('should create a nonce and return SIWS message', async () => {
      const mockUser = createMockUser();
      userModel.findOneAndUpdate.mockResolvedValue(mockUser);

      const result = await service.generateNonce(TEST_WALLET);

      expect(result).toHaveProperty('nonce');
      expect(typeof result.nonce).toBe('string');
      expect(result.nonce.length).toBeGreaterThan(0);
      expect(result.message).toContain(TEST_WALLET);
      expect(result.message).toContain('okaform.com');
      expect(result.message).toContain('Okaform');
    });

    it('should store nonce on user with expiration', async () => {
      const mockUser = createMockUser();
      userModel.findOneAndUpdate.mockResolvedValue(mockUser);

      await service.generateNonce(TEST_WALLET);

      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { wallet: TEST_WALLET },
        expect.objectContaining({
          wallet: TEST_WALLET,
          siwsNonce: expect.any(String),
          siwsNonceExpiresAt: expect.any(Date),
        }),
        { upsert: true, new: true },
      );
    });

    it('should generate unique nonces for each call', async () => {
      const mockUser = createMockUser();
      userModel.findOneAndUpdate.mockResolvedValue(mockUser);

      const result1 = await service.generateNonce(TEST_WALLET);
      const result2 = await service.generateNonce(TEST_WALLET);

      expect(result1.nonce).not.toBe(result2.nonce);
    });
  });

  describe('verifySignature', () => {
    const dto: VerifySignatureDto = {
      wallet: TEST_WALLET,
      message: buildMessage(TEST_WALLET, TEST_NONCE),
      signature: '5J8ExampleBase58Signature',
    };

    it('should throw NonceNotRequestedException when user not found', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(service.verifySignature(dto)).rejects.toThrow(
        NonceNotRequestedException,
      );
    });

    it('should throw InvalidNonceException when nonce not in message', async () => {
      const mockUser = createMockUser();
      userModel.findOne.mockResolvedValue(mockUser);

      const badDto = { ...dto, message: 'some message without nonce field' };

      await expect(service.verifySignature(badDto)).rejects.toThrow(
        InvalidNonceException,
      );
    });

    it('should throw InvalidNonceException when nonce mismatch', async () => {
      const mockUser = createMockUser({ siwsNonce: 'correct-nonce' });
      userModel.findOne.mockResolvedValue(mockUser);

      const badDto = {
        ...dto,
        message: buildMessage(TEST_WALLET, 'wrong-nonce'),
      };

      await expect(service.verifySignature(badDto)).rejects.toThrow(
        InvalidNonceException,
      );
    });

    it('should throw NonceExpiredException when nonce expired', async () => {
      const mockUser = createMockUser({
        siwsNonce: TEST_NONCE,
        siwsNonceExpiresAt: new Date(Date.now() - 1000),
      });
      userModel.findOne.mockResolvedValue(mockUser);

      await expect(service.verifySignature(dto)).rejects.toThrow(
        NonceExpiredException,
      );
    });

    it('should throw InvalidSignatureException when wallet not in message', async () => {
      const mockUser = createMockUser();
      userModel.findOne.mockResolvedValue(mockUser);

      const badDto = {
        ...dto,
        message: buildMessage(
          'WRONGWALLET1111111111111111111111111111111',
          TEST_NONCE,
        ),
      };

      await expect(service.verifySignature(badDto)).rejects.toThrow(
        InvalidSignatureException,
      );
    });

    it('should throw InvalidSignatureException when nacl verify fails', async () => {
      mockNaclVerify.mockReturnValue(false);

      const mockUser = createMockUser();
      userModel.findOne.mockResolvedValue(mockUser);

      await expect(service.verifySignature(dto)).rejects.toThrow(
        InvalidSignatureException,
      );
    });

    it('should throw InvalidSignatureException when nacl throws', async () => {
      mockNaclVerify.mockImplementation(() => {
        throw new Error('invalid signature bytes');
      });

      const mockUser = createMockUser();
      userModel.findOne.mockResolvedValue(mockUser);

      await expect(service.verifySignature(dto)).rejects.toThrow(
        InvalidSignatureException,
      );
    });

    it('should clear nonce and update lastLoginAt on success', async () => {
      mockNaclVerify.mockReturnValue(true);

      const mockUser = createMockUser();
      userModel.findOne.mockResolvedValue(mockUser);

      jwtService.sign.mockReturnValue('jwt-access-token');
      refreshTokenModel.create.mockResolvedValue(undefined as never);

      await service.verifySignature(dto);

      expect(mockUser.siwsNonce).toBeUndefined();
      expect(mockUser.siwsNonceExpiresAt).toBeUndefined();
      expect(mockUser.lastLoginAt).toBeInstanceOf(Date);
      expect(mockSave).toHaveBeenCalled();
    });

    it('should return tokens and user profile on success', async () => {
      mockNaclVerify.mockReturnValue(true);

      const mockUser = createMockUser();
      userModel.findOne.mockResolvedValue(mockUser);

      jwtService.sign.mockReturnValue('jwt-access-token');
      refreshTokenModel.create.mockResolvedValue(undefined as never);

      const result = await service.verifySignature(dto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.user.wallet).toBe(TEST_WALLET);
      expect(result.user.badgeTier).toBe(BadgeTier.GREY);
    });

    it('should issue access and refresh tokens', async () => {
      mockNaclVerify.mockReturnValue(true);

      const mockUser = createMockUser();
      userModel.findOne.mockResolvedValue(mockUser);

      jwtService.sign.mockReturnValue('jwt-access-token');
      refreshTokenModel.create.mockResolvedValue(undefined as never);

      await service.verifySignature(dto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-id-123', wallet: TEST_WALLET },
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
      expect(refreshTokenModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.anything(),
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe('refreshTokens', () => {
    it('should throw InvalidRefreshTokenException when token not found', async () => {
      refreshTokenModel.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });

    it('should throw InvalidRefreshTokenException when token is revoked', async () => {
      refreshTokenModel.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });

    it('should throw RefreshTokenExpiredException when token expired', async () => {
      const expiredToken = createMockRefreshToken({
        expiresAt: new Date(Date.now() - 1000),
      });
      refreshTokenModel.findOne.mockResolvedValue(expiredToken);

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        RefreshTokenExpiredException,
      );
    });

    it('should throw UserNotFoundException when user not found', async () => {
      const validToken = createMockRefreshToken();
      refreshTokenModel.findOne.mockResolvedValue(validToken);
      userModel.findById.mockResolvedValue(null);

      await expect(service.refreshTokens('valid-token')).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('should revoke old token and issue new pair on success', async () => {
      const validToken = createMockRefreshToken();
      refreshTokenModel.findOne.mockResolvedValue(validToken);

      const mockUser = createMockUser();
      userModel.findById.mockResolvedValue(mockUser);

      jwtService.sign.mockReturnValue('new-jwt-token');
      refreshTokenModel.create.mockResolvedValue(undefined as never);

      const result = await service.refreshTokens('valid-token');

      expect(validToken.revokedAt).toBeInstanceOf(Date);
      expect(mockSave).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken', 'new-jwt-token');
      expect(result).toHaveProperty('refreshToken');
      expect(typeof result.refreshToken).toBe('string');
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(undefined);

      await service.logout('some-refresh-token');

      expect(refreshTokenModel.findOneAndUpdate).toHaveBeenCalledWith(
        { token: 'some-refresh-token' },
        { revokedAt: expect.any(Date) },
      );
    });

    it('should handle revoking non-existent token gracefully', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.logout('nonexistent-token'),
      ).resolves.toBeUndefined();
    });
  });

  describe('validateUser', () => {
    it('should return user profile when found', async () => {
      const mockUser = createMockUser();
      userModel.findById.mockResolvedValue(mockUser);

      const result = await service.validateUser({
        sub: 'user-id-123',
        wallet: TEST_WALLET,
      });

      expect(result).toEqual({
        wallet: TEST_WALLET,
        username: null,
        globalScore: 0,
        surveysCompleted: 0,
        badgeTier: BadgeTier.GREY,
      });
    });

    it('should throw UserNotFoundException when user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        service.validateUser({ sub: 'nonexistent-id', wallet: TEST_WALLET }),
      ).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('getUserByWallet', () => {
    it('should return user profile when wallet exists', async () => {
      const mockUser = createMockUser();
      userModel.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserByWallet(TEST_WALLET);

      expect(result).toEqual({
        wallet: TEST_WALLET,
        username: null,
        globalScore: 0,
        surveysCompleted: 0,
        badgeTier: BadgeTier.GREY,
      });
    });

    it('should return null when wallet not found', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await service.getUserByWallet('unknown-wallet');

      expect(result).toBeNull();
    });

    it('should include user stats in profile', async () => {
      const mockUser = createMockUser({
        globalScore: 1500,
        surveysCompleted: 12,
        badgeTier: BadgeTier.GOLD,
        username: 'testuser',
      });
      userModel.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserByWallet(TEST_WALLET);

      expect(result).toEqual({
        wallet: TEST_WALLET,
        username: 'testuser',
        globalScore: 1500,
        surveysCompleted: 12,
        badgeTier: BadgeTier.GOLD,
      });
    });
  });
});
