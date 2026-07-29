# QuestLock — Known Limitations (v1.2.1)

## v1.2.1 sponsor trust model

- **Tiered trust** — new sponsors start at `new`. First 3 manual approvals
  route to admin confirmation. After 3 admin-confirmed approvals → promoted
  to `trusted`; their approvals fire onchain immediately.
- **High-value gate** — trusted sponsors still need admin confirmation when
  a quest's max payout (reward × max_claims) ≥ 500 QUEST.
- **Flagged / suspended** — admin-only toggle via the Confirmations page.
  Flagged sponsors return to admin-confirmed approvals; suspended sponsors
  cannot approve at all.
- **Existing sponsors** at the time of v1.2.1 deploy start at `new` —
  intentional, gives admin a few cycles to validate the flow before
  promoting anyone.
- Promotion is **automatic on threshold hit**. Demotion is **manual only**
  (admin must flag or suspend).

Honest list, in priority order. Everything here is a deliberate trade-off, not a bug.

## Network & infrastructure

- **Base Sepolia testnet only.** No mainnet deployment, no multi-chain reward bridging. Reward token (`QUEST`) has no economic value.
- **Single-region cron.** The scheduled indexer runs from Vercel's default region. A regional outage means events accumulate until the next successful run.
- **No paid RPC.** The default `BASE_SEPOLIA_RPC_URL` is `https://sepolia.base.org`. Under load you may want to swap to a paid provider.

## Proof adapters

- **GitHub is the only fully deterministic adapter.** Manual / X / LMS adapters default to admin manual review. Discord is deterministic only when `DISCORD_BOT_TOKEN` is configured AND the bot is a member of the required guild — otherwise it falls back to manual review.
- **All 5 proof types are fully reachable via the UI end-to-end** —
  sponsors pick proof_type on `/create` (with template chips that pre-fill the form),
  admin creates direct quests with proof_type on `/ops-ql`,
  `/quests/[id]` dispatches the correct submit form by `quest.proof_type`,
  and non-github submissions POST to `/api/proof/multi`. All five paths flow into the same EAS attestation + claim layer.
- **No paid X API.** The free X tier does not return post content. The `x_post` adapter validates URL format + parses handle/post_id, and then defers content verification (required hashtag/mention/phrase) to admin manual review. URL parsing is deterministic; content authenticity is not.
- **GitHub adapter trusts GitHub's authorship attribution.** If a user co-authors commits with `Co-Authored-By:` trailers, only the primary author counts toward `commits_after_start`.
- **Demo URL check** does not execute JavaScript or detect SPA route changes — it only checks that the URL returns a 2xx within the timeout.

## Contracts

- **V1 contract is not retired.** Old `QuestLockCore` (`0xCCe5…782C`) still holds legacy quests and still has `VERIFIER_ROLE` granted to the old verifier wallet. This is a deliberate rollback path — the cut-over to V2 + new verifier is reversible.
- **No on-chain way to flip a `REJECTED` submission to `APPROVED`** on either V1 or V2. The appeal queue avoids this by never having the verifier call `rejectSubmission` for offchain failures (rejections terminate before going onchain).
- **Sponsor cannot reduce `requiredFunding` after creation.** They can top up or withdraw unused funds after deadline, but reducing the per-claim reward or `maxClaims` is not supported.

## Sponsor funding

- **Wallet-signed only.** Sponsors must sign every fund / top-up / withdraw / close transaction from their connected wallet. The backend never holds sponsor funds and has no key path to move them. This is a security property, not a limitation — but it does mean sponsors need a funded wallet on Base Sepolia.
- **Withdrawal is gated by `block.timestamp >= deadline` or `closeQuest`** — sponsors cannot withdraw partial leftover funds mid-quest without closing it.

## Identity & auth

- **No KYC.** Wallet address is the only identity primitive.
- **GitHub OAuth tokens are exchanged server-side and discarded immediately** — they never reach the browser. We store only the linked `github_id`, `login`, `avatar_url`, `profile_url`, `connected_at`.
- **Discord OAuth has the same posture** but only fetches profile, not guild membership at link time — guild role checks happen at proof-submit time via the bot token.

## Rate limiting

- **Durable rate limit falls back to in-process** on DB error. Under a Supabase outage, limits become per-server-instance — a serverless cold start resets them.

## Admin operations

- **Retry Centre proof-check supports github_project only.** Re-running a check for manual / X / LMS / Discord submissions doesn't make sense — those have no automated score to recompute. Use the appeal queue instead.
- **Indexer retry is global** (no per-quest scope). It re-scans from the last recorded block.
- **No audit log surface in the UI yet.** All retries are written to `system_logs` (and surfaced in the `/ops-ql` System tab) but there is no dedicated audit-trail page.

## Public certificate

- **No social-network preview generation server-side.** OpenGraph tags are emitted, but link previews on X / Telegram / Slack depend on those crawlers respecting the meta tags.
- **No PDF/image export.** Certificates are HTML pages.

## Notifications

- **In-app only.** No email, no push, no Discord DM. The bell polls every 30s while the tab is open — closed tabs don't receive anything until they're reopened.

## Things deliberately deferred (not bugs)

| Item | Why deferred |
|---|---|
| Paid X API integration | Out of scope per v1.2 brief ("free tier only"). |
| AI / LLM evaluation | Out of scope per project rules. |
| GenLayer integration | Out of scope per project rules. |
| Mainnet deployment | Out of scope per v1.2 brief. |
| Multi-chain reward bridging | Out of scope per v1.2 brief. |
| Sponsor self-publish (no admin approval) | Trust model unresolved — kept admin-gated for safety. |
| Reputation levels & seasons | Future release. |

---

If you hit something that isn't on this list and feels broken, it probably is — open an issue.
