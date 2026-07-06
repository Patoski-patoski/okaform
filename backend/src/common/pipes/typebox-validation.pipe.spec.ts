import { BadRequestException } from '@nestjs/common';
import { TypeBoxValidationPipe } from './typebox-validation.pipe';
import { Type } from '@sinclair/typebox';

describe('TypeBoxValidationPipe', () => {
  const schema = Type.Object({
    name: Type.String({ minLength: 1, maxLength: 50 }),
    age: Type.Number({ minimum: 0, maximum: 200 }),
  });

  describe('transform', () => {
    it('should return casted value for valid input', () => {
      const pipe = new TypeBoxValidationPipe(schema);
      const result = pipe.transform({ name: 'Alice', age: 30 });

      expect(result.name).toBe('Alice');
      expect(result.age).toBe(30);
    });

    it('should throw BadRequestException for invalid input', () => {
      const pipe = new TypeBoxValidationPipe(schema);

      expect(() => pipe.transform({ name: '', age: -1 })).toThrow(
        BadRequestException,
      );
    });

    it('should include error details in exception response', () => {
      const pipe = new TypeBoxValidationPipe(schema);

      try {
        pipe.transform({ name: '', age: -1 });
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        const response = (e as BadRequestException).getResponse();
        expect(response).toHaveProperty('errors');
        expect(Array.isArray((response as any).errors)).toBe(true);
      }
    });

    it('should reject missing required fields', () => {
      const pipe = new TypeBoxValidationPipe(schema);

      expect(() => pipe.transform({ name: 'Alice' })).toThrow(
        BadRequestException,
      );
    });

    it('should reject extra properties with additionalProperties false', () => {
      const strictSchema = Type.Object(
        { name: Type.String() },
        { additionalProperties: false },
      );
      const pipe = new TypeBoxValidationPipe(strictSchema);

      expect(() => pipe.transform({ name: 'Alice', extra: true })).toThrow(
        BadRequestException,
      );
    });

    it('should handle nested object validation', () => {
      const nested = Type.Object({
        user: Type.Object({
          name: Type.String(),
          email: Type.String({ format: 'email' }),
        }),
      });
      const pipe = new TypeBoxValidationPipe(nested);

      expect(() =>
        pipe.transform({ user: { name: 'A', email: 'invalid' } }),
      ).toThrow(BadRequestException);
    });

    it('should handle array validation', () => {
      const arraySchema = Type.Array(Type.Number(), { minItems: 1 });
      const pipe = new TypeBoxValidationPipe(arraySchema);

      expect(() => pipe.transform([])).toThrow(BadRequestException);
    });

    it('should accept valid array', () => {
      const arraySchema = Type.Array(Type.Number(), { minItems: 1 });
      const pipe = new TypeBoxValidationPipe(arraySchema);

      const result = pipe.transform([1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should accept null for optional fields', () => {
      const optional = Type.Object({
        name: Type.String(),
        nickname: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      });
      const pipe = new TypeBoxValidationPipe(optional);

      const result = pipe.transform({ name: 'Alice', nickname: null });
      expect(result.nickname).toBeNull();
    });
  });
});
