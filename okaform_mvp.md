# 🔗 Okaform MVP — Project Breakdown

> **Stack:** Anchor (Rust) · NestJS + Bun · Vite + React + Tailwind · MongoDB · Solana Devnet
> **Duration:** 12 Weeks | **Goal:** Functional alpha ready for 3 founder pilots

---

## 🏗️ Architecture Diagram Guide (draw.io)

Before writing a single line of code, draw these three diagrams. Each one answers a different question.

### Diagram 1 — System Context (The "Big Picture")

**Question it answers:** What are all the moving parts and how do they talk to each other?
**What to draw:**

- 5 boxes: User/Respondent, Creator, React Frontend (SPA), NestJS Backend, Solana Program
- 2 cylinders: MongoDB, Solana Blockchain (on-chain state)
- Arrows between them labelled with what flows (e.g. "form answers", "SOL escrow", "signature")
- Keep it high-level. No code, no endpoints. Just shapes and arrows.

### Diagram 2 — Data Flow (The "What Happens When")

**Question it answers:** What happens step by step when a user submits a form?
**What to draw:**

- A swimlane diagram with 4 lanes: Frontend, Backend, Solana Program, MongoDB
- Map each step as a box inside the correct lane
- Connect with arrows showing direction of data
- Repeat this for: (a) Form Creation, (b) Form Submission, (c) Form Close + Distribution

### Diagram 3 — On-Chain State (The "Anchor Data Model")

**Question it answers:** What accounts live on-chain and how are they structured?
**What to draw:**

- 3 PDA boxes: SurveyAccount, ParticipantEntry, RespondentScoreAccount
- Inside each box list the fields (like a database schema)
- Show how they relate with arrows (e.g. SurveyAccount → many ParticipantEntry)

**draw.io tips:**

- Use the "Flowchart" shape library for Diagrams 1 and 2
- Use "Entity Relation" shape library for Diagram 3
- Colour-code by layer: orange = on-chain, blue = backend, green = frontend
- Export as PNG and store in your GitHub repo under `/docs/architecture/`

---

## 📋 MONTH 1: FOUNDATION (Weeks 1–3)

### Week 1: Smart Contract Core

**Focus:** Anchor Program — Survey Lifecycle + Escrow

---

#### 🎯 Tasks_001

- [x] **Setup Development Environment**
  - [x] Install Rust, Anchor CLI (`avm use latest`), Solana CLI
  - [x] Configure Solana devnet: `solana config set --url devnet`
  - [x] Airdrop devnet SOL to your wallet: `solana airdrop 2`
  - [x] Create GitHub repo, push initial commit
  - [x] Set up local validator: `solana-test-validator`
  - **Est. Time:** 4 hours
  - **Blocker?** ❌ None

- [x] **Design On-Chain Account Structures**
  - [x] Design `SurveyAccount` PDA struct:

    ```rust
    creator: Pubkey
    reward_pool: u64
    reward_type: Enum (Weighted / Lucky draw)
    max_responses: u32
    response_count: u32
    is_active: bool
    bump: u8
    ```

  - [x] Design `ParticipantEntry` PDA struct:

    ```rust
    survey: Pubkey
    respondent: Pubkey
    has_submitted: bool
    score_weight: u8
    bump: u8
    ```

  - [x] Design `RespondentScoreAccount` PDA struct (on-chain reputation):

    ```rust
    wallet: Pubkey
    global_score: u16
    surveys_completed: u32
    badge_tier: Enum (Ghost/Cipher/ Sentinel/Oracle/Sovereign)
    bump: u8
    ```

  - [x] Document PDA derivation seeds for each account
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

- [x] **`initialize_survey` Instruction**
  - [x] Create `SurveyAccount` PDA on-chain
  - [x] Accept `reward_pool` amount and `reward_type` param
  - [x] Transfer SOL from creator wallet into escrow vault PDA
  - [x] Set `is_active: true`
  - [x] Write unit tests
  - **Est. Time:** 10 hours
  - **Blocker?** ⚠️ PDA derivation and rent-exemption handling

- [x] **`register_participant` Instruction**
  - [x] Create `ParticipantEntry` PDA for each respondent
  - [x] Validate wallet has not already submitted (`has_submitted: false`)
  - [x] Validate survey is still active
  - [x] Write unit tests
  - **Est. Time:** 8 hours
  - **Blocker?** ❌ None

**Week 1 Goals:**

- ✅ Anchor project compiles cleanly
- ✅ Can initialize a survey and deposit SOL on devnet
- ✅ Can register a participant on devnet
- ✅ All three account structs defined and documented

---

### Week 2: Smart Contract Extended

**Focus:** Anchor Program — Reputation PDA + Distribution Logic

---

#### 🎯 Tasks_002

- [x] **`initialize_score_account` Instruction**
  - [x] Create `RespondentScoreAccount` PDA derived from wallet pubkey
  - [x] Set initial values: `global_score: 0`, `badge_tier: Ghost`
  - [x] Make this instruction idempotent (safe to call if account already exists)
  - [x] Write unit tests
  - **Est. Time:** 8 hours
  - **Blocker?** ⚠️ Handling existing PDA gracefully

- [x] **`update_score` Instruction**
  - [x] Accept score delta (positive or negative) from backend authority
  - [x] Update `global_score` and recalculate `badge_tier`:
    - Ghost: 0–25 | Cipher: 26–50 |  Sentinel: 51–75 | Oracle: 76–100 | Sovereign: 100+
  - [x] Increment `surveys_completed` counter
  - [x] Add authority check — only your backend keypair can call this
  - [x] Write unit tests
  - **Est. Time:** 10 hours
  - **Blocker?** ⚠️ Authority/signer validation pattern

- [x] **`close_survey` Instruction**
  - [x] Validate caller is survey creator
  - [x] Set `is_active: false`
  - [x] Write unit tests
  - **Est. Time:** 4 hours
  - **Blocker?** ❌ None

- [x] **`distribute_rewards` Instruction**
  - [x] Read all `ParticipantEntry` accounts for the survey
  - [x] If `reward_type: Weighted` — calculate share per wallet using score weights
  - [x] If `reward_type: Lucky draw` — select winners using pseudo-random (slot hash + clock)
  - [x] Execute CPI token transfers from escrow vault to winner wallets
  - [x] Mark survey as fully settled
  - [x] Write unit tests
  - **Est. Time:** 14 hours
  - **Blocker?** ⚠️ CPI transfer handling and pseudo-random logic

**Week 2 Goals:**

- ✅ Score PDA creates and updates on devnet
- ✅ Survey closes and distributes rewards on devnet
- ✅ Full smart contract test suite passing locally

---

### Week 3: Backend Foundation

**Focus:** NestJS + MongoDB Setup + Wallet Auth

---

#### 🎯 Tasks_003

- [x] **Project Setup**
  - [x] Initialize NestJS project with Bun runtime
  - [x] Configure TypeScript, ESLint, Prettier
  - [x] Connect MongoDB via Mongoose
  - [x] Set up `.env` with `MONGO_URI`, `SOLANA_RPC`, `BACKEND_KEYPAIR`
  - [x] Push to GitHub
  - **Est. Time:** 4 hours
  - **Blocker?** ❌ None

- [] **MongoDB Schema Design**
  - [] `Form` collection:

    ```db
    formId, creatorWallet, title, questions[], 
    rewardPool, rewardType, maxResponses, 
    surveyPDA, isActive, createdAt
    ```

  - [x] `Response` collection:

    ```db
    formId, respondentWallet, answers[], 
    submittedAt, scoreAtSubmission
    ```

  - [x] `User` collection:

    ```db
    wallet, username, badgeTier, globalScore, 
    surveysCompleted, createdAt
    ```

  - [ ] Create Mongoose models for all three
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

- [x] **Wallet Authentication**
  - [x] `POST /auth/nonce` — generate and store a nonce for a wallet address
  - [x] `POST /auth/verify` — verify signed nonce using `@solana/web3.js`
  - [x] Return JWT on successful verification
  - [x] Auth middleware to protect private routes
  - [x] Test end-to-end with Phantom wallet signing
  - **Est. Time:** 10 hours
  - **Blocker?** ⚠️ Solana message signing + verification pattern

- [x] **User Profile Endpoints**
  - [x] `GET /users/:wallet` — fetch user profile + badge from on-chain PDA
  - [x] `POST /users/username` — set username (unique check in MongoDB)
  - [x] `GET /users/:wallet/history` — list of surveys completed
  - **Est. Time:** 8 hours
  - **Blocker?** ❌ None

- [x] **Sybil Filter Service**
  - [x] Write `SybilCheckService` that reads wallet data from Solana RPC
  - [x] Check wallet age (first transaction timestamp)
  - [x] Check SOL balance
  - [x] Return `{ passed: boolean, reason?: string }`
  - **Est. Time:** 8 hours
  - **Blocker?** ⚠️ RPC call reliability on devnet

**Week 3 Goals:**

- ✅ NestJS server running and connected to MongoDB
- ✅ Can authenticate with a Phantom wallet via JWT
- ✅ Sybil check service working against devnet wallets
- ✅ User profile endpoints returning correct data

---

## 📋 MONTH 2: CORE PRODUCT (Weeks 4–7)

### Week 4: Form Builder UI

**Focus:** Vite + React Frontend — Creator Side

---

#### 🎯 Tasks_004

- [ ] **Project Setup**
  - [ ] Initialize Vite + React project with TypeScript: `npm create vite@latest Okaform-frontend -- --template react-ts`
  - [ ] Install `@solana/wallet-adapter-react`, `@solana/wallet-adapter-phantom`
  - [ ] Install Tailwind CSS
  - [ ] Configure wallet provider at root `App.tsx`
  - [ ] Set up Axios for API calls to NestJS backend
  - **Est. Time:** 4 hours
  - **Blocker?** ❌ None

- [ ] **Wallet Connect Component**
  - [ ] "Connect Wallet" button in navbar
  - [ ] Show truncated wallet address when connected
  - [ ] Show user badge tier and score (fetched from backend)
  - [ ] Disconnect option
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

- [ ] **Form Builder Interface**
  - [ ] Creator can add question blocks: Short Text, Long Text, Multiple Choice, Checkbox
  - [ ] Drag to reorder questions
  - [ ] Set form title and description
  - [ ] Set `max_responses` limit
  - [ ] Set sybil filter rules (wallet age, SOL balance)
  - **Est. Time:** 14 hours
  - **Blocker?** ⚠️ Drag-and-drop UX complexity

- [ ] **Reward Configuration Panel**
  - [ ] Input: total reward pool (SOL amount)
  - [ ] Toggle: Weighted Distribution (default) vs Lucky draw
  - [ ] Lucky draw toggle shows winner count input
  - [ ] "Coming Soon" badge on auto-close toggle
  - [ ] Display: "Respondents will be informed of reward type on form"
  - **Est. Time:** 8 hours
  - **Blocker?** ❌ None

- [ ] **Publish Flow**
  - [ ] "Publish" button calls `POST /forms` on backend
  - [ ] Backend creates MongoDB record and initializes Anchor survey PDA
  - [ ] Frontend prompts creator to sign and approve SOL escrow transaction
  - [ ] On success: redirect to creator dashboard for that form
  - **Est. Time:** 10 hours
  - **Blocker?** ⚠️ Coordinating backend + on-chain transaction in sequence

**Week 4 Goals:**

- ✅ Creator can build a multi-question form
- ✅ Creator can configure reward pool and type
- ✅ Form publishes and escrow deposits on devnet

---

### Week 5: Form Submission Flow

**Focus:** Vite + React + NestJS — Respondent Side

---

#### 🎯 Tasks_005

- [ ] **Public Form Page (`/form/[formId]`)**
  - [ ] Fetch form schema from backend and render questions dynamically
  - [ ] Display reward type banner (top of form): "Rewards: Reputation-Weighted" or "Rewards: Lucky draw (X winners)"
  - [ ] Show sybil filter requirements: "This form requires wallet age > 30 days"
  - [ ] Wallet must be connected to see form
  - **Est. Time:** 8 hours
  - **Blocker?** ❌ None

- [ ] **Sybil Gate on Frontend**
  - [ ] On wallet connect, call `GET /sybil-check/:wallet`
  - [ ] If failed: show clear rejection message with reason ("Your wallet is too new")
  - [ ] If passed: unlock form fields
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

- [ ] **Form Submission**
  - [ ] Collect all answers into a JSON payload
  - [ ] User signs a message confirming ownership: `"Submitting form [formId] with wallet [pubkey]"`
  - [ ] `POST /forms/:formId/submit` with answers + signature
  - [ ] Backend verifies signature → runs sybil check → saves to MongoDB → calls `register_participant` on Anchor program
  - [ ] Show success screen with score update notification
  - **Est. Time:** 12 hours
  - **Blocker?** ⚠️ Coordinating signature verification + on-chain participant registration

- [ ] **Backend: Form Submission Endpoint**
  - [ ] `POST /forms/:formId/submit`
  - [ ] Verify wallet signature
  - [ ] Check sybil rules
  - [ ] Check for duplicate submission (MongoDB + on-chain)
  - [ ] Save response to MongoDB
  - [ ] Call `register_participant` instruction on Anchor program
  - [ ] Trigger score update via `update_score` instruction
  - **Est. Time:** 12 hours
  - **Blocker?** ⚠️ Double-submission prevention across MongoDB and on-chain

**Week 5 Goals:**

- ✅ Respondent can connect wallet, pass sybil check, and fill form
- ✅ Submission verified, recorded in MongoDB, registered on-chain
- ✅ Duplicate submission blocked correctly

---

### Week 6: Reputation Scoring System

**Focus:** Backend Score Logic + Badge Display

---

#### 🎯 Tasks_006

- [ ] **Score Calculation Service (NestJS)**
  - [ ] `ScoreService.calculateSubmissionScore(response, formRules)`:
    - Completion Rate: Did they answer all required questions? (1.0 / 0.5 / 0.0)
    - Response Depth: Met word count threshold? (1.0 / 0.5 / 0.0)
    - Consistency: Time-to-submit within normal range? (1.0 / 0.5 / 0.0)
    - Wallet History: Age + activity score from SybilCheckService (1.0 / 0.5 / 0.0)
    - Creator Rating: Default 1.0 at submission, adjustable post-survey
  - [ ] Return total score delta (0.0 to 5.0)
  - [ ] Call `update_score` Anchor instruction with delta
  - **Est. Time:** 12 hours
  - **Blocker?** ⚠️ Defining "normal" time-to-submit range

- [ ] **Badge Display Component (Frontend)**
  - [ ] Map badge tier to colour + icon:
    - Ghost 🔘 · Cipher 🔵 ·  Sentinel 🟢 · Oracle 🟡 · Sovereign 💎
  - [ ] Display badge to right of username (like a verified tag)
  - [ ] Hover tooltip: breakdown of score components
  - [ ] Badge visible on: navbar (own badge), form submission list (creator view)
  - **Est. Time:** 8 hours
  - **Blocker?** ❌ None

- [ ] **Score Transparency on Respondent Profile**
  - [ ] `GET /users/:wallet/score` returns full breakdown from on-chain PDA
  - [ ] Profile page shows: Global Score, Badge Tier, Surveys Completed, Score History
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

**Week 6 Goals:**

- ✅ Score calculates and updates on-chain after every submission
- ✅ Badge renders correctly at all 5 tiers
- ✅ Profile page shows live score from on-chain PDA

---

### Week 7: Distribution Logic

**Focus:** Close Flow + Weighted/Lucky draw Distribution

---

#### 🎯 Tasks_007

- [ ] **Backend: Close Survey Endpoint**
  - [ ] `POST /forms/:formId/close` (creator only, JWT protected)
  - [ ] Call `close_survey` Anchor instruction
  - [ ] Mark form as inactive in MongoDB
  - [ ] Trigger distribution flow
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

- [ ] **Backend: Distribution Orchestration**
  - [ ] Fetch all participant wallets and their on-chain scores
  - [ ] If Weighted: calculate proportional share per wallet using badge weights
    - Ghost: 0.5x · Cipher: 0.75x ·  Sentinel: 1.0x · Oracle: 1.25x · Sovereign: 1.5x
  - [ ] If Lucky draw: randomly select X winners from participant pool
  - [ ] Call `distribute_rewards` Anchor instruction with winner list + amounts
  - **Est. Time:** 12 hours
  - **Blocker?** ⚠️ Passing correct amounts to Anchor for batch transfer

- [ ] **Distribution Transparency Notification**
  - [ ] After distribution, send on-chain event that frontend can read
  - [ ] Respondent sees: "You received 0.05 SOL from [Form Title]" on their profile
  - [ ] Creator sees: full distribution table in dashboard
  - **Est. Time:** 8 hours
  - **Blocker?** ❌ None

**Week 7 Goals:**

- ✅ Creator can close a form and trigger distribution
- ✅ Weighted distribution pays correct proportional amounts on devnet
- ✅ Lucky draw distribution selects random winners and pays on devnet
- ✅ All participants notified of outcome

---

## 📋 MONTH 3: POLISH + ALPHA (Weeks 8–12)

### Week 8: Creator Dashboard

**Focus:** Full Creator Experience

---

#### 🎯 Tasks_008

- [ ] **Dashboard Home (`/dashboard`)**
  - [ ] List of all forms created by connected wallet
  - [ ] Per form: title, response count, status (active/closed), reward pool
  - [ ] "Create New Form" CTA
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

- [ ] **Form Detail View (`/dashboard/form/[formId]`)**
  - [ ] Response count vs target
  - [ ] List of respondent wallets with badge tier visible
  - [ ] Per-question summary (for MCQ: bar chart of selections)
  - [ ] Individual response viewer
  - [ ] "Close Survey" button (with confirmation modal)
  - [ ] Post-close: distribution table showing who received what
  - **Est. Time:** 14 hours
  - **Blocker?** ⚠️ Rendering dynamic question summaries

- [ ] **"Coming Soon" Auto-Close Toggle**
  - [ ] Toggle visible in reward config panel
  - [ ] Clicking shows tooltip: "Auto-close when response target is hit — coming in v2"
  - [ ] Toggle is disabled/greyed out
  - **Est. Time:** 2 hours
  - **Blocker?** ❌ None

**Week 8 Goals:**

- ✅ Creator can view all their forms and responses
- ✅ Creator can close and see distribution results
- ✅ Coming Soon toggle visible and non-functional

---

### Week 9: Sybil Filtering + Username System + Bot Detection

**Focus:** Quality Gatekeeping, Identity, Advanced Fraud Signals

---

#### 🎯 Tasks_009

- [ ] **Username System**
  - [ ] `POST /users/username` — claim unique username
  - [ ] Validate: alphanumeric, 3–20 chars, no spaces
  - [ ] Store in MongoDB with uniqueness index
  - [ ] Display username as primary identity everywhere (not wallet address)
  - [ ] Fallback to truncated wallet if no username set
  - **Est. Time:** 8 hours
  - **Blocker?** ❌ None

- [ ] **Enhanced Sybil Filter UI**
  - [ ] Creator can configure per-form:
    - Minimum wallet age (days)
    - Minimum SOL balance
  - [ ] Clear display to respondent on form page: requirements to participate
  - [ ] Graceful rejection screen with reason
  - **Est. Time:** 8 hours
  - **Blocker?** ❌ None

- [ ] **Funding-Graph Detection Service (Backend)**
  - [ ] For each respondent wallet, call Helius enhanced transaction API to pull earliest inbound transfers
  - [ ] Extract the sending address(es) from those early funding transactions
  - [ ] After every submission, run a background job (async — do NOT block submission) that:
    - [ ] Compares this wallet's funders against all other respondents' funders on the same form
    - [ ] Also compares against the platform-wide history (same funders appearing across multiple surveys)
    - [ ] Calculates a cluster score: how many wallets share the same non-CEX funder within a tight time window
  - [ ] Maintain an exclusion list of known CEX withdrawal addresses (Binance, Coinbase, etc.) — shared CEX funders do NOT count as suspicious
  - [ ] Treat result as a soft risk signal (0.0–1.0), stored in MongoDB per wallet, feeding into the sybil score — never a hard auto-reject
  - [ ] Expose `GET /sybil/risk/:wallet` endpoint returning combined risk score with breakdown
  - **Est. Time:** 14 hours
  - **Blocker?** ⚠️ Helius API integration + CEX exclusion list sourcing

- [ ] **Answer-Similarity Detection Service (Backend)**
  - [ ] After each text response is saved, run an async background job that:
    - [ ] Compares the new response's open-text answers against all other responses on the same form
    - [ ] Flag responses where similarity exceeds a threshold (e.g. >80% string similarity on any long-form answer)
    - [ ] Store a `similarity_flag: boolean` on the MongoDB response document
  - [ ] Use a simple string similarity algorithm (Levenshtein distance or Jaccard index) — no ML required for MVP
  - [ ] Flagged responses are visible to the creator in the dashboard with a ⚠️ indicator — creator decides what to do with them, system does not auto-reject
  - **Est. Time:** 10 hours
  - **Blocker?** ❌ None

- [ ] **Protocol Fee Collection**
  - [ ] On `initialize_survey`, automatically deduct 5% from reward pool into treasury PDA
  - [ ] Treasury PDA controlled by your authority keypair
  - [ ] Log fee collected per survey in MongoDB
  - **Est. Time:** 6 hours
  - **Blocker?** ⚠️ Correct PDA authority setup for treasury

**Week 9 Goals:**

- ✅ Users can claim and display usernames
- ✅ Sybil filters configurable per form and enforced on submission
- ✅ Funding-graph clustering running as async background job
- ✅ Answer-similarity flagging visible to creators in dashboard
- ✅ Protocol fee collecting correctly on devnet

---

### Week 10: End-to-End Testing + Bug Fixes

**Focus:** Full Flow QA

---

#### 🎯 Tasks_010

- [ ] **Full Flow Test (Weighted)**
  - [ ] Create form → deposit escrow → 5 test wallets submit → close → distribute weighted
  - [ ] Verify all balances correct on devnet explorer
  - [ ] Verify score PDAs updated for all wallets
  - **Est. Time:** 8 hours
  - **Blocker?** ⚠️ Likely to surface edge cases

- [ ] **Full Flow Test (Lucky draw)**
  - [ ] Same flow with lucky draw toggle enabled, 10 wallets, 3 winners
  - [ ] Verify only 3 wallets received SOL
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

- [ ] **Edge Case Handling**
  - [ ] What if creator closes with 0 responses?
  - [ ] What if a wallet fails sybil check mid-session?
  - [ ] What if escrow runs out (rounding errors)?
  - [ ] What if distribution transaction fails?
  - [ ] Handle all gracefully with clear UI messages
  - **Est. Time:** 10 hours
  - **Blocker?** ⚠️ Edge cases take time to discover

- [ ] **Mobile Responsiveness Pass**
  - [ ] Form fill page fully usable on mobile
  - [ ] Wallet connect works on mobile browser
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

**Week 10 Goals:**

- ✅ Both distribution modes work end-to-end on devnet
- ✅ All major edge cases handled
- ✅ No critical bugs outstanding

---

### Week 11: Alpha Prep

**Focus:** Get 3 Founder Pilots Ready

---

#### 🎯 Tasks_011

- [ ] **Deploy to Devnet (Public URL)**
  - [ ] Build Vite app: `npm run build` → outputs static `dist/` folder
  - [ ] Deploy static frontend to Vercel or Netlify (drag-and-drop `dist/` or connect GitHub repo)
  - [ ] Deploy NestJS to Railway or Render
  - [ ] Point both to Solana devnet RPC (Helius)
  - [ ] Test full flow on live deployment (not localhost)
  - **Est. Time:** 6 hours
  - **Blocker?** ⚠️ Environment variable management

- [ ] **Onboarding Flow for Creators**
  - [ ] Simple "How It Works" modal on first visit
  - [ ] Tooltip hints on form builder for new creators
  - **Est. Time:** 6 hours
  - **Blocker?** ❌ None

- [ ] **Identify and Onboard 3 Founder Pilots**
  - [ ] Reach out to 3 Solana ecosystem founders
  - [ ] Offer to run their community survey for free
  - [ ] Provide a short Loom walkthrough of the product
  - [ ] Set up their forms yourself (white-glove for alpha)
  - **Est. Time:** 6 hours
  - **Blocker?** ⚠️ Relationship-dependent

**Week 11 Goals:**

- ✅ Product live on a public URL
- ✅ 3 founder pilots confirmed and onboarded
- ✅ At least 1 real survey live on devnet

---

### Week 12: Alpha Launch + Feedback

**Focus:** Run Pilots, Collect Feedback, Plan v2

---

#### 🎯 Tasks_012

- [ ] **Monitor 3 Pilot Surveys Live**
  - [ ] Watch for errors in Railway/Render logs
  - [ ] Track submission rates, sybil rejections, score updates
  - [ ] Be available to fix bugs same-day
  - **Est. Time:** Ongoing
  - **Blocker?** ❌ None

- [ ] **Collect Structured Feedback**
  - [ ] Feedback from creators: Was the form builder intuitive? Was the dashboard clear?
  - [ ] Feedback from respondents: Did the reward feel fair? Was the form easy?
  - [ ] Document all feedback in a Notion page or GitHub Issues
  - **Est. Time:** 4 hours
  - **Blocker?** ❌ None

- [ ] **v2 Backlog (Based on Alpha Learnings)**
  - [ ] Priority-rank post-MVP features:
    - [ ] Auto-close / auto-distribute
    - [ ] Advanced token-gating (JUP, BONK holders)
    - [ ] Switchboard VRF (replace mock randomness)
    - [ ] Arweave storage (replace MongoDB for responses)
    - [ ] Creator rating of individual responses
  - **Est. Time:** 4 hours
  - **Blocker?** ❌ None

**Week 12 Goals:**

- ✅ 3 real surveys completed with real Solana community members
- ✅ Structured feedback documented
- ✅ v2 backlog prioritised and ready

---

## 📊 Summary Timeline

| Month | Weeks | Focus |
| ----- | ----- | ----- |
| Month 1 | 1–3 | Smart contracts + backend foundation |
| Month 2 | 4–7 | Core product: form builder, submissions, scoring, distribution |
| Month 3 | 8–12 | Polish, testing, alpha launch with 3 pilots |

---

## ⚠️ Key Technical Risks

| Risk | Mitigation |
| ----- | ----- |
| Anchor distribution fails on large participant lists | Cap MVP at 100 responses per form |
| Pseudo-random lucky draw is gameable | Clearly label as "mock randomness" in alpha, migrate to Switchboard VRF in v2 |
| MongoDB response storage is centralised | Acceptable for MVP, migrate to Arweave post-alpha |
| Score PDA migration if schema changes | Version the PDA seeds from day one |
| RPC rate limits on devnet | Use Helius or QuickNode free tier instead of public RPC |
