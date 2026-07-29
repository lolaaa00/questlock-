# QuestLock

> **Rewards should follow proof, not farming.**

[![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Base Sepolia](https://img.shields.io/badge/Base_Sepolia-0052FF?style=flat-square&logo=coinbase)](https://sepolia.basescan.org)
[![EAS](https://img.shields.io/badge/EAS_Attestations-6B4EFF?style=flat-square)](https://attest.org)
[![Privy](https://img.shields.io/badge/Privy_Auth-000000?style=flat-square)](https://privy.io)
[![Supabase](https://img.shields.io/badge/Supabase_Postgres-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)

QuestLock is a **deterministic proof-powered quest platform** built on Base Sepolia. Sponsors fund quests from their own wallet. Builders submit verifiable proof. An objective engine scores the work against a 100-point rubric. Pass the threshold — get an EAS attestation, an onchain badge, and a gasless token reward. No farming. No discretion. Proof or nothing.

**[quest-lock.vercel.app](https://quest-lock.vercel.app)**

---

## How It Works

```
Sponsor creates quest → funds pool from own wallet (QuestLockCoreV2)
        ↓
Builder submits proof (GitHub / manual / Discord / X / LMS)
        ↓
Backend fetches evidence → deterministic engine scores (100 pts, 70 to pass)
        ↓
Anti-farm checks → proof hash committed onchain
        ↓
EAS attestation issued (public, shareable certificate)
        ↓
Verifier wallet calls submitAndApprove (atomic, no double-spend)
        ↓
Builder clicks "Claim Reward" — verifier calls claimRewardFor (gasless)
        ↓
ERC-20 QUEST token transferred + ERC-1155 soulbound badge minted
```

---

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|---|---|
| **QuestLockCoreV2** (v1.2 · per-quest funded) | `0xDDC0024E76C2bEC64F6f7785e232E7Ce11b0A282` |
| QuestLockCore (v1 · legacy shared pool) | `0xCCe52216B17096235c070ce85F5C4fFBbf9E782C` |
| QuestRewardToken (QUEST ERC-20) | `0x154250cc3253b4C7a0f1bfe0eCc26792c81b3054` |
| QuestBadge (ERC-1155 soulbound) | `0x1010F4fB73b2DCb4b2bD43D87E0210cb6a00bBAe` |
| EAS Contract | `0x4200000000000000000000000000000000000021` |
| EAS Schema UID | `0x3c9b890e57a3887a0766fe0bf74df896e9551d7b173b3113e3363149156940a6` |

V2 introduced per-quest funded pools — sponsors fund their own quest; rewards never come from a shared bag. V1 quests continue to run on the original contract. The EAS schema is shared across both versions.

---

## Features

### For Builders
- **5 proof types** — GitHub project, manual project, Discord role, X post, LMS course
- **Public certificates** — every passing submission gets a shareable `/proof/[id]` page with EAS attestation, score breakdown, and all tx links
- **Gasless claims** — the verifier wallet calls `claimRewardFor` so builders pay zero gas to collect rewards
- **Profile page** — track submissions, badges, attestations, and display name
- **Leaderboard** — filter by proof type or badge; identity shown as `display_name → @github → 0xshort…`

### For Sponsors
- **Self-funded quests** — sponsors deposit QUEST tokens directly; admin never touches sponsor funds
- **5 quest templates** — one per proof type, cloneable from `/create`
- **Manual review dashboard** — approve or reject manual submissions from `/sponsor/quests/[id]`
- **Tiered trust** — after 3 admin-confirmed approvals, sponsors are promoted to Trusted and bypass the admin queue on standard quests

### For Admins
- **Quest creation & publishing** — two-step offchain approve → onchain publish
- **Retry Centre** — one-click idempotent retry for proof check, attestation, onchain approval, and indexer
- **Admin confirmations queue** — review `SPONSOR_APPROVED_PENDING_ADMIN` submissions; confirm or override
- **Analytics dashboard** — conversion rates, outflow remaining, top failure reasons per quest
- **System panel** — env audit, indexer status, submission counts, live log tail

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS |
| Auth / Wallet | Privy + wagmi + viem |
| Database | Supabase Postgres + Prisma ORM |
| Smart Contracts | Solidity 0.8.28, Hardhat 3, OpenZeppelin 5 |
| Attestations | EAS (Ethereum Attestation Service) |
| Network | Base Sepolia (Chain ID 84532) |
| Scheduled indexer | Supabase pg_cron + pg_net (every 5 min) |
| Identity | GitHub OAuth + Discord OAuth + display name |

---

## Smart Contracts

### Roles

| Role | Holder | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Admin wallet | Emergency control, role management |
| `QUEST_CREATOR_ROLE` | Deployer wallet | Create quests onchain |
| `VERIFIER_ROLE` | Verifier wallet | Approve submissions + claim for users |
| `PAUSER_ROLE` | Admin wallet | Pause in emergency |

### Key Functions

| Function | Who calls it | What it does |
|---|---|---|
| `createQuest(...)` | QUEST_CREATOR_ROLE | Create a quest with reward, deadline, min score |
| `submitAndApprove(...)` | VERIFIER_ROLE | Atomic: commit proof hash + approve in one tx |
| `claimRewardFor(questId, user)` | VERIFIER_ROLE | Gasless claim — transfers QUEST + mints badge |
| `fundQuest(questId, amount)` | Sponsor wallet | Deposit QUEST into per-quest pool (V2 only) |
| `withdrawUnusedFunds(questId)` | Sponsor wallet | Reclaim unused pool after deadline |

---

## Proof Engine

### Scoring Rubric (GitHub Project · 100 pts · 70 to pass)

| Check | Points |
|---|---|
| Repository exists and is public | 10 |
| Owner matches linked GitHub username | 10 |
| Repository updated after quest start | 10 |
| 3+ commits after quest start (by submitter) | 15 |
| README file present | 10 |
| README has 500+ characters | 10 |
| Frontend files detected | 10 |
| Contract or backend files detected | 10 |
| Demo URL loads successfully | 10 |
| Not previously submitted | 5 |

Other proof types (`manual_project`, `discord_role`, `x_post`, `lms_course`) implement the same `ProofAdapter` interface and share the same pipeline — only the evidence fetch and scoring logic differs.

### Submission Status Lifecycle

```
SUBMITTED → FETCHING_PROOF → EVALUATING → PASSED → ATTESTING
  → ATTESTED → APPROVING_ONCHAIN → APPROVED_ONCHAIN → CLAIMING → CLAIMED

Failure paths: FAILED · REJECTED · CLAIM_FAILED
Sponsor queue: SPONSOR_APPROVED_PENDING_ADMIN (new sponsors, high-value quests)
```

---

## Backend Services

| Module | Responsibility |
|---|---|
| `lib/adapters/*` | One adapter per proof type — `validateInput`, `fetchEvidence`, `scoreEvidence`, `buildPublicProofPayload` |
| `lib/scoring.ts` | 10-check deterministic scoring engine |
| `lib/antifarm.ts` | Duplicate detection + risk band (`LOW / MEDIUM / HIGH_RISK`) |
| `lib/proof-hash.ts` | Deterministic keccak hash for onchain commitment |
| `lib/eas.ts` | EAS attestation creation (pure ethers, no SDK lock-in) |
| `lib/approval.ts` | Verifier wallet calls `submitAndApprove` |
| `lib/event-indexer.ts` | Syncs onchain events to `contract_events` table |
| `lib/sponsor-trust.ts` | Tiered trust — `new / trusted / flagged / suspended`, auto-promotion at 3 confirmed |
| `lib/creator-guard.ts` | Blocks creator/sponsor from submitting their own quests |
| `lib/contracts.ts` | Routes approve/claim/fund calls to V1 or V2 by `contract_version` |
| `lib/rate-limit.ts` | Supabase-backed token bucket with in-process fallback |
| `lib/logger.ts` | System log writer |

---

## Pages

| Route | Who | Purpose |
|---|---|---|
| `/` | Public | Landing — proof-powered quests explainer |
| `/quests` | Public | Quest marketplace |
| `/quests/[id]` | Public | Quest detail + proof submission form |
| `/submit/[questId]` | Builder | Real-time pipeline status, score breakdown, claim button |
| `/proof/[id]` | Public | Shareable EAS certificate per submission |
| `/leaderboard` | Public | Ranked by claimed quests; filter by proof type or badge |
| `/me` | Builder | Profile, submissions, badges, rewards, display name, linked accounts |
| `/create` | Sponsor | Propose a quest; track request status |
| `/sponsor` | Sponsor | Funded quest overview + trust tier |
| `/sponsor/quests/[id]` | Sponsor | Fund, top-up, withdraw, review manual submissions |
| `/ops-ql` | Admin | Dashboard — system status, submission list |
| `/ops-ql/submissions/[id]` | Admin | Per-submission inspection — all proof checks + tx hashes |
| `/ops-ql/quest-requests` | Admin | Review + publish sponsor quest requests |
| `/ops-ql/appeals` | Admin | Manual appeal review queue |
| `/ops-ql/analytics` | Admin | Conversion rates, outflow, top failure reasons |
| `/ops-ql/retry` | Admin | One-click retry for stuck pipeline stages |
| `/ops-ql/confirmations` | Admin | Confirm or override sponsor-approved submissions |

---

## API Reference

### Public

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/quests` | GET | List active quests |
| `/api/quests/[id]` | GET | Single quest |
| `/api/proof/submit` | POST | Full proof pipeline trigger |
| `/api/proof/status/[id]` | GET | Poll submission status |
| `/api/proof/public/[id]` | GET | Public certificate payload |
| `/api/relay/claim` | POST | Gasless claim relay |
| `/api/submissions` | GET | `?wallet=` — user submission history |
| `/api/leaderboard` | GET | `?proof_type=&badge_id=` — filtered leaderboard |
| `/api/health` | GET | Env audit + DB ping + RPC ping → 200 / 503 |
| `/api/appeals` | GET / POST | User appeal submission |
| `/api/notifications` | GET | Bell feed for connected wallet |
| `/api/templates` | GET | 5 quest templates (one per proof type) |

### Sponsor

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/quest-requests` | GET / POST | Submit or list own quest requests |
| `/api/sponsor/submissions` | GET | Manual submissions for sponsor's quests |
| `/api/sponsor/submissions/[id]/approve` | POST | Approve (routes by trust tier) |
| `/api/sponsor/submissions/[id]/reject` | POST | Reject with optional reason |
| `/api/sponsor/trust-status` | GET | Own trust tier self-check |

### Admin

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ops-ql/submissions/[id]` | GET | Full submission detail |
| `/api/ops-ql/quest-requests` | GET | Quest request queue |
| `/api/ops-ql/quest-requests/[id]/approve\|reject\|publish` | POST | Admin actions |
| `/api/ops-ql/appeals` | GET | Appeal queue |
| `/api/ops-ql/appeals/[id]/approve\|reject` | POST | Admin appeal actions |
| `/api/ops-ql/analytics` | GET | Full analytics payload |
| `/api/ops-ql/system-status` | GET | Env, indexer, counts, log tail |
| `/api/admin/retry/queue` | GET | Stuck submission queues |
| `/api/admin/retry/[op]` | POST | Trigger retry (proof-check / attestation / onchain-approval / indexer) |
| `/api/admin/confirmations` | GET | Pending admin confirmation queue |
| `/api/admin/confirmations/[id]/confirm\|reject` | POST | Admin confirm / override |
| `/api/admin/sponsors/[wallet]/trust` | GET / POST | Read or set sponsor trust level |
| `/api/indexer` | POST | Manual indexer trigger (`x-indexer-secret` header) |

---

## Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=

# Database (Supabase connection pooler, port 6543, pgbouncer transaction mode)
DATABASE_URL=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Privy
NEXT_PUBLIC_PRIVY_APP_ID=

# Wallets (never commit these)
VERIFIER_PRIVATE_KEY=
DEPLOYER_PRIVATE_KEY=

# EAS
EAS_SCHEMA_UID=

# GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=

# Discord OAuth (for discord_role proof type)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
DISCORD_BOT_TOKEN=        # optional — enables deterministic role checking

# Indexer auth
INDEXER_SECRET=

# Admin
ADMIN_WALLET_ADDRESS=
```

---

## Local Setup

```bash
git clone https://github.com/your-org/questlock
cd questlock
cp .env.example .env
# Fill all values

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### GitHub OAuth App

Create one at [github.com/settings/developers](https://github.com/settings/developers). Set the Authorization callback URL to `${NEXT_PUBLIC_APP_URL}/api/auth/github/callback`.

---

## Build & Test

```bash
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build
npm run typecheck        # tsc --noEmit
npm run test:contracts   # Hardhat unit tests (18 passing)
```

---

## Contract Deployment (Base Sepolia)

```bash
npm run contracts:compile
npm run contracts:deploy        # Deploy QuestLockCore + V2 + QuestRewardToken + QuestBadge
npm run contracts:grant-roles   # Grant VERIFIER_ROLE to verifier wallet
npm run contracts:seed-quest    # Fund + create sample quest
```

---

## Scheduled Indexer

The event indexer is driven by **Supabase pg_cron** — a Postgres-native cron job that fires `pg_net.http_post` to `/api/indexer` every 5 minutes. No external cron service required.

```sql
-- View the scheduled job
select jobid, jobname, schedule, active from cron.job;

-- Remove if needed
select cron.unschedule('questlock-indexer');
```

Indexer chunks at 1900-block batches to respect Base Sepolia's public RPC cap (`eth_getLogs` max 2000 blocks). The Admin Retry Centre also has a manual "Run indexer now" button at `/ops-ql/retry`.

---

## Release History

| Version | Tag | Highlights |
|---|---|---|
| v1.0 | — | Core GitHub proof, shared pool contract, EAS attestation |
| v1.1 | — | Appeals queue, analytics, proof engine hardening, GitHub linking, creator guard |
| v1.2.0 | `v1.2.0` | QuestLockCoreV2 per-quest pools, 5 proof adapters, sponsor dashboard, leaderboard, notifications, templates, Retry Centre |
| v1.2.1 | `v1.2.1` | Tiered sponsor trust (`new / trusted / flagged / suspended`), admin confirmations queue, auto-promotion |
| v1.2.2+ | `main` | Display names, Discord connect card, leaderboard filters, role chips on `/me`, mobile navbar, Supabase pg_cron indexer |

Full notes in `RELEASE_NOTES_v1.2.md` · Known limitations in `KNOWN_LIMITATIONS.md` · Designer handoff in `UI_REDESIGN_HANDOFF.md`.

---

## Design System

Warm proof infrastructure palette — Plus Jakarta Sans throughout.

| Token | Hex | Role |
|---|---|---|
| `--ql-bighorn` | `#22150C` | Primary dark background |
| `--ql-night` | `#432C1A` | Card surfaces |
| `--ql-derby` | `#5B4535` | Muted text |
| `--ql-bear` | `#816550` | Metadata / secondary text |
| `--ql-cafe` | `#A98C75` | Borders, input labels |
| `--ql-chocolate` | `#834A1F` | Action accent (CTA, claim) |
| `--ql-ashen` | `#D3CBC1` | Light background |

---

## Known Limitations

- GitHub proof is the only fully deterministic adapter. Manual / X / LMS default to admin review. Discord is deterministic only when `DISCORD_BOT_TOKEN` is configured.
- Base Sepolia testnet only — no mainnet, no multi-chain.
- No paid X API integration (free tier doesn't return post content).
- The old verifier wallet remains authorised on V1 as a rollback path — rotation is deliberate.

Full list in `KNOWN_LIMITATIONS.md`.

---

*QuestLock · Base Sepolia · Proof over hype.*
