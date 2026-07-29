// Read-only: confirm V2 roles + badge minter grant
import { network } from "hardhat";
import * as fs from "fs"; import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();
const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function short(a: string) { return `${a.slice(0,6)}…${a.slice(-4)}`; }

async function main() {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "baseSepolia.json"), "utf-8"));
  const v2 = d.NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS;
  const badge = d.NEXT_PUBLIC_QUEST_BADGE_ADDRESS;
  const deployer = "0x1f63ea74065586Af0C7c48428372D88d0A89525B";
  const newVerifier = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY!).address;

  const V2 = await ethers.getContractFactory("QuestLockCoreV2");
  const core = V2.attach(v2);
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
  const QUEST_CREATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("QUEST_CREATOR_ROLE"));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  const Badge = await ethers.getContractFactory("QuestBadge");
  const b = Badge.attach(badge);
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  console.log(`V2: ${v2}`);
  console.log(`Badge: ${badge}`);
  console.log(`\nV2 role state:`);
  console.log(`  deployer ${short(deployer)} DEFAULT_ADMIN_ROLE: ${await core.hasRole(DEFAULT_ADMIN_ROLE, deployer)}`);
  console.log(`  deployer ${short(deployer)} QUEST_CREATOR_ROLE: ${await core.hasRole(QUEST_CREATOR_ROLE, deployer)}`);
  console.log(`  deployer ${short(deployer)} PAUSER_ROLE:        ${await core.hasRole(PAUSER_ROLE, deployer)}`);
  console.log(`  new verifier ${short(newVerifier)} VERIFIER_ROLE: ${await core.hasRole(VERIFIER_ROLE, newVerifier)}`);
  console.log(`\nBadge role state:`);
  console.log(`  V2 ${short(v2)} MINTER_ROLE on Badge: ${await b.hasRole(MINTER_ROLE, v2)}`);
  console.log(`\nQuest count on V2: ${await core.questCount()}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
