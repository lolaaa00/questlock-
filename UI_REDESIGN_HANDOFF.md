# QuestLock — UI Redesign Handoff Package

> Everything a frontend designer/developer needs to reskin QuestLock without touching backend logic, API contracts, or on-chain interactions.

**Current version:** v1.2.1 (tag `3ec9919`, live at https://quest-lock.vercel.app)
**Prepared:** 2026-06-05

---

## 1. Ground Rules

### What you CAN change

- All CSS, Tailwind classes, colours, typography, spacing, layout
- Component visual structure (HTML/JSX nesting, wrappers, classNames)
- Icons, illustrations, brand assets
- Animation, transitions, micro-interactions
- Light/dark mode implementation
- Mobile responsive behaviour
- Component file organisation (move, split, merge components)

### What you MUST NOT change

- **API calls** — every `fetch(...)` URL, method, request body shape, and response consumption must stay exactly as-is. The backend returns specific JSON shapes the frontend relies on.
- **Privy / wagmi / viem hooks** — `usePrivy()`, `useWriteContract()`, and all wallet-interaction code must stay. These are not UI — they're the wallet bridge.
- **Route paths** — `/quests`, `/quests/[id]`, `/submit/[questId]`, `/proof/[id]`, `/me`, `/sponsor`, `/sponsor/quests/[id]`, `/create`, `/ops-ql/*`, `/leaderboard`. These are server-side filesystem routes in Next.js App Router. Renaming them would break bookmarks + the API layer.
- **Component props** — the data flow (what props a component receives) must stay. You can rename internal variables but the public interface that the page passes in must be preserved.
- **Form field names and validation logic** — what data gets collected and how it's validated is backend-coupled.
- **Status strings** — `SUBMITTED`, `APPROVED_ONCHAIN`, `CLAIMED`, `SPONSOR_APPROVED_PENDING_ADMIN`, etc. These are database-level constants.
- **Admin wallet check** — `walletAddr?.toLowerCase() === "0x1f63ea74065586af0c7c48428372d88d0a89525b"` gates admin surfaces. Keep the gate, just restyle what's inside.

### Key architectural constraint

QuestLock uses **Next.js 15 App Router** with a mix of:
- **Server Components** (default, no `"use client"`) — can do Prisma calls, cannot use React hooks
- **Client Components** (`"use client"` at top) — can use hooks, `useState`, `useEffect`, `usePrivy()`

The `"use client"` directive at the top of each file is NOT a styling choice — it determines what React features are available. Preserve it exactly.

---

## 2. Current Design System

### Colour Palette (CSS Variables + Tailwind tokens)

| Token | Hex | Current use |
|---|---|---|
| `--ql-bighorn` | `#22150C` | Primary dark surface (navbar, profile header, admin pages) |
| `--ql-night` | `#432C1A` | Secondary dark (admin cards) |
| `--ql-derby` | `#5B4535` | Muted surface, secondary text |
| `--ql-bear` | `#816550` | Metadata text, labels, helper text |
| `--ql-cafe` | `#A98C75` | Borders, input outlines, admin link text |
| `--ql-chocolate` | `#834A1F` | **Primary CTA** — Submit, Claim, Connect, Fund buttons. All primary actions. |
| `--ql-ashen` | `#D3CBC1` | Light background, nav link text on dark |
| `--background` | `#D3CBC1` | Page-level background |
| `--card` | `#F5F1EC` | Card surfaces (quest cards, form containers, proof checks) |
| `--muted` | `#E7DED4` | Muted backgrounds (wallet strip, disabled inputs) |
| `--border` | `rgba(169,140,117,0.45)` | Card borders, separators |
| `--accent` | `#834A1F` | Same as chocolate. CTA fills. |
| Success | `#2D5A2D` fg / `#D9EDD9` bg | Passed checks, approved states, trust=trusted |
| Warning | `#7A5A20` fg / `#FFF1D6` bg | Pending states, new sponsor |
| Error | `#7A2020` fg / `#F0DADA` bg | Failed checks, rejected, flagged |
| Discord brand | `#5865F2` | Discord connect button only |

### Typography

- **Font:** Plus Jakarta Sans (Google Fonts, weights 400–800)
- `.font-serif` is mapped to Plus Jakarta Sans (not a real serif — legacy naming)
- `.font-sans` also Plus Jakarta Sans
- **Scale (Tailwind):** `text-xs` (metadata), `text-sm` (body), `text-lg` (section headings), `text-2xl`/`text-3xl` (page titles), `text-4xl` (hero)
- **Mono:** `font-mono` for wallet addresses, hashes, scores

### Shape & Spacing

- **Card radius:** `rounded-[18px]` everywhere
- **Button radius:** `rounded-full` (pill shape)
- **Page padding:** `py-6 sm:py-10 px-4 sm:px-6` (responsive)
- **Max-width:** `max-w-3xl` (forms, certs), `max-w-4xl` (profile), `max-w-5xl` (admin lists, sponsor), `max-w-6xl` (admin dashboard, analytics)
- **Card shadow:** `0 18px 50px rgba(34,21,12,0.12)`

### Status Badge Colours (9 states)

| CSS class | Background | Text | State |
|---|---|---|---|
| `.badge-submitted` | `#E7DED4` | `#5B4535` | Initial submission |
| `.badge-checking` | `#F0E8DF` | `#834A1F` | Fetching / evaluating / attesting |
| `.badge-passed` | `#D9EDD9` | `#2D5A2D` | Proof passed |
| `.badge-failed` | `#F0DADA` | `#7A2020` | Proof failed |
| `.badge-attested` | `#D9EBF5` | `#1A4A6B` | EAS attestation issued |
| `.badge-approved` | `#D4E8D4` | `#1E5C1E` | (legacy, rarely used) |
| `.badge-claimable` | `#834A1F` | `#F6F1EA` | Reward unlocked |
| `.badge-claimed` | `#22150C` | `#F6F1EA` | Reward claimed |
| `.badge-rejected` | `#C9A0A0` | `#5A0000` | Rejected |

Plus a new v1.2.1 state handled in the StatusBadge component:
- `SPONSOR_APPROVED_PENDING_ADMIN` → uses `.badge-checking`

### Scrollbar

Custom webkit scrollbar: 6px width, muted track, cafe thumb, 3px radius.

---

## 3. Page-by-Page Inventory

### Public Pages

#### `/` — Landing Page (294 lines, Server Component → Client)

**Purpose:** Hero marketing page. "Rewards should follow proof, not farming."

**Layout:**
- "BASE SEPOLIA · PROOF-POWERED" chip
- Hero headline + subtext
- Two CTAs: "Browse Quests" → `/quests`, "Create Quest" → `/create`

**Data needed:** None. Static.

**Constraints:** Keep the two CTA buttons linking to `/quests` and `/create`.

---

#### `/quests` — Quest Marketplace (70 lines, Server Component)

**Purpose:** Grid of active quests.

**Data:** Fetches from Prisma directly (server component). Renders `QuestCard` for each quest.

**Layout:** Responsive grid `md:grid-cols-2 lg:grid-cols-3`. Empty state with "No active quests" + admin link.

**Constraints:** Must render `QuestCard` for each quest. Each card links to `/quests/[id]`.

**Component dependency:** `QuestCard` (105 lines)
- Props: `id, title, description, rewardAmount, badgeId, deadline, minScore, maxClaims, claimCount, status`
- Wraps in a `<Link href="/quests/{id}">`
- Shows: title, truncated description, reward amount, badge name, deadline countdown, claims fraction, proof-type chip

---

#### `/quests/[id]` — Quest Detail + Submit Form (225 lines, Server Component with Client sub-components)

**Purpose:** Full quest info + proof submission form.

**Layout:** Two-column `grid md:grid-cols-2`:
- Left: quest details (title, description, requirements, status, deadline, reward, badge, claims, proof type chip)
- Right: `ProofSubmissionForm` (dispatcher for 5 proof types)

**Component dependencies:**
- `CreatorGuardNotice` (44 lines) — red banner if caller is the quest creator/sponsor
- `ProofSubmissionForm` (552 lines) — the 5-way dispatcher, described in Section 5

**Data:** Server-side Prisma fetch. Passes `quest.proof_type` to ProofSubmissionForm.

**Constraints:** Must render `CreatorGuardNotice` when `wallet = created_by || sponsor_wallet`. Must pass `proofType={quest.proof_type}` to the form.

---

#### `/submit/[questId]` — Submission Status + Claim (256 lines, Client Component)

**Purpose:** Real-time status tracker after proof submission.

**Layout:**
- Left column: `ProofTimeline` (step-by-step status: Submitted → Evaluating → Passed → Attested → Unlocked → Claimed)
- Right column: `ScoreBreakdown` (10 checks with pass/fail + points)
- Below: `AttestationCard` (EAS UID, score, risk band, network, EASScan link)
- Below: `GaslessClaimButton` (or `AppealCTA` if failed)

**Data:** Polls `GET /api/proof/status/{submissionId}` every 3s until terminal state.

**Component dependencies:**
- `ProofTimeline` (132 lines) — 6 steps, colour-coded by status
- `ScoreBreakdown` (138 lines) — table of 10 checks
- `AttestationCard` (96 lines) — EAS certificate block
- `GaslessClaimButton` (99 lines) — POST `/api/relay/claim`
- `AppealCTA` (184 lines) — POST `/api/appeals`

**Constraints:** Must poll the status endpoint. Must preserve the GaslessClaimButton's fetch to `/api/relay/claim`. Must preserve AppealCTA's fetch to `/api/appeals`.

---

#### `/proof/[id]` — Public Certificate (501 lines, Server Component)

**Purpose:** Shareable, public, verifiable proof-of-completion page.

**Layout:**
- Hero card: subject identity (display_name → @github → short wallet), score, risk band, reward, badge
- Onchain verification links: EAS attestation, approval tx, claim tx (all Blockscout/EASScan links)
- Adapter-aware "Submitted Work" section (per proof type — see Section 5)
- Proof type chip
- Proof checks table
- Footer tagline

**Data:** Server-side Prisma fetch → `toPublicProof()` whitelist.

**Constraints:**
- Must call `toPublicProof()` — this is the security boundary that strips private fields
- Must render per-type SubmittedArtefacts dispatcher
- External links (EAS, Blockscout) must be `target="_blank" rel="noopener noreferrer"`
- OpenGraph metadata must be preserved (drives link previews on X/Telegram/Slack)

---

#### `/leaderboard` — Filterable Leaderboard (165 lines, Client Component)

**Purpose:** Top 50 wallets by completed quests.

**Layout:**
- Filter row: proof-type chips (All / GitHub / Manual / Discord / X / LMS)
- Badge dropdown filter
- Table: rank, builder identity (fallback chain), wallet, discord handle, completed count, avg score
- Empty state adapts to whether a filter is active

**Data:** Fetches `GET /api/leaderboard?proof_type=&badge_id=`.

**Constraints:** Must pass `proof_type` and `badge_id` query params. Identity column must use the `display_name → @github_login → wallet_short` fallback chain.

---

#### `/create` — Sponsor Quest Request (452 lines, Client Component)

**Purpose:** Any wallet can request a quest. Admin reviews → publishes.

**Layout:**
- Template chips row (5 seeded templates from `/api/templates`)
- Proof type dropdown (5 options)
- Form fields: title, description, requirements, reward, badge, min score, max claims, deadline days, sponsor name/email
- "Your requests" section below (sponsor's own request history with status chips)

**Data:**
- `GET /api/templates` on mount
- `POST /api/quest-requests` on submit
- `GET /api/quest-requests?wallet=` for history

**Constraints:** Must include `proof_type` in the POST body. Template `applyTemplate()` pre-fills the form.

---

#### `/me` — Profile (363 lines, Client Component)

**Purpose:** Wallet profile, identity linking, submission history.

**Layout:**
- Header card (dark bg): avatar (GitHub photo OR initial), display name (fallback chain), wallet, role chips (Builder / Sponsor / Admin — conditional)
- `DisplayNameCard` (save/clear)
- `GithubConnectCard` (OAuth link/unlink)
- `DiscordConnectCard` (OAuth link/unlink)
- Submissions grouped by: Claimable → Completed → Pending → Failed

**Data:**
- `GET /api/submissions?wallet=`
- `GET /api/users/display-name?wallet=`
- `GET /api/auth/github/status?wallet=`
- `GET /api/sponsor/quests?wallet=` (for sponsor chip)

**Component dependencies:**
- `DisplayNameCard` (129 lines) — input + save/clear + flash messages
- `GithubConnectCard` (184 lines) — GitHub OAuth flow
- `DiscordConnectCard` (141 lines) — Discord OAuth flow
- `StatusBadge` (47 lines) — coloured pill per status

**Constraints:**
- Role chips render conditionally: Builder (submissions > 0), Sponsor (sponsored quests > 0), Admin (wallet match)
- OAuth flows start via `POST /api/auth/{github,discord}/start` → redirect to provider → callback writes cookies → redirect back with `?github=linked` or `?discord=linked`
- DisplayName POST to `/api/users/display-name` with `{ walletAddress, displayName }`

---

### Authenticated Pages

#### `/sponsor` — Sponsor Dashboard (191 lines, Client Component)

**Purpose:** List quests this wallet sponsors + trust tier banner.

**Layout:**
- Trust banner (colour-coded by tier: new=amber, trusted=green, flagged=red, suspended=dark red)
- "+ Request quest" CTA → `/create`
- Quest list with funding-status chips per row
- Loading skeleton (3 animated placeholder cards)
- Error state with retry button
- Empty state

**Data:**
- `GET /api/sponsor/quests?wallet=`
- `GET /api/sponsor/trust-status?wallet=`

**Constraints:** Trust banner copy is tier-specific (see v1.2.1 trust model). Each quest links to `/sponsor/quests/[id]`.

---

#### `/sponsor/quests/[id]` — Sponsor Quest Detail (29 lines, Client Component)

**Purpose:** Funding panel + review panel for one quest.

**Components:**
- `SponsorFundingPanel` (318 lines) — fund/topup/withdraw/close via wagmi `useWriteContract`. Reads funding state from `/api/quests/[id]/funding`. Shows funding bar, status chip, accounting breakdown.
- `SponsorReviewPanel` (234 lines) — lists pending non-github submissions. Approve / Reject per row. Trust-tier-aware footer copy.

**Constraints:**
- `SponsorFundingPanel` uses wagmi hooks (`useWriteContract`, `useWaitForTransactionReceipt`). MetaMask popup is triggered by these hooks — cannot be replaced with a simple `fetch`.
- Approve hits `POST /api/sponsor/submissions/[id]/approve` with `x-wallet-address` header.
- Reject hits `POST /api/sponsor/submissions/[id]/reject`.

---

### Admin Pages (gated to admin wallet)

All admin pages are under `/ops-ql/`. They share the same dark-theme pattern: `background: var(--ql-bighorn)`, card bg `var(--ql-night)`, text `#F6F1EA`.

| Page | Lines | Purpose |
|---|---|---|
| `/ops-ql` | 498 | Dashboard: Quests tab, Submissions tab, Create Quest tab, System tab |
| `/ops-ql/submissions/[id]` | 264 | Per-submission inspection (proof checks, tx links, failure reasons) |
| `/ops-ql/quest-requests` | 244 | Sponsor request queue + approve/reject/publish |
| `/ops-ql/appeals` | 260 | Builder appeals queue + approve/reject |
| `/ops-ql/analytics` | 364 | Global tiles + per-quest cards + pool balance |
| `/ops-ql/retry` | 284 | Idempotent retry for 4 pipelines |
| `/ops-ql/confirmations` | 286 | Sponsor-approved-pending-admin queue + per-row trust controls |

**Admin gate:** Every admin page checks `wallet.toLowerCase() === "0x1f63ea74065586af0c7c48428372d88d0a89525b"`. If not, renders "Access denied." If not authenticated, renders "Connect Wallet" button. This logic must be preserved.

---

## 4. Reusable Components (17 total)

| Component | Lines | Used on | Key interaction |
|---|---|---|---|
| `Navbar` | 216 | Every page | Hamburger < md, full bar ≥ md. NotificationBell + wallet chip + logout |
| `NotificationBell` | 182 | Navbar | Polls `/api/notifications?wallet=` every 30s. Dropdown with mark-read |
| `QuestCard` | 105 | `/quests` | Link to `/quests/[id]`. Hover lift animation |
| `ProofSubmissionForm` | 552 | `/quests/[id]` | 5-way dispatcher by proof_type. Sub-forms: GitHub, Manual, Discord, X, LMS |
| `ProofTimeline` | 132 | `/submit/[questId]` | 6 steps, colour-coded. Active/done/pending/failed states |
| `ScoreBreakdown` | 138 | `/submit/[questId]` | Table of 10 checks with pass/fail icons + points |
| `AttestationCard` | 96 | `/submit/[questId]` | EAS UID, score, risk band, network, EASScan link |
| `GaslessClaimButton` | 99 | `/submit/[questId]` | POST `/api/relay/claim`. Shows "Processing Claim..." then redirects |
| `AppealCTA` | 184 | `/submit/[questId]` | POST `/api/appeals`. Form with reason textarea |
| `StatusBadge` | 47 | Everywhere | Status → {label, className} pill |
| `CreatorGuardNotice` | 44 | `/quests/[id]` | Red banner blocking self-submission |
| `SponsorFundingPanel` | 318 | `/sponsor/quests/[id]` | wagmi fund/topup/withdraw/close. ERC-20 approve + V2 contract interaction |
| `SponsorReviewPanel` | 234 | `/sponsor/quests/[id]` | Pending submissions list. Approve/reject per row |
| `GithubConnectCard` | 184 | `/me` | OAuth start/disconnect + status display |
| `DiscordConnectCard` | 141 | `/me` | OAuth start/disconnect + status display |
| `DisplayNameCard` | 129 | `/me` | Input + save/clear via `/api/users/display-name` |
| `RewardPoolTopUp` | 364 | `/ops-ql/analytics` | V1 admin pool top-up (legacy, may not be needed for V2-only future) |

---

## 5. Proof Type Form Dispatch

`ProofSubmissionForm.tsx` is the core dispatcher. It renders one of 5 sub-forms based on `quest.proof_type`:

### github_project
- Fields: GitHub username (locked if linked), Repo URL, Demo URL, Explanation (optional)
- POSTs to: `/api/proof/submit`
- Needs: GitHub linking gate (shows "Connect GitHub on Profile" if not linked)

### manual_project
- Fields: Project Title, Demo URL, Explanation (min 30 chars), Supporting Link (optional)
- POSTs to: `/api/proof/multi`
- Shows info banner: "This quest is admin-reviewed."

### discord_role
- Fields: Optional note for admin
- POSTs to: `/api/proof/multi`
- Needs: Discord linking gate (shows "Connect Discord on Profile" if not linked)
- Shows info banner about deterministic vs manual verification

### x_post
- Fields: X handle, Post URL (client-side regex validated), optional note
- POSTs to: `/api/proof/multi`
- Shows info banner: "URL + author handle validated automatically. Content verified by admin."

### lms_course
- Fields: Platform/Course name, Certificate URL, Completion ID (optional), Explanation (min 30 chars)
- POSTs to: `/api/proof/multi`
- Shows info banner: "Course completions are admin-verified."

### Common across all sub-forms
- Creator/sponsor self-submit guard (wallet check, disabled button)
- Wallet strip showing connected wallet + "Base Sepolia" chip
- Error message box
- Submit button with loading state
- Redirect to `/submit/[questId]?submissionId=...` on success

---

## 6. Public Certificate — Adapter-Aware Sections

`/proof/[id]` renders a "Submitted Work" section that varies by proof type. The data comes from `evidence_public` (whitelisted fields):

| Proof type | Section title | Fields rendered |
|---|---|---|
| `github_project` | "Submitted Work · GitHub Project" | repo URL (link), demo URL (link), language, default branch, commits after start, README chars |
| `manual_project` | "Submitted Work · Manual Project" | project title, demo URL (link), supporting link (link), "Admin-reviewed" note |
| `discord_role` | "Submitted Work · Discord Role" | discord username, guild name, role name |
| `x_post` | "Submitted Work · X / Twitter Post" | handle, post URL (link), post ID |
| `lms_course` | "Submitted Work · Course Completion" | platform, certificate URL (link), completion ID |

If proof type is unknown, a graceful fallback renders just "Proof type: ..." text.

---

## 7. Sponsor Trust Tier — Visual States

The sponsor trust banner on `/sponsor` and the review-panel footer copy on `/sponsor/quests/[id]` adapt per tier:

| Tier | Banner bg | Banner text colour | Copy |
|---|---|---|---|
| `new` | `#FFF1D6` | `#7A5A20` | "Your first N manual approvals require admin confirmation before reward fires." |
| `trusted` | `#D9EDD9` | `#2D5A2D` | "Your approvals fire onchain immediately for standard-value quests. High-value quests still need admin sign-off." |
| `flagged` | `#F0DADA` | `#7A2020` | "Your approvals are temporarily routed back to admin confirmation until cleared." |
| `suspended` | `#6B3838` | `#F0DADA` | "You cannot approve submissions right now. Reject still works. Contact admin." |

---

## 8. Identity Fallback Chain

Everywhere a builder/user is displayed, the identity rendering follows this chain:

```
display_name → @github_login → 0xshort…wallet
```

The wallet address ALWAYS stays visible as a secondary line (font-mono, smaller). Display name is additive cosmetic — never replaces the address.

**Profile header additionally shows:**
- Avatar: GitHub photo if linked, else first 2 chars of primary identity as initials
- Role chips: `[ BUILDER ]` (chocolate), `[ SPONSOR ]` (green), `[ ADMIN ]` (amber) — only the ones that apply

---

## 9. Navbar Architecture

### Desktop (≥ 768px / md:)
All links shown inline: Quests, Create (hidden from admin), Leaderboard, Sponsor, Profile, [Admin links if admin], NotificationBell, wallet chip, Disconnect button.

### Mobile (< 768px)
- Visible: QuestLock logo + NotificationBell + hamburger button
- Hamburger opens a slide-down sheet with:
  - All public links (Quests, Create, Leaderboard)
  - All auth links (Sponsor, Profile)
  - Admin section (separated by a border + "Admin" label)
  - Wallet chip + Disconnect at bottom
- Closes on: link click, resize above md, hamburger toggle

### NotificationBell
- Absolutely positioned dropdown (right-aligned, `w-80`, `max-h-[28rem]`)
- Polls every 30s
- Unread badge: orange `#834A1F` circle, "99+" cap
- Click outside closes
- Mark-one-read on click, mark-all-read button

---

## 10. API Endpoints the Frontend Calls

**The redesigner must preserve every `fetch(...)` call exactly.** Here's the complete list:

### Reads (GET)
```
GET /api/quests                          → quest list
GET /api/quests/[id]                     → single quest
GET /api/leaderboard?proof_type=&badge_id= → filtered leaderboard
GET /api/templates                       → quest templates (5)
GET /api/proof/status/[id]               → poll submission status
GET /api/proof/public/[id]               → public cert JSON
GET /api/submissions?wallet=             → user's submissions
GET /api/notifications?wallet=           → notification list + unread count
GET /api/auth/github/status?wallet=      → GitHub link state
GET /api/auth/discord/status?wallet=     → Discord link state
GET /api/users/display-name?wallet=      → display name
GET /api/sponsor/quests?wallet=          → sponsor's quests
GET /api/sponsor/submissions?wallet=&quest_id= → sponsor review queue
GET /api/sponsor/trust-status?wallet=    → sponsor trust tier
GET /api/quest-requests?wallet=          → sponsor's own requests
GET /api/quests/[id]/funding             → live funding state
GET /api/admin/quests                    → admin quest list
GET /api/admin/submissions               → admin submission list
GET /api/ops-ql/submissions/[id]         → admin submission detail
GET /api/ops-ql/system-status            → system tab feed
GET /api/ops-ql/analytics                → analytics data
GET /api/ops-ql/appeals                  → appeals queue
GET /api/ops-ql/quest-requests           → quest request queue
GET /api/admin/retry/queue               → stuck submissions feed
GET /api/admin/confirmations             → sponsor-pending-admin queue
GET /api/admin/sponsors/[wallet]/trust   → admin reads sponsor trust
```

### Writes (POST)
```
POST /api/proof/submit                   → github_project pipeline
POST /api/proof/multi                    → non-github proof
POST /api/relay/claim                    → gasless claim
POST /api/notifications                  → mark read
POST /api/quest-requests                 → sponsor submit request
POST /api/auth/github/start              → start GitHub OAuth
POST /api/auth/github/disconnect         → unlink GitHub
POST /api/auth/discord/start             → start Discord OAuth
POST /api/auth/discord/disconnect        → unlink Discord
POST /api/users/display-name             → set/clear display name
POST /api/appeals                        → builder appeals
POST /api/quests                         → admin direct-create
POST /api/sponsor/submissions/[id]/approve → sponsor approve
POST /api/sponsor/submissions/[id]/reject  → sponsor reject
POST /api/quests/[id]/funding            → resync funding state
POST /api/ops-ql/quest-requests/[id]/approve → admin approve request
POST /api/ops-ql/quest-requests/[id]/reject  → admin reject request
POST /api/ops-ql/quest-requests/[id]/publish → admin publish onchain
POST /api/ops-ql/appeals/[id]/approve    → admin approve appeal
POST /api/ops-ql/appeals/[id]/reject     → admin reject appeal
POST /api/admin/retry/[op]               → retry (indexer/proof-check/attestation/onchain-approval)
POST /api/admin/confirmations/[id]/confirm → admin confirms sponsor approval
POST /api/admin/confirmations/[id]/reject  → admin overrides sponsor approval
POST /api/admin/sponsors/[wallet]/trust  → admin sets trust level
```

### Headers used
```
Content-Type: application/json           → all POST bodies
x-wallet-address: <wallet>               → admin/sponsor gated endpoints
```

---

## 11. wagmi Contract Interactions (SponsorFundingPanel)

These are on-chain wallet-signed transactions. The redesigner MUST preserve:

```ts
// ERC-20 approve (QUEST token → V2 contract)
useWriteContract({
  address: QUEST_REWARD_TOKEN,
  abi: ERC20_ABI,
  functionName: "approve",
  args: [V2_ADDRESS, amount],
})

// Fund quest
useWriteContract({
  address: V2_ADDRESS,
  abi: V2_ABI,
  functionName: "fundQuest",
  args: [questId, amount],
})

// Top up quest
useWriteContract({
  address: V2_ADDRESS,
  abi: V2_ABI,
  functionName: "topUpQuest",
  args: [questId, amount],
})

// Withdraw unused funds
useWriteContract({
  address: V2_ADDRESS,
  abi: V2_ABI,
  functionName: "withdrawUnusedQuestFunds",
  args: [questId],
})

// Close quest
useWriteContract({
  address: V2_ADDRESS,
  abi: V2_ABI,
  functionName: "closeQuest",
  args: [questId],
})
```

These trigger MetaMask popups. The redesigner can change the **button labels and visual feedback** but NOT the `useWriteContract` calls.

---

## 12. File-by-File Summary

### Files to redesign (17 components + 19 pages = 36 files)

**Components (`components/`):**
| File | Lines | Priority |
|---|---|---|
| `Navbar.tsx` | 216 | **High** — first thing users see |
| `QuestCard.tsx` | 105 | **High** — quest marketplace |
| `ProofSubmissionForm.tsx` | 552 | **High** — 5 sub-forms |
| `ProofTimeline.tsx` | 132 | High — submission flow |
| `ScoreBreakdown.tsx` | 138 | High — proof detail |
| `StatusBadge.tsx` | 47 | High — used everywhere |
| `SponsorFundingPanel.tsx` | 318 | Medium — sponsor UX |
| `SponsorReviewPanel.tsx` | 234 | Medium — sponsor review |
| `NotificationBell.tsx` | 182 | Medium — notification UX |
| `GithubConnectCard.tsx` | 184 | Medium — identity linking |
| `DiscordConnectCard.tsx` | 141 | Medium — identity linking |
| `DisplayNameCard.tsx` | 129 | Low — simple input |
| `AttestationCard.tsx` | 96 | Low — EAS display |
| `GaslessClaimButton.tsx` | 99 | Low — single button |
| `AppealCTA.tsx` | 184 | Low — edge case UX |
| `CreatorGuardNotice.tsx` | 44 | Low — simple banner |
| `RewardPoolTopUp.tsx` | 364 | Low — legacy V1 admin |

**Pages (`app/`):**
| File | Lines | Priority |
|---|---|---|
| `page.tsx` (landing) | 294 | **High** — first impression |
| `quests/page.tsx` | 70 | **High** — marketplace |
| `quests/[id]/page.tsx` | 225 | **High** — submit flow entry |
| `submit/[questId]/page.tsx` | 256 | **High** — core UX |
| `proof/[id]/page.tsx` | 501 | **High** — shareable cert |
| `leaderboard/page.tsx` | 165 | High — social proof |
| `me/page.tsx` | 363 | High — identity hub |
| `create/page.tsx` | 452 | Medium — sponsor form |
| `sponsor/page.tsx` | 191 | Medium — sponsor dashboard |
| `sponsor/quests/[id]/page.tsx` | 29 | Medium — quest detail |
| `ops-ql/page.tsx` | 498 | Low — admin |
| `ops-ql/submissions/[id]/page.tsx` | 264 | Low — admin |
| `ops-ql/quest-requests/page.tsx` | 244 | Low — admin |
| `ops-ql/appeals/page.tsx` | 260 | Low — admin |
| `ops-ql/analytics/page.tsx` | 364 | Low — admin |
| `ops-ql/retry/page.tsx` | 284 | Low — admin |
| `ops-ql/confirmations/page.tsx` | 286 | Low — admin |

**Config files (style foundation — redesigner SHOULD modify these):**
| File | Purpose |
|---|---|
| `globals.css` | CSS variables, badge colours, timeline states, scrollbar, base styles |
| `tailwind.config.ts` | Colour tokens, font family, border radius, shadows |
| `layout.tsx` | HTML shell, metadata, Navbar + Providers |
| `providers.tsx` | Privy theme (accentColor, logo, landingHeader) |

---

## 13. Current External Assets

| Asset | Location | Purpose |
|---|---|---|
| QuestLock logo SVG | Inline in `Navbar.tsx` (28×28 padlock icon) | Brand mark |
| Privy logo | `/public/logo.svg` (referenced in providers.tsx) | Login modal |
| Google Font | `Plus Jakarta Sans` (loaded via CSS @import in globals.css) | Primary typeface |
| No other images/icons | All icons are inline SVGs | — |

---

## 14. Things a Redesigner Might Want to Add

These are NOT in the current design but are natural upgrades:

- Dark mode toggle (CSS variables are already structured for it — just add a `:root.dark` override)
- Real logo / wordmark (current is a hand-drawn padlock SVG)
- Illustration set (empty states, success celebrations, loading skeletons)
- Toast/notification system (currently uses in-component `toast` state)
- A component library wrapper (Radix, shadcn/ui) — current is all raw Tailwind
- Animated page transitions (Next.js App Router supports `loading.tsx` + Suspense)
- OG image generation (currently text-only OG tags; could add a `/api/og/[id]` image route)
- Favicon / PWA manifest

---

## 15. How to Test After Redesign

```bash
npm run typecheck        # Must pass — catches any broken imports
npm test                 # Must pass — 85 backend tests unaffected
npm run build            # Must pass — catches SSR issues, missing exports
npm run dev              # Manual click-through on every page
```

The backend tests don't test UI at all — they're pure logic. But `npm run build` will catch:
- Missing component imports
- TypeScript errors in page files
- SSR compilation failures

---

**End of handoff. The redesigner has everything they need to build a new visual layer on top of the existing logic.**
