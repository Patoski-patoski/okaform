import { PipeTransform, BadRequestException } from '@nestjs/common';
import { TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

/**
 * Coerce string values that should be numbers.
 * Express query params are always strings — this converts them before validation.
 */
function coerceQueryParams(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) {
      result[key] = Number(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export class TypeBoxValidationPipe<T extends TSchema> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): T['static'] {
    const coerced = coerceQueryParams(value);
    const casted = Value.Cast(this.schema, coerced);

    const errors = [...Value.Errors(this.schema, casted)];
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errors.map((e) => ({
          path: e.path,
          message: e.message,
          value: e.value,
        })),
      });
    }
    return casted;
  }
}
