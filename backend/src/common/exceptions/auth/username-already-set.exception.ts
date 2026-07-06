import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class UsernameAlreadySetException extends OkaformException {
  constructor(wallet: string) {
    super(
      {
        code: 'USERNAME_ALREADY_SET',
        detail: 'Username has already been set and cannot be changed.',
        context: { wallet: wallet.slice(0, 8) + '...' },
      },
      HttpStatus.CONFLICT,
    );
  }
}
