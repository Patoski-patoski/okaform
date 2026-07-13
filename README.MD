# Okaform

**Clean Data as a Service** — incentivised, Sybil-resistant surveys for Web3 communities.

Traditional survey tools are defenceless against bot spam, and offer no reason for real users to engage deeply. Okaform fixes both problems: crypto-incentivised rewards motivate genuine participation, while on-chain wallet verification ensures every response comes from a real community member.

Built natively on Solana.

---

## What It Does

Creators launch surveys backed by an on-chain SOL escrow pool. Respondents connect their wallets, complete the survey, and earn rewards — distributed automatically when the creator closes the survey. Every respondent builds a cumulative on-chain reputation score across all surveys they complete, which determines their reward weight and unlocks higher-paying opportunities over time.

**For protocols and DAOs:** verified, targeted feedback from token holders, wallet-aged community members, or any on-chain criteria you define. No bots. No low-effort responses.

**For respondents:** earn SOL for quality participation. Your reputation is portable, on-chain, and grows with every survey you complete honestly.

---

## Core Features

- **On-chain escrow** — reward pool locked in a program-derived vault at survey creation; released automatically on close
- **Sybil resistance** — wallet age, SOL balance, and funding-graph clustering filter out bots before a single response is accepted
- **Reputation scoring** — five-metric system (completion rate, response depth, consistency, wallet history, creator rating) produces a cumulative global score stored in a per-wallet PDA
- **Badge tiers** — Ghost → Cipher →  Sentinel → Oracle → Sovereign, each carrying a reward weight multiplier
- **Weighted distribution** — rewards distributed proportionally by badge tier (0.5x to 1.5x); optional lottery mode available as a creator toggle
- **Zero respondent fees** — all transaction costs absorbed by the platform; respondents pay nothing to participate

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Smart Contract | Anchor (Rust) on Solana |
| Backend | NestJS + Bun runtime |
| Database | MongoDB |
| Frontend | Vite + React + TypeScript + Tailwind CSS |
| Wallet Integration | @solana/wallet-adapter |
| RPC Provider | Helius |

---

## Architecture Overview

```markdown
[React SPA]
    │  wallet connection · form UI · badge display · creator dashboard
    │
    ▼
[NestJS API]
    │  signature verification · sybil checks · score calculation
    │  funding-graph analysis · answer-similarity detection
    │
    ├──────────────────────────────────────────┐
    ▼                                          ▼
[MongoDB]                            [Solana · Anchor Program]
  form schemas                         SurveyAccount PDA (escrow)
  response bodies                      ParticipantEntry PDA (per survey × wallet)
  submission records                   RespondentScoreAccount PDA (global, per wallet)
```

**Submission flow:** respondent connects wallet → signs message proving ownership → backend verifies signature → sybil filters applied → response saved → `register_participant` called on-chain → score updated via authority-gated `update_score` instruction.

**Distribution flow:** creator closes survey → backend reads on-chain scores → calculates weighted amounts → ALT-batched payout transactions sent from escrow PDA to recipient wallets → zero respondent action required.

---

## On-Chain Program Instructions

| Instruction | Description |
| --- | --- |
| `initialize_survey` | Creates survey PDA, deposits SOL into escrow vault |
| `register_participant` | Creates participant PDA; creator pays rent, not respondent |
| `initialize_score_account` | Creates global reputation PDA for a wallet |
| `update_score` | Authority-gated; updates global score, badge tier, surveys completed |
| `close_survey` | Creator-only; marks survey inactive |
| `distribute_rewards` | Moves lamports from escrow to recipient wallets |

---

## Reputation System

Each completed survey contributes up to **5 points** to a wallet's cumulative global score. Partial credit prevents unfair penalisation for near-misses.

| Metric | Full (1.0) | Partial (0.5) | Zero (0) |
| --- | --- | --- | --- |
| Completion Rate | Finished 100% | Finished >70% | Abandoned |
| Response Depth | Met word count | Within 20% of threshold | Far below |
| Consistency | Normal timing | Slightly fast | Suspicious burst |
| Wallet History | Strong on-chain history | Moderate | Brand new wallet |
| Creator Rating | Rated positively | Not rated | Flagged as spam |

Badge tiers and their reward multipliers:

| Badge | Score Range | Reward Weight |
| --- | --- | --- |
| 🔘 Ghost | 0–25 | 0.5x |
| 🔵 Cipher | 26–50 | 0.75x |
| 🟢  Sentinel | 51–75 | 1.0x |
| 🟡 Oracle | 76–100 | 1.25x |
| 💎 Sovereign | 100+ | 1.5x |

---

## Monetisation

| Tier | Pricing |
| --- | --- |
| Open (any valid wallet) | 3–5% protocol fee on reward pool |
| Filtered (wallet age, balance) | 3–5% + $15 (flat filter fee) |
| Targeted (token holdings, e.g. JUP ≥ 50) | 3–5% + $25-100 by complexity (premium filter fee) |

---

## Project Structure

```markdown
Okaform/
├── programs/
│   └── Okaform/
│       └── src/
│           ├── instructions/     # initialize_survey, register_participant, etc.
│           ├── state/            # SurveyAccount, ParticipantEntry, RespondentScoreAccount
│           ├── constants.rs
│           ├── errors.rs
│           └── lib.rs
├── backend/
│   └── src/
│       ├── auth/                 # Wallet signature verification, JWT
│       ├── forms/                # Form CRUD, submission handling
│       ├── sybil/                # Wallet age, balance, funding-graph checks
│       ├── score/                # Score calculation service
│       └── distribution/         # Weighted + lottery payout orchestration
├── frontend/
│   └── src/
│       ├── pages/                # Home, form builder, form fill, dashboard
│       ├── components/           # Wallet connect, badge display, form renderer
│       └── lib/                  # API client, wallet utilities
├── docs/
│   └── architecture/             # draw.io diagrams (PNG exports)
├── tests/                        # Anchor program tests
└── POST_MVP_TODO.md
```

---

## Getting Started

### Prerequisites

- Rust and Cargo
- Solana CLI (`sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`)
- Anchor CLI (`cargo install --git https://github.com/coral-xyz/anchor avm --locked && avm install latest && avm use latest`)
- Node.js 20+ and Bun (`curl -fsSL https://bun.sh/install | bash`)
- MongoDB instance (local or Atlas)
- Helius API key (free tier sufficient for development)

### Smart Contract

```bash
cd programs/Okaform
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

### Backend

```bash
cd backend
bun install
cp .env.example .env   # fill in MONGO_URI, HELIUS_RPC, BACKEND_KEYPAIR, JWT_SECRET
bun run start:dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # fill in VITE_API_URL, VITE_PROGRAM_ID
npm run dev
```

---

## Development Status

| Phase | Status |
| --- | --- |
| Smart contract — core instructions | ✅ Complete |
| Smart contract — reputation PDA | ✅ Complete |
| Backend — NestJS scaffold + auth | 🔄 In progress |
| Backend — sybil + scoring services | ⏳ Planned |
| Frontend — form builder + wallet connect | ⏳ Planned |
| Creator dashboard | ⏳ Planned |
| Alpha pilot (3 founder surveys) | ⏳ Planned |

---

## Roadmap (Post-MVP)

- On-chain distribution verification (tolerance-check against declared `RewardType`)
- Switchboard VRF for verifiable lottery randomness
- Advanced token-gating (specific NFT collections, DAO participation)
- Arweave storage for response bodies (replacing MongoDB)
- Auto-close on response target met
- Zero-knowledge proof integration for privacy-preserving balance verification
- Escrow vault rent recovery on survey close

---

## Architecture Decision Record

Key decisions and the reasoning behind them are documented in [`docs/DECISION_RECORD.md`](docs/DECISION_RECORD.md).

Notable decisions: why ALT-batched push distribution was chosen over Merkle claims, why the reputation score is stored on-chain rather than in the database, and why Vite + React was chosen over Next.js.

---

## Contributing

This project is currently in active early development. Issues and discussions are open — feel free to raise questions or suggestions.

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification, enforced locally via commitlint + husky and verified on PRs via GitHub Actions.

---

## License

MIT
