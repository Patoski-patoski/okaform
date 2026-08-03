# Success Metrics

Primary (North Star):

Surveys published with locked reward pools indicate creators trust the platform enough to commit real SOL. Target: 20+ surveys with locked pools within 3 months of launch.

Secondary:

- Total SOL locked in escrow (TVL) — Measures economic commitment. Target: 50+ SOL across all active surveys.
- Unique respondent wallets — Measures organic adoption. Target: 200+ unique wallets completing surveys.
- Response completion rate — Indicates UX quality. Target: >70% of started surveys get submitted.
- Sybil rejection rate — Validates the filtering system works. Target: 15–30% of attempted submissions flagged (enough to prove the system catches bots, not so high it blocks legitimate users).

Tertiary:

- Creator retention — % of creators who publish a second survey. Target: >30%.
- Respondent repeat rate — % of wallets that participate in 2+ surveys. Target: >25%.

Failure signals:

- Zero surveys published after 30 days = product-market fit problem.
- A >50% sybil rejection rate = filters too aggressive.
- A <20% response completion = UX or wallet friction issue.
- Reward pool TVL <5 SOL total = creators don't trust escrow.

Success = At least 20 published surveys with locked pools, 200+ unique respondents, and 2+ creators publishing repeat surveys within the grant period. This proves both supply (creators willing to pay) and demand (respondents willing to participate).

By the end of the project duration, we aim to achieve:

- Production-ready survey platform on Solana devnet — Full end-to-end flow: creator publishes surveys with locked SOL reward pools, respondents authenticate via wallet, submit answers, and receive automatic weighted/lucky draw distributions.

- On-chain sybil-resistant escrow — Anchor program handling deposit, registration, score-weighted distribution, and lucky draw mode, with all funds secured in PDAs (no custodial risk).

- Reputation system — Portable on-chain score tied to wallet identity, with badge tiers (Ghost → Sovereign) that multiply reward allocation. Scores persist across surveys.

- Backend filtering and bot detection — Wallet age verification, SOL balance gating, funding-graph clustering, and answer-similarity flagging to ensure survey responses come from real ecosystem participants.

- Creator dashboard and analytics — Real-time survey status, response metrics, CSV export, and distribution tracking.

- Pricing model live — Protocol fee (5%) on reward pools plus tiered flat fees for advanced filtering (Filtered/Targeted tiers). Fee calculator integrated.

- Frontend with complete UX — Landing page, form builder with drag-and-drop, survey fill flow, explore/discover page, and pricing page — all responsive and on-brand.

- Test coverage ≥80% — Unit tests for all service methods, integration tests for Anchor instructions, E2E tests for auth and submission flows.

Deployable to mainnet — Architecture designed for mainnet upgrade (authority migration from hardcoded to config PDA, cluster switching via env vars).
