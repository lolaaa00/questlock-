# QuestLock v1.2 — Screenshots Checklist

For the launch package + social tease. Capture at **1440×900** desktop and **390×844** mobile (iPhone 14 Pro). Save to `docs/screenshots/v1.2/` with the exact filenames below.

## Public-facing — desktop (1440×900)

| # | Page | Filename | Notes |
|---|---|---|---|
| 1 | `/` (landing) | `01-landing-desktop.png` | Above the fold only. Make sure the v1.2 sponsor line is visible. |
| 2 | `/quests` | `02-quests-list-desktop.png` | At least 3 active quests visible. Mix proof types. |
| 3 | `/quests/[id]` (github_project) | `03-quest-detail-github-desktop.png` | Open a github quest. Show requirements + submit form. |
| 4 | `/quests/[id]` (manual_project) | `04-quest-detail-manual-desktop.png` | Open a manual quest. Show the manual-review hint. |
| 5 | `/submit/[questId]` (PASSED state) | `05-submit-passed-desktop.png` | A successful submission with all 10 checks green + claim button visible. |
| 6 | `/proof/[id]` (github cert) | `06-cert-github-desktop.png` | Public certificate page. Score, badge, EAS link, repo link. |
| 7 | `/proof/[id]` (discord cert) | `07-cert-discord-desktop.png` | Same page, discord_role proof type. Shows handle + guild + role. |
| 8 | `/proof/[id]` (x cert) | `08-cert-x-desktop.png` | x_post proof type. Shows handle + post URL + post_id. |
| 9 | `/leaderboard` | `09-leaderboard-desktop.png` | At least 5 rows. |
| 10 | `/sponsor` | `10-sponsor-home-desktop.png` | At least 2 sponsored quests with different funding statuses. |
| 11 | `/sponsor/quests/[id]` | `11-sponsor-detail-desktop.png` | Funding panel visible. Show fund / topup / withdraw / close buttons. |
| 12 | `/me` | `12-profile-desktop.png` | Completed quests + badges + GitHub/Discord link state. |

## Admin — desktop (1440×900)

| # | Page | Filename | Notes |
|---|---|---|---|
| 13 | `/ops-ql` (Quests tab) | `13-admin-quests-desktop.png` | |
| 14 | `/ops-ql` (System tab) | `14-admin-system-desktop.png` | Env audit + indexer status + recent logs visible. |
| 15 | `/ops-ql/quest-requests` | `15-admin-quest-requests-desktop.png` | Mix of statuses including PUBLISHED. |
| 16 | `/ops-ql/appeals` | `16-admin-appeals-desktop.png` | At least one appeal in PENDING. |
| 17 | `/ops-ql/analytics` | `17-admin-analytics-desktop.png` | Global tiles + per-quest cards. |
| 18 | `/ops-ql/retry` | `18-admin-retry-desktop.png` | All 4 sections visible, at least one stuck submission per section. |
| 19 | Notification bell open | `19-notification-bell-desktop.png` | Bell dropdown showing 3+ items, at least 1 unread. |

## Mobile (390×844)

| # | Page | Filename |
|---|---|---|
| 20 | `/` (landing) | `20-landing-mobile.png` |
| 21 | `/quests` | `21-quests-list-mobile.png` |
| 22 | `/submit/[questId]` (PASSED) | `22-submit-passed-mobile.png` |
| 23 | `/proof/[id]` (github cert) | `23-cert-github-mobile.png` |
| 24 | `/leaderboard` | `24-leaderboard-mobile.png` |
| 25 | `/sponsor/quests/[id]` | `25-sponsor-detail-mobile.png` |
| 26 | Notification bell open | `26-notification-bell-mobile.png` |

## Empty / loading / error states

Capture each in **desktop**:

| # | What | Filename | How to repro |
|---|---|---|---|
| 27 | Quests list — empty | `27-empty-quests-desktop.png` | Temporarily set all quests `status='paused'` in DB. |
| 28 | Leaderboard — empty | `28-empty-leaderboard-desktop.png` | Use a fresh DB / dev branch with 0 CLAIMED submissions. |
| 29 | Sponsor home — empty | `29-empty-sponsor-desktop.png` | Connect a wallet that has not sponsored anything. |
| 30 | Sponsor home — loading skeleton | `30-loading-sponsor-desktop.png` | Throttle network to Slow 3G in DevTools and screenshot during the skeleton. |
| 31 | Sponsor home — error state | `31-error-sponsor-desktop.png` | Block `/api/sponsor/quests` in DevTools network tab and refresh. |
| 32 | Retry centre — empty | `32-empty-retry-desktop.png` | When no stuck submissions exist. |

## On-chain proof shots

| # | What | Filename |
|---|---|---|
| 33 | Blockscout — V2 contract page | `33-blockscout-v2.png` |
| 34 | Blockscout — a successful `submitAndApprove` tx | `34-blockscout-approve-tx.png` |
| 35 | Blockscout — a successful `claimReward` tx | `35-blockscout-claim-tx.png` |
| 36 | EAS Scan — one issued attestation | `36-eas-attestation.png` |

## Capture rules

- Use a clean browser profile — no extension toolbars, no devtools open (except for #30 and #31).
- Hide the cursor unless it's a tooltip shot.
- For mobile shots use real device frames in the launch deck (Cleanshot / Mockflow), not raw screenshots.
- Strip any wallet addresses that aren't the test admin (`0x1f63ea74…525B`) — censor with a black rectangle.
- **Never** screenshot the `.env` file, the deployer/verifier private keys, the Privy app secret, the GitHub OAuth client secret, the Discord OAuth client secret, the Discord bot token, or the `DATABASE_URL`.

## Sign-off

When all 36 are captured, file a PR adding them to `docs/screenshots/v1.2/` and update `LAUNCH_PACKAGE.md` with a "Visuals" section linking to the directory.
