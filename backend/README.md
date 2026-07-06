# FILE

```markdown
src/
├── app.module.ts
├── main.ts
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts        # POST /auth/nonce, POST /auth/verify
│   ├── auth.service.ts           # nonce generation, signature verification
│   ├── jwt.strategy.ts           # Passport JWT strategy
│   ├── jwt-auth.guard.ts         # guard applied to protected routes
│   └── dto/
│       ├── get-nonce.dto.ts
│       └── verify-signature.dto.ts
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts       # GET /users/:wallet, POST /users/username
│   ├── users.service.ts
│   └── dto/
│       └── set-username.dto.ts
│
├── forms/
│   ├── forms.module.ts
│   ├── forms.controller.ts       # POST /forms, GET /forms/:id
│   ├── forms.service.ts          # form CRUD, publish flow
│   └── dto/
│       ├── create-form.dto.ts
│       └── submit-response.dto.ts
│
├── submissions/
│   ├── submissions.module.ts
│   ├── submissions.controller.ts # POST /forms/:id/submit
│   ├── submissions.service.ts    # signature verify → sybil → save → on-chain
│   └── dto/
│
├── sybil/
│   ├── sybil.module.ts
│   ├── sybil.service.ts          # wallet age, balance, funding-graph, similarity
│   └── dto/
│       └── sybil-result.dto.ts
│
├── score/
│   ├── score.module.ts
│   ├── score.service.ts          # metric calculation, update_score CPI call
│   └── dto/
│
├── distribution/
│   ├── distribution.module.ts
│   ├── distribution.service.ts   # weighted calc, lottery, ALT-batched payouts
│   └── dto/
│
├── solana/
│   ├── solana.module.ts
│   ├── solana.service.ts         # shared RPC connection, program client, keypair
│   └── helius.service.ts         # Helius API calls (wallet history, token checks)
│
└── common/
    ├── guards/
    │   └── jwt-auth.guard.ts
    ├── interceptors/
    │   └── logging.interceptor.ts
    ├── filters/
    │   └── http-exception.filter.ts
    ├── decorators/
    │   └── current-user.decorator.ts  # extracts wallet from JWT payload
    └── schemas/                        # Mongoose schemas shared across modules
        ├── form.schema.ts
        ├── response.schema.ts
        └── user.schema.ts
```

Two things worth noting about this structure specifically for Okaform.
solana/ is a shared infrastructure module, not a feature module. Every other module that needs to talk to the blockchain — submissions, score, distribution — injects SolanaService rather than each creating its own RPC connection. You create the connection once, share it everywhere. In NestJS terms, SolanaModule is exported and imported by whichever modules need it.
sybil/ has no controller because it's never called directly by HTTP — it's an internal service that submissions/ calls during the submission flow. Not every module needs a controller. Services can be purely internal.
