import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class InvalidNonceException extends OkaformException {
  constructor(wallet: string) {
    super(
      {
        code: 'INVALID_NONCE',
        detail: 'Invalid or already used nonce.',
        context: { wallet: wallet.slice(0, 8) + '...' },
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
