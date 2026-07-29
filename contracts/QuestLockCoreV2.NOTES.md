# QuestLockCoreV2 — Design Notes

**Branch:** `feature/sponsor-funded-contract-design` (local only)
**Status:** Draft contract + tests passing locally. Not deployed.

## Why this contract exists
v1.1.4's shared-pool model lets one quest drain another. V2 adds per-quest funded balances so each quest can only pay out from its own deposits.

## Shape relative to V1
- Same role model (`DEFAULT_ADMIN_ROLE`, `QUEST_CREATOR_ROLE`, `VERIFIER_ROLE`, `PAUSER_ROLE`).
- Same submission lifecycle (`NONE → SUBMITTED → APPROVED | REJECTED → CLAIMED`).
- Same atomic claim pattern (`safeTransfer` + `badge.mint` inside one `nonReentrant`).
- Added: per-quest `fundedAmount / claimedAmount / withdrawnAmount` accounting.
- Added: `fundQuest`, `topUpQuest`, `withdrawUnusedQuestFunds`, `closeQuest`.
- Added: funding state machine `UNFUNDED → PARTIALLY_FUNDED → FUNDED`, with `UNDERFUNDED` for post-claim drift, `CLOSED` / `REFUNDED` as terminal states.

## Funding state machine

```
UNFUNDED ──fund──► PARTIALLY_FUNDED ──fund──► FUNDED
                          │                     │
                          │                     ├─claim if remaining < rewardAmount─► UNDERFUNDED
                          │                     │
                          ├─claim if remaining < rewardAmount─► UNDERFUNDED
                          │
                          └─sponsor closes──► CLOSED ──withdraw all──► REFUNDED
                                                              │
                  deadline passes + withdraw all unused (no claims) ──┘
```

Terminal states (`CLOSED`, `REFUNDED`) are never overwritten. `_recomputeFundingStatus` runs after every `fundQuest` / `topUpQuest` / claim.

### Status semantics (owner-approved)

| Status | Meaning |
|---|---|
| `UNFUNDED` | `fundedAmount == 0` — no deposits yet |
| `PARTIALLY_FUNDED` | `0 < fundedAmount < requiredFunding` **and the quest can still pay at least one more claim** (`remaining >= rewardAmount`). Operational. |
| `FUNDED` | `fundedAmount >= requiredFunding`. Sticky — once reached, the status stays `FUNDED` even after claims drain part of the pool, as long as `remaining >= rewardAmount`. |
| `UNDERFUNDED` | `remaining < rewardAmount` and slots remain. **The quest cannot pay even one more claim.** Sponsor must top up or admin must close. |
| `CLOSED` | Terminal. Sponsor or admin called `closeQuest`. Withdrawal is immediately allowed. |
| `REFUNDED` | Terminal. All funds returned to sponsor (no claims happened). |
| `EXPIRED` | View-only. Computed from `block.timestamp > deadline` — not stored. |
| `PAUSED` | View-only. Reflects per-quest `active == false`. |

The key refinement vs. the original draft: **initial partial deposits are `PARTIALLY_FUNDED`, not `UNDERFUNDED`.** A quest funded with 20 QUEST against a required 50 is operational for up to 2 claims and shown as `PARTIALLY_FUNDED`. Only when a future claim leaves `remaining < rewardAmount` does the contract emit `QuestUnderfunded` and transition the status.

## Critical invariants (tested)
1. `fundedAmount >= claimedAmount + withdrawnAmount` at every state
2. Claims deduct only from the target quest's balance (cross-quest isolation test)
3. Withdrawal requires `block.timestamp > deadline OR fundingStatus == CLOSED`
4. Withdrawal cannot exceed `fundedAmount - claimedAmount - withdrawnAmount`
5. Only sponsor or `DEFAULT_ADMIN_ROLE` can withdraw
6. Pause blocks all sensitive ops via `whenNotPaused` and per-quest `active` flag
7. Claim is `nonReentrant`; withdraw is `nonReentrant`
8. `SafeERC20.safeTransfer` for all token movements

## Compiler note
`viaIR: true` was enabled in `hardhat.config.ts` because V2's struct (16 fields) plus 8-parameter functions exceed solc's stack depth. This is local-compile only; on-chain v1 contracts are unaffected (we never redeploy from these artifacts).

## What is NOT in this branch
- No deployment.
- No DB migrations.
- No backend/frontend changes.
- No role grants on Base Sepolia.
- No env or production config touched.
- No push to GitHub.

## Next phase (after owner approval)
`feature/sponsor-funded-pools` — DB migration, API routes, frontend funding UI, sponsor dashboard.

## Function quick reference
| Function | Role | Notes |
|---|---|---|
| `createFundedQuest` | QUEST_CREATOR | sets `requiredFunding = rewardAmount × maxClaims` |
| `fundQuest` | anyone | emits `QuestFunded` or `QuestToppedUp` based on prior state |
| `topUpQuest` | anyone | alias for funding after `FUNDED` |
| `submitProofHash` | user | self-submit |
| `submitProofHashFor` | VERIFIER | submit on behalf of user |
| `submitAndApprove` | VERIFIER | atomic submit + approve |
| `approveSubmission` | VERIFIER | post-submit approval |
| `rejectSubmission` | VERIFIER | terminal reject |
| `claimReward` | user (nonReentrant) | self-claim from quest's pool |
| `claimRewardFor` | VERIFIER (nonReentrant) | gasless claim |
| `withdrawUnusedQuestFunds` | sponsor or ADMIN (nonReentrant) | post-deadline or post-close |
| `closeQuest` | sponsor or ADMIN | terminal; enables immediate withdrawal |
| `pauseQuest` / `unpauseQuest` | PAUSER / ADMIN | reversible |
| `pause` / `unpause` | PAUSER / ADMIN | contract-wide |
| `getQuest`, `getSubmission`, `getQuestFunding`, `getRemainingFunding`, `getClaimableCapacity` | view | analytics-friendly |
