# QuestLock v1.2 — Architecture Plan

**Branch lineage (local only — none pushed):**
`feature/v12-gap-audit` → `feature/sponsor-funded-contract-design` → `feature/verifier-key-rotation-plan`
**Baseline:** v1.1.4 at `ed9cfbc`
**Status:** Phase 0 (audit) approved. Phase 1 (contract design) approved.
**Next gate:** verifier key rotation plan + V2 deployment authorisation.

### Revision history
- 2026-06-04 — Initial draft (`feature/v12-gap-audit`)
- 2026-06-05 — Reflects Phase 1 outcomes:
  - `viaIR: true` enabled for local compile (approved)
  - `UNDERFUNDED` semantic refined (approved)
  - V2 contract test count finalised at 45 (63 total contract tests)
  - Deployment explicitly blocked pending verifier key rotation + owner approval

---

## 1. Executive summary

QuestLock v1.2 turns the platform into a true sponsor-ready product by introducing **per-quest funded reward pools** alongside the existing shared-pool model. The biggest gap in v1.1.4 is that a single shared `QuestLockCore` balance backs every quest, so one quest can drain another quest's allocation. v1.2 fixes this with a new `QuestLockCoreV2` contract that holds funds **earmarked per quest**, plus a frontend/backend that routes claims to the correct contract by quest version.

In parallel, v1.2 ships the rest of the planned product surface: four new proof types (manual, Discord, X, LMS) behind a clean adapter abstraction, a sponsor dashboard, a public leaderboard, in-app notifications, scheduled indexer, durable rate limits, quest templates, polished badge metadata, certificate templates for every proof type, brand polish across new surfaces, and complete docs.

**Zero changes to existing deployed contracts.** v1 quests continue to work exactly as today. Only new sponsor-funded quests target V2.

---

## 2. Current v1.1.4 architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15)                                           │
│    /quests · /me · /create · /ops-ql/*                           │
│         │                                                         │
│         ▼                                                         │
│  API routes (Next.js)                                            │
│    /api/proof/submit  ─── GitHub-only ─── /api/relay/claim       │
│         │                                                         │
│         ▼                                                         │
│  Verifier wallet (server-side)                                   │
│         │                                                         │
│         ▼                                                         │
│  QuestLockCore  ◄── one shared QUEST balance ──►  QuestBadge     │
│  (0xCCe5…E782C)                                  (0x1010…0bBAe)  │
│         │                                                         │
│         └──► EAS (0x4200…0021) Schema 0x3c9b…40a6                │
└──────────────────────────────────────────────────────────────────┘
```

Single contract. Single token. One proof type. One global pool. Admin tops up pool from dashboard.

---

## 3. What changes in v1.2

### Contracts
- **New:** `QuestLockCoreV2` deployed alongside the existing core. Per-quest funded pools. Self-contained: funding + approval + claim + withdrawal.
- **No change** to deployed `QuestLockCore`, `QuestRewardToken`, `QuestBadge`, EAS schema.

### Database
- New columns on `quests`: `contract_version`, `funded_quest_id`, `funding_status`, `funded_amount`, `claimed_amount_onchain`, `withdrawn_amount`, `required_funding`.
- New columns on `submissions`: `proof_type`, `evidence_json`.
- New tables: `rate_limit_buckets`, `notifications`, `quest_templates`, `discord_connections` (or fields on `users`).

### Backend
- **Proof adapter layer.** `/api/proof/submit` becomes a dispatcher that picks an adapter by quest's `proof_type`. GitHub adapter is the v1 logic moved behind the interface (no behaviour change).
- **Sponsor API.** `/api/sponsor/*` scoped strictly to the connected wallet.
- **Funding API.** `/api/quests/[id]/fund | topup | withdraw` (wallet-signed, no backend keys).
- **Discord OAuth.** Mirrors GitHub OAuth (HMAC state, server-only token, immediate discard).
- **Durable rate limits.** Wraps existing in-process limiter with a DB-backed bucket.
- **Scheduled indexer.** Vercel Cron hits `/api/indexer` with a cron-only secret.

### Frontend
- New routes: `/sponsor/*`, `/leaderboard`.
- New components: SponsorDashboardCard, FundingPanel, NotificationBell, MultiProofSubmitForm (or per-type forms), QuestTemplatePicker.
- Existing `/quests`, `/quests/[id]`, `/proof/[id]` learn to display funded-vs-legacy.
- Submit flow branches by adapter.

---

## 4. What stays unchanged

- `QuestLockCore`, `QuestRewardToken`, `QuestBadge` contracts at their existing addresses.
- EAS schema UID `0x3c9b…40a6`.
- v1.1.4 proof-to-claim flow for the two existing legacy quests.
- Admin wallet, verifier wallet, deployer wallet, all roles.
- The 10-check GitHub scoring rubric (preserved as `github_project` adapter).
- Existing public certificate page logic for v1 submissions.
- Existing tests (18 contract + 78 backend) — all must still pass after v1.2.
- Privy, wagmi, viem, Prisma, Supabase, Hardhat, OpenZeppelin, Next.js versions.
- No new runtime dependency added.

---

## 5. Contract architecture options

### Option A — `QuestLockCoreV2` with native per-quest funding (replaces v1)
- One contract holds all per-quest balances.
- All v1.2 quests created on V2.
- Legacy quests migrated to V2 or left orphaned on V1.

**Pros:** Single source of truth; clean storage.
**Cons:** Either forces migration (risky) or leaves legacy quests unsupported by new UI logic.

### Option B — Separate `QuestFundingVault` + existing `QuestLockCore`
- V1 contract unchanged.
- New `QuestFundingVault` holds per-quest sponsor funds keyed by `(coreAddress, questId)`.
- Claims atomically: V1 contract approves + emits, then Vault releases QUEST to user.

**Pros:** Preserves v1 contract.
**Cons:** Atomicity is fragile. Today `claimReward` does `safeTransfer` + `badge.mint` atomically inside one `nonReentrant` call. Splitting QUEST transfer out of the core means either (a) V1 contract needs a new function that calls the vault — but V1 is immutable; or (b) the claim becomes a two-tx flow which is harder to make safe.

### Option C — Hybrid (recommended) ✅
- V1 contracts stay untouched. Legacy quests keep working on V1.
- New `QuestLockCoreV2` is a self-contained contract (same shape as V1 but with per-quest funded balances + funding/withdrawal functions).
- Each new sponsor-funded quest is created **on V2 only**.
- Database column `quests.contract_version` (1 | 2) tells the frontend + backend which contract address to use for that quest.
- Verifier wallet gets `VERIFIER_ROLE` on both V1 and V2. Same wallet, two role grants.
- Same QUEST token, same badge contract. No new token, no new badge.

**Pros:** Zero risk to existing claims. Each contract is internally atomic. Simple routing by version field. Both proof flows can ship in parallel.
**Cons:** Two contracts for the verifier to track (mitigated by config-driven address selection).

---

## 6. Recommended contract architecture

**Option C — Hybrid.** Your stated preference matches the safest path. Detailed below.

---

## 7. Why Option C is safest

1. **Zero behaviour change for existing v1 quests.** Their claim path is byte-identical.
2. **No state migration.** No re-funding old quests onto a new contract.
3. **Atomicity preserved.** V2's `claimRewardFor` does `safeTransfer` from per-quest balance + `badge.mint` inside one `nonReentrant` call — same shape as V1.
4. **Compositional simplicity.** V2 is V1 + per-quest funding storage. No cross-contract coordination.
5. **Easy rollback.** If V2 ever needs a fix, redeploy V2 only; V1 is untouched.
6. **Audit-friendly.** V2 reuses V1's role model + OpenZeppelin imports. Test suite extends rather than replaces.
7. **Operational simplicity.** Verifier wallet only needs two role grants. Admin/sponsor tools route by `contract_version`.

---

## 8. Legacy quest compatibility strategy

| Aspect | Legacy (v1) quests | New (v2) quests |
|---|---|---|
| Contract | `QuestLockCore` `0xCCe5…E782C` | `QuestLockCoreV2` (new address) |
| Funding model | Shared `QuestLockCore.balanceOf(QUEST)` | Per-quest `fundedAmount[questId]` |
| `quests.contract_version` | 1 | 2 |
| `quests.onchain_quest_id` | Existing IDs (1, 2) | Used for V1 only |
| `quests.funded_quest_id` | NULL | New IDs on V2 |
| Frontend label | "Shared pool" badge | "Sponsor-funded" badge |
| Funding UI | Admin pool top-up only (existing) | Sponsor + admin per-quest funding |
| Withdrawal | Not supported | Sponsor can withdraw unused after deadline |
| Claim path | Existing `claimRewardFor` on V1 | New `claimRewardFor` on V2 |
| Analytics | Pool coverage (existing) | Per-quest funded coverage |
| Quest creation route | Admin direct on `/ops-ql` | Sponsor request → admin approve → admin or sponsor funds → publish on V2 |

Two legacy quests exist today (onchain IDs 1 and 2). They keep working. New sponsor-funded quests go onto V2 from day one.

---

## 9. New sponsor-funded quest flow

```
1. Sponsor creates request at /create
   └── quest_requests row, status=PENDING_REVIEW, contract_version=2

2. Admin reviews at /ops-ql/quest-requests
   ├── Reject → REJECTED
   └── Approve offchain → APPROVED (no gas yet)

3. Admin publishes on-chain (creates quest on V2, unfunded)
   ├── V2.createQuest(...) returns funded_quest_id
   ├── quests row inserted with contract_version=2, funding_status=UNFUNDED
   └── quest_requests.status=PUBLISHED

4. Sponsor funds the quest
   ├── /sponsor/quests/[id] → "Fund quest" button
   ├── Browser-signed: QUEST.approve(V2, requiredFunding)
   ├── Browser-signed: V2.fundQuest(questId, amount)
   └── quests.funding_status flows UNFUNDED → PARTIALLY_FUNDED → FUNDED

5. Quest goes live on /quests once status=FUNDED (or admin can override)
```

---

## 10. Funding lifecycle

```
UNFUNDED ──fundQuest──► PARTIALLY_FUNDED ──fundQuest──► FUNDED
                                                          │
              ┌──── deadline passes ────────► EXPIRED ────┤
              │                                            ▼
              │                                       withdrawUnusedQuestFunds → REFUNDED
              │
              │ admin/sponsor closeQuest before deadline
              ▼
            CLOSED ──── withdrawUnusedQuestFunds ──► REFUNDED

(PAUSED state available via pauseQuest/unpauseQuest, blocks new claims)
```

Invariant: `fundedAmount >= claimedAmount + withdrawnAmount` at every state.

---

## 11. Claim lifecycle (V2)

Same shape as V1 but the QUEST transfer comes from the per-quest balance:

```
1. User submits proof via adapter
2. Backend scores → EAS attestation → V2.submitAndApprove (atomic submit + approve)
3. User clicks Claim → /api/relay/claim → verifier wallet calls V2.claimRewardFor(questId, user)
4. V2 checks:
   - submission.status == APPROVED
   - quest.active && !paused
   - fundedAmount - claimedAmount - withdrawnAmount >= rewardAmount   ← key v1.2 check
5. V2 deducts from per-quest balance, transfers QUEST, mints badge — all atomic
6. submission.status = CLAIMED, claimedAmount += rewardAmount
```

If funding is insufficient, claim reverts with a clear reason. Admin sees `funding_status=UNDERFUNDED` in analytics and can prompt sponsor to top up.

---

## 12. Withdrawal / refund lifecycle

```
Sponsor or admin calls V2.withdrawUnusedQuestFunds(questId, amount)
  ├── require msg.sender == quest.sponsor || hasRole(ADMIN_ROLE)
  ├── require quest is EXPIRED or CLOSED (or PAUSED + admin)
  ├── require amount <= (fundedAmount - claimedAmount - withdrawnAmount)
  ├── withdrawnAmount += amount
  ├── SafeERC20.safeTransfer(quest.sponsor, amount)
  └── emit UnusedFundsWithdrawn(questId, sponsor, amount)
```

Withdrawal is **always blocked** while the quest is active and before its deadline, no matter who calls it. This protects users mid-claim.

---

## 13. Contract roles (V2)

Same 4-role model as V1:
- `DEFAULT_ADMIN_ROLE` — emergency, role grants, can withdraw any quest
- `QUEST_CREATOR_ROLE` — `createFundedQuest`
- `VERIFIER_ROLE` — `submitAndApprove`, `submitProofHashFor`, `claimRewardFor`, `rejectSubmission`
- `PAUSER_ROLE` — `pauseQuest`, contract-wide `pause`

No new role types. Same OpenZeppelin AccessControl pattern.

---

## 14. Contract events (V2)

```solidity
event FundedQuestCreated(uint256 indexed questId, address indexed sponsor, address rewardToken, uint256 rewardAmount, uint256 maxClaims, uint256 deadline);
event QuestFunded(uint256 indexed questId, address indexed funder, uint256 amount, uint256 newFundedAmount);
event QuestToppedUp(uint256 indexed questId, address indexed funder, uint256 amount, uint256 newFundedAmount);
event QuestUnderfunded(uint256 indexed questId, uint256 fundedAmount, uint256 requiredFunding);
event RewardClaimed(uint256 indexed questId, address indexed user, uint256 rewardAmount, uint256 badgeId);
event UnusedFundsWithdrawn(uint256 indexed questId, address indexed to, uint256 amount);
event QuestClosed(uint256 indexed questId);
event QuestFundingStatusChanged(uint256 indexed questId, uint8 oldStatus, uint8 newStatus);
event ProofSubmitted(uint256 indexed questId, address indexed user, bytes32 proofHash);
event SubmissionApproved(uint256 indexed questId, address indexed user, bytes32 attestationUID, uint16 score);
event SubmissionRejected(uint256 indexed questId, address indexed user);
event QuestPaused(uint256 indexed questId);
```

Indexer subscribes to all of these.

---

## 15. Contract storage design (V2)

> **Implementation note (Phase 1):** `EXPIRED` is computed at the view layer from
> `block.timestamp > deadline` (not stored). `PAUSED` is reflected by the
> per-quest `bool active` (not a stored enum value). The stored `FundingStatus`
> enum therefore only holds funding-lifecycle values, which keeps the state
> machine deterministic and simpler.

```solidity
enum SubmissionStatus { NONE, SUBMITTED, APPROVED, REJECTED, CLAIMED }
// Stored values only. EXPIRED/PAUSED are derived at the view layer.
enum FundingStatus    { UNFUNDED, PARTIALLY_FUNDED, FUNDED, UNDERFUNDED, CLOSED, REFUNDED }

struct FundedQuest {
    uint256 id;
    address creator;       // QUEST_CREATOR_ROLE who called createFundedQuest
    address sponsor;       // wallet that owns withdrawal rights
    address rewardToken;
    uint256 rewardAmount;
    uint256 badgeId;
    uint256 startTime;
    uint256 deadline;
    uint256 maxClaims;
    uint256 totalClaims;
    uint16  minScore;
    bool    active;        // settable via pauseQuest/unpauseQuest

    // funding accounting
    uint256 requiredFunding;   // rewardAmount * maxClaims (computed at create)
    uint256 fundedAmount;      // total QUEST deposited
    uint256 claimedAmount;     // total QUEST paid out
    uint256 withdrawnAmount;   // total QUEST refunded to sponsor
    FundingStatus fundingStatus;
}

struct Submission {
    bytes32 proofHash;
    bytes32 attestationUID;
    uint16  score;
    SubmissionStatus status;
    uint256 submittedAt;
    uint256 reviewedAt;
    uint256 claimedAt;
}

mapping(uint256 => FundedQuest) public quests;
mapping(uint256 => mapping(address => Submission)) public submissions;
uint256 public questCount;
QuestBadge public immutable badgeContract;
```

Invariant: `quest.fundedAmount >= quest.claimedAmount + quest.withdrawnAmount`.

---

### 15a. Refined `FundingStatus` semantics (owner-approved)

| Status | When the contract sets it |
|---|---|
| `UNFUNDED` | `fundedAmount == 0` |
| `PARTIALLY_FUNDED` | `0 < fundedAmount < requiredFunding` **and** the quest can still pay at least one more claim (`remaining >= rewardAmount`). Operational. |
| `FUNDED` | `fundedAmount >= requiredFunding`. Sticky — stays `FUNDED` even after partial claims, as long as `remaining >= rewardAmount`. |
| `UNDERFUNDED` | `remaining < rewardAmount` with slots still open. **Cannot pay even one more claim.** Emits `QuestUnderfunded`. |
| `CLOSED` | Terminal. Sponsor or admin called `closeQuest`. |
| `REFUNDED` | Terminal. All funds returned to sponsor and no claims occurred. |

The key refinement vs. the original plan: an initial partial deposit (e.g. 20 / 50) is now `PARTIALLY_FUNDED`, not `UNDERFUNDED`. `UNDERFUNDED` is reserved for the post-claim drift case where the next claim would revert.

## 16. Contract function list (V2 — as implemented in Phase 1)

```solidity
// Creation
function createFundedQuest(address sponsor, address rewardToken, uint256 rewardAmount,
    uint256 badgeId, uint256 startTime, uint256 deadline, uint256 maxClaims, uint16 minScore)
    external onlyRole(QUEST_CREATOR_ROLE) returns (uint256 questId);

// Funding (anyone with QUEST can fund a quest the sponsor owns)
function fundQuest(uint256 questId, uint256 amount) external;
function topUpQuest(uint256 questId, uint256 amount) external; // alias for fundQuest after FUNDED

// Submission (unchanged shape from V1)
function submitProofHash(uint256 questId, bytes32 proofHash) external;
function submitProofHashFor(uint256 questId, address user, bytes32 proofHash) external onlyRole(VERIFIER_ROLE);
function submitAndApprove(uint256 questId, address user, bytes32 proofHash, bytes32 attestationUID, uint16 score) external onlyRole(VERIFIER_ROLE);
function approveSubmission(uint256 questId, address user, bytes32 proofHash, bytes32 attestationUID, uint16 score) external onlyRole(VERIFIER_ROLE);
function rejectSubmission(uint256 questId, address user) external onlyRole(VERIFIER_ROLE);

// Claim
function claimReward(uint256 questId) external nonReentrant;
function claimRewardFor(uint256 questId, address user) external onlyRole(VERIFIER_ROLE) nonReentrant;

// Sponsor / admin maintenance
function withdrawUnusedQuestFunds(uint256 questId, uint256 amount) external nonReentrant;
function closeQuest(uint256 questId) external;
function pauseQuest(uint256 questId) external onlyRole(PAUSER_ROLE);
function unpauseQuest(uint256 questId) external onlyRole(DEFAULT_ADMIN_ROLE);

// Reads
function getQuest(uint256 questId) external view returns (FundedQuest memory);
function getSubmission(uint256 questId, address user) external view returns (Submission memory);
function getQuestFunding(uint256 questId) external view returns (uint256 funded, uint256 claimed, uint256 withdrawn, uint256 remaining);
function getRemainingFunding(uint256 questId) external view returns (uint256);
function getClaimableCapacity(uint256 questId) external view returns (uint256); // how many more claims the funding allows
```

---

## 17. Database migration plan

### New migration: `20260605000000_v12_sponsor_funded`

```sql
-- quests: per-quest funding accounting + contract version routing
ALTER TABLE "quests"
  ADD COLUMN "contract_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "funded_quest_id" BIGINT,
  ADD COLUMN "funding_status" TEXT NOT NULL DEFAULT 'LEGACY_SHARED',
  ADD COLUMN "required_funding" TEXT,
  ADD COLUMN "funded_amount" TEXT DEFAULT '0',
  ADD COLUMN "claimed_amount_onchain" TEXT DEFAULT '0',
  ADD COLUMN "withdrawn_amount" TEXT DEFAULT '0';

CREATE INDEX "quests_contract_version_idx" ON "quests"("contract_version");
CREATE INDEX "quests_funding_status_idx" ON "quests"("funding_status");

-- submissions: adapter dispatch + generic evidence
ALTER TABLE "submissions"
  ADD COLUMN "proof_type" TEXT NOT NULL DEFAULT 'github_project',
  ADD COLUMN "evidence_json" JSONB DEFAULT '{}';

-- quest_requests: funding before publish
ALTER TABLE "quest_requests"
  ADD COLUMN "required_funding" TEXT,
  ADD COLUMN "funded_amount" TEXT DEFAULT '0';

-- new table: rate_limit_buckets
CREATE TABLE "rate_limit_buckets" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "window_seconds" INTEGER NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "limit" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rate_limit_buckets_key_route_window_start_key" ON "rate_limit_buckets"("key", "route", "window_start");

-- new table: notifications
CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata_json" JSONB DEFAULT '{}',
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_wallet_address_read_at_idx" ON "notifications"("wallet_address", "read_at");

-- new table: discord_connections (separate so we can add revocation later)
CREATE TABLE "discord_connections" (
  "id" TEXT NOT NULL,
  "wallet_address" TEXT NOT NULL UNIQUE,
  "discord_id" TEXT NOT NULL UNIQUE,
  "discord_username" TEXT NOT NULL,
  "discord_avatar_url" TEXT,
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "discord_connections_pkey" PRIMARY KEY ("id")
);

-- new table: quest_templates (admin/sponsor-facing presets)
CREATE TABLE "quest_templates" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "proof_type" TEXT NOT NULL,
  "requirements_json" JSONB DEFAULT '{}',
  "scoring_rubric_json" JSONB DEFAULT '{}',
  "default_min_score" INTEGER NOT NULL DEFAULT 70,
  "default_badge_id" INTEGER NOT NULL DEFAULT 1,
  "default_reward_amount" TEXT NOT NULL DEFAULT '10',
  "default_max_claims" INTEGER NOT NULL DEFAULT 50,
  "default_deadline_days" INTEGER NOT NULL DEFAULT 30,
  "suggested_copy_json" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quest_templates_pkey" PRIMARY KEY ("id")
);
```

Backfill: existing 2 legacy quests get `contract_version=1`, `funding_status='LEGACY_SHARED'` (already the default).

---

## 18. API route changes

| Route | Status | Purpose |
|---|---|---|
| `POST /api/proof/submit` | refactor | Dispatch by `quest.proof_type` to the right adapter; same surface |
| `POST /api/proof/manual` | new | Manual project submission entry (could share `/submit` with type=manual) |
| `POST /api/proof/discord` | new | Discord role check + submission |
| `POST /api/proof/x` | new | X URL validation + submission (manual fallback) |
| `POST /api/proof/lms` | new | LMS course submission (manual review) |
| `POST /api/relay/claim` | extend | Route to V1 or V2 contract based on quest.contract_version |
| `POST /api/quests/[id]/fund` | new | Wallet-signed; validates sponsor or admin |
| `POST /api/quests/[id]/topup` | new | Same |
| `POST /api/quests/[id]/withdraw` | new | Sponsor or admin only; checks deadline/close state |
| `POST /api/quests/[id]/close` | new | Admin only |
| `POST /api/auth/discord/start | callback | status | disconnect` | new | Mirror GitHub OAuth |
| `GET  /api/sponsor/quests` | new | Quests owned by connected wallet |
| `GET  /api/sponsor/quests/[id]` | new | Full sponsor view of one quest |
| `GET  /api/sponsor/funding` | new | Funding summary across sponsor's quests |
| `GET  /api/sponsor/submissions` | new | Submissions to sponsor's quests |
| `GET  /api/leaderboard` | new | Public-safe ranking |
| `GET  /api/notifications` | new | List for connected wallet |
| `POST /api/notifications/mark-read` | new | Single or all |
| `GET  /api/templates` | new | List quest templates |
| `POST /api/ops-ql/retry/[submissionId]` | new | Admin retry for failed attestation / approval |
| `GET  /api/indexer` | extend | Accept cron-only secret via query param OR header |

All new admin routes follow the existing `x-wallet-address === ADMIN_WALLET_ADDRESS` pattern. All sponsor routes additionally check `sponsor_wallet` ownership.

---

## 19. Frontend route changes

| Route | Status | Purpose |
|---|---|---|
| `/` | extend | Mention sponsor-funded model (one sentence; avoid casino copy) |
| `/quests` | extend | Display funded-vs-legacy chip |
| `/quests/[id]` | extend | Show funding status if V2; "Connect GitHub" gate still applies |
| `/submit/[questId]` | extend | Branch by proof_type |
| `/me` | extend | Show Discord connection card alongside GitHub |
| `/proof/[id]` | extend | Per-type certificate body via adapter `buildPublicProofPayload` |
| `/create` | extend | Template picker + funding requirement preview |
| `/sponsor` | new | Sponsor home — list owned quests |
| `/sponsor/quests` | new | Full list with funding state |
| `/sponsor/quests/[id]` | new | Per-quest fund / top-up / withdraw + analytics |
| `/sponsor/requests` | new | Lifecycle status |
| `/sponsor/funding` | new | Cross-quest funding summary |
| `/leaderboard` | new | Public ranking |
| `/ops-ql` | extend | New tabs for Funded Quests, Sponsors, Retry Center |
| `/ops-ql/analytics` | extend | Sponsor-funded analytics block |

---

## 20. Admin flow changes

| Existing | New addition |
|---|---|
| Admin creates quest directly | Admin can also pick a template |
| Admin reviews quest requests | Admin sees required_funding + funded_amount before publish |
| Admin publishes → calls v1 `createQuest` | Admin publishes → calls V2 `createFundedQuest` (zero funding required to publish but quest is `UNFUNDED` until sponsor funds) |
| Admin shared-pool top-up (v1.1.4) | Still available; renamed contextually to "Legacy shared pool top-up" |
| Manual appeal approval | Unchanged for legacy; for V2 quests, calls V2's `submitAndApprove` |
| No retry buttons | New retry buttons in admin Retry Center for attestation/approval/indexer failures |
| No close/withdraw | Admin can force-close and withdraw on V2 quests |

---

## 21. Sponsor flow changes

| Today (v1.1.4) | v1.2 |
|---|---|
| Sponsor submits request at `/create` | Same |
| Sponsor sees status only | Sponsor lands on `/sponsor` after approval |
| Sponsor cannot fund | Sponsor funds via `/sponsor/quests/[id]` — wallet-signed `QUEST.approve` + `V2.fundQuest` |
| Sponsor cannot top up | Top-up button on the same page |
| Sponsor cannot withdraw | After deadline or admin-close, withdraw button releases unused QUEST back to sponsor wallet |
| No per-quest analytics for sponsor | Sponsor sees funding %, claims, conversion, top failure reasons (no admin notes / no anti-farm internals) |

---

## 22. Proof adapter design

```ts
export interface ProofAdapter<TInput, TEvidence, TResult> {
  proofType: string;                // "github_project" | "manual_project" | ...
  displayName: string;
  validateInput(input: TInput, ctx: SubmitContext): ValidationResult;
  fetchEvidence(input: TInput, ctx: SubmitContext): Promise<TEvidence>;
  scoreEvidence(evidence: TEvidence, quest: Quest, ctx: SubmitContext): Promise<ScoringResult>;
  buildPublicProofPayload(evidence: TEvidence, result: TResult): PublicProofPayload;
  buildPrivateProofPayload(evidence: TEvidence, result: TResult): unknown;  // stored on submission, never exposed
  getFailureReasons(result: TResult): string[];
  requiresManualReview(): boolean;
  supportsAutoApproval(): boolean;
}
```

Registry keyed by `proofType`. `/api/proof/submit` looks up the adapter from `quest.proof_type`, runs it, and writes the result to the existing `submissions` table (with `evidence_json` for adapter-specific payload).

GitHub adapter wraps the current v1.1 hardened logic verbatim — no behaviour change.

---

## 23. Proof type design (per type)

| Adapter | Auto-score? | Manual review? | Key checks |
|---|---|---|---|
| `github_project` | ✅ deterministic | only via appeal | Existing 10 checks |
| `manual_project` | ❌ | ✅ default | URL validity, explanation length, dup demo |
| `discord_role` | ✅ if Discord API permissions allow | ✅ fallback | Linked Discord, member of guild, has required role |
| `x_post` | 🟡 URL validation only | ✅ default in v1.2 | Valid URL, post ID parsed, required phrase/hashtag (manual confirms) |
| `lms_course` | ❌ | ✅ default | URL validity, dup certificate ID, explanation length |

---

## 24. EAS attestation strategy

**No schema change.** Existing schema already includes a `proofType` string field. Every adapter just passes its `proofType` value at attestation time:

- `github_project`
- `manual_project`
- `discord_role`
- `x_post`
- `lms_course`

`riskBand` keeps `LOW_RISK | MEDIUM_RISK | HIGH_RISK | MANUAL_REVIEW`.

Attestations issued the same way: pure-ethers call to EAS `0x4200…0021` on schema `0x3c9b…40a6`.

---

## 25. Public proof page changes

`/proof/[id]` becomes adapter-aware:

```
<HeroCertificate />  // unchanged
<OnchainVerification />  // unchanged (EAS + approval tx + claim tx)
<AdapterSpecificEvidence proofType={...} payload={publicPayload} />
<ProofChecksSummary />  // unchanged for github_project; hidden for manual
```

`AdapterSpecificEvidence` is a per-type renderer. GitHub shows the repo + demo + 10-check breakdown (current). Manual shows project title + demo + short summary. Discord shows guild + role. X shows post URL. LMS shows course + completion ID.

Whitelist enforcement stays in `lib/public-proof.ts` extended per type — each adapter contributes a `buildPublicProofPayload` and tests assert that no private field leaks.

---

## 26. Analytics strategy

`/ops-ql/analytics` adds a new block: **"Sponsor-funded quests"** alongside the existing legacy shared-pool block.

Per-quest analytics gain (when contract_version=2):
- funding model label
- required funding
- funded amount
- claimed amount
- remaining funded amount
- shortfall (required - funded, or 0)
- funding coverage % (funded / required)
- funding status

Sponsor dashboard mirrors per-quest analytics, scoped to that sponsor's quests only.

---

## 27. Notification strategy

Insert into `notifications` table at the same point each event fires:
- proof submitted → user
- proof passed / failed → user
- appeal submitted / approved / rejected → user
- claim available → user
- claim succeeded → user
- request submitted / approved / rejected / published → sponsor
- quest funded / underfunded → sponsor
- top-up needed → sponsor (when funding coverage < 100% after a claim)
- unused funds withdrawn → sponsor

UI: bell icon in Navbar with unread count; `/me` shows full list. No email in v1.2.

---

## 28. Indexer strategy

Vercel Cron entry in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/indexer?key=$INDEXER_CRON_KEY", "schedule": "*/10 * * * *" }
  ]
}
```

`/api/indexer` accepts either:
- header `x-indexer-secret` matching `INDEXER_SECRET` (existing manual trigger), OR
- query param `key` matching `INDEXER_CRON_KEY` (cron-only secret)

Admin System tab adds: last run timestamp, last error, manual retry button.

---

## 29. Durable rate limit strategy

`lib/rate-limit.ts` gains a Supabase-backed implementation that uses the new `rate_limit_buckets` table. Existing in-process limiter stays as a fast path (best-effort). The function signature stays the same so routes don't change:

```ts
await rateLimit(identifier, config);  // tries DB first, falls back to in-process on DB error
```

Pseudo-flow: upsert `(key, route, window_start)`, increment `count`, return decision. Window calculated by truncating `Date.now()` to `windowMs` boundary. Old buckets cleaned weekly via a separate cron (or lazy delete on read).

---

## 30. Test strategy

### New contract tests (Hardhat) — **Phase 1 RESULT: 45 V2 tests, all green; V1 still 18/18**

Implemented and passing on `feature/sponsor-funded-contract-design`:

| Group | Test count | Highlights |
|---|---|---|
| `createFundedQuest` | 6 | happy path, requiredFunding math, past deadline, zero maxClaims, zero reward, zero sponsor, role gate |
| `fundQuest / topUpQuest` | 7 | partial→FUNDED, full→FUNDED, multi-funder, zero amount, missing quest, topUp emits ToppedUp, fund-after-FUNDED emits ToppedUp |
| submission + approval | 7 | submit+approve, atomic submitAndApprove, score floor, hash mismatch, role gate, rejected blocks claim, double-submit blocked |
| claim | 6 | user claimReward, verifier claimRewardFor, accounting deduction, double-claim blocked, no-approval blocked, **insufficient-funding blocked** |
| **cross-quest isolation** | 2 | Quest B untouched after Quest A claim; draining A leaves B funded |
| maxClaims + deadline | 2 | maxClaims=1 enforced, post-deadline submit blocked |
| `withdrawUnusedQuestFunds` | 7 | sponsor-after-deadline, admin-on-behalf, blocked-while-active, non-sponsor-rejected, exceeds-unused-rejected, invariant-after-partial-claim, post-close immediate withdraw |
| close + pause | 5 | pauseQuest+unpauseQuest, closeQuest terminal, role gate close, role gate pause, contract-wide pause blocks fund+submit+claim |
| views | 2 | getClaimableCapacity math, getQuestFunding accounting |
| (preserved) Existing V1 suite | 18 | all still pass byte-identically |
| **Total** | **63 passing** | **45 new V2 + 18 V1** |

### New backend tests (Jest)
- proof adapter registry: dispatch by proof_type
- GitHub adapter: behaviour matches v1.1 (delta tests)
- manual adapter: validation, manual-review state
- Discord adapter: state HMAC, role check, failure modes
- X adapter: URL validation, manual fallback
- LMS adapter: validation, manual-review state
- durable rate limit: bucket increment, window reset, fallback
- sponsor route filtering: cannot see other sponsor's data
- leaderboard public-safe output: no private fields
- notification creation: triggered on each event
- notification mark-read: single + all
- analytics: sponsor-funded math (coverage, shortfall)
- quest template list
- creator-guard still works on V2 quests

### Manual QA
Per the brief's testing block — all 20+ checks.

---

## 31. Deployment plan

1. **Local**: design + tests pass; gates green; do NOT push.
2. **Owner approval gate**: review V1_2_GAP_AUDIT.md and this plan.
3. **Contract deploy (after approval)**:
   ```
   npx hardhat run scripts/deploy-v2.ts --network baseSepolia
   ```
   Deploys `QuestLockCoreV2`. Grants:
   - `VERIFIER_ROLE` to verifier wallet
   - `MINTER_ROLE` on existing `QuestBadge` to V2 (so V2 can mint badges atomically)
4. **Persist new V2 address** to `deployments/baseSepolia.json` + `.env` (`NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS`).
5. **Apply DB migration** to Supabase: `npx prisma migrate deploy`.
6. **Seed quest templates** into `quest_templates`.
7. **Push to GitHub** (only after explicit approval).
8. **Vercel deploy** auto-triggers.
9. **Production smoke test** (separate phase, brief's 20+ checks).
10. **Tag** `v1.2.0` only after smoke test passes.

---

## 32. Rollback plan

| Scenario | Rollback |
|---|---|
| V2 contract has a bug found before any sponsor funds | Mark V2 as inactive in env, redeploy V2 with fix, point new quests at new V2 address. Old quests on V1 unaffected. |
| V2 contract has a bug found after sponsor funds | Pause V2, ask sponsor to withdraw via `withdrawUnusedQuestFunds` (which we'll add an admin path for if needed), redeploy. |
| Frontend bug breaks legacy quests | Revert to `v1.1.4` tag in Vercel; rollback is one-click. |
| DB migration breaks something | Migrations are additive only — no destructive change. Worst case: reset added columns to NULL via SQL. |
| Vercel deploy fails | `v1.1.4` is the previous successful deployment; one-click promote. |

---

## 33. Risks

- **R1 — Contract bug.** Mitigation: 45 V2 tests + cross-quest leak tests passing locally; consider a static analyser (e.g. `slither`) pre-deploy.
- **R2 — Sponsor withdraws and a user claims simultaneously.** Mitigation: withdraw uses `nonReentrant` + checks `fundedAmount - claimedAmount - withdrawnAmount`; claim checks remaining funds and reverts cleanly.
- **R3 — `viaIR` compiler change.** Mitigation: documented as local-only; V1 on-chain bytecode unaffected (we never redeploy from these artifacts); all V1 tests still pass after the switch. **If a `viaIR`-compiled V2 ever shows a runtime issue during deploy, stop and report before sending the deploy tx.**
- **R4 — Discord/X APIs change.** Mitigation: manual-review fallback always present.
- **R5 — Vercel cold-start losing rate-limit state.** Mitigation: Supabase-backed bucket as source of truth (see §29).
- **R6 — Scope creep.** Mitigation: 19 branches in fixed order, no v1.3 features.
- **R7 — Verifier wallet runs out of ETH.** Mitigation: admin System tab surfaces verifier balance; doc-level alert at <0.02 ETH.
- **R8 — Verifier private key compromised.** **Confirmed compromise** — leaked into chat transcripts during early development. Mitigation: `VERIFIER_KEY_ROTATION_PLAN.md` produced in `feature/verifier-key-rotation-plan` (this branch). Rotation must complete and be verified on V1 before V2 deploy.

---

## 34. Open owner decisions (status updated)

| # | Decision | Status |
|---|---|---|
| 1 | Contract architecture: Option C — Hybrid | ✅ **Approved** |
| 2 | Deploy `QuestLockCoreV2` after design review | 🟡 Design approved locally; **deployment still blocked** pending verifier rotation + explicit go-ahead |
| 3 | No `QuestFundingVault` (folded into V2) | ✅ **Approved** |
| 4 | No EAS schema change | ✅ **Approved** |
| 5 | No badge contract redeploy — use `setTokenURI` | ✅ **Approved** |
| 6 | Same QUEST token for V1 + V2 quests | ✅ **Approved** |
| 7 | Discord OAuth app creation | ⏸ **Deferred** to `feature/discord-proof` branch — owner will create app when reached |
| 8 | X manual-review fallback | ✅ **Approved** (no paid X API in v1.2) |
| 9 | 5 default quest templates seeded | ✅ **Approved** — list lands with `feature/quest-templates` |
| 10 | In-app notifications only, no email | ✅ **Approved** |
| 11 | Vercel Cron `INDEXER_CRON_KEY` | ⏸ Spec only — owner sets env when `feature/scheduled-indexer` is ready |
| 12 | Verifier key rotation timing | ✅ **Before V2 deploy** — plan written in `VERIFIER_KEY_ROTATION_PLAN.md` (this branch); rotation execution still requires owner go-ahead |

### Resolved during Phase 1
- 13 — `viaIR: true` is acceptable for V2 local compile. ✅ Documented in `QuestLockCoreV2.NOTES.md`; V1 on-chain unaffected; V1 tests still pass.
- 14 — `UNDERFUNDED` semantic: "remaining < rewardAmount" (cannot pay one more claim), not "fundedAmount < requiredFunding". ✅ Reflected in §15a, the contract code, and the V2 design notes.

### Still blocking V2 deploy
- Verifier key rotation must complete first.
- Owner must explicitly authorise the V2 deploy and DB migration when ready.
- No GitHub push, no PR, no merge, no tag, no production env change until owner says so.

---

## Acceptance criteria for this plan

- [x] All 34 sections from the brief addressed
- [x] Contract architecture compared (A / B / C) with recommendation
- [x] Legacy compatibility strategy explicit
- [x] Funding + claim + withdrawal lifecycles diagrammed
- [x] DB migration drafted (additive only)
- [x] API and frontend route deltas tabulated
- [x] Test strategy enumerated (contract + backend + manual)
- [x] Deployment + rollback plans present
- [x] Risk register with mitigations
- [x] Owner decisions explicitly called out
- [x] No code written for any v1.2 feature — design only

**Next step:** Owner reviews + answers the 12 open decisions in §34. After approval, the next branch (`feature/sponsor-funded-contract-design`) writes `QuestLockCoreV2.sol` and its Hardhat tests — local only, still no deploy.
