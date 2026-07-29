# QuestLock v1.2 — Live Demo Script

> Target run-time: **6 minutes**. Practice once end-to-end before any live demo. Have the verifier wallet funded with at least 0.05 ETH on Base Sepolia and the test sponsor wallet funded with at least 50 QUEST.

## Setup (do this 10 minutes before)

1. Two browser profiles open, side by side:
   - **Profile A (Sponsor)** — connected wallet with QUEST balance
   - **Profile B (Builder)** — connected wallet with a linked GitHub account
2. One terminal tab open to the questlock repo root with `npm run dev` running.
3. Blockscout tab pre-loaded at the V2 contract page.
4. EAS Scan tab pre-loaded at the schema page.
5. Disable browser notifications and email popups.

---

## Beat 1 — Hook (0:00–0:30)

> "QuestLock pays builders for proof of work, not for following a leaderboard. In v1.2 we made every quest self-funded by its sponsor — so rewards never run dry mid-quest, and sponsors never wonder where their money went."

**On screen:** landing page (`/`).

---

## Beat 2 — Sponsor creates and funds a quest (0:30–2:00)

> "Here's the sponsor side. They request a quest, an admin approves it, and then the sponsor funds the per-quest pool from their own wallet."

1. **Profile A → `/create`** — fill the form for a GitHub Builder Quest:
   - Title: "Demo: Ship a Counter dApp"
   - Reward: 5 QUEST, max claims: 3, deadline: +14 days
   - Show the proof-type dropdown — call out that we support 5 types
2. **Profile A → `/sponsor`** — show the new quest in PENDING_REVIEW.
3. **Admin (same browser, second tab) → `/ops-ql/quest-requests`** — approve + publish. Call out: "This is the only admin step — once published, the sponsor owns the funding flow."
4. **Profile A → `/sponsor/quests/[id]`** — funding panel.
   - Click **Fund** for `requiredFunding = 15 QUEST` (3 claims × 5 reward).
   - Approve the ERC-20 spend in MetaMask, then fund.
   - Show the funding status flip from `UNFUNDED` → `FUNDED`.

**Key line:** "Notice the backend never touched my wallet. I signed every transaction myself."

---

## Beat 3 — Builder submits proof (2:00–4:00)

> "Now the builder side. They prove they shipped a GitHub project, the platform runs 10 deterministic checks, and if they pass, they get an EAS attestation and a gasless claim."

1. **Profile B → `/quests`** — browse to the new quest.
2. **Profile B → `/quests/[id]`** — show requirements + submit form.
3. Submit with a pre-prepared GitHub repo URL + demo URL.
4. **`/submit/[questId]`** — talk through the live status:
   - `SUBMITTED` → `FETCHING_PROOF` → `EVALUATING` → `PASSED`
   - Point out the 10 green checks
   - Point out the EAS attestation link → click it → flip to EAS Scan tab briefly
5. Click **Claim Reward (Gasless)**.
   - In MetaMask, no transaction popup — backend submits.
   - Status flips to `CLAIMED`.
6. **Profile B → `/me`** — show the new badge + the reward.

**Key line:** "Three checks ran, the user paid zero gas, and there's a public attestation on EAS proving it."

---

## Beat 4 — Public proof + leaderboard (4:00–4:45)

> "Every passed quest produces a public certificate. Anyone can verify on-chain — no QuestLock account required."

1. Click the certificate link from `/me` → opens `/proof/[id]` in a new tab.
2. Walk through the cert:
   - Score + risk band + badge
   - EAS attestation link
   - Approval tx + claim tx on Blockscout
   - Per-check breakdown
3. **`/leaderboard`** — show the builder appears, ranked by completed quests.

**Key line:** "Notice the cert renders different fields based on proof type — GitHub commits here, but a Discord cert would show guild + role, an X cert would show the post URL. Each adapter decides what's public-safe."

---

## Beat 5 — Sponsor monitors + closes (4:45–5:30)

> "Back to the sponsor side. They can see live funding, top up, or close the quest."

1. **Profile A → `/sponsor/quests/[id]`** — show the funded/claimed/withdrawn accounting.
2. Click **Top up** — fund another 10 QUEST. Show the status stays `FUNDED`.
3. Mention: "After the deadline, they can withdraw unused funds with `withdrawUnusedQuestFunds`. Right now we'd have to close first since we're before deadline."

---

## Beat 6 — Admin Retry Centre + close (5:30–6:00)

> "Last beat: when something gets stuck — bad RPC, missed event, transient failure — admins have one-click recovery."

1. **Admin → `/ops-ql/retry`** — walk through the four sections:
   - Indexer (single button)
   - Proof check (github_project)
   - Attestation
   - Onchain approval
2. Mention: "All ops are idempotent. Double-click does nothing harmful."
3. **Close:**
   > "QuestLock v1.2 — sponsor-funded, multi-proof, on Base Sepolia today. Proof over hype."

---

## If you have extra time (90 seconds)

Show the **notification bell** in the Navbar with at least one unread item. Walk through the dropdown, click mark-all-read, show the count drops to zero.

## Fallback if something breaks

| Failure | Recovery |
|---|---|
| Network blip during fund tx | Skip to Beat 3 using a pre-funded backup quest. |
| GitHub OAuth flaky | Use Profile C with a session already established. |
| Verifier wallet unfunded | Pause, top up via the test faucet, resume. |
| Indexer behind | Open `/ops-ql/retry` and run indexer live — turns into a feature demo. |

## What NOT to show

- The `.env` file
- Any private key
- The `DATABASE_URL`
- The admin Privy session details
- The Discord bot token
- Any wallet address other than the test sponsor + test builder + test admin
