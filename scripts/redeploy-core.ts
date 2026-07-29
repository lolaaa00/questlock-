import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const deploymentsPath = path.join(__dirname, "..", "deployments", "baseSepolia.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const badgeAddress = deployments.NEXT_PUBLIC_QUEST_BADGE_ADDRESS;
  const tokenAddress = deployments.NEXT_PUBLIC_QUEST_REWARD_TOKEN_ADDRESS;

  console.log("Deployer:", deployer.address);
  console.log("Reusing QuestBadge:", badgeAddress);
  console.log("Reusing QuestRewardToken:", tokenAddress);

  // Deploy new QuestLockCore
  console.log("\nDeploying new QuestLockCore...");
  const QuestLockCore = await ethers.getContractFactory("QuestLockCore");
  const core = await QuestLockCore.deploy(deployer.address, badgeAddress);
  await core.waitForDeployment();
  const coreAddress = await core.getAddress();
  console.log("New QuestLockCore:", coreAddress);

  // Grant MINTER_ROLE on QuestBadge to new core
  console.log("\nGranting MINTER_ROLE on QuestBadge to new core...");
  const QuestBadge = await ethers.getContractFactory("QuestBadge");
  const badge = QuestBadge.attach(badgeAddress);
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  await (await badge.grantRole(MINTER_ROLE, coreAddress)).wait();

  // Grant VERIFIER_ROLE to verifier wallet
  const verifierAddress = process.env.VERIFIER_PRIVATE_KEY
    ? new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY).address
    : null;
  if (verifierAddress) {
    console.log("Granting VERIFIER_ROLE to:", verifierAddress);
    const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
    await (await core.grantRole(VERIFIER_ROLE, verifierAddress)).wait();
  }

  // Fund core with QUEST tokens
  console.log("\nFunding new QuestLockCore with 1000 QUEST...");
  const QuestRewardToken = await ethers.getContractFactory("QuestRewardToken");
  const token = QuestRewardToken.attach(tokenAddress);
  await (await token.transfer(coreAddress, ethers.parseEther("1000"))).wait();

  // Create sample quest
  console.log("Creating sample quest...");
  const now = Math.floor(Date.now() / 1000);
  const deadline = now + 30 * 24 * 60 * 60;
  const tx = await core.createQuest(
    tokenAddress,
    ethers.parseEther("10"),
    1,
    now,
    deadline,
    100,
    60
  );
  await tx.wait();
  console.log("Quest created. ID: 1");

  // Save new address
  deployments.NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS = coreAddress;
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

  console.log("\n=== REDEPLOY COMPLETE ===");
  console.log("NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS=" + coreAddress);
  console.log("\nUpdate your .env with the new QuestLockCore address above.");
}

main().catch((e) => { console.error(e); process.exit(1); });
