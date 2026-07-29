# QuestLock v1.1 — Creator, Trust and Review Upgrade

**Status:** Release candidate on `dev` (commit `bcc5c25`). `main` is frozen at v1 (commit `06caaaf`).

---

## Summary

v1.1 makes QuestLock more credible and more usable without destabilising the v1 proof-to-claim flow. It adds GitHub identity binding, a sponsor request queue, a manual review queue, public shareable proof certificates, quest analytics, a hardened proof engine and operational primitives (health check, env audit, rate limits, admin system panel).

**Zero contract redeployments.** Every onchain feature reuses the existing `submitAndApprove`, `claimRewardFor` and `createQuest` paths the v1 contract already exposed.

---

## New features

### 1. GitHub account linking (`feature/github-linking`)
- New columns on `users`: `github_id`, `github_login`, `github_avatar_url`, `github_profile_url`, `github_connected_at` (id + login unique).
- HMAC-signed state cookie binds the OAuth callback to the connecting wallet (10-min TTL, constant-time verify).
- Access token discarded after `/user` lookup — never reaches the browser, never persisted.
- Same GitHub identity cannot be linked to two different wallets.
- **Enforced on submission:** new proofs require a linked GitHub account and reject any repo whose owner does not match the linked login.
- `GithubConnectCard` on `/me`. Submit form pre-fills + locks the username when linked, blocks with a "Connect GitHub on Profile →" CTA when not.

### 2. Sponsor / creator quest requests (`feature/quest-requests`)
- New `quest_requests` table. Lifecycle: `PENDING_REVIEW → APPROVED → PUBLISHING → PUBLISHED`; branches `REJECTED`, `PUBLISH_FAILED` (retryable).
- Public form at `/create` lets any connected wallet propose a quest. Sponsors see their own queue inline.
- Admin review at `/ops-ql/quest-requests`. **Two-step admin flow:** Approve (offchain) then explicit "Publish onchain" (gas).
- Publish calls `QuestLockCore.createQuest` via the deployer wallet (`QUEST_CREATOR_ROLE`), parses the `QuestCreated` event for the new `onchainQuestId`, inserts a `quests` row tied to that id. No random user can publish.
- Publish failures captured in `publish_error` with full message; admin can retry without re-submitting.

### 3. Manual review / appeals (`feature/appeals`)
- New `submission_appeals` table, one appeal per submission (DB-enforced).
- Failed-proof view shows an inline "Request review" CTA only to the submitter; admin notes and outcome render on the same panel after submission.
- Admin queue at `/ops-ql/appeals`. Approve → onchain pipeline: re-uses existing `proof_hash` (or mints a deterministic one), issues an EAS attestation tagged `riskBand = "MANUAL_REVIEW"`, calls `submitAndApprove` via the verifier wallet, updates the submission to `APPROVED_ONCHAIN` so the existing gasless claim button works.
- Onchain score is lifted to `max(score, quest.min_score)` to clear the contract floor; the real deterministic score remains in the EAS attestation.
- **Known limitation (documented in README):** the existing contract cannot flip an onchain `REJECTED` status into `APPROVED`. v1 failures never go onchain so this affects nothing today.

### 4. Public proof / certificate pages (`feature/proof-pages`)
- `/proof/[submissionId]` — public, shareable, no auth required.
- Only `ATTESTED | APPROVED_ONCHAIN | CLAIMING | CLAIMED` submissions are visible; everything else 404s.
- Whitelist enforced in code (`lib/public-proof.ts → toPublicProof`); tests assert that `explanation`, `failure_reasons_json`, anti-farm internals etc. never appear in the public payload.
- Renders quest title + subject (GitHub login if linked, else short wallet), score, risk band, badge, repo + demo links, EAS attestation, approval tx, claim tx, proof hash and per-check pass/fail.
- OpenGraph metadata per-proof for nice link previews on Twitter / Slack.

### 5. Quest analytics (`feature/analytics`)
- Read-only admin dashboard at `/ops-ql/analytics`. Cards, tables, percentages — no charting library.
- Global tiles: total quests, total submissions, approved onchain, claimed, approval %, claim %, **live `QuestLockCore.balanceOf(QUEST)`**.
- Per-quest cards: submitted / passed / failed / claimable / claimed / avg score, approval %, claim %, potential outflow remaining `(maxClaims − totalClaims) × rewardAmount`, top 5 failure reasons.
- Global top-8 failure reasons across all quests.

### 6. Proof engine hardening (`feature/proof-engine-hardening`)
- New `lib/retry.ts` (exponential backoff + retryable-status whitelist) used by both the GitHub fetcher and demo-URL probe. Transient `429/408/425/5xx` plus timeouts and socket errors retry twice before failing.
- `lib/github.ts` now captures: fork status, default branch, primary language, file count, max directory depth, package manager (`npm/pnpm/yarn/bun`), README section count, **commit authorship** (how many commits since quest start are attributed to the submitting GitHub user).
- Frontend / contract detection expanded to a broad regex set (Next, Vite, Svelte, Nuxt, *.tsx, *.sol, hardhat / foundry / truffle, server/, api/, prisma/, Go/Rust/Java backend signals).
- Same 100-point ceiling and same 10 check names — existing data still readable.
- `commits_after_start` now fails when commits exist but none are attributed to the submitter (closes "fork without own work" abuse).
- Soft `warnings[]` channel — surfaces fork notices etc. without zeroing a check.

### 7. Ops hardening (`feature/ops-hardening`)
- `lib/env.ts` — `requireEnv` / `auditEnv` for centralised env validation.
- `lib/rate-limit.ts` — in-process token bucket wired into `proof/submit` (3/min), `relay/claim` (5/min), `appeals` (2/min), `oauthStart` (5/min), `oauthCallback` (10/min). Documented as best-effort (resets on cold start).
- `/api/health` — public health check returning 200/503 with env audit + DB ping + RPC tip block + latencies.
- `/ops-ql` gains a **System** tab — env audit, indexer state (last block / last event / total events), submission counts by status, last 25 system log lines.

---

## Unchanged v1 core

- Same three deployed contracts:
  - `QuestLockCore`: `0xCCe52216B17096235c070ce85F5C4fFBbf9E782C`
  - `QuestRewardToken`: `0x154250cc3253b4C7a0f1bfe0eCc26792c81b3054`
  - `QuestBadge`: `0x1010F4fB73b2DCb4b2bD43D87E0210cb6a00bBAe`
- Same EAS schema UID: `0x3c9b890e57a3887a0766fe0bf74df896e9551d7b173b3113e3363149156940a6`
- Same 100-point scoring rubric, same 10 check names, same pass mark logic.
- Same submission lifecycle statuses (no new statuses added to the submission state machine — appeals are a sibling table).
- Same proof-to-claim flow: connect wallet → submit → score → attest → approve → claim.
- Same gasless model: verifier-signed `claimRewardFor` (no user gas).
- Same admin gate (`ADMIN_WALLET_ADDRESS`).

---

## Tests passed on `dev` (this run, just now)

| Gate | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run lint` (aliased to strict `tsc`) | ✅ clean |
| `npm run build` | ✅ clean — 25 routes built |
| `npx hardhat compile` | ✅ no changes to compile |
| `npm run test:contracts` | ✅ **18 passing** (same as v1) |
| `npm test` (Jest backend) | ✅ **50 passing** (v1.1 added 50; v1 backend tests were 0) |
| Deployed contract addresses unchanged | ✅ confirmed against `deployments/baseSepolia.json` |
| `.env` excluded from git | ✅ confirmed |
| `.env.example` updated for v1.1 (GitHub OAuth + DIRECT_URL + INDEXER_SECRET) | ✅ |

---

## Manual QA checklist (please run through these)

### V1 regression — must still work
1. Visit `/quests`. Sample quest "Build a Simple Onchain Guestbook" is listed.
2. Open it. Description, scoring rubric and Submit form render.
3. Connect a wallet (Privy modal opens, email + Google + wallet options visible).
4. Submit proof with a valid GitHub repo. Timeline animates through SUBMITTED → EVALUATING → PASSED → ATTESTING → ATTESTED → APPROVING_ONCHAIN → APPROVED_ONCHAIN.
5. Score breakdown renders with per-check pass/fail.
6. EAS attestation card appears with a working `View on EASScan →` link.
7. "Claim Reward (Gasless)" button appears. Clicking it transitions to "Reward Claimed" with a working BaseScan tx link. **No wallet signature, no gas paid.**
8. Visit `/me`. Completed quest appears with Attestation, Claim tx and Approval tx links. Badge balance is 1 in the wallet.
9. Visit `/ops-ql/submissions/[id]` as admin. Full proof inspection renders, including per-check details.

### V1.1 features
10. **GitHub linking** — Open `/me` as a wallet with no linked account. Click `Connect GitHub` → GitHub authorise → bounce back to `/me?github=linked` → card now shows your `@login` + avatar + connected date. `Disconnect` removes it.
11. **GitHub enforcement** — Disconnect, then go to `/quests/[id]` → Submit form is blocked with "Connect GitHub on Profile →" CTA. Reconnect, then submit a repo whose owner does NOT match your linked login — POST `/api/proof/submit` returns 400 with the mismatch message.
12. **Public proof page** — Open `/proof/<submissionId>` for any of your `APPROVED_ONCHAIN/CLAIMED` submissions (the v1 successful submission still works). The full certificate renders: subject = `@login`, score, risk band, EAS link, approval tx, claim tx, proof hash, every per-check pass/fail. Try the same path for a `FAILED` submission — 404.
13. **Sponsor flow** — From any wallet, go to `/create`. Fill the form. Submit. Your request appears in the "Your requests" panel as `PENDING_REVIEW`.
14. **Admin review** — As admin wallet (`0x1f63ea74…525B`), visit `/ops-ql/quest-requests`. The new request is there. Click **Approve**. Status flips to `APPROVED`. Click **Publish onchain**. After a few seconds the request reaches `PUBLISHED` with a tx link and an `onchain quest #<id>` chip. The corresponding `quests` row is now live on `/quests`.
15. **Appeals** — Submit a deliberately failing proof (e.g. a private repo URL). Status goes to `FAILED` with reasons. As that wallet, click "Request review" on the submit result page → fill reason → submit. Reload — the panel now shows `Pending review`.
16. **Admin appeal approve** — As admin, visit `/ops-ql/appeals`. The appeal is listed with the original failure reasons. Click **Approve onchain**. After a few seconds the appeal shows `APPROVED` with attestation + approval tx links. The underlying submission flips to `APPROVED_ONCHAIN` with `risk_band = MANUAL_REVIEW`. Reload `/submit/<questId>?submissionId=<id>` as the original wallet — Claim button is now visible. Claim and confirm tokens + badge arrive.
17. **Analytics** — As admin, visit `/ops-ql/analytics`. Global tiles populate with real counts. QUEST pool balance reads from chain. Each quest card shows its per-status counts and conversion rates. Top failure reasons table is sorted by count.
18. **/api/health** — `curl http://localhost:3000/api/health` returns 200 with `status: "ok"`, env audit clean, DB and RPC `ok: true` with latency_ms.
19. **Rate limits do not block normal use** — Three normal proof submissions in a row succeed (the 4th in under 60s returns 429 with `Retry-After`, which is the intended behaviour).
20. **System tab** — As admin, open `/ops-ql` → System tab. Env audit shows OK, submission counts by status are populated, recent logs render.

---

## Security / privacy checks

| Check | Status |
|---|---|
| GitHub OAuth secrets are server-only (no `NEXT_PUBLIC_` prefix) | ✅ `GITHUB_OAUTH_CLIENT_SECRET` is server-only |
| Public proof pages do not expose raw GitHub API data | ✅ `toPublicProof` whitelist; tested |
| Public proof pages do not expose admin notes or rejection reasons | ✅ not in whitelist; tested |
| Public proof pages do not expose anti-farm internals | ✅ `risk_band` exposed, full anti-farm payload not |
| Normal users cannot access `/ops-ql/*` admin data | ✅ all admin API routes gated by `x-wallet-address === ADMIN_WALLET_ADDRESS`; pages render "Access denied" client-side |
| Normal users cannot publish quests onchain | ✅ `/api/quest-requests` is public but only stores `PENDING_REVIEW`; `/api/ops-ql/quest-requests/[id]/publish` is admin-gated |
| No private keys or secrets committed | ✅ `.env` not tracked; only `process.env` reads in source |
| `.env.example` updated | ✅ added `GITHUB_OAUTH_*`, `DIRECT_URL`, `INDEXER_SECRET` |
| GitHub OAuth state HMAC-signed and time-bounded | ✅ 10-min TTL, constant-time verify |
| Access token discarded after `/user` lookup | ✅ never persisted, never returned to client |
| Same GitHub identity cannot link to two wallets | ✅ unique DB index + explicit conflict check |
| Appeal API rate-limited | ✅ 2/min per wallet |
| Quest request API rate-limited | ✅ 3/min per wallet |

---

## Known limitations (v1.1)

- **Appeals cannot recover onchain `REJECTED` submissions.** The current contract has no path to flip a `REJECTED` status to `APPROVED`. v1 failures terminate offchain so this is fine today; if a future change starts onchain rejections we will need a contract upgrade.
- **Rate limits are best-effort.** State held in module memory; resets on server restart / serverless cold start. Swap the store backend without changing the API for durability.
- **Contract event indexer is manual.** `POST /api/indexer` is gated by `x-indexer-secret`; not yet wired to a scheduled trigger.
- **Privy Google OAuth uses Privy's shared credentials.** Fine for prototyping; will need its own Google app for production branding on the consent screen.
- **Analytics dashboard is admin-only.** Sponsor-facing analytics aren't built yet.
- **No charting library.** Tables and percentages only — by design.

---

## Deploy / upgrade notes

### To bring an existing v1 deploy up to v1.1

1. **Pull the code** — `git fetch origin && git checkout dev` (or merge `dev` into your branch once approved).
2. **Install deps** — `npm install`. New deps in v1.1: `@types/jest` (devDep). No new runtime deps added.
3. **Apply migrations:**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
   New migrations: `20260604120000_add_github_oauth_fields`, `20260604130000_quest_requests`, `20260604140000_submission_appeals`.
4. **Update `.env`** — copy any new keys from `.env.example`:
   - `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_OAUTH_REDIRECT_URI` (required if you want GitHub linking).
   - `DIRECT_URL` (required for `prisma migrate`).
   - `INDEXER_SECRET` (optional; falls back to `VERIFIER_PRIVATE_KEY` for OAuth state HMAC).
5. **Create a GitHub OAuth App** — github.com/settings/developers → New OAuth App → callback `${NEXT_PUBLIC_APP_URL}/api/auth/github/callback`.
6. **No contract redeploy.** Existing addresses still valid.
7. **No EAS schema change.** Existing UID still valid.
8. **Restart the app.** New routes and migrations are picked up at boot.

### Verify before promoting to `main`
```bash
npm run typecheck && npm run build && npm test && npm run test:contracts
```
Expect: 18 contract + 50 backend = 68 tests passing.

### Promotion plan (run only after manual QA sign-off)
```bash
git checkout main
git merge --ff-only dev
git push origin main
git tag v1.1.0
git push origin v1.1.0
```
