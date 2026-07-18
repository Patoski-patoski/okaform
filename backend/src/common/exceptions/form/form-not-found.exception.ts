import { HttpStatus } from '@nestjs/common';
import { OkaformException } from '../base.exception';

export class FormNotFoundException extends OkaformException {
  constructor(formId: string) {
    super(
      {
        code: 'FORM_NOT_FOUND',
        detail: 'The requested survey form does not exist.',
        context: { formId },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
