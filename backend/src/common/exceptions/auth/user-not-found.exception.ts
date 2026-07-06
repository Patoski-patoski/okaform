import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class UserNotFoundException extends OkaformException {
  constructor(wallet: string) {
    super(
      {
        code: 'USER_NOT_FOUND',
        detail: 'User not found.',
        context: { wallet: wallet.slice(0, 8) + '...' },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
