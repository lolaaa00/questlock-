# QuestLock — Security Rotation Summary

**Branch:** `feature/secret-rotation-plans` (local only — not pushed)
**Status:** All three rotation plans drafted locally. **No rotation has been executed.** No production env changed. No GitHub push.

---

## 1. Current security checkpoint

| Item | State |
|---|---|
| v1.1.4 live on Vercel | ✅ `https://quest-lock.vercel.app` |
| V2 deployed | ❌ design only, not deployed |
| Verifier rotation plan drafted | ✅ `VERIFIER_KEY_ROTATION_PLAN.md` |
| Deployer rotation plan drafted | ✅ `DEPLOYER_KEY_ROTATION_PLAN.md` |
| GitHub OAuth secret plan drafted | ✅ `GITHUB_OAUTH_SECRET_ROTATION_PLAN.md` |
| Any rotation executed | ❌ none |
| Any production env changed | ❌ none |
| Any GitHub push | ❌ none — all branches local-only |
| Old verifier role still active on V1 | ✅ — keep until cut-over complete |
| Old admin role still active on V1 | ✅ — keep until rotation window |
| Old GitHub OAuth secret still in production | ✅ — keep until rotation window |

---

## 2. Rotation priority

| Priority | Secret | Why | Timing |
|---|---|---|---|
| **1 — Highest** | Verifier private key | High-frequency signer; leaked; controls `submitAndApprove` + `claimRewardFor`; can drain shared pool today | **Before V2 deployment** |
| **2 — Medium** | GitHub OAuth client secret | Authorises QuestLock backend at GitHub's edge; leaked; user impact is moderate since access tokens are discarded immediately | **Before final v1.2 public release**, in its own window (can be after V2 deploy) |
| **3 — High-impact-low-frequency** | Deployer / admin private key | Controls every role on every contract; leaked; misuse risk is large but it is a low-frequency signer | **After v1.2 is stable in production for ≥ 1 week**, in its own dedicated window |

### Why not all at once
- Each rotation has a distinct rollback path. Bundling them makes diagnosis hard if anything breaks.
- The deployer key is the riskiest to rotate (lock-out risk). It earns the longest stability window first.

---

## 3. Safety rules (applies to all three plans)

- Never paste private keys or client secrets into chat
- Never commit `.env*` files (already in `.gitignore`)
- Never screenshot secrets
- Never print keys in terminal reports or commit messages
- Never log keys (even partial / prefix / suffix)
- Never revoke an old role before the new role is granted **and** tested with at least one real transaction
- Always test after env changes — local first, then production
- Always keep the rollback path available until the new state is proven stable for ≥ 24 hours
- Generate new keys in a fresh, isolated terminal that has no shared clipboard history with chat windows
- Use placeholders `<NEW_*>` in every doc, every commit message, every chat message

### Partial / "redacted" disclosure is NOT safe
Pasting a private key with the last N characters replaced by `xxxxx` (or any other partial form) still leaks the high-entropy prefix. Treat the key as fully compromised. Generate another.

---

## 4. Current recommendation

| Step | Recommendation |
|---|---|
| Next execution | **Verifier rotation only**, when owner approves the existing plan |
| V2 deploy | After verifier rotation proves stable for one full proof-to-claim cycle on V1 |
| GitHub OAuth secret rotation | After V2 is live and the proof adapters are merged, before final public release |
| Deployer/admin rotation | After v1.2 has been stable in production for ≥ 1 week |

### Owner decision queue (in order)
1. Confirm the verifier rotation can begin (per `VERIFIER_KEY_ROTATION_PLAN.md`).
2. After verifier rotation is verified on V1, approve V2 deploy.
3. After V2 deploy + smoke test, approve continuing with v1.2 feature branches.
4. Just before the v1.2 public release, approve GitHub OAuth secret rotation.
5. After v1.2 stable for 1+ weeks, approve deployer/admin rotation.

---

## 5. Plan files at a glance

| Plan | Path | Purpose |
|---|---|---|
| Verifier | `VERIFIER_KEY_ROTATION_PLAN.md` | Cut over backend signer to fresh wallet; keep old role until proven |
| Deployer/admin | `DEPLOYER_KEY_ROTATION_PLAN.md` | Cut over on-chain admin + frontend `ADMIN_WALLET_ADDRESS`; lock-out is the dominant risk |
| GitHub OAuth secret | `GITHUB_OAUTH_SECRET_ROTATION_PLAN.md` | Rotate the production OAuth app's client secret; users do not have to relink |

Every plan uses placeholders only. No real secret appears in any file in the repo.

---

## 6. Hard "do not"s before next approval

- ❌ Do not execute any rotation
- ❌ Do not generate new keys yet (wait for the rotation-execution checkpoint)
- ❌ Do not update Vercel env
- ❌ Do not revoke any old role
- ❌ Do not deploy V2
- ❌ Do not push any of these branches to GitHub
- ❌ Do not merge `feature/secret-rotation-plans` into `dev` or `main`
- ❌ Do not tag

---

## 7. Acceptance

Owner reviews:
1. This summary
2. `VERIFIER_KEY_ROTATION_PLAN.md`
3. `DEPLOYER_KEY_ROTATION_PLAN.md`
4. `GITHUB_OAUTH_SECRET_ROTATION_PLAN.md`

…and replies with which rotation (if any) is approved to execute next. The default position is: nothing executes without an explicit, scoped go-ahead.
