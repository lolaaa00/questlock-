import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await deployer.provider!.getBalance(deployer.address)), "ETH");

  // 1. Deploy QuestRewardToken
  console.log("\n1. Deploying QuestRewardToken...");
  const QuestRewardToken = await ethers.getContractFactory("QuestRewardToken");
  const token = await QuestRewardToken.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("   QuestRewardToken:", tokenAddress);

  // 2. Deploy QuestBadge
  console.log("\n2. Deploying QuestBadge...");
  const QuestBadge = await ethers.getContractFactory("QuestBadge");
  const badge = await QuestBadge.deploy(deployer.address, "https://questlock.io/badges/");
  await badge.waitForDeployment();
  const badgeAddress = await badge.getAddress();
  console.log("   QuestBadge:", badgeAddress);

  // 3. Deploy QuestLockCore
  console.log("\n3. Deploying QuestLockCore...");
  const QuestLockCore = await ethers.getContractFactory("QuestLockCore");
  const core = await QuestLockCore.deploy(deployer.address, badgeAddress);
  await core.waitForDeployment();
  const coreAddress = await core.getAddress();
  console.log("   QuestLockCore:", coreAddress);

  // 4. Grant MINTER_ROLE to QuestLockCore on QuestBadge
  console.log("\n4. Granting MINTER_ROLE to QuestLockCore on QuestBadge...");
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const grantTx = await badge.grantRole(MINTER_ROLE, coreAddress);
  await grantTx.wait();
  console.log("   Done.");

  // 5. Mint QUEST token supply to deployer
  console.log("\n5. Minting 1,000,000 QUEST tokens to deployer...");
  const supply = ethers.parseEther("1000000");
  const mintTx = await token.mint(deployer.address, supply);
  await mintTx.wait();
  console.log("   Done.");

  // Print summary
  const addresses = {
    NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS: coreAddress,
    NEXT_PUBLIC_QUEST_REWARD_TOKEN_ADDRESS: tokenAddress,
    NEXT_PUBLIC_QUEST_BADGE_ADDRESS: badgeAddress,
  };

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log(JSON.stringify(addresses, null, 2));
  console.log("\nAdd these to your .env file.");
  console.log("\nNext steps:");
  console.log("  npx hardhat run scripts/grant-roles.ts --network baseSepolia");
  console.log("  npx hardhat run scripts/seed-quest.ts --network baseSepolia");

  // Write to deployments file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  fs.writeFileSync(
    path.join(deploymentsDir, "baseSepolia.json"),
    JSON.stringify({ ...addresses, deployedAt: new Date().toISOString() }, null, 2)
  );
  console.log("\nAddresses saved to deployments/baseSepolia.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
