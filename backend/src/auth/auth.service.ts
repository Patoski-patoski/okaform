import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import * as crypto from 'crypto';
import { User, UserDocument } from '../common/schemas/user.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../common/schemas/refresh-token.schema';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { NonceNotRequestedException } from '../common/exceptions/auth/nonce-not-requested.exception';
import { InvalidNonceException } from '../common/exceptions/auth/invalid-nonce.exception';
import { NonceExpiredException } from '../common/exceptions/auth/nonce-expired.exception';
import { InvalidSignatureException } from '../common/exceptions/wallet/invalid-signature.exception';
import { InvalidRefreshTokenException } from '../common/exceptions/auth/invalid-refresh-token.exception';
import { RefreshTokenExpiredException } from '../common/exceptions/auth/refresh-token-expired.exception';
import { UserNotFoundException } from '../common/exceptions/auth/user-not-found.exception';

const DOMAIN = 'okaform.com';
const APP_NAME = 'Okaform';
const NONCE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
const REFRESH_TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SiwsNonceResponse {
  nonce: string;
  message: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  wallet: string;
  username: string | null;
  globalScore: number;
  surveysCompleted: number;
  badgeTier: string;
}

interface JwtPayload {
  sub: string;
  wallet: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    private jwtService: JwtService,
  ) {}

  async generateNonce(wallet: string): Promise<SiwsNonceResponse> {
    const nonce = crypto.randomBytes(32).toString('base64');
    const issuedAt = new Date().toISOString();

    const message = this.buildSiwsMessage(wallet, nonce, issuedAt);

    await this.userModel.findOneAndUpdate(
      { wallet },
      {
        wallet,
        siwsNonce: nonce,
        siwsNonceExpiresAt: new Date(Date.now() + NONCE_EXPIRATION_MS),
      },
      { upsert: true, new: true },
    );

    this.logger.debug({
      event: 'NONCE_GENERATED',
      wallet: wallet.slice(0, 8) + '...',
    });

    return { nonce, message };
  }

  async verifySignature(dto: VerifySignatureDto): Promise<AuthTokensResponse> {
    const { wallet, message, signature } = dto;

    const user = await this.userModel.findOne({ wallet });
    if (!user) {
      throw new NonceNotRequestedException(wallet);
    }

    const nonceMatch = message.match(/Nonce: (.+)/);
    if (!nonceMatch) {
      throw new InvalidNonceException(wallet);
    }
    const messageNonce = nonceMatch[1];

    if (user.siwsNonce !== messageNonce) {
      throw new InvalidNonceException(wallet);
    }

    if (
      user.siwsNonceExpiresAt &&
      user.siwsNonceExpiresAt.getTime() < Date.now()
    ) {
      throw new NonceExpiredException(wallet);
    }

    if (!message.includes(wallet)) {
      throw new InvalidSignatureException(wallet);
    }

    try {
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const publicKey = new PublicKey(wallet);

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes(),
      );

      if (!isValid) {
        throw new InvalidSignatureException(wallet);
      }
    } catch (error) {
      if (error instanceof InvalidSignatureException) throw error;
      throw new InvalidSignatureException(wallet);
    }

    user.siwsNonce = undefined;
    user.siwsNonceExpiresAt = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    this.logger.log({
      event: 'USER_AUTHENTICATED',
      wallet: wallet.slice(0, 8) + '...',
    });

    const tokens = await this.issueTokens(user);

    return {
      ...tokens,
      user: this.toUserProfile(user),
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPairResponse> {
    const storedToken = await this.refreshTokenModel.findOne({
      token: refreshToken,
      revokedAt: null,
    });

    if (!storedToken || !storedToken.expiresAt) {
      throw new InvalidRefreshTokenException();
    }

    if (storedToken.expiresAt.getTime() < Date.now()) {
      throw new RefreshTokenExpiredException();
    }

    storedToken.revokedAt = new Date();
    await storedToken.save();

    const user = await this.userModel.findById(storedToken.userId);
    if (!user) {
      throw new UserNotFoundException('unknown');
    }

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenModel.findOneAndUpdate(
      { token: refreshToken },
      { revokedAt: new Date() },
    );

    this.logger.debug({ event: 'USER_LOGGED_OUT' });
  }

  async validateUser(payload: JwtPayload): Promise<UserProfile> {
    const user = await this.userModel.findById(payload.sub);
    if (!user) throw new UserNotFoundException(payload.wallet);

    return this.toUserProfile(user);
  }

  async getUserByWallet(wallet: string): Promise<UserProfile | null> {
    const user = await this.userModel.findOne({ wallet });
    if (!user) return null;
    return this.toUserProfile(user);
  }

  private async issueTokens(user: UserDocument): Promise<TokenPairResponse> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      wallet: user.wallet,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: (process.env.JWT_EXPIRATION || '15m') as never,
    });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    await this.refreshTokenModel.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_MS),
    });

    return { accessToken, refreshToken };
  }

  private toUserProfile(user: UserDocument): UserProfile {
    return {
      wallet: user.wallet,
      username: user.username,
      globalScore: user.globalScore,
      surveysCompleted: user.surveysCompleted,
      badgeTier: user.badgeTier,
    };
  }

  private buildSiwsMessage(
    wallet: string,
    nonce: string,
    issuedAt: string,
  ): string {
    return `${DOMAIN} wants you to sign in with your Solana account:
${wallet}

Sign in to ${APP_NAME}

URI: https://${DOMAIN}
Version: 1
Chain ID: solana:mainnet-beta
Nonce: ${nonce}
Issued At: ${issuedAt}`;
  }
}
