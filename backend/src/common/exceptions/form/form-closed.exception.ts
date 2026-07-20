import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class FormClosedException extends OkaformException {
  constructor(formId: string) {
    super(
      {
        code: 'FORM_CLOSED',
        detail: 'This survey is no longer accepting responses.',
        context: { formId },
      },
      HttpStatus.CONFLICT,
    );
  }
}
