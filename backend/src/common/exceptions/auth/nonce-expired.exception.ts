import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class NonceExpiredException extends OkaformException {
  constructor(wallet: string) {
    super(
      {
        code: 'NONCE_EXPIRED',
        detail: 'Nonce has expired. Request a new one.',
        context: { wallet: wallet.slice(0, 8) + '...' },
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
