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
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments/baseSepolia.json not found. Run deploy.ts first.");
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const coreAddress = deployments.NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS;

  const [deployer] = await ethers.getSigners();
  const verifierAddress = process.env.VERIFIER_PRIVATE_KEY
    ? new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY).address
    : null;

  if (!verifierAddress) {
    console.warn("VERIFIER_PRIVATE_KEY not set. Skipping verifier role grant.");
    return;
  }

  const QuestLockCore = await ethers.getContractFactory("QuestLockCore");
  const core = QuestLockCore.attach(coreAddress) as Awaited<ReturnType<typeof QuestLockCore.deploy>>;

  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
  const QUEST_CREATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("QUEST_CREATOR_ROLE"));

  console.log("Granting VERIFIER_ROLE to:", verifierAddress);
  const tx1 = await core.grantRole(VERIFIER_ROLE, verifierAddress);
  await tx1.wait();

  console.log("Granting QUEST_CREATOR_ROLE to deployer:", deployer.address);
  const tx2 = await core.grantRole(QUEST_CREATOR_ROLE, deployer.address);
  await tx2.wait();

  console.log("Roles granted successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
