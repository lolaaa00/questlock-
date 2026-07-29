import { expect } from "chai";
import { network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { QuestLockCore, QuestRewardToken, QuestBadge } from "../typechain-types";

const { ethers } = await network.create();

describe("QuestLockCore", function () {
  let core: QuestLockCore;
  let token: QuestRewardToken;
  let badge: QuestBadge;
  let admin: HardhatEthersSigner;
  let verifier: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));

  const rewardAmount = ethers.parseEther("10");
  const minScore = 70;
  const badgeId = 1;

  async function chainNow(): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block!.timestamp;
  }

  async function deployAndSetup() {
    [admin, verifier, user1, user2] = await ethers.getSigners();
    const now = await chainNow();

    const Token = await ethers.getContractFactory("QuestRewardToken");
    token = await Token.deploy(admin.address);

    const Badge = await ethers.getContractFactory("QuestBadge");
    badge = await Badge.deploy(admin.address, "https://questlock.io/badges/");

    const Core = await ethers.getContractFactory("QuestLockCore");
    core = await Core.deploy(admin.address, await badge.getAddress());

    // Grant roles
    await badge.grantRole(MINTER_ROLE, await core.getAddress());
    await core.grantRole(VERIFIER_ROLE, verifier.address);

    // Mint and fund
    await token.mint(admin.address, ethers.parseEther("1000000"));
    await token.transfer(await core.getAddress(), ethers.parseEther("1000"));

    // Create quest
    const deadline = now + 86400 * 30;
    await core.createQuest(
      await token.getAddress(),
      rewardAmount,
      badgeId,
      now,
      deadline,
      100,
      minScore
    );

    return { now, deadline };
  }

  describe("Quest creation", () => {
    it("deploys and creates quest", async () => {
      await deployAndSetup();
      const quest = await core.getQuest(1);
      expect(quest.id).to.equal(1n);
      expect(quest.active).to.be.true;
      expect(quest.minScore).to.equal(minScore);
    });

    it("reverts if deadline is in the past", async () => {
      await deployAndSetup();
      const pastDeadline = (await chainNow()) - 1;
      await expect(
        core.createQuest(await token.getAddress(), rewardAmount, badgeId, 0, pastDeadline, 100, 70)
      ).to.be.revertedWith("QuestLockCore: deadline in past");
    });

    it("reverts if called by non-creator", async () => {
      await deployAndSetup();
      await expect(
        core.connect(user1).createQuest(await token.getAddress(), rewardAmount, badgeId, 0, Math.floor(Date.now() / 1000) + 86400, 100, 70)
      ).to.be.revert(ethers);
    });
  });

  describe("Proof submission", () => {
    it("allows user to submit proof hash", async () => {
      await deployAndSetup();
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test-proof"));
      await core.connect(user1).submitProofHash(1, proofHash);
      const sub = await core.getSubmission(1, user1.address);
      expect(sub.status).to.equal(1); // SUBMITTED
    });

    it("reverts on double submission", async () => {
      await deployAndSetup();
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test-proof"));
      await core.connect(user1).submitProofHash(1, proofHash);
      await expect(
        core.connect(user1).submitProofHash(1, proofHash)
      ).to.be.revertedWith("QuestLockCore: already submitted");
    });
  });

  describe("Approval and rejection", () => {
    let proofHash: string;

    beforeEach(async () => {
      await deployAndSetup();
      proofHash = ethers.keccak256(ethers.toUtf8Bytes("test-proof"));
      await core.connect(user1).submitProofHash(1, proofHash);
    });

    it("verifier can approve submission", async () => {
      const attestUID = ethers.keccak256(ethers.toUtf8Bytes("attest-uid"));
      await core.connect(verifier).approveSubmission(1, user1.address, proofHash, attestUID, 85);
      const sub = await core.getSubmission(1, user1.address);
      expect(sub.status).to.equal(2); // APPROVED
      expect(sub.score).to.equal(85);
    });

    it("non-verifier cannot approve", async () => {
      const attestUID = ethers.keccak256(ethers.toUtf8Bytes("attest-uid"));
      await expect(
        core.connect(user2).approveSubmission(1, user1.address, proofHash, attestUID, 85)
      ).to.be.revert(ethers);
    });

    it("verifier can reject submission", async () => {
      await core.connect(verifier).rejectSubmission(1, user1.address);
      const sub = await core.getSubmission(1, user1.address);
      expect(sub.status).to.equal(3); // REJECTED
    });

    it("reverts if score below minimum", async () => {
      const attestUID = ethers.keccak256(ethers.toUtf8Bytes("attest-uid"));
      await expect(
        core.connect(verifier).approveSubmission(1, user1.address, proofHash, attestUID, 50)
      ).to.be.revertedWith("QuestLockCore: score below minimum");
    });
  });

  describe("Claiming rewards", () => {
    let proofHash: string;
    let attestUID: string;

    beforeEach(async () => {
      await deployAndSetup();
      proofHash = ethers.keccak256(ethers.toUtf8Bytes("test-proof"));
      attestUID = ethers.keccak256(ethers.toUtf8Bytes("attest-uid"));
      await core.connect(user1).submitProofHash(1, proofHash);
      await core.connect(verifier).approveSubmission(1, user1.address, proofHash, attestUID, 85);
    });

    it("approved user can claim reward", async () => {
      const balanceBefore = await token.balanceOf(user1.address);
      await core.connect(user1).claimReward(1);
      const balanceAfter = await token.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(rewardAmount);
    });

    it("badge mints on claim", async () => {
      await core.connect(user1).claimReward(1);
      expect(await badge.hasBadge(user1.address, badgeId)).to.be.true;
    });

    it("cannot claim twice", async () => {
      await core.connect(user1).claimReward(1);
      await expect(core.connect(user1).claimReward(1)).to.be.revertedWith(
        "QuestLockCore: submission not approved"
      );
    });

    it("cannot claim before approval", async () => {
      await deployAndSetup();
      const ph2 = ethers.keccak256(ethers.toUtf8Bytes("test-proof-2"));
      await core.connect(user2).submitProofHash(1, ph2);
      await expect(core.connect(user2).claimReward(1)).to.be.revertedWith(
        "QuestLockCore: submission not approved"
      );
    });

    it("cannot claim rejected submission", async () => {
      await deployAndSetup();
      const ph2 = ethers.keccak256(ethers.toUtf8Bytes("test-proof-3"));
      await core.connect(user2).submitProofHash(1, ph2);
      await core.connect(verifier).rejectSubmission(1, user2.address);
      await expect(core.connect(user2).claimReward(1)).to.be.revertedWith(
        "QuestLockCore: submission not approved"
      );
    });
  });

  describe("Quest pause", () => {
    it("pauser can pause quest", async () => {
      await deployAndSetup();
      await core.pauseQuest(1);
      const quest = await core.getQuest(1);
      expect(quest.active).to.be.false;
    });

    it("paused quest blocks submission", async () => {
      await deployAndSetup();
      await core.pauseQuest(1);
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await expect(
        core.connect(user1).submitProofHash(1, proofHash)
      ).to.be.revertedWith("QuestLockCore: quest not active");
    });

    it("contract pause blocks sensitive actions", async () => {
      await deployAndSetup();
      await core.pause();
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await expect(core.connect(user1).submitProofHash(1, proofHash)).to.be.revert(ethers);
    });
  });

  describe("maxClaims enforcement", () => {
    it("enforces maxClaims = 1", async () => {
      [admin, verifier, user1, user2] = await ethers.getSigners();
      const now = Math.floor(Date.now() / 1000);

      const Token = await ethers.getContractFactory("QuestRewardToken");
      token = await Token.deploy(admin.address);
      const Badge = await ethers.getContractFactory("QuestBadge");
      badge = await Badge.deploy(admin.address, "");
      const Core = await ethers.getContractFactory("QuestLockCore");
      core = await Core.deploy(admin.address, await badge.getAddress());

      await badge.grantRole(MINTER_ROLE, await core.getAddress());
      await core.grantRole(VERIFIER_ROLE, verifier.address);
      await token.mint(admin.address, ethers.parseEther("100"));
      await token.transfer(await core.getAddress(), ethers.parseEther("100"));

      // Create quest with maxClaims = 1
      await core.createQuest(await token.getAddress(), rewardAmount, badgeId, now, now + 86400, 1, 70);

      const p1 = ethers.keccak256(ethers.toUtf8Bytes("p1"));
      const p2 = ethers.keccak256(ethers.toUtf8Bytes("p2"));
      const a1 = ethers.keccak256(ethers.toUtf8Bytes("a1"));
      const a2 = ethers.keccak256(ethers.toUtf8Bytes("a2"));

      await core.connect(user1).submitProofHash(1, p1);
      await core.connect(verifier).approveSubmission(1, user1.address, p1, a1, 80);
      await core.connect(user1).claimReward(1);

      await core.connect(user2).submitProofHash(1, p2);
      await expect(
        core.connect(verifier).approveSubmission(1, user2.address, p2, a2, 80)
      ).to.be.revertedWith(
        "QuestLockCore: max claims reached"
      );
    });
  });
});
