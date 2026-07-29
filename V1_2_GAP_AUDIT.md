# QuestLock v1.2 — Gap Audit

**Branch:** `feature/v12-gap-audit` (local only — not pushed)
**Baseline:** v1.1.4 at `ed9cfbc`
**Production:** https://quest-lock.vercel.app
**Reference sources:** Original Build PDF, Brand/UI PDF, current code, `LAUNCH_PACKAGE.md`, `RELEASE_NOTES_v1.1.md`, `README.md`

**Status legend:** ✅ Done · 🟡 Partial · ⛔ Missing · 🔁 Changed intentionally · ⏸ Deferred with reason · 🧭 Needs owner decision

---

## A. Product positioning

| Item | Status | Notes |
|---|---|---|
| "Proof-powered" positioning | ✅ | Landing tagline + README + LAUNCH_PACKAGE all consistent |
| Non-AI wording across UI/docs | ✅ | No "AI/LLM" copy anywhere; verified by grep |
| Deterministic proof engine | ✅ | 10-check scoring rubric, configurable per quest |
| Public-safe attestations (EAS) | ✅ | Schema live, attestations posted, EASScan links surfaced |
| Onchain reward enforcement | ✅ | `submitAndApprove` + `claimRewardFor` + score floor + maxClaims |
| Gasless user claim UX | 🔁 | Verifier-sponsored instead of Gelato Relay — copy already updated. Spec accepted this as v1.2 wording too |
| Anti-farm integrity | ✅ | Dup-repo, dup-demo, dup-username, risk bands; tested |
| Sponsor readiness | 🟡 | Sponsors can request + see status; **cannot fund their own pool** — this is the v1.2 product gap |

---

## B. Network / tooling

| Item | Status | Notes |
|---|---|---|
| Base Sepolia only | ✅ | Chain ID 84532; no mainnet, no multi-chain |
| Next.js 15 | ✅ | App Router, server components + route handlers |
| TypeScript strict | ✅ | `tsc --noEmit` is the lint gate |
| Tailwind | ✅ | v3.4, warm brown palette per brand PDF |
| Privy (email + Google + wallet) | ✅ | Email/Google bootstrap embedded wallet automatically |
| wagmi + viem | ✅ | wagmi v2.x, viem v2.x |
| Supabase Postgres + Prisma | ✅ | 5 migrations applied, pooler for runtime, DIRECT_URL for migrate |
| Hardhat 3 | ✅ | v3.7 with toolbox-mocha-ethers |
| OpenZeppelin contracts | ✅ | v5, AccessControl + Pausable + ReentrancyGuard + SafeERC20 + ERC1155Supply |
| EAS attestations | ✅ | Pure-ethers integration (SDK had lodash-es ESM conflict) |
| Verifier-sponsored claim | ✅ | Replaces Gelato; documented in README and copy fixed |
| npm only | ✅ | package-lock.json present, no pnpm/yarn lockfiles |

---

## C. Contracts

| Item | Status | Notes |
|---|---|---|
| `QuestLockCore` (`0xCCe5…E782C`) | ✅ | Live on Base Sepolia |
| `QuestRewardToken` (`0x1542…3054`) | ✅ | Live; 1,000,000 QUEST minted to deployer |
| `QuestBadge` (`0x1010…0bBAe`) | ✅ | Soulbound ERC-1155 |
| Roles: `DEFAULT_ADMIN_ROLE`, `QUEST_CREATOR_ROLE`, `VERIFIER_ROLE`, `PAUSER_ROLE` | ✅ | All granted to deployer/admin; VERIFIER_ROLE on verifier wallet |
| **Shared-pool limitation** | ⛔ | All quests draw from `QuestLockCore.balanceOf(QUEST)` — one quest can drain another's allocation. **This is the v1.2 gap.** |
| `maxClaims` / `rewardAmount` model | ✅ | Per-quest in struct, but funding is global |
| `claimRewardFor(questId, user)` path | ✅ | Verifier signs and pays |
| `submitAndApprove(questId, user, proofHash, attestationUID, score)` path | ✅ | Atomic submit + approve |
| Per-quest funding possible without new contract | ⛔ | Storage is shared; no per-quest balance fields in current contract |
| Unused funds withdrawable today | ⛔ | No `withdraw*` function exists in deployed contract |
| Per-quest sponsor funding requires V2 | 🧭 | **Needs owner decision** — proposed in V1_2_ARCHITECTURE_PLAN.md (Option C recommended) |
| Old quest compatibility | 🧭 | Recommended: keep legacy quests on v1 contract; only new sponsor-funded quests on v2 |
| Setting per-token URI on `QuestBadge` | ✅ | Admin can call `setTokenURI`; no redeploy needed for badge metadata polish |

---

## D. Backend

| Item | Status | Notes |
|---|---|---|
| GitHub proof service (`lib/github.ts`) | ✅ | v1.1 hardened (authorship, package mgr, retry) |
| Demo URL service (`lib/demo-url.ts`) | ✅ | Retry on transient failures |
| Scoring service (`lib/scoring.ts`) | ✅ | 10-check rubric, 100-point ceiling preserved |
| Anti-farm service (`lib/antifarm.ts`) | ✅ | Hashed identifiers, risk bands |
| Proof hash service (`lib/proof-hash.ts`) | ✅ | Deterministic SHA-256 |
| EAS service (`lib/eas.ts`) | ✅ | Pure ethers |
| Approval service (`lib/approval.ts`) | ✅ | Atomic `submitAndApprove` via verifier |
| Event indexer (`lib/event-indexer.ts`) | 🟡 | Function exists; only triggered manually via `POST /api/indexer` — **needs scheduled cron** |
| Logger (`lib/logger.ts`) | ✅ | Writes to `system_logs` |
| Analytics (`lib/analytics.ts`) | ✅ | v1.1.3 added `computePoolCoverage`; v1.2 needs sponsor-funded analytics too |
| Rate limits (`lib/rate-limit.ts`) | 🟡 | In-process only; **needs durable Supabase-backed limiter** for serverless |
| GitHub OAuth (`lib/github-oauth.ts`) | ✅ | HMAC-signed state, server-only token |
| Public proof whitelist (`lib/public-proof.ts`) | ✅ | 18 whitelisted fields, tested |
| Appeals (`lib/appeal-approve.ts`) | ✅ | MANUAL_REVIEW risk band, reuses `submitAndApprove` |
| Quest requests (`lib/quest-publish.ts`) | 🟡 | Calls `createQuest` only — **no funding step** when published |
| Creator guard (`lib/creator-guard.ts`) | ✅ | Case-insensitive, tested |
| Pool top-up (`lib/pool-topup.ts`) | ✅ | v1.1.4 admin shared-pool top-up |
| Admin routes (`app/api/ops-ql/*`) | ✅ | Quests, submissions, system-status, analytics, quest-requests, appeals |
| **Sponsor routes** | ⛔ | No `/api/sponsor/*` routes; sponsors can only see their requests via `/api/quest-requests` |
| **Proof adapter abstraction** | ⛔ | All proof logic is GitHub-specific in `/api/proof/submit`. New proof types need a refactor |
| Discord OAuth + proof | ⛔ | Not built |
| X / Twitter proof | ⛔ | Not built |
| LMS course proof | ⛔ | Not built |
| Manual project proof | ⛔ | Not built (appeals are an admin override of failed scoring, not a manual proof type) |
| Notifications service | ⛔ | Not built |
| Quest templates | ⛔ | Not built |
| Leaderboard query | ⛔ | Not built |
| Admin retry actions | ⛔ | No retry button for attestation/approval/indexer failures |

---

## E. Database

| Table / Field | Status | Notes |
|---|---|---|
| `users` | ✅ | id, wallet_address, github_username, GitHub OAuth fields |
| `users.discord_*` | ⛔ | Or could be separate `discord_connections` |
| `users.x_handle`, `users.x_*` | ⛔ | TBD whether stored on user or just on submission |
| `quests` | ✅ | Includes `sponsor_wallet` (v1.1.4) |
| `quests.contract_version` | ⛔ | Needed to route claims to V1 vs V2 contract |
| `quests.funded_quest_id` | ⛔ | onchain id on V2 (legacy quests keep `onchain_quest_id`) |
| `quests.funding_token_address` | ⛔ | Already have `reward_token_address` but no enforcement that funding exists |
| `quests.required_funding` / `funded_amount` / `claimed_amount_onchain` / `withdrawn_amount` | ⛔ | All new fields for v1.2 sponsor-funded quests |
| `quests.funding_status` | ⛔ | `UNFUNDED | PARTIALLY_FUNDED | FUNDED | UNDERFUNDED | EXPIRED | CLOSED | REFUNDED | PAUSED` |
| `quests.proof_type` | 🟡 | Field exists (`quest_type` defaults to `github_project`) but no adapter dispatch yet |
| `submissions` | ✅ | composite unique (quest_id, wallet_address) |
| `submissions.proof_type` | ⛔ | Currently inferred from quest; should be explicit per-submission |
| `submissions.evidence_json` | ⛔ | Generic field to store adapter-specific evidence |
| `proof_checks` | ✅ | Per-check records |
| `duplicate_index` | ✅ | Used for repo/demo/username dedupe |
| `contract_events` | ✅ | Used by indexer (manual run only today) |
| `system_logs` | ✅ | Logger output |
| `quest_requests` | ✅ | v1.1 lifecycle |
| `quest_requests.required_funding` / `funded_amount` | ⛔ | Sponsor needs to fund before publish in v1.2 |
| `submission_appeals` | ✅ | v1.1 manual review |
| `rate_limit_buckets` | ⛔ | New table for durable rate limiting |
| `notifications` | ⛔ | New table |
| `discord_connections` (or fields) | ⛔ | New |
| `quest_templates` | ⛔ | New |
| `proof_adapter_runs` (optional) | 🟡 | Could fold into existing `submissions` |
| `funding_events` (optional) | 🟡 | Could be derived from `contract_events` on V2 |

---

## F. Frontend

| Page / Component | Status | Notes |
|---|---|---|
| `/` landing | ✅ | Updated copy in v1.1.1 |
| `/quests` | ✅ | Marketplace; no legacy-vs-funded label yet |
| `/quests/[id]` | ✅ | Includes CreatorGuardNotice (v1.1.4) |
| `/submit/[questId]` | ✅ | Includes AppealCTA + GaslessClaimButton |
| `/me` profile | ✅ | Includes GithubConnectCard |
| `/proof/[id]` public certificate | ✅ | Whitelisted; **only supports github_project shape today** |
| `/create` sponsor request | ✅ | Form + own-requests list; **no funding step yet** |
| `/ops-ql` admin dashboard | ✅ | Quests / Submissions / Create / System tabs |
| `/ops-ql/quest-requests` | ✅ | Approve / Reject / Publish |
| `/ops-ql/appeals` | ✅ | Approve / Reject (MANUAL_REVIEW path) |
| `/ops-ql/analytics` | ✅ | Global tiles + per-quest + RewardPoolTopUp (v1.1.4) + Pool Coverage (v1.1.3) |
| `/ops-ql/submissions/[id]` | ✅ | Per-submission inspection |
| **Sponsor dashboard** (`/sponsor/*`) | ⛔ | Not built |
| **Leaderboard** (`/leaderboard`) | ⛔ | Not built |
| **Multi-proof submit UI** | ⛔ | Form is GitHub-only |
| **Notification bell + list** | ⛔ | Not built |
| **Funded-quest funding panel** | ⛔ | Not built |
| **Quest templates picker** | ⛔ | Not built |
| **Quest detail "Funded / Legacy" label** | ⛔ | Needs flag from API |
| Admin retry buttons | ⛔ | No retry UI for failed attestation/approval/indexer |

---

## G. Proof types

| Proof type | Status | Notes |
|---|---|---|
| `github_project` | ✅ | Full pipeline working with v1.1 hardening |
| `manual_project` | ⛔ | Not built; admin appeals are not a substitute |
| `discord_role` | ⛔ | Needs Discord OAuth + guild API |
| `x_post` | ⛔ | Needs URL validation + (optional) X API; manual-review fallback acceptable per brief |
| `lms_course` | ⛔ | Mostly manual-review path |

---

## H. Public safety

| Item | Status | Notes |
|---|---|---|
| Public proof page whitelist | ✅ | Enforced in code + asserted by tests |
| No raw GitHub data | ✅ | API response audited |
| No admin notes | ✅ | Not in whitelist |
| No anti-farm internals | ✅ | Only `risk_band` bucket exposed |
| No private logs | ✅ | `system_logs` admin-only |
| No private explanations | ✅ | `submissions.explanation` not in public payload |
| No secrets | ✅ | `.env` gitignored; only `process.env` reads; no `NEXT_PUBLIC_` on secrets |
| **Whitelist for new proof types** | 🧭 | Each new adapter must define its own public-safe payload (`buildPublicProofPayload`) |

---

## I. Admin / sponsor operations

| Item | Status | Notes |
|---|---|---|
| Admin quest creation (`/ops-ql` Create tab) | ✅ | Direct admin path bypassing requests |
| Admin shared-pool top-up | ✅ | v1.1.4 wallet-signed |
| Sponsor quest request submission | ✅ | `/create` |
| **Sponsor funding own quest** | ⛔ | No funding flow today — sponsor cannot fund |
| **Sponsor analytics** | ⛔ | Sponsors see only request status; no per-quest analytics |
| **Sponsor dashboard** | ⛔ | Not built |
| Manual review (appeals) | ✅ | v1.1 appeals work |
| Retry controls | ⛔ | Admin must re-run from scratch on failures |
| System health (`/api/health` + System tab) | ✅ | v1.1 ops hardening |
| Verifier balance check | 🟡 | Not surfaced in UI; admin uses Blockscout |
| Indexer status (last block / last event) | ✅ | System tab shows it |
| Rate-limit status | 🟡 | Not surfaced; in-process so per-instance |

---

## J. Docs

| Doc | Status | Notes |
|---|---|---|
| `README.md` | ✅ | Updated through v1.1.4 |
| `docs/DEPLOYMENT.md` | ✅ | Production env table updated in v1.1.1 |
| `LAUNCH_PACKAGE.md` | ✅ | v1.1.2 launch package |
| `RELEASE_NOTES_v1.1.md` | ✅ | Covers v1.1.0 |
| `KNOWN_LIMITATIONS.md` (standalone) | ⛔ | Limitations live inside README — not a separate file |
| `V1_2_GAP_AUDIT.md` | ✅ | (this file) |
| `V1_2_ARCHITECTURE_PLAN.md` | 🟡 | Drafted in parallel — see file |
| Demo script | ✅ | In LAUNCH_PACKAGE.md |
| X post draft | ✅ | In LAUNCH_PACKAGE.md |
| Screenshots checklist | ⛔ | Not started |

---

## Cross-cutting risk + decision summary

### Single biggest product gap
**Shared-pool funding model.** Today one quest can drain another quest's allocation. This is the v1.2 keystone — without it, QuestLock is not "sponsor-ready". Every other v1.2 feature (sponsor dashboard, funding analytics, withdrawal) depends on per-quest funded balances existing.

### Owner decisions required before v1.2 coding begins

| # | Decision | Recommendation |
|---|---|---|
| 1 | Contract architecture: Option A, B, or C | **C — Hybrid** (legacy on v1, new sponsor-funded on V2). Safest. Zero risk to existing claims. |
| 2 | Deploy `QuestLockCoreV2` | **Yes**, after design review |
| 3 | Deploy a `QuestFundingVault` | **No** — folded into V2 to avoid cross-contract claim atomicity issues |
| 4 | EAS schema changes | **No change.** Existing schema covers all v1.2 proof types via the `proofType` field |
| 5 | New badge token IDs (5–9) | **Yes**, but no badge contract redeploy needed — use `setTokenURI` on existing badge contract |
| 6 | Reward token redeploy | **No** — same QUEST token for V1 and V2 |
| 7 | Discord OAuth app | **Yes**, needs you to register an app (similar to GitHub OAuth) |
| 8 | X / Twitter API | **No paid X API.** Use URL validation + manual-review fallback per the brief |
| 9 | New dependencies | **None planned** — Discord OAuth uses fetch; LMS / manual proof are pure form + admin review |
| 10 | Vercel Cron for indexer | **Yes**, free tier supports it; cron secret added via env |
| 11 | Sponsor-funded contract function set | See proposed list in V1_2_ARCHITECTURE_PLAN.md §16 |
| 12 | Quest template seeding | **Yes**, seed 5 templates as DB rows or as constants in code |

### Risks
- **R1 — Contract bug in V2.** Mitigation: full Hardhat test suite (sponsor-funded scenarios, withdrawal, reentrancy, role gating). Audit checklist in plan.
- **R2 — Legacy/v2 quest routing bug.** Mitigation: explicit `contract_version` column; frontend + backend route by that field; tests cover both paths.
- **R3 — Sponsor withdraws before all claimants finish.** Mitigation: contract blocks withdraw before `deadline` (or explicit close); only sponsor or admin can withdraw.
- **R4 — Discord/X API instability.** Mitigation: manual-review fallback always available; UI degrades gracefully.
- **R5 — Vercel cold-start rate-limit bypass.** Mitigation: durable Supabase-backed `rate_limit_buckets`.
- **R6 — Scope creep.** Mitigation: 19 feature branches in fixed implementation order, each ends with local commit only; no v1.3 work.

### What v1.2 explicitly will NOT do
- No AI / no GenLayer
- No mainnet
- No multi-chain / bridge
- No custom domain (separate phase)
- No new paid services
- No payment/fiat
- No mobile app

---

## Implementation feasibility check

| Feature batch | Effort | Blocker | Owner decision needed? |
|---|---|---|---|
| Contract design + deploy V2 | M | Architecture plan approval | ✅ |
| Sponsor-funded pools (DB + API + UI) | L | V2 deployed | — |
| Funding analytics | S | DB columns | — |
| Scheduled indexer | XS | Vercel Cron config | minor |
| Durable rate limits | S | DB table | — |
| Proof adapter system | M | Refactor `/api/proof/submit` | — |
| Manual proof | S | Adapter system | — |
| Discord proof | M | OAuth app | ✅ register app |
| X proof (manual-review fallback) | S | Adapter system | — |
| LMS proof | S | Adapter system | — |
| Quest templates | XS | None | — |
| Sponsor dashboard | M | Sponsor-funded pools live | — |
| Leaderboard | S | Public-safe query | — |
| Badge metadata polish | XS | `setTokenURI` admin call | — |
| Notifications | S | DB table + UI bell | — |
| Admin polish (retry buttons) | S | None | — |
| Certificate polish (multi-proof) | S | Adapter `buildPublicProofPayload` | — |
| Brand/UI polish | M | None | — |
| Final docs | S | All features done | — |

Estimated total: ~3 to 4 weeks of focused work across 19 branches.

---

## Acceptance: when this audit is "complete"

- [x] Every audit category A–J has a status mark for every item
- [x] Cross-cutting decisions table populated with recommendations
- [x] Risks enumerated with mitigations
- [x] Implementation order matches the brief
- [x] Owner-decision list populated and flagged

**Next:** Read `V1_2_ARCHITECTURE_PLAN.md` for the proposed contract + system design. Approve or request changes. Only then will any v1.2 coding start.
