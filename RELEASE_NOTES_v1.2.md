# QuestLock v1.2 — Sponsor-Funded Multi-Proof Release

> Base Sepolia · 2026-06 · Proof over hype.

## TL;DR

v1.2 turns QuestLock from a shared-pool single-proof platform into a **per-quest funded, multi-proof** platform. Sponsors fund their own quest. Builders prove their work in one of five formats. Everything else (deterministic checks, EAS attestations, verifier-signed gasless claims, soulbound badges, anti-farm, appeals) is unchanged from v1.1.

## What's new

### 1. QuestLockCoreV2 — per-quest funded pool

| Address (Base Sepolia) | `0xDDC0024E76C2bEC64F6f7785e232E7Ce11b0A282` |
|---|---|
| Solidity | 0.8.28 with `viaIR: true` |
| Roles | `DEFAULT_ADMIN_ROLE`, `VERIFIER_ROLE`, `PAUSER_ROLE` |

Each quest carries its own funding state:

```
UNFUNDED → PARTIALLY_FUNDED → FUNDED → UNDERFUNDED → CLOSED / REFUNDED
```

`UNDERFUNDED` semantic (refined per owner approval): a quest is UNDERFUNDED only when **remaining funds < single reward amount** — so a partial top-up that still covers the next claim does NOT flag UNDERFUNDED.

Key functions:

- `createFundedQuest(...)` — admin/sponsor creates an unfunded quest; emits `FundedQuestCreated(onchainQuestId, requiredFunding)`
- `fundQuest(questId, amount)` / `topUpQuest(questId, amount)` — sponsor signs from their wallet
- `withdrawUnusedQuestFunds(questId)` — sponsor or admin reclaims unused funds after deadline
- `closeQuest(questId)` — terminal; blocks new submissions + claims, allows immediate withdrawal
- `pauseQuest(questId)` / `unpauseQuest(questId)` — `PAUSER_ROLE` only
- `submitAndApprove(...)` / `claimReward(...)` — same shape as V1, atomic, verifier-signed

63 hardhat tests cover the full funding state machine, cross-quest isolation, withdrawal preconditions, pause/close terminals, and accounting invariants (`withdrawn + claimed ≤ funded`).

### 2. Contract-version routing

Every existing v1 quest stays on `QuestLockCore` (v1). New quests created via the v1.2 sponsor flow route to V2. The router lives in `lib/contracts.ts#coreAddressFor(contractVersion)`. Approval (`lib/approval.ts`) and funding endpoints both consume it.

`quests.contract_version` (default `1`) is the source of truth.

### 3. Five proof adapters

| Adapter | Source | Auto-approve | Manual review |
|---|---|---|---|
| `github_project` | GitHub REST API | ✓ (deterministic) | only via appeal |
| `manual_project` | sponsor-described work | ✗ | always |
| `discord_role` | Discord guild API | ✓ when `DISCORD_BOT_TOKEN` set, else manual | conditional |
| `x_post` | URL + handle parse | ✗ | always (no paid X API) |
| `lms_course` | course certificate URL | ✗ | always |

All implement the `ProofAdapter` interface in `lib/adapters/types.ts`. The registry (`lib/adapters/registry.ts`) dispatches by `quest.proof_type`. GitHub flow is wrapped without behaviour change — existing v1.1 scoring and anti-farm logic untouched.

### 4. Sponsor dashboard

- `/sponsor` — lists quests where the connected wallet is `sponsor_wallet`. Funding-status chip per row.
- `/sponsor/quests/[id]` — fund / top up / withdraw unused / close. **All transactions signed by the sponsor's connected wallet via wagmi `useWriteContract`.** No backend keys touch sponsor funds.

### 5. Public leaderboard

- `/leaderboard` — public, proof-backed. Only `CLAIMED` submissions count. Shows GitHub handle if linked, Discord handle if linked, completed quest count, average score.
- API: `GET /api/leaderboard`

### 6. In-app notifications

- New `notifications` table (wallet, type, title, message, metadata, read_at).
- Bell in Navbar polls `GET /api/notifications?wallet=…` every 30s.
- `POST /api/notifications` marks one (with `id`) or all (without `id`) read.
- Helper `lib/notify.ts#notify()` is non-blocking — write a notification from any backend path without awaiting.

### 7. Quest templates

Five templates seeded via `prisma/seed.ts` (upsert by `key`, so re-seeding is safe):

| Key | Proof type | Default reward |
|---|---|---|
| `github_builder_quest` | github_project | 10 QUEST |
| `manual_project_quest` | manual_project | 10 QUEST |
| `discord_role_quest`   | discord_role   | 5 QUEST  |
| `x_post_quest`         | x_post         | 2 QUEST  |
| `lms_course_quest`     | lms_course     | 8 QUEST  |

Each carries `requirements_json`, `scoring_rubric_json`, `suggested_copy_json`, and sensible defaults for badge / min score / max claims / deadline. Exposed via `GET /api/templates`.

### 8. Adapter-aware `/proof/[id]`

The public certificate page now dispatches by `proof_type` and renders a per-type "Submitted Work" section. Field whitelist is enforced in `lib/public-proof.ts#EVIDENCE_PUBLIC_KEYS` — anything not on the list is dropped. Explanation, raw GitHub API blob, admin notes, and OAuth tokens never reach the public payload.

### 9. Admin Retry Centre

- `/ops-ql/retry` (admin-wallet gated) with four idempotent ops:
  1. **Indexer** — single button, re-runs `indexContractEvents()`
  2. **Proof check (github_project only)** — re-fetches evidence, re-scores, replaces `proof_checks`
  3. **Attestation** — re-issues EAS for any submission with `proof_hash` but no UID
  4. **Onchain approval** — re-runs `submitAndApprove` for any attested submission without a tx hash
- Endpoints at `POST /api/admin/retry/[op]` and queue feed at `GET /api/admin/retry/queue`.
- Each op short-circuits when the target field is already populated — accidental double-clicks return `{ ok: true, skipped: true }`.

### 10. Discord OAuth scaffold

- `discord_connections` table (one row per wallet, unique discord_id).
- HMAC-signed state cookies mirroring the GitHub OAuth pattern.
- `POST /api/auth/discord/start` → Discord OAuth → `GET /api/auth/discord/callback`.
- `GET /api/auth/discord/status?wallet=` reports link state. `POST /api/auth/discord/disconnect` clears it.
- Required for `discord_role` proofs.

### 11. Durable rate limits

- `rate_limit_buckets` table (`key, route, window_start, window_seconds, count, limit`) with `@@unique([key, route, window_start])`.
- `lib/rate-limit.ts#rateLimitDurable()` uses Supabase first, falls back to the in-process limiter on DB error.

### 12. Scheduled indexer

- External cron service (cron-job.org or similar) hits `/api/indexer` with the `x-indexer-secret` header on whatever interval the operator chooses.
- Vercel native cron was attempted but removed — the Hobby tier caps native cron at one run per day, too coarse for fresh event indexing. The Retry Centre also exposes a manual "Run indexer now" button for on-demand catch-up.

## Verification (this release)

```
npm run typecheck        ✓ clean
npm test                 ✓ 85/85  (13 suites)
npm run test:contracts   ✓ 63/63  (hardhat 3, V2 funded-pool + state machine)
npm run build            ✓ all routes compiled
npx hardhat compile      ✓ V2 builds with viaIR
```

## Migration & rollback safety

- Migration is **additive only** — no column dropped, no constraint changed, no FK retargeted.
- All new `quests` rows default to `contract_version = 1` so legacy code paths still work unchanged for any quest created before v1.2 routing was enabled.
- Old verifier wallet retains `VERIFIER_ROLE` on V1 as a deliberate rollback path.
- V1 contract is **not** redeployed and **not** modified.
- EAS schema is **unchanged** — v1 and v1.2 attestations live side by side.

## Files of interest

```
contracts/QuestLockCoreV2.sol
lib/contracts.ts                       # coreAddressFor() router
lib/approval.ts                        # routes V1/V2 verifier calls
lib/quest-publish-v2.ts                # createFundedQuest publisher
lib/adapters/{types,registry,...}.ts   # proof adapter system
lib/notify.ts                          # non-blocking notification writer
lib/discord-oauth.ts                   # HMAC state + token exchange
lib/rate-limit.ts                      # durable + in-process limiter
components/SponsorFundingPanel.tsx     # wallet-signed fund/topup/withdraw/close
components/NotificationBell.tsx        # navbar bell
app/sponsor/**                         # sponsor dashboard
app/leaderboard/page.tsx               # public leaderboard
app/ops-ql/retry/page.tsx              # retry centre
app/api/admin/retry/[op]/route.ts
app/api/proof/multi/route.ts           # non-github adapter dispatch
app/api/quests/[id]/funding/route.ts   # live funding state
prisma/migrations/20260605000000_v12_sponsor_funded/migration.sql
prisma/seed.ts                         # quest templates upsert
app/api/indexer/route.ts               # x-indexer-secret authed; called by external cron
```

## Out of scope (deliberately, per brief)

No GitHub push from this release. No Vercel touch. No mainnet. No AI. No GenLayer. No multi-chain. No paid X API. No bridge.
