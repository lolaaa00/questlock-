// Idempotent role-grant for QuestLockCoreV2. Run after deploy-v2.ts if the
// verifier key was rotated or the deploy script skipped the grant. **Do not
// run** until owner approves.

import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();
const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const deploymentsPath = path.join(__dirname, "..", "deployments", "baseSepolia.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const coreV2Address = deployments.NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS;
  if (!coreV2Address) throw new Error("V2 address missing. Deploy first.");

  if (!process.env.VERIFIER_PRIVATE_KEY) {
    throw new Error("VERIFIER_PRIVATE_KEY not set");
  }
  const verifierAddress = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY).address;
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));

  const QuestLockCoreV2 = await ethers.getContractFactory("QuestLockCoreV2");
  const coreV2 = QuestLockCoreV2.attach(coreV2Address);

  const already = await coreV2.hasRole(VERIFIER_ROLE, verifierAddress);
  if (already) {
    console.log(`VERIFIER_ROLE already held by ${verifierAddress}. No-op.`);
    return;
  }

  console.log(`Granting VERIFIER_ROLE on V2 to ${verifierAddress}...`);
  await (await coreV2.grantRole(VERIFIER_ROLE, verifierAddress)).wait();
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
