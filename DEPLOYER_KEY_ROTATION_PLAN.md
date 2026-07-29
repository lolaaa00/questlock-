# Deployer / Admin Key Rotation Plan

**Branch:** `feature/secret-rotation-plans` (local only — not pushed)
**Status:** DRAFT — execution requires owner approval AND a separate role audit pass on chain.
**Recommendation:** **Do not execute before V2 deploy** unless absolutely necessary. Draft now, schedule later.

> ⚠️ **Hard rules**
> 1. Never paste any private key into chat.
> 2. Never commit a `.env*` file.
> 3. Never put a private key in this document or any other doc.
> 4. Never log the private key — even partial / prefix / suffix.
> 5. Never share via screenshot.
> 6. Use placeholders `<NEW_ADMIN_ADDRESS>` and `<NEW_DEPLOYER_PRIVATE_KEY>` everywhere.
> 7. **Never revoke an old admin role before the new admin role is granted AND tested.** Locking ourselves out is the worst possible outcome of this rotation.

---

## 1. Why rotation may be needed

The deployer / admin wallet controls higher-risk permissions than the verifier:
- creating quests on chain
- pausing and unpausing the contract
- granting and revoking every other role (including its own)
- minting QUEST tokens (via the token contract's admin role)
- granting `MINTER_ROLE` on the badge to whichever core contract should mint

Its private key was leaked into chat transcripts during early v1 development. Rotation is the right cleanup, but it has to be done with extreme care because:
- there is exactly one `DEFAULT_ADMIN_ROLE` enforced atomically per contract — if we revoke before granting, we are permanently locked out
- it is the only wallet that can publish new quests today
- it is the only wallet that can grant `MINTER_ROLE` on the badge if v2 needs that grant
- it signs the `submitAndApprove` deploy script and the `grant-roles` script

Because the verifier wallet is rotated first and is the higher-frequency signer, the deployer rotation is **not on the critical path for V2 deploy**. It is a hygiene task best scheduled in its own controlled window.

---

## 2. Current admin / deployer wallet (public address — safe to record)

| Field | Value |
|---|---|
| Address | `0x1f63ea74065586Af0C7c48428372D88d0A89525B` |
| Role on this app | Admin wallet (header gate for `/ops-ql/*`) + deployer + quest creator + pauser |
| Used by | Hardhat scripts (`DEPLOYER_PRIVATE_KEY` env var) + admin frontend gate (`ADMIN_WALLET_ADDRESS` env var) |

---

## 3. What this wallet controls — role audit checklist

**Execute the audit on chain before any rotation.** The result is the source of truth for which `grantRole` calls are required against the new admin address.

### `QuestLockCore` v1 (`0xCCe5…E782C`)
```bash
# Substitute <NEW_ADMIN_ADDRESS> and <OLD_ADMIN_ADDRESS> at runtime only
ROLES="DEFAULT_ADMIN_ROLE QUEST_CREATOR_ROLE PAUSER_ROLE"
# For each: cast call CORE_V1 "hasRole(bytes32,address)" $(cast keccak $ROLE) <OLD_ADMIN_ADDRESS>
```
Expected `true` for all three based on `scripts/deploy.ts`.

### `QuestRewardToken` (`0x1542…3054`)
The token contract uses OpenZeppelin ERC20 with a single admin/minter — verify with:
```bash
cast call QUEST_TOKEN "owner()(address)"
# Or, if AccessControl-based, check DEFAULT_ADMIN_ROLE
```
Expected: deployer.

### `QuestBadge` (`0x1010…0bBAe`)
```bash
ROLES="DEFAULT_ADMIN_ROLE MINTER_ROLE"
# Expected: deployer has DEFAULT_ADMIN_ROLE
# Expected: QuestLockCore v1 has MINTER_ROLE (granted at deploy time)
# Expected: (future) QuestLockCoreV2 will also need MINTER_ROLE
```

### Future `QuestLockCoreV2` (when deployed)
The deploy script grants `DEFAULT_ADMIN_ROLE`, `QUEST_CREATOR_ROLE`, `VERIFIER_ROLE`, `PAUSER_ROLE` to whichever address calls the deploy. If V2 is deployed by the **current** admin, the current admin holds all four roles on V2 too. If V2 is deployed by the **new** admin (post-rotation), the new admin holds them from day one — preferred.

### Frontend gate (`ADMIN_WALLET_ADDRESS` env var)
Backend route handlers compare `x-wallet-address` header to this env var (case-insensitive). Rotating the admin requires updating both `.env` and Vercel env in lockstep with the on-chain role grants.

---

## 4. Rotation principle

**Never revoke old admin before the new admin is fully granted and tested.** This is non-negotiable. The cost of a permanent admin lock-out is total — there is no recovery path on any AccessControl contract without an existing admin signer.

Acceptable end-states during the cut-over:
- New admin granted, old admin still granted → both work, dual-control window. ✅ safe.
- New admin granted, old admin revoked → single new admin. ✅ safe IF the new admin has been proven to work first.

Unacceptable:
- Old admin revoked before new admin granted → permanent lock-out. ❌ never.
- Both admins revoked anywhere in the sequence → permanent lock-out. ❌ never.

---

## 5. Safe rotation sequence

### A. Generate new admin / deployer wallet
- MetaMask → Add account → name e.g. `QuestLock Admin v2`
- Or: standalone ethers script (see verifier plan §4 Option B)
- **The new private key never leaves the operator's machine — never pasted in chat, never logged, never partially redacted.**
- Record only the public address as `<NEW_ADMIN_ADDRESS>` for use in commands.

### B. Fund it with Base Sepolia ETH
Send **0.1 ETH** from the existing deployer wallet to `<NEW_ADMIN_ADDRESS>`. Sufficient for many deploy/role-grant transactions.

### C. Grant new admin every required role on V1 contracts

Local-only script template (saved as `scripts/grant-admin-roles-to-new.ts` when ready):
```ts
import { network } from "hardhat";
import * as fs from "fs"; import * as path from "path";
import { fileURLToPath } from "url";

const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const NEW_ADMIN = process.env.NEW_ADMIN_ADDRESS;
  if (!NEW_ADMIN) throw new Error("NEW_ADMIN_ADDRESS env required");

  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "baseSepolia.json"), "utf-8"));

  const QuestLockCore = await ethers.getContractFactory("QuestLockCore");
  const core = QuestLockCore.attach(d.NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS);
  const QuestBadge = await ethers.getContractFactory("QuestBadge");
  const badge = QuestBadge.attach(d.NEXT_PUBLIC_QUEST_BADGE_ADDRESS);

  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const QUEST_CREATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("QUEST_CREATOR_ROLE"));
  const PAUSER_ROLE        = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));

  for (const [name, role] of [
    ["DEFAULT_ADMIN_ROLE", DEFAULT_ADMIN_ROLE],
    ["QUEST_CREATOR_ROLE", QUEST_CREATOR_ROLE],
    ["PAUSER_ROLE",        PAUSER_ROLE],
  ] as const) {
    if (await core.hasRole(role, NEW_ADMIN)) { console.log(`V1 ${name}: already granted`); continue; }
    console.log(`Granting V1 ${name} to ${NEW_ADMIN}`);
    await (await core.grantRole(role, NEW_ADMIN)).wait();
  }

  // Badge admin
  if (!(await badge.hasRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN))) {
    console.log(`Granting Badge DEFAULT_ADMIN_ROLE to ${NEW_ADMIN}`);
    await (await badge.grantRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN)).wait();
  }

  // Token admin/minter — TBD based on actual token contract role layout
  // (Add the appropriate grant after the §3 audit confirms which roles exist)
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Run:
```bash
export NEW_ADMIN_ADDRESS=<NEW_ADMIN_ADDRESS>
npx hardhat run scripts/grant-admin-roles-to-new.ts --network baseSepolia
```

This still uses the **old** `DEPLOYER_PRIVATE_KEY` as the signer (the only wallet that currently holds `DEFAULT_ADMIN_ROLE`).

### D. Confirm `hasRole` for each role
```bash
# For each role: cast call CORE_V1 "hasRole(bytes32,address)(bool)" <ROLE_HASH> <NEW_ADMIN_ADDRESS>
# Expect: true for DEFAULT_ADMIN, QUEST_CREATOR, PAUSER on V1
# Expect: true for DEFAULT_ADMIN on Badge
```

### E. Test admin-only actions that do not risk funds
Using `<NEW_ADMIN_ADDRESS>` connected via MetaMask in the browser:
1. Visit `/ops-ql` — verify the page recognises the new admin (after `ADMIN_WALLET_ADDRESS` env update — see §G).
2. Hit `/api/ops-ql/system-status` with `x-wallet-address: <NEW_ADMIN_ADDRESS>` — expect 200.
3. Use the admin UI to pause a stale legacy quest (then unpause it). No fund movement.
4. Verify the new admin can read `analytics`, `quest-requests`, `appeals` admin routes.

**Do not** grant or revoke any role from the new admin until full V2 cut-over is complete — keep dual control.

### F. Keep old admin temporarily
The old admin retains all roles. If anything breaks, the operator falls back to it.

### G. Update env vars
```diff
# .env (local) + Vercel
-DEPLOYER_PRIVATE_KEY=<OLD_DEPLOYER_PRIVATE_KEY>
+DEPLOYER_PRIVATE_KEY=<NEW_DEPLOYER_PRIVATE_KEY>
-ADMIN_WALLET_ADDRESS=0x1f63ea74065586Af0C7c48428372D88d0A89525B
+ADMIN_WALLET_ADDRESS=<NEW_ADMIN_ADDRESS>
```

Vercel: dashboard → Environment Variables → edit both for Production/Preview/Development → trigger redeploy.

### H. For V2, deploy with new admin if possible
If V2 has not yet been deployed when this rotation runs, the V2 deploy script signs with whatever `DEPLOYER_PRIVATE_KEY` is in the env at deploy time. With the new key in env, V2 admin roles land on the new admin from day one — no extra grant needed.

If V2 was deployed before this rotation, run the equivalent grant script against V2 to add the new admin to V2's role set.

### I. Only after all checks, consider revoking old admin roles
This step is **separate, gated, and documented in its own script** (`scripts/revoke-old-admin-roles.ts` — to be drafted only when execution is approved). Revocation must:
1. Be preceded by ≥ 24 hours of stable operation on the new admin.
2. Revoke roles one at a time, verifying the new admin still holds each before proceeding.
3. Leave `DEFAULT_ADMIN_ROLE` for last.

---

## 6. Commands quick reference (placeholders only)

```bash
# (A) Generate new admin wallet — MetaMask, or one-liner:
# node -e "const w = require('ethers').Wallet.createRandom(); console.log('ADDRESS:', w.address);"
# (Run a SEPARATE command if you need to capture the key; pipe directly into .env)

# (B) Fund:
# MetaMask: send 0.1 Sepolia ETH from old admin to <NEW_ADMIN_ADDRESS>

# (C) Grant roles on V1:
export NEW_ADMIN_ADDRESS=<NEW_ADMIN_ADDRESS>
npx hardhat run scripts/grant-admin-roles-to-new.ts --network baseSepolia

# (D) Verify on chain:
# Use Blockscout / BaseScan / cast — no scripts needed

# (E) Browser test: connect as <NEW_ADMIN_ADDRESS>, visit /ops-ql, /ops-ql/analytics

# (G) Update env:
# Local: edit .env, restart `npm run dev`
# Vercel: dashboard → Environment Variables → edit DEPLOYER_PRIVATE_KEY + ADMIN_WALLET_ADDRESS → redeploy

# (I) AFTER stable window, revoke old admin (separate plan):
# scripts/revoke-old-admin-roles.ts  (to be drafted)
```

---

## 7. Risks

- **R1 — Lock-out.** If the new admin grant fails partway through, both wallets must remain admins. Mitigation: §5C grants are idempotent (skip when `hasRole` is already true).
- **R2 — Losing admin control.** Mitigation: never revoke old admin until §5E checks pass on the new admin.
- **R3 — Breaking quest creation.** After env switch, the deploy + quest creation scripts sign with the new key. Mitigation: §5E includes a no-fund pause/unpause round-trip; extend to a no-funds test quest creation if you want a stronger pre-revoke gate.
- **R4 — Breaking badge `MINTER_ROLE` grants.** Required when V2 deploys (V2 must be granted `MINTER_ROLE` on the existing badge). The badge contract's `DEFAULT_ADMIN_ROLE` holder is what's needed; mitigation: §5C explicitly includes the badge admin grant for the new admin.
- **R5 — Breaking token mint/admin functions.** If anyone ever needs to mint more QUEST, the token contract's admin must be set. Mitigation: §3 audit identifies the token's actual admin model; grant new admin accordingly.
- **R6 — Frontend admin gate desync.** The `ADMIN_WALLET_ADDRESS` env var is independent from on-chain roles. If env is updated but on-chain isn't (or vice versa), the admin sees "Access denied" or sees an admin UI but cannot send admin transactions. Mitigation: update env and on-chain in the same maintenance window.
- **R7 — Vercel env partial update.** If only Production scope is updated but Preview is not, branch deploys break. Mitigation: §5G updates all three scopes.
- **R8 — Operator copy-paste error.** Address typo when granting a role grants it to a random address. Mitigation: §5D verification using `hasRole` before any old-role revocation.

---

## 8. Recommendation

**Do not rotate deployer/admin before V2 deploy unless absolutely necessary.**

Reasoning:
- The verifier key is the higher-priority rotation (higher-frequency signer + already leaked).
- V2 deploy itself uses the deployer key once. Rotating before V2 deploy means executing two scripts in the same window. Rotating after V2 deploy is simpler because V2's admin roles are already in place.
- The admin/deployer key has not been used for any high-value action since v1 deploy. Continued use through V2 deploy is acceptable risk for the short window.

Proposed schedule:
1. **Now:** finish v1.2 design + this rotation plan (this branch).
2. **Verifier rotation** when approved (per `VERIFIER_KEY_ROTATION_PLAN.md`).
3. **V2 deploy** when approved.
4. **GitHub OAuth secret rotation** before final v1.2 public announcement.
5. **Deployer/admin rotation** in its own dedicated window after v1.2 is stable in production for ≥ 1 week.

If the threat model changes (e.g. you discover the key has been actively misused), promote step 5 to step 1.

---

## 9. Acceptance

This plan is local-only documentation. No commands here will be executed without owner go-ahead per phase.
