import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class RefreshTokenExpiredException extends OkaformException {
  constructor() {
    super(
      {
        code: 'REFRESH_TOKEN_EXPIRED',
        detail: 'Refresh token has expired. Please sign in again.',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
