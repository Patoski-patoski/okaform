import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import type { AuthTokensResponse } from './auth.service';
import { AuthService } from './auth.service';
import type { UserProfile } from '../common/decorators/current-user.decorator';
import { GetNonceSchema } from './dto/get-nonce.dto';
import type { GetNonceDto } from './dto/get-nonce.dto';
import { VerifySignatureSchema } from './dto/verify-signature.dto';
import type { VerifySignatureDto } from './dto/verify-signature.dto';
import { TypeBoxValidationPipe } from '../common/pipes/typebox-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === 'production',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async getNonce(
    @Body(new TypeBoxValidationPipe(GetNonceSchema)) dto: GetNonceDto,
  ): Promise<{ nonce: string; message: string }> {
    return await this.authService.generateNonce(dto.wallet);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async verify(
    @Body(new TypeBoxValidationPipe(VerifySignatureSchema))
    dto: VerifySignatureDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: UserProfile }> {
    const result: AuthTokensResponse =
      await this.authService.verifySignature(dto);
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: UserProfile): UserProfile {
    return user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;

    const token = cookies?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token not found');
    }
    const result = await this.authService.refreshTokens(token);
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;

    const token = cookies?.refreshToken;
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie('refreshToken', { path: '/auth' });
    return { message: 'Logged out successfully' };
  }
}
