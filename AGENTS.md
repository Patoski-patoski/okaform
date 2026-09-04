# AGENT.MD — Okaform Backend

This file defines the rules, conventions, and architectural decisions for the Okaform NestJS backend. Read this entire file before writing, editing, or reviewing any code in this project.

---

## Project Overview

Okaform is a Solana-native survey platform. The backend is responsible for:

- Wallet-based authentication (sign-in with Solana)
- Form CRUD and survey lifecycle management
- Submission handling — signature verification, sybil filtering, on-chain registration
- Reputation score calculation and on-chain update via authority-gated instruction
- Reward distribution orchestration (weighted and lucky draw modes)
- Funding-graph and answer-similarity bot detection

**Runtime:** Bun  
**Framework:** NestJS  
**Database:** MongoDB via Mongoose  
**Blockchain:** Solana devnet (mainnet post-alpha) via Helius RPC  
**Language:** TypeScript (strict mode, no exceptions)

---

## TypeScript Rules

### No `any` — ever

`any` defeats the purpose of TypeScript. It is banned without exception.

```typescript
// ❌ Never do this
function processWallet(data: any) {}
const result: any = await someCall();

// ✅ Do this instead
function processWallet(data: WalletPayload) {}
const result: SybilResult = await someCall();
```

If you genuinely don't know the shape of incoming data (e.g. raw RPC responses), use `unknown` and narrow it explicitly:

```typescript
// ✅ unknown + type guard
function isHeliusTransaction(value: unknown): value is HeliusTransaction {
  return (
    typeof value === 'object' &&
    value !== null &&
    'signature' in value &&
    'timestamp' in value
  );
}

const raw: unknown = await helius.getTransaction(sig);
if (!isHeliusTransaction(raw)) {
  throw new InvalidRpcResponseError(sig);
}
```

### Strict TypeScript config

`tsconfig.json` must include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Never weaken these settings to make code compile. Fix the code instead.

---

## Validation — TypeBox Only

All incoming data (request bodies, query params, config) must be validated using **TypeBox**. Do not use `class-validator`, `zod`, or plain interface assertions.

Install: `bun install @sinclair/typebox`

### Defining schemas

```typescript
// src/forms/dto/create-form.dto.ts
import { Type, Static } from '@sinclair/typebox';

export const CreateFormSchema = Type.Object({
  title: Type.String({ minLength: 3, maxLength: 100 }),
  questions: Type.Array(
    Type.Object({
      id: Type.String(),
      type: Type.Union([
        Type.Literal('short_text'),
        Type.Literal('long_text'),
        Type.Literal('multiple_choice'),
        Type.Literal('checkbox'),
      ]),
      label: Type.String({ minLength: 1 }),
      required: Type.Boolean(),
      minWords: Type.Optional(Type.Number({ minimum: 0 })),
    }),
    { minItems: 1, maxItems: 50 }
  ),
  rewardPool: Type.Number({ minimum: 100_000_000 }), // 0.1 SOL in lamports
  rewardType: Type.Union([Type.Literal('weighted'), Type.Literal('lucky_draw')]),
  maxResponses: Type.Number({ minimum: 1, maximum: 1000 }),
  filterRules: Type.Optional(
    Type.Object({
      minWalletAgeDays: Type.Optional(Type.Number({ minimum: 0 })),
      minSolBalance: Type.Optional(Type.Number({ minimum: 0 })),
      tokenRules: Type.Optional(
        Type.Array(
          Type.Object({
            mint: Type.String(),
            minAmount: Type.Number({ minimum: 0 }),
          })
        )
      ),
    })
  ),
});

export type CreateFormDto = Static<typeof CreateFormSchema>;
```

### Validation pipe

Use a global TypeBox validation pipe. All controllers receive already-validated, fully-typed DTOs:

```typescript
// src/common/pipes/typebox-validation.pipe.ts
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export class TypeBoxValidationPipe<T extends TSchema> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown) {
    const errors = [...Value.Errors(this.schema, value)];
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
    return Value.Cast(this.schema, value);
  }
}

// Usage in controller:
@Post()
async createForm(
  @Body(new TypeBoxValidationPipe(CreateFormSchema)) dto: CreateFormDto,
) {}
```

---

## Error Handling

### Custom exception hierarchy

Every domain error must be a typed exception. Do not throw raw `Error` objects or generic `BadRequestException` with string messages.

```markdown
src/common/exceptions/
├── base.exception.ts
├── wallet/
│   ├── invalid-signature.exception.ts
│   └── wallet-not-found.exception.ts
├── form/
│   ├── form-not-found.exception.ts
│   ├── form-already-closed.exception.ts
│   └── max-responses-reached.exception.ts
├── sybil/
│   ├── wallet-too-young.exception.ts
│   ├── insufficient-balance.exception.ts
│   └── token-requirement-not-met.exception.ts
└── solana/
    ├── rpc-error.exception.ts
    └── transaction-failed.exception.ts
```

```typescript
// src/common/exceptions/base.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export interface ExceptionMeta {
  code: string;       // machine-readable, e.g. "FORM_NOT_FOUND"
  detail?: string;    // human-readable, safe to show in UI
  context?: Record<string, unknown>;  // extra data for logging only
}

export class OkaformException extends HttpException {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(meta: ExceptionMeta, status: HttpStatus) {
    super({ message: meta.detail ?? meta.code, code: meta.code }, status);
    this.code = meta.code;
    this.context = meta.context ?? {};
  }
}
```

```typescript
// src/common/exceptions/form/form-not-found.exception.ts
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
```

### Global exception filter

One filter catches everything and produces consistent response shapes:

```typescript
// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OkaformException } from '../exceptions/base.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const code =
      exception instanceof OkaformException
        ? exception.code
        : 'INTERNAL_ERROR';

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as Record<string, unknown>).message ?? exception.message
        : 'An unexpected error occurred.';

    // Log full context for Okaform exceptions — never log to console directly
    if (exception instanceof OkaformException) {
      this.logger.warn({
        code: exception.code,
        context: exception.context,
        path: request.url,
      });
    } else {
      this.logger.error({
        error: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
        path: request.url,
      });
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

Register globally in `main.ts`:

```typescript
app.useGlobalFilters(new GlobalExceptionFilter());
```

---

## Logging

Use NestJS's built-in `Logger` — never `console.log`, `console.error`, or `console.warn` anywhere in the codebase.

```typescript
// ❌ Never
console.log('Survey created:', surveyId);

// ✅ Always
private readonly logger = new Logger(FormsService.name);
this.logger.log(`Survey created: ${surveyId}`);
```

### Log levels by situation

| Situation | Level |
| --- | --- |
| Normal operation, significant events | `log` |
| Expected business rule violations (form closed, wallet too young) | `warn` |
| Unexpected errors, RPC failures | `error` |
| Detailed flow tracing (dev only) | `debug` |
| Startup, shutdown, config loaded | `verbose` |

### What to always include in logs

```typescript
// Structured log — include enough context to debug without re-running the request
this.logger.log({
  event: 'SUBMISSION_ACCEPTED',
  wallet: wallet.slice(0, 8) + '...', // never log full wallet in prod
  formId,
  score: submissionScore,
  durationMs: Date.now() - startTime,
});

this.logger.warn({
  event: 'SYBIL_CHECK_FAILED',
  wallet: wallet.slice(0, 8) + '...',
  reason: 'WALLET_TOO_YOUNG',
  walletAgeDays: age,
  requiredDays: rule.minWalletAgeDays,
});
```

### Never log

- Full wallet addresses in production (truncate to first 8 chars)
- JWT tokens or secrets
- Full request bodies (may contain sensitive survey answers)
- Private key material

---

## Testing

Tests are not optional. Every service method must have a corresponding test. PRs without tests for new functionality will not be merged.

### Stack

- **Unit tests:** Jest (bundled with NestJS)
- **E2E tests:** Jest + Supertest
- **Test file location:** co-located with source (`*.spec.ts`) for unit tests, `test/` directory for E2E

### Coverage requirements

```bash
Statements:  80% minimum
Branches:    80% minimum
Functions:   90% minimum
Lines:       80% minimum
```

Run coverage: `bun run test:cov`

### Unit test structure

```typescript
// src/sybil/sybil.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SybilService } from './sybil.service';
import { HeliusService } from '../solana/helius.service';

describe('SybilService', () => {
  let service: SybilService;
  let heliusService: jest.Mocked<HeliusService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SybilService,
        {
          provide: HeliusService,
          useValue: {
            getWalletAge: jest.fn(),
            getSolBalance: jest.fn(),
            getTokenBalance: jest.fn(),
            getEarlyFunders: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SybilService>(SybilService);
    heliusService = module.get(HeliusService);
  });

  describe('checkEligibility', () => {
    it('should pass when wallet meets all criteria', async () => {
      heliusService.getWalletAge.mockResolvedValue(90);
      heliusService.getSolBalance.mockResolvedValue(2.5);

      const result = await service.checkEligibility('wallet123', {
        minWalletAgeDays: 30,
        minSolBalance: 1,
      });

      expect(result.passed).toBe(true);
    });

    it('should fail when wallet is too young', async () => {
      heliusService.getWalletAge.mockResolvedValue(5);
      heliusService.getSolBalance.mockResolvedValue(2.5);

      const result = await service.checkEligibility('wallet123', {
        minWalletAgeDays: 30,
        minSolBalance: 1,
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toBe('WALLET_TOO_YOUNG');
    });

    it('should skip age check when not configured', async () => {
      heliusService.getSolBalance.mockResolvedValue(2.5);

      const result = await service.checkEligibility('wallet123', {
        minSolBalance: 1,
      });

      expect(heliusService.getWalletAge).not.toHaveBeenCalled();
      expect(result.passed).toBe(true);
    });
  });
});
```

### What to test in every service

- Happy path for each public method
- Each validation/business rule failure path (one test per error case)
- Edge cases: empty arrays, zero amounts, boundary values
- That correct exceptions are thrown (not just that something throws)

```typescript
it('should throw FormNotFoundException for unknown form', async () => {
  mockFormModel.findOne.mockResolvedValue(null);

  await expect(service.getForm('nonexistent-id')).rejects.toThrow(
    FormNotFoundException,
  );
});
```

### E2E test structure

```typescript
// test/auth.e2e-spec.ts
describe('Auth (e2e)', () => {
  it('POST /auth/nonce — returns nonce for valid wallet', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/nonce')
      .send({ wallet: TEST_WALLET_ADDRESS })
      .expect(201);

    expect(response.body).toHaveProperty('nonce');
    expect(typeof response.body.nonce).toBe('string');
  });

  it('POST /auth/verify — returns tokens for valid signature', async () => {
    // Use a test keypair to sign the nonce — never use a real wallet in tests
    const { nonce } = await getNonce(TEST_WALLET_ADDRESS);
    const signature = signMessage(nonce, TEST_KEYPAIR);

    const response = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ wallet: TEST_WALLET_ADDRESS, signature })
      .expect(201);

    expect(response.body).toHaveProperty('accessToken');
  });
});
```

---

## Module Architecture

Each feature module follows this exact structure — no exceptions, no mixing concerns:

```markdown
feature/
├── feature.module.ts       — declares controllers, providers, imports, exports
├── feature.controller.ts   — HTTP only: routing, parsing, calling service
├── feature.service.ts      — business logic only: no HTTP awareness
├── feature.schema.ts       — Mongoose schema (if module owns the collection)
├── feature.spec.ts         — unit tests for the service
└── dto/
    └── action-name.dto.ts  — TypeBox schema + Static type export
```

**Controllers** handle HTTP concerns only — parsing the request, calling a service, returning the result. Zero business logic.

**Services** contain all business logic. They are unaware of HTTP. They receive typed inputs and return typed outputs.

**Never** import a controller into another module. Only services are shared across modules.

---

## Solana / On-Chain Conventions

All Solana interactions live in `src/solana/solana.service.ts` and `src/solana/helius.service.ts`. No other service creates RPC connections or Anchor program clients directly.

```typescript
// ✅ Correct — inject SolanaService
constructor(private readonly solana: SolanaService) {}

// ❌ Never — create connection inline
const connection = new Connection('https://...');
```

On-chain calls that can fail must handle `SendTransactionError` explicitly:

```typescript
import { SendTransactionError } from '@solana/web3.js';

try {
  await this.solana.registerParticipant(surveyPda, respondentWallet);
} catch (error) {
  if (error instanceof SendTransactionError) {
    this.logger.error({
      event: 'ON_CHAIN_REGISTER_FAILED',
      logs: error.logs,
      wallet: respondentWallet.slice(0, 8) + '...',
    });
    throw new TransactionFailedException('register_participant', error.logs);
  }
  throw error;
}
```

All Helius API calls are async background jobs when used for bot detection — they must never block the synchronous submission response:

```typescript
// ✅ Fire and forget for funding-graph check
void this.sybilService.runFundingGraphCheck(wallet, formId);

// ❌ Don't await bot detection in the submission handler
await this.sybilService.runFundingGraphCheck(wallet, formId);
```

---

## Environment Variables

All environment variables are typed and validated at startup using TypeBox. The application must fail fast if required config is missing — not at runtime when a feature is first used.

```typescript
// src/config/env.schema.ts
import { Type, Static } from '@sinclair/typebox';

export const EnvSchema = Type.Object({
  NODE_ENV: Type.Union([
    Type.Literal('development'),
    Type.Literal('production'),
    Type.Literal('test'),
  ]),
  PORT: Type.String({ default: '3000' }),
  MONGO_URI: Type.String(),
  JWT_ACCESS_SECRET: Type.String({ minLength: 32 }),
  JWT_REFRESH_SECRET: Type.String({ minLength: 32 }),
  HELIUS_API_KEY: Type.String(),
  HELIUS_RPC_URL: Type.String(),
  BACKEND_KEYPAIR: Type.String(),        // base58-encoded authority keypair
  PROGRAM_ID: Type.String(),
  SOLANA_CLUSTER: Type.Union([
    Type.Literal('devnet'),
    Type.Literal('mainnet-beta'),
  ]),
});

export type Env = Static<typeof EnvSchema>;
```

---

## Git Conventions

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) spec, enforced by commitlint + husky. Use `bun run commit` to invoke the interactive commitizen prompt.

| Type | When to use |
| --- | --- |
| `feat` | New endpoint, service method, or on-chain interaction |
| `fix` | Bug fix |
| `refactor` | Restructure without behaviour change |
| `test` | Add or update tests |
| `docs` | Comments, README, AGENT.MD |
| `chore` | Dependencies, config, tooling |
| `perf` | Performance improvement |

Scope should match the module name:

```bash
feat(forms): add reward pool validation in create-form endpoint
fix(sybil): exclude CEX addresses from funding-graph clustering
test(score): add edge case for saturating_sub on zero score
```

---

## What Not To Do

- Do not use `console.log` — use `Logger`
- Do not use `any` — use `unknown` + type guards or concrete types
- Do not use `class-validator` — use TypeBox
- Do not put business logic in controllers
- Do not create `Connection` or `AnchorProvider` outside `SolanaService`
- Do not await Helius bot-detection calls in synchronous request handlers
- Do not push `.env` files — use `.env.example` with placeholder values
- Do not disable ESLint rules inline without a comment explaining why
- Do not write a service method without a corresponding test
