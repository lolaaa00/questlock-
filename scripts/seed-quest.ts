import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const deploymentsPath = path.join(__dirname, "..", "deployments", "baseSepolia.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments/baseSepolia.json not found. Run deploy.ts first.");
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const coreAddress = deployments.NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS;
  const tokenAddress = deployments.NEXT_PUBLIC_QUEST_REWARD_TOKEN_ADDRESS;

  const [deployer] = await ethers.getSigners();

  const QuestLockCore = await ethers.getContractFactory("QuestLockCore");
  const core = QuestLockCore.attach(coreAddress) as Awaited<ReturnType<typeof QuestLockCore.deploy>>;

  const QuestRewardToken = await ethers.getContractFactory("QuestRewardToken");
  const token = QuestRewardToken.attach(tokenAddress) as Awaited<ReturnType<typeof QuestRewardToken.deploy>>;

  // Fund QuestLockCore with 1000 QUEST
  const fundAmount = ethers.parseEther("1000");
  console.log("Funding QuestLockCore with 1000 QUEST...");
  const approveTx = await token.approve(coreAddress, fundAmount);
  await approveTx.wait();
  const transferTx = await token.transfer(coreAddress, fundAmount);
  await transferTx.wait();
  console.log("Funded.");

  // Create sample quest: 30 days deadline
  const now = Math.floor(Date.now() / 1000);
  const deadline = now + 30 * 24 * 60 * 60;
  const rewardAmount = ethers.parseEther("10");

  console.log("Creating sample quest...");
  const createTx = await core.createQuest(
    tokenAddress,
    rewardAmount,
    1, // badgeId: Verified Builder
    now,
    deadline,
    100, // maxClaims
    70   // minScore
  );
  const receipt = await createTx.wait();
  console.log("Quest created. Tx:", receipt?.hash);
  console.log("Quest ID: 1 (first quest)");
  console.log("\nUpdate your database with onchain_quest_id: 1 for this quest.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
