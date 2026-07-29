// Phase 1 of v1.2: rotate verifier on V1 QuestLockCore.
// Reads VERIFIER_PRIVATE_KEY from .env, derives the public address only,
// funds it from DEPLOYER_PRIVATE_KEY if low, grants VERIFIER_ROLE on V1,
// and verifies hasRole for both old and new. NEVER prints the private key.

import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();
const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OLD_VERIFIER = "0xC26788E71036601B4Dbe5551160abFc733bf0601";
const MIN_ETH = ethers.parseEther("0.05");
const FUND_AMOUNT = ethers.parseEther("0.05");

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function main() {
  if (!process.env.VERIFIER_PRIVATE_KEY) {
    throw new Error("VERIFIER_PRIVATE_KEY not set in .env");
  }
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  }

  // Derive new verifier address — public only, never log the key.
  const newVerifier = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY).address;
  console.log(`New verifier address: ${short(newVerifier)}`);

  // Read V1 core address
  const deploymentsPath = path.join(__dirname, "..", "deployments", "baseSepolia.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const coreV1 = deployments.NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS;
  console.log(`V1 QuestLockCore: ${coreV1}`);

  // Use the connected deployer signer for funding + role grant
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer signer: ${short(deployer.address)}`);

  // Check new verifier ETH balance
  const balance = await deployer.provider!.getBalance(newVerifier);
  console.log(`New verifier ETH: ${ethers.formatEther(balance)}`);

  if (balance < MIN_ETH) {
    console.log(`Funding new verifier with ${ethers.formatEther(FUND_AMOUNT)} ETH...`);
    const tx = await deployer.sendTransaction({ to: newVerifier, value: FUND_AMOUNT });
    await tx.wait();
    console.log(`Funded. tx: ${tx.hash}`);
  } else {
    console.log("Already funded, skipping.");
  }

  // Grant VERIFIER_ROLE on V1 (idempotent)
  const QuestLockCore = await ethers.getContractFactory("QuestLockCore");
  const core = QuestLockCore.attach(coreV1);
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));

  const alreadyGranted = await core.hasRole(VERIFIER_ROLE, newVerifier);
  if (alreadyGranted) {
    console.log("New verifier ALREADY has VERIFIER_ROLE on V1 — no grant needed.");
  } else {
    console.log("Granting VERIFIER_ROLE on V1 to new verifier...");
    const tx = await core.grantRole(VERIFIER_ROLE, newVerifier);
    await tx.wait();
    console.log(`Granted. tx: ${tx.hash}`);
  }

  // Verify both old and new
  const newHas = await core.hasRole(VERIFIER_ROLE, newVerifier);
  const oldHas = await core.hasRole(VERIFIER_ROLE, OLD_VERIFIER);
  console.log("\n=== Role check ===");
  console.log(`new ${short(newVerifier)} has VERIFIER_ROLE: ${newHas}`);
  console.log(`old ${short(OLD_VERIFIER)} has VERIFIER_ROLE: ${oldHas}`);

  if (!newHas) throw new Error("New verifier did NOT receive VERIFIER_ROLE");
  if (!oldHas) console.warn("WARN: old verifier no longer holds the role — rollback safety net is gone");

  console.log("\n=== Rotation Phase 1 done (V1). Old verifier intentionally NOT revoked. ===");
}

main().catch((e) => { console.error(e); process.exit(1); });
