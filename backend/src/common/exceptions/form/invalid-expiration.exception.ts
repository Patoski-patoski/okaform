import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class InvalidExpirationException extends OkaformException {
  constructor(message: string) {
    super(
      {
        code: 'INVALID_EXPIRATION',
        detail: message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
