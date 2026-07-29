# QuestLock — Launch Package

**Status:** v1.2 release candidate. Live deploy still on `v1.1.2`; v1.2 push pending owner approval.
Build/deploy date (current production): 2026-06-04 · v1.2 prepared 2026-06-05.

> v1.2 changes: per-quest sponsor-funded pool (QuestLockCoreV2), 5 proof adapters, sponsor dashboard, leaderboard, in-app notifications, scheduled indexer, retry centre. Full notes in `RELEASE_NOTES_v1.2.md`. Known limitations in `KNOWN_LIMITATIONS.md`. Demo walk-through in `DEMO_SCRIPT.md`. Visuals checklist in `SCREENSHOTS_CHECKLIST.md`.

---

## 1. Project summary

QuestLock is a **proof-powered quest platform** on Base Sepolia. Builders submit GitHub project proof, the system runs ten deterministic objective checks, issues a public EAS attestation, approves the submission on-chain, and lets the user claim ERC-20 rewards plus a soulbound ERC-1155 badge — without paying gas and without signing the claim transaction.

Sponsors can request quests; admins review them, approve offchain, then explicitly publish on-chain. Failed users can request manual review. Every successful submission becomes a public shareable certificate at `/proof/[id]`. Admins get a read-only analytics dashboard with live conversion rates and the on-chain reward pool.

**Core tagline:** *Rewards should follow proof, not farming.*

---

## 2. Live URLs

| Item | URL |
|---|---|
| **Production app** | https://quest-lock.vercel.app |
| **GitHub repository** | https://github.com/ometere123/questlock |
| **v1.1.2 release tag** | https://github.com/ometere123/questlock/releases/tag/v1.1.2 |
| **Health check** | https://quest-lock.vercel.app/api/health |
| **Quest marketplace** | https://quest-lock.vercel.app/quests |
| **Sponsor a quest** | https://quest-lock.vercel.app/create |

---

## 3. Contracts (Base Sepolia · chain ID 84532)

| Contract | Address | Explorer |
|---|---|---|
| **QuestLockCore** (v1, legacy shared pool) | `0xCCe52216B17096235c070ce85F5C4fFBbf9E782C` | [BaseScan](https://sepolia.basescan.org/address/0xCCe52216B17096235c070ce85F5C4fFBbf9E782C) |
| **QuestLockCoreV2** (v1.2, per-quest funded) | `0xDDC0024E76C2bEC64F6f7785e232E7Ce11b0A282` | [BaseScan](https://sepolia.basescan.org/address/0xDDC0024E76C2bEC64F6f7785e232E7Ce11b0A282) |
| **QuestRewardToken** (QUEST, ERC-20) | `0x154250cc3253b4C7a0f1bfe0eCc26792c81b3054` | [BaseScan](https://sepolia.basescan.org/address/0x154250cc3253b4C7a0f1bfe0eCc26792c81b3054) |
| **QuestBadge** (ERC-1155, soulbound) | `0x1010F4fB73b2DCb4b2bD43D87E0210cb6a00bBAe` | [BaseScan](https://sepolia.basescan.org/address/0x1010F4fB73b2DCb4b2bD43D87E0210cb6a00bBAe) |

---

## 4. EAS

| Item | Value |
|---|---|
| **Schema UID** | `0x3c9b890e57a3887a0766fe0bf74df896e9551d7b173b3113e3363149156940a6` |
| **Schema on EASScan** | https://base-sepolia.easscan.org/schema/view/0x3c9b890e57a3887a0766fe0bf74df896e9551d7b173b3113e3363149156940a6 |
| **EAS contract (Base Sepolia native)** | `0x4200000000000000000000000000000000000021` |

Schema string:
```
uint256 questId, address user, string proofType, bytes32 proofHash,
uint16 score, string riskBand, bool approved, uint256 issuedAt
```

---

## 5. Sample artefacts (real, on-chain)

| Item | Value |
|---|---|
| **Sample EAS attestation** | [`0xd7ba4652…35eb11`](https://base-sepolia.easscan.org/attestation/view/0xd7ba4652940d69bd68e282a84ce98bb874cc11415726e48c972a98a57935eb11) |
| **Sample `submitAndApprove` tx** | [`0x1f526893…13b0e7`](https://sepolia.basescan.org/tx/0x1f52689352a9a6fb53ec863824bd1815beb69f8e93e2a7efc660545eea13b0e7) |
| **Sample `claimRewardFor` tx** | [`0x8d7d7d99…64e002`](https://sepolia.basescan.org/tx/0x8d7d7d9962ca6a64af56c247d3437499705577bbc51138c94fb14f7f2964e002) |
| **Sample public certificate** | https://quest-lock.vercel.app/proof/c1e0864e-364c-488c-b3b5-a1413190bade |

---

## 6. Feature list

### Core (v1)
- Three-contract architecture: QuestLockCore + QuestRewardToken + QuestBadge (soulbound)
- 10-check deterministic proof scoring (100 pts, configurable pass mark)
- Anti-farm: duplicate-repo / duplicate-demo / wallet-collision detection, risk bands
- EAS attestations on Base Sepolia
- Atomic on-chain `submitAndApprove` via verifier wallet
- **Gasless claim from the user's perspective** — verifier signs and pays, user clicks once
- Soulbound ERC-1155 badge minted atomically with reward
- Profile page with attestation + tx links
- Admin dashboard with per-submission inspection

### Upgrade (v1.1)
- **GitHub account linking** — HMAC-signed OAuth flow, server-only token handling, required for new submissions, repo owner must match linked login
- **Public proof / certificate pages** at `/proof/[id]` — whitelist-enforced, OpenGraph metadata for link previews
- **Sponsor / creator quest requests** at `/create` — two-step admin flow (approve offchain → publish on-chain)
- **Manual review / appeals queue** — failed users request review; approval pipeline issues a `MANUAL_REVIEW` EAS attestation and reuses `submitAndApprove`
- **Quest analytics dashboard** — global tiles, per-quest cards, live QUEST pool, conversion rates, top failure reasons
- **Proof engine hardening** — retry on transient failures, commit-authorship signal (closes fork-without-own-work abuse), broader frontend/contract patterns, package manager detection
- **Ops hardening** — `requireEnv` / `auditEnv`, in-process rate limits on six routes, `/api/health`, admin **System** tab
- **Creator / sponsor guard** — backend 403 + UI disable; case-insensitive comparison against `quests.created_by` and `quests.sponsor_wallet`

---

## 7. Known limitations

- Base Sepolia testnet only (no mainnet)
- GitHub proof only (no Twitter/X, Discord, LMS)
- Deterministic scoring only (no AI/LLM)
- Appeals cannot recover an on-chain `REJECTED` submission (v1 contract has no path to flip it back; v1 failures terminate offchain so this affects nothing today)
- Rate limits are in-process (reset on Vercel cold start; per-instance, not global)
- Contract event indexer is manual (`POST /api/indexer` with `x-indexer-secret`) — not yet on a scheduled trigger
- Privy Google sign-in uses Privy's shared OAuth credentials (production should provide its own later)
- Sponsor-facing analytics not built — analytics dashboard is admin-only
- No charting library — tables and percentages only, by design

---

## 8. Smoke test — automated public probes (passed)

| # | Test | Result |
|---|---|---|
| 1 | `GET /api/health` | ✅ 200 — `status: "ok"`, env clean, DB 1205 ms, RPC 70 ms, block 42419785 |
| 2 | Landing page loads | ✅ Tagline "Rewards should follow proof, not farming." rendered; **no Gelato copy anywhere** |
| 3 | `/quests` lists active quests | ✅ Two quests live: "Build a Subgraph for QuestLock Events" (onchain #2, 0 claims) and "Build a Simple Onchain Guestbook" (onchain #1, 1 claim) |
| 4 | `GET /api/proof/public/<id>` whitelist | ✅ Returns only the 18 whitelisted fields. Confirmed absence of `explanation`, `failure_reasons_json`, `admin_notes` |
| 5 | `/proof/<id>` certificate page | ✅ Renders subject, score 90/100, "Reward Claimed", "Verified Builder" badge, EAS link, approval tx link, claim tx link |
| 6 | `/create` page | ✅ "Request a Quest" headline + Connect CTA (form gated to authenticated wallets, as designed) |
| 7 | `/api/ops-ql/analytics` without auth | ✅ Returns **HTTP 403 Forbidden** — admin gate enforced |

## 9. Smoke test — manual steps you should run in a browser

These need a wallet or admin actions; they cannot be probed unauthenticated. Run them once and tick off:

- [ ] `/me` loads after Privy email/Google/wallet sign-in; embedded wallet auto-created for email login
- [ ] **GitHub linking** on production OAuth app — Connect GitHub → bounce → land on `/me?github=linked` with avatar
- [ ] Submit a valid GitHub proof (e.g. your `ometere123/genetia`) → timeline animates → score ≥ 60 → attestation issued → onchain approval → Claim button appears
- [ ] Click Claim → "Reward Claimed" with BaseScan link → QUEST + badge in wallet
- [ ] Linked-GitHub enforcement: try submitting `github.com/vercel/next.js` → 400 "Repository owner (vercel) must match…"
- [ ] Creator-guard: connect as admin wallet (`0x1f63ea74…525B`), open the sponsor-published quest, confirm submit button is disabled with the red notice
- [ ] `/create` → submit a request as a non-admin wallet → admin reviews on `/ops-ql/quest-requests` → Approve → Publish on-chain → new quest goes live
- [ ] Submit a deliberately failing proof (e.g. an empty repo) → AppealCTA appears → file an appeal → admin approves on `/ops-ql/appeals` → submission flips to CLAIMABLE with `risk_band = MANUAL_REVIEW`
- [ ] `/ops-ql/analytics` shows the live QUEST pool + per-quest tiles + global top failure reasons
- [ ] Visit `/ops-ql` and `/ops-ql/quest-requests` as a non-admin wallet → "Access denied"

---

## 10. Wallets for testing

| Role | Wallet |
|---|---|
| **Admin / Deployer** (you) | `0x1f63ea74065586Af0C7c48428372D88d0A89525B` |
| **Verifier** (backend; never used in UI) | `0xC26788E71036601B4Dbe5551160abFc733bf0601` |
| **Normal test user** | Sign in with email or Google → Privy creates an embedded wallet automatically. No extension needed. |

---

## 11. Test data

**Valid proof case** — a repo owned by your linked GitHub account with 3+ commits since quest start, a README with 500+ chars, frontend + contract files, and a live demo URL. Example: `https://github.com/ometere123/genetia` (already used for the v1 successful claim).

**Invalid proof cases:**
- **Owner mismatch** — paste `https://github.com/vercel/next.js`. The backend rejects with 400 before any scoring runs.
- **Missing README** — create a fresh empty repo and submit it. `repo_exists` passes but `readme_exists`, `readme_length`, `frontend_files`, `contract_files`, `commits_after_start` all zero → score ~25 → `FAILED`.
- **Private repo** — submit a private repo URL. `repo_exists` returns 404 with "Repository not found or is private."
- **No GitHub link** — disconnect on `/me`, then try to submit. UI shows "Connect GitHub on Profile →"; if the user bypasses the UI, the backend returns 403 `requiresGithubLink: true`.

---

## 12. Short demo script (90 seconds)

> 1. Open https://quest-lock.vercel.app — *"QuestLock. Rewards should follow proof, not farming."*
> 2. Sign in with email — Privy creates a wallet for me automatically, no extension.
> 3. `/me` → Connect GitHub → bounce through OAuth → I'm linked.
> 4. `/quests` → "Build a Simple Onchain Guestbook" → click in.
> 5. Submit form — GitHub username pre-filled and locked to my linked login. Paste my repo, paste my demo URL.
> 6. Live timeline: SUBMITTED → EVALUATING → PASSED → ATTESTED → APPROVED_ONCHAIN. Score breakdown shows every check.
> 7. EAS attestation card — *"This is the public certificate. Verifiable on EASScan."*
> 8. Click "Claim Reward (Gasless)" — no signature, no gas, QUEST tokens + soulbound badge land in my wallet.
> 9. `/proof/[id]` — *"Shareable public certificate. Anyone can verify on-chain."*
> 10. As admin → `/ops-ql/analytics` — conversion rates, live QUEST pool, top failure reasons. No charts; just the numbers that matter.
> 11. *"Anyone can sponsor a quest at `/create`. Admin reviews, then publishes on-chain. Same proof engine. Same gasless claim."*

---

## 13. One-minute pitch

> QuestLock is proof infrastructure for builder quests. Every quest reward goes through ten deterministic objective checks, an EAS attestation on Base, an on-chain approval, and a gasless claim — in that order, every time. There's no opaque scoring, no farming, no signing the claim transaction. A user only earns if the public proof passes.
>
> Sponsors can request quests; the admin approves offchain, then explicitly publishes on-chain. Failed users can request manual review with a `MANUAL_REVIEW` EAS attestation on the override. Every successful submission becomes a public shareable certificate with all the on-chain links baked in.
>
> Wallet-native users connect MetaMask, Rabby, or any standard wallet. Web2 users sign in with email or Google and get a Privy embedded wallet automatically — same flow, no extension. Both paths land in the same proof pipeline.
>
> v1.1 ships on Base Sepolia with three contracts already verified, 75 tests passing, and a real successful claim on-chain. The whole thing is open-source on GitHub and live at quest-lock.vercel.app.

---

## 14. X post draft

```
Just shipped QuestLock v1.1 on Base Sepolia.

Proof-powered quest platform. Submit GitHub project → 10 deterministic checks → EAS attestation → on-chain approval → gasless claim. Soulbound ERC-1155 badge + ERC-20 reward. No signature, no gas to the user.

Anyone can sponsor a quest. Admin approves then explicitly publishes on-chain. Failed proofs can request manual review with a MANUAL_REVIEW EAS attestation on the override.

Live: https://quest-lock.vercel.app
Repo: https://github.com/ometere123/questlock
Sample certificate: https://quest-lock.vercel.app/proof/c1e0864e-364c-488c-b3b5-a1413190bade

Rewards should follow proof, not farming.
```

(Alt shorter version, fits the 280-char limit easily:)

```
QuestLock v1.1 — proof-powered quest platform live on Base Sepolia.

Submit GitHub proof → 10 deterministic checks → EAS attestation → on-chain approval → gasless claim → soulbound badge.

Rewards should follow proof, not farming.

https://quest-lock.vercel.app
```

---

## 15. Repository state snapshot

| Item | Value |
|---|---|
| `main` HEAD | `a1b7921` |
| Tags pushed | `v1.1.0` (`9ea361b`), `v1.1.1` (`88e2284`), `v1.1.2` (`a1b7921`) |
| Tests on `main` | 18 Hardhat + 57 Jest = **75 passing** |
| Vercel deployment | Live at `https://quest-lock.vercel.app` from `a1b7921` |
| Migrations applied to Supabase | 5/5 |
| `.env` committed | No (gitignored) |

---

*v1.2 is not started. This package is launch-only.*
