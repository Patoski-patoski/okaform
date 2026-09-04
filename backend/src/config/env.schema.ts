import { Type, Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export const EnvSchema = Type.Object({
  NODE_ENV: Type.Optional(
    Type.Union([
      Type.Literal('development'),
      Type.Literal('production'),
      Type.Literal('test'),
    ]),
  ),
  PORT: Type.Optional(Type.Number({ default: 3000 })),
  MONGODB_URI: Type.String(),
  JWT_SECRET: Type.String({ minLength: 8 }),
  JWT_REFRESH_SECRET: Type.Optional(Type.String()),
  JWT_EXPIRATION: Type.Optional(Type.String({ default: '15m' })),
  JWT_REFRESH_EXPIRATION: Type.Optional(Type.String({ default: '30d' })),
  THROTTLE_TTL: Type.Optional(Type.Number({ default: 60000 })),
  THROTTLE_LIMIT: Type.Optional(Type.Number({ default: 10 })),
  CORS_ORIGIN: Type.Optional(Type.String()),
  SOLANA_RPC_URL: Type.String(),
  BACKEND_KEYPAIR: Type.String(),
  AUTHORITY_KEYPAIR: Type.String(),
  PROTOCOL_FEE_BPS: Type.Optional(
    Type.Number({ default: 0, minimum: 0, maximum: 1000 }),
  ),
  PROTOCOL_FEE_WALLET: Type.Optional(Type.String()),
});

export type Env = Static<typeof EnvSchema>;

const DEV_JWT_SECRET = 'okaform-access-dev-secret-2026';

/**
 * Resolve the JWT signing secret. In production the secret must be explicitly
 * configured and must not be the well-known development default; a missing or
 * placeholder value aborts startup instead of silently accepting tokens signed
 * with the public dev secret.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim() || '';
  const isProduction = process.env.NODE_ENV === 'production';
  if (
    isProduction &&
    (secret.length < 32 ||
      secret === DEV_JWT_SECRET ||
      secret === 'your-access-token-secret-change-me')
  ) {
    throw new Error(
      'Environment validation failed: JWT_SECRET must be a unique secret of at least 32 characters in production',
    );
  }
  return secret || DEV_JWT_SECRET;
}

const NUMERIC_KEYS = [
  'PORT',
  'THROTTLE_TTL',
  'THROTTLE_LIMIT',
  'PROTOCOL_FEE_BPS',
];

/**
 * Environment variables arrive as strings from process.env/.env. Coerce
 * well-formed numeric values so they can be validated as numbers without
 * TypeBox silently clamping invalid values during Value.Cast.
 */
function coerceNumericEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...config };
  for (const key of NUMERIC_KEYS) {
    const value = config[key];
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        normalized[key] = parsed;
      }
    }
  }
  return normalized;
}

/**
 * Validate the merged environment at startup. Throws on missing or invalid
 * config so the application fails fast instead of at first feature use.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const normalized = coerceNumericEnv(config);
  const errors = [...Value.Errors(EnvSchema, normalized)];
  if (errors.length > 0) {
    const details = errors
      .map((error) => `  ${error.path}: ${error.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${details}`);
  }
  return Value.Cast(EnvSchema, normalized);
}
