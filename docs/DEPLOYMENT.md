# QuestLock Deployment Guide

## Prerequisites

- Node.js 20+
- npm (no pnpm or yarn)
- A Supabase project (free tier works)
- A funded Base Sepolia wallet (deployer)
- A second wallet for the verifier role
- Privy account (app ID)
- GitHub Personal Access Token (for API rate limits)
- GitHub OAuth App (for v1.1 account linking) — Authorization callback `${NEXT_PUBLIC_APP_URL}/api/auth/github/callback`
- **v1.2 additions:**
  - Discord OAuth App (optional, required for `discord_role` proofs) — Authorization callback `${NEXT_PUBLIC_APP_URL}/api/auth/discord/callback`
  - Discord Bot token (optional, enables deterministic guild-role checks; without it `discord_role` falls back to manual review)
  - Second contract deploy: QuestLockCoreV2 (`scripts/deploy-v2.ts`) — grant `MINTER_ROLE` on Badge to V2 and `VERIFIER_ROLE` on V2 to the verifier wallet
  - External cron service (e.g. https://cron-job.org) configured to hit `https://<your-domain>/api/indexer` on the cadence you want (15 min recommended), sending header `x-indexer-secret: <value of INDEXER_SECRET env var>`. Vercel native cron is NOT used (Hobby tier caps at 1 run/day).

### v1.2 env vars

Required:
- `NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS` — V2 contract address (`0xDDC0…A282` for the current deploy)
- `ADMIN_WALLET_ADDRESS` — wallet allowed into `/ops-ql/*` and `/api/admin/*`

Optional (feature-gated):
- `DISCORD_OAUTH_CLIENT_ID`, `DISCORD_OAUTH_CLIENT_SECRET`, `DISCORD_OAUTH_REDIRECT_URI` — Discord linking
- `DISCORD_BOT_TOKEN` — enables deterministic Discord role checks

Removed in v1.2:
- `GELATO_RPC_URL` — Gelato Relay was abandoned in v1.1.1; the env entry is stale and can be deleted.

## 1. Install dependencies

```bash
cd questlock
npm install
```

## 2. Set environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | app.privy.io → your app |
| `DATABASE_URL` | Supabase → Settings → Database → Connection string |
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `GITHUB_TOKEN` | github.com/settings/tokens → classic token, public_repo scope |
| `DEPLOYER_PRIVATE_KEY` | Your deployer wallet private key |
| `VERIFIER_PRIVATE_KEY` | Your verifier wallet private key |
| `BASE_SEPOLIA_RPC_URL` | `https://sepolia.base.org` (or Alchemy/Infura) |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` / `GITHUB_OAUTH_REDIRECT_URI` | github.com/settings/developers → OAuth App |
| `DIRECT_URL` | Same Supabase URL but unpooled, used by Prisma Migrate |
| `INDEXER_SECRET` | Random hex; signs OAuth state and gates `/api/indexer` |
| `ADMIN_WALLET_ADDRESS` | Your admin wallet address |

## 3. Set up Supabase

1. Create a new Supabase project.
2. Note the connection string for `DATABASE_URL`.

```bash
npm run db:migrate
npm run db:seed
```

## 4. Deploy contracts to Base Sepolia

Make sure your deployer wallet has Sepolia ETH. Get it from the Base Sepolia faucet.

```bash
npm run contracts:compile
npm run contracts:deploy
```

This will:
- Deploy `QuestRewardToken`
- Deploy `QuestBadge`
- Deploy `QuestLockCore`
- Grant minter role to QuestLockCore
- Mint 1,000,000 QUEST to deployer
- Save addresses to `deployments/baseSepolia.json`

Copy the printed addresses into your `.env` file.

## 5. Grant roles

```bash
npm run contracts:grant-roles
```

This grants `VERIFIER_ROLE` to the verifier wallet.

## 6. Create EAS schema

Run in a Node REPL or a one-off script:

```typescript
import { registerSchema } from "./lib/eas";
const uid = await registerSchema();
console.log("Schema UID:", uid);
```

Add the UID to `.env` as `NEXT_PUBLIC_EAS_SCHEMA_UID`.

## 7. Seed a sample quest and fund it

```bash
npm run contracts:seed-quest
```

This funds QuestLockCore with 1000 QUEST and creates quest ID 1.

Then run the DB seed to create the matching quest in the database:

```bash
npm run db:seed
```

After that, update the database quest record with `onchain_quest_id: 1`:

```sql
UPDATE quests SET onchain_quest_id = 1 WHERE title = 'Build a Simple Onchain Guestbook';
```

## 8. Run locally

```bash
npm run dev
```

Open http://localhost:3000

## 9. Run tests

```bash
npm run test:contracts  -- contract unit tests
npm run test           -- backend unit tests
```

## 10. Deploy frontend

Deploy to Vercel:

```bash
# Push to GitHub, then:
# Vercel → New Project → import repo
# Set all env vars in Vercel dashboard
# Deploy
```

## Contract addresses (fill after deployment)

| Contract | Address |
|---|---|
| QuestLockCore | TBD |
| QuestRewardToken | TBD |
| QuestBadge | TBD |
| EAS (Base Sepolia) | 0x4200000000000000000000000000000000000021 |

## Test the end-to-end flow

1. Create a quest via `/admin`.
2. Connect wallet on `/quests`.
3. Submit a real GitHub repo with 3+ commits, README, and a working demo.
4. Watch the proof timeline evaluate.
5. If score ≥ 70, attestation appears and reward unlocks.
6. Click "Claim Reward (Gasless)".
7. Check `/me` for the completed quest, reward, badge, and attestation link.
