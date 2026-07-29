# GitHub OAuth Client Secret Rotation Plan

**Branch:** `feature/secret-rotation-plans` (local only — not pushed)
**Status:** DRAFT — execution requires owner approval.
**Recommendation:** rotate before the final v1.2 public release. Can be done before or after V2 deploy; ideally in its own window for clean isolation.

> ⚠️ **Hard rules**
> 1. Never paste any client secret into chat.
> 2. Never commit a `.env*` file.
> 3. Never put a client secret in this document.
> 4. Never log the client secret — even partial.
> 5. Use placeholders `<NEW_GITHUB_OAUTH_CLIENT_SECRET>` everywhere.
> 6. The `GITHUB_OAUTH_CLIENT_ID` is **not** a secret (it's visible in the OAuth redirect URL). Only the secret rotates.

---

## 1. Why rotate

The current `GITHUB_OAUTH_CLIENT_SECRET` was pasted into chat during v1.1 development. Even though:
- the secret only authorises the QuestLock backend to exchange an OAuth `code` for an access token (it is not user-facing),
- and our backend discards the access token immediately after one call to `/user`,
- a leaked client secret combined with a hijacked OAuth callback URL could let an attacker impersonate QuestLock during the exchange step.

Rotating before the final v1.2 public release is the right hygiene step.

---

## 2. What it affects

- `lib/github-oauth.ts → exchangeCodeForUser` — server-side token exchange
- `/api/auth/github/callback` — uses the secret to complete the OAuth handshake
- Any future GitHub OAuth-related call (none today; we only call `/user`)

---

## 3. What it does NOT affect

- **Already-linked users do not need to reconnect.** The QuestLock backend stores only `github_id`, `github_login`, avatar URL, profile URL, and `connected_at` on the user row. No long-lived access token is persisted. Existing links continue to work because the linking is recorded in our DB, not held in GitHub's session.
- The HMAC-signed OAuth state token (`buildState` / `verifyState` in `lib/github-oauth.ts`) is independent of the client secret. Its signing key is `INDEXER_SECRET` (with `VERIFIER_PRIVATE_KEY` as fallback). Not affected by this rotation.
- The `GITHUB_OAUTH_CLIENT_ID` is not rotated. It stays the same.
- The OAuth callback URL stays the same:
  - Local: `http://localhost:3000/api/auth/github/callback`
  - Production: `https://quest-lock.vercel.app/api/auth/github/callback`
- The `GITHUB_TOKEN` (PAT used for proof scoring via REST API) is a different secret and is **not** in scope for this plan.

---

## 4. Safe rotation sequence

### A. Open GitHub OAuth App settings
- Visit https://github.com/settings/developers
- Click into the QuestLock production OAuth app (the one whose callback is the Vercel URL)

### B. Generate new client secret
- Click **Generate a new client secret**
- GitHub displays the new secret **exactly once** — copy it immediately into your clipboard
- **Do not paste it into chat. Do not screenshot it. Do not commit it.**
- Within the same minute, paste it into the local `.env` (see step C) and into Vercel (see step E)

### C. Update local `.env`
```diff
-GITHUB_OAUTH_CLIENT_SECRET=<OLD_GITHUB_OAUTH_CLIENT_SECRET>
+GITHUB_OAUTH_CLIENT_SECRET=<NEW_GITHUB_OAUTH_CLIENT_SECRET>
```
Restart `npm run dev`.

### D. Test local GitHub connect/disconnect
1. On `http://localhost:3000/me`, disconnect GitHub if currently linked.
2. Click **Connect GitHub** → bounce through GitHub → land back on `/me?github=linked`.
3. Verify `@github_login` and avatar render.
4. Click **Disconnect** → confirm `connected: false` in `/api/auth/github/status?wallet=<your_wallet>`.
5. Reconnect to leave the linking in place.
6. Submit a small proof to confirm the linked-login enforcement still passes (existing flow regression check).

### E. Update Vercel env
1. dashboard.vercel.com → quest-lock → Settings → Environment Variables
2. Find `GITHUB_OAUTH_CLIENT_SECRET` for Production scope
3. **Edit** → paste `<NEW_GITHUB_OAUTH_CLIENT_SECRET>` → save
4. Repeat for Preview and Development scopes if they were set
5. Trigger a redeploy (Deployments → most recent → ⋯ → Redeploy with same source)

### F. Test production GitHub linking
On https://quest-lock.vercel.app/me:
1. Disconnect (if currently linked with the production OAuth app)
2. Connect GitHub → bounce → land back on `/me?github=linked`
3. Submit a proof for an active quest (existing v1 flow regression check)
4. Confirm the full pipeline (score → attest → approve → claim) still works

### G. Confirm callback URL remains unchanged
On the GitHub OAuth App page, verify the Authorization callback URL is still exactly:
- `https://quest-lock.vercel.app/api/auth/github/callback`

If you have a separate **local OAuth app** with a localhost callback, its client secret is independent — rotating production's secret does not require rotating local's. (Recommended: rotate local separately if also leaked.)

---

## 5. Callback URLs

| Environment | Callback URL |
|---|---|
| Local | `http://localhost:3000/api/auth/github/callback` |
| Production | `https://quest-lock.vercel.app/api/auth/github/callback` |

These are configured in the GitHub OAuth App settings UI. They do **not** change as part of secret rotation. They match the env var `GITHUB_OAUTH_REDIRECT_URI` in `.env` / Vercel.

---

## 6. Rollback

If GitHub linking breaks after the rotation:

| Symptom | Cause | Rollback |
|---|---|---|
| `?github=exchange_failed` on callback | Client secret typo in env | Re-copy from GitHub OAuth settings (note: the old secret cannot be restored — GitHub shows a new secret only once. If the new secret was lost, **Generate a new client secret** again and paste the freshest one). |
| `?github=missing_params` | Callback URL drift | Verify `GITHUB_OAUTH_REDIRECT_URI` env matches the URL configured on the OAuth App page exactly. |
| `?github=invalid_state` | HMAC state issue (NOT related to this rotation — check `INDEXER_SECRET` env instead) | Different rotation; out of scope here. |
| GitHub link returns nothing | Vercel env not propagated | Re-trigger redeploy after env edit. |

Worst case: revert Vercel env to the previous-but-one secret if you kept it offline somewhere safe. Generally do not keep old secrets — once rotated, the old one stops working at GitHub's edge anyway.

---

## 7. Recommendation

Rotate GitHub OAuth secret **before** final v1.2 public release, but **not** in the same execution window as V2 contract deployment unless necessary.

Reason:
- V2 deploy moves on-chain state and DB schema. Bundling an OAuth secret rotation in the same window adds a third failure surface (OAuth handshake) on top of the contract + DB risks.
- GitHub OAuth rotation is reversible within minutes; V2 deploy is not. Run them in separate windows so any rollback is unambiguous.

Proposed schedule:
1. Verifier rotation (separate plan)
2. V2 deploy + smoke test (separate plan)
3. v1.2 product features (separate branches)
4. **GitHub OAuth secret rotation** ← here, just before final public announcement
5. v1.2 production smoke test
6. Tag v1.2.0
7. Deployer/admin rotation in its own later window

---

## 8. Acceptance

This plan is local-only documentation. No commands here will be executed without owner go-ahead.
