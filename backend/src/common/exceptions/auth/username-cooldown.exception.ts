import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class UsernameCooldownException extends OkaformException {
  constructor(daysLeft: number) {
    super(
      {
        code: 'USERNAME_COOLDOWN',
        detail: `Username can be changed in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        context: { daysLeft },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
