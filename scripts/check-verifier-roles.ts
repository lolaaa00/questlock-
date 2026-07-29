// Read-only: confirm VERIFIER_ROLE state on V1 for both old and new verifier.

import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();
const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OLD_VERIFIER = "0xC26788E71036601B4Dbe5551160abFc733bf0601";

function short(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

async function main() {
  if (!process.env.VERIFIER_PRIVATE_KEY) throw new Error("VERIFIER_PRIVATE_KEY not set");
  const newVerifier = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY).address;

  const deploymentsPath = path.join(__dirname, "..", "deployments", "baseSepolia.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const coreV1 = deployments.NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS;

  const QuestLockCore = await ethers.getContractFactory("QuestLockCore");
  const core = QuestLockCore.attach(coreV1);
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));

  const newHas = await core.hasRole(VERIFIER_ROLE, newVerifier);
  const oldHas = await core.hasRole(VERIFIER_ROLE, OLD_VERIFIER);
  const balance = await (await ethers.getSigners())[0].provider!.getBalance(newVerifier);

  console.log(`V1 core: ${coreV1}`);
  console.log(`new ${short(newVerifier)} balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`new ${short(newVerifier)} VERIFIER_ROLE: ${newHas}`);
  console.log(`old ${short(OLD_VERIFIER)} VERIFIER_ROLE: ${oldHas}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
