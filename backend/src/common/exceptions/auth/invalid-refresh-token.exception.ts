import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class InvalidRefreshTokenException extends OkaformException {
  constructor() {
    super(
      {
        code: 'INVALID_REFRESH_TOKEN',
        detail: 'Refresh token is invalid or has been revoked.',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
