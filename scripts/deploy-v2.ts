// QuestLockCoreV2 deployment script — DRAFT for v1.2.
// **Do not run** until owner approves the contract design AND the verifier
// key rotation has been completed.
//
// Reuses the existing QuestRewardToken and QuestBadge addresses — no token
// or badge redeploy.
//
// After deploy:
//   1. Grant VERIFIER_ROLE on V2 to the (rotated) verifier wallet.
//   2. Grant MINTER_ROLE on the existing QuestBadge to the new V2 address.
//   3. Append the new V2 address to deployments/baseSepolia.json.
//   4. Add NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS to .env / Vercel.
//   5. Do NOT touch the existing QuestLockCore — legacy quests stay on V1.

import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const deploymentsPath = path.join(__dirname, "..", "deployments", "baseSepolia.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments/baseSepolia.json not found. Run scripts/deploy.ts (v1) first.");
  }
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const badgeAddress = deployments.NEXT_PUBLIC_QUEST_BADGE_ADDRESS;
  if (!badgeAddress) throw new Error("QuestBadge address missing");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying QuestLockCoreV2 with:", deployer.address);
  console.log("Reusing QuestBadge:", badgeAddress);

  const QuestLockCoreV2 = await ethers.getContractFactory("QuestLockCoreV2");
  const coreV2 = await QuestLockCoreV2.deploy(deployer.address, badgeAddress);
  await coreV2.waitForDeployment();
  const coreV2Address = await coreV2.getAddress();
  console.log("QuestLockCoreV2 deployed:", coreV2Address);

  // Grant MINTER_ROLE on existing badge to the new V2 address so V2 can mint.
  const QuestBadge = await ethers.getContractFactory("QuestBadge");
  const badge = QuestBadge.attach(badgeAddress);
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  console.log("Granting MINTER_ROLE on QuestBadge to V2...");
  await (await badge.grantRole(MINTER_ROLE, coreV2Address)).wait();

  // Grant VERIFIER_ROLE on V2 to the verifier wallet (rotated key expected).
  if (process.env.VERIFIER_PRIVATE_KEY) {
    const verifierAddress = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY).address;
    const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
    console.log("Granting VERIFIER_ROLE on V2 to:", verifierAddress);
    await (await coreV2.grantRole(VERIFIER_ROLE, verifierAddress)).wait();
  } else {
    console.warn("VERIFIER_PRIVATE_KEY not set; skipping VERIFIER_ROLE grant. Run grant-roles-v2.ts later.");
  }

  // Persist
  deployments.NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS = coreV2Address;
  deployments.QUESTLOCK_CORE_V2_DEPLOYED_AT = new Date().toISOString();
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

  console.log("\n=== V2 DEPLOY COMPLETE ===");
  console.log("Add to .env (and Vercel):");
  console.log(`NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS=${coreV2Address}`);
  console.log("\nLegacy v1 contracts are untouched. Existing quests remain on V1.");
}

main().catch((e) => { console.error(e); process.exit(1); });
