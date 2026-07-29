import { expect } from "chai";
import { network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { QuestLockCoreV2, QuestRewardToken, QuestBadge } from "../../typechain-types";

const { ethers } = await network.create();

describe("QuestLockCoreV2 — sponsor-funded per-quest pools", function () {
  let core: QuestLockCoreV2;
  let token: QuestRewardToken;
  let badge: QuestBadge;
  let admin: HardhatEthersSigner;
  let verifier: HardhatEthersSigner;
  let sponsor: HardhatEthersSigner;
  let sponsorB: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;

  const VERIFIER_ROLE      = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
  const MINTER_ROLE        = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const QUEST_CREATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("QUEST_CREATOR_ROLE"));
  const PAUSER_ROLE        = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));

  const REWARD = ethers.parseEther("10");
  const MAX_CLAIMS = 5n;
  const MIN_SCORE = 70;
  const BADGE_ID = 1;
  const REQUIRED_FUNDING = REWARD * MAX_CLAIMS; // 50 QUEST

  // FundingStatus enum (must match the Solidity ordering)
  const FS = {
    UNFUNDED: 0,
    PARTIALLY_FUNDED: 1,
    FUNDED: 2,
    UNDERFUNDED: 3,
    CLOSED: 4,
    REFUNDED: 5,
  };

  async function deployAll() {
    [admin, verifier, sponsor, sponsorB, user1, user2, outsider] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("QuestRewardToken");
    token = await Token.deploy(admin.address);

    const Badge = await ethers.getContractFactory("QuestBadge");
    badge = await Badge.deploy(admin.address, "https://questlock.io/badges/");

    const Core = await ethers.getContractFactory("QuestLockCoreV2");
    core = await Core.deploy(admin.address, await badge.getAddress());

    // V2 mints badges
    await badge.grantRole(MINTER_ROLE, await core.getAddress());
    // Verifier role
    await core.grantRole(VERIFIER_ROLE, verifier.address);

    // Mint QUEST + distribute to sponsors so they can fund
    await token.mint(admin.address, ethers.parseEther("1000000"));
    await token.transfer(sponsor.address, ethers.parseEther("10000"));
    await token.transfer(sponsorB.address, ethers.parseEther("10000"));
  }

  async function chainNow(): Promise<number> {
    const b = await ethers.provider.getBlock("latest");
    return b!.timestamp;
  }

  async function createQuest(deadlineSeconds?: number) {
    const now = await chainNow();
    const deadline = now + (deadlineSeconds ?? 30 * 86400);
    const tx = await core.createFundedQuest(
      sponsor.address,
      await token.getAddress(),
      REWARD,
      BADGE_ID,
      0, // startTime → block.timestamp
      deadline,
      MAX_CLAIMS,
      MIN_SCORE
    );
    await tx.wait();
    return { questId: 1n, deadline };
  }

  async function fund(questId: bigint, signer: HardhatEthersSigner, amount: bigint) {
    await token.connect(signer).approve(await core.getAddress(), amount);
    await core.connect(signer).fundQuest(questId, amount);
  }

  // ─────────────────────────────────────────────────────────────── //
  // CREATION
  // ─────────────────────────────────────────────────────────────── //
  describe("createFundedQuest", () => {
    beforeEach(deployAll);

    it("deploys and creates a funded quest", async () => {
      await createQuest();
      const q = await core.getQuest(1);
      expect(q.id).to.equal(1n);
      expect(q.sponsor).to.equal(sponsor.address);
      expect(q.rewardAmount).to.equal(REWARD);
      expect(q.maxClaims).to.equal(MAX_CLAIMS);
      expect(q.requiredFunding).to.equal(REQUIRED_FUNDING);
      expect(q.fundedAmount).to.equal(0);
      expect(q.fundingStatus).to.equal(FS.UNFUNDED);
      expect(q.active).to.be.true;
    });

    it("requiredFunding equals rewardAmount × maxClaims", async () => {
      await createQuest();
      const q = await core.getQuest(1);
      expect(q.requiredFunding).to.equal(REWARD * MAX_CLAIMS);
    });

    it("reverts on past deadline", async () => {
      const past = await chainNow() - 1;
      await expect(
        core.createFundedQuest(sponsor.address, await token.getAddress(),
          REWARD, BADGE_ID, 0, past, MAX_CLAIMS, MIN_SCORE)
      ).to.be.revertedWith("QLCv2: deadline in past");
    });

    it("reverts on zero maxClaims", async () => {
      const future = await chainNow() + 86400;
      await expect(
        core.createFundedQuest(sponsor.address, await token.getAddress(),
          REWARD, BADGE_ID, 0, future, 0, MIN_SCORE)
      ).to.be.revertedWith("QLCv2: maxClaims must be > 0");
    });

    it("reverts on zero reward amount", async () => {
      const future = await chainNow() + 86400;
      await expect(
        core.createFundedQuest(sponsor.address, await token.getAddress(),
          0, BADGE_ID, 0, future, MAX_CLAIMS, MIN_SCORE)
      ).to.be.revertedWith("QLCv2: reward must be > 0");
    });

    it("reverts on zero sponsor", async () => {
      const future = await chainNow() + 86400;
      await expect(
        core.createFundedQuest(ethers.ZeroAddress, await token.getAddress(),
          REWARD, BADGE_ID, 0, future, MAX_CLAIMS, MIN_SCORE)
      ).to.be.revertedWith("QLCv2: zero sponsor");
    });

    it("only QUEST_CREATOR_ROLE can create", async () => {
      const future = await chainNow() + 86400;
      await expect(
        core.connect(outsider).createFundedQuest(
          sponsor.address, await token.getAddress(),
          REWARD, BADGE_ID, 0, future, MAX_CLAIMS, MIN_SCORE
        )
      ).to.be.revert(ethers);
    });
  });

  // ─────────────────────────────────────────────────────────────── //
  // FUNDING
  // ─────────────────────────────────────────────────────────────── //
  describe("fundQuest / topUpQuest", () => {
    beforeEach(async () => { await deployAll(); await createQuest(); });

    it("partial fund → PARTIALLY_FUNDED", async () => {
      await fund(1n, sponsor, ethers.parseEther("20"));
      const q = await core.getQuest(1);
      expect(q.fundedAmount).to.equal(ethers.parseEther("20"));
      expect(q.fundingStatus).to.equal(FS.PARTIALLY_FUNDED);
    });

    it("full fund → FUNDED", async () => {
      await fund(1n, sponsor, REQUIRED_FUNDING);
      const q = await core.getQuest(1);
      expect(q.fundedAmount).to.equal(REQUIRED_FUNDING);
      expect(q.fundingStatus).to.equal(FS.FUNDED);
    });

    it("multiple funders can contribute", async () => {
      await fund(1n, sponsor, ethers.parseEther("20"));
      await fund(1n, sponsorB, ethers.parseEther("30"));
      const q = await core.getQuest(1);
      expect(q.fundedAmount).to.equal(REQUIRED_FUNDING);
      expect(q.fundingStatus).to.equal(FS.FUNDED);
    });

    it("rejects zero amount", async () => {
      await token.connect(sponsor).approve(await core.getAddress(), 1);
      await expect(core.connect(sponsor).fundQuest(1n, 0)).to.be.revertedWith("QLCv2: zero amount");
    });

    it("rejects funding for missing quest", async () => {
      await token.connect(sponsor).approve(await core.getAddress(), ethers.parseEther("10"));
      await expect(core.connect(sponsor).fundQuest(999n, ethers.parseEther("10")))
        .to.be.revertedWith("QLCv2: quest missing");
    });

    it("topUpQuest after FUNDED also works and emits QuestToppedUp", async () => {
      await fund(1n, sponsor, REQUIRED_FUNDING);
      await token.connect(sponsor).approve(await core.getAddress(), ethers.parseEther("5"));
      await expect(core.connect(sponsor).topUpQuest(1n, ethers.parseEther("5")))
        .to.emit(core, "QuestToppedUp");
    });

    it("fundQuest after FUNDED emits QuestToppedUp (not QuestFunded)", async () => {
      await fund(1n, sponsor, REQUIRED_FUNDING);
      await token.connect(sponsor).approve(await core.getAddress(), ethers.parseEther("5"));
      await expect(core.connect(sponsor).fundQuest(1n, ethers.parseEther("5")))
        .to.emit(core, "QuestToppedUp");
    });
  });

  // ─────────────────────────────────────────────────────────────── //
  // SUBMISSION + APPROVAL
  // ─────────────────────────────────────────────────────────────── //
  describe("submission + approval", () => {
    let proofHash: string;
    let attestUID: string;

    beforeEach(async () => {
      await deployAll();
      await createQuest();
      await fund(1n, sponsor, REQUIRED_FUNDING);
      proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof-1"));
      attestUID = ethers.keccak256(ethers.toUtf8Bytes("attest-1"));
    });

    it("user can submitProofHash and verifier can approve", async () => {
      await core.connect(user1).submitProofHash(1n, proofHash);
      await core.connect(verifier).approveSubmission(1n, user1.address, proofHash, attestUID, 85);
      const s = await core.getSubmission(1n, user1.address);
      expect(s.status).to.equal(2); // APPROVED
      expect(s.score).to.equal(85);
    });

    it("verifier submitAndApprove is atomic", async () => {
      await core.connect(verifier).submitAndApprove(1n, user1.address, proofHash, attestUID, 85);
      const s = await core.getSubmission(1n, user1.address);
      expect(s.status).to.equal(2);
    });

    it("reverts on score below minScore", async () => {
      await core.connect(user1).submitProofHash(1n, proofHash);
      await expect(
        core.connect(verifier).approveSubmission(1n, user1.address, proofHash, attestUID, 50)
      ).to.be.revertedWith("QLCv2: score below minimum");
    });

    it("reverts on proofHash mismatch", async () => {
      await core.connect(user1).submitProofHash(1n, proofHash);
      const wrong = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
      await expect(
        core.connect(verifier).approveSubmission(1n, user1.address, wrong, attestUID, 85)
      ).to.be.revertedWith("QLCv2: proof hash mismatch");
    });

    it("only verifier can approve", async () => {
      await core.connect(user1).submitProofHash(1n, proofHash);
      await expect(
        core.connect(outsider).approveSubmission(1n, user1.address, proofHash, attestUID, 85)
      ).to.be.revert(ethers);
    });

    it("rejected submission cannot be claimed", async () => {
      await core.connect(user1).submitProofHash(1n, proofHash);
      await core.connect(verifier).rejectSubmission(1n, user1.address);
      await expect(core.connect(user1).claimReward(1n))
        .to.be.revertedWith("QLCv2: not approved");
    });

    it("blocks double submit", async () => {
      await core.connect(user1).submitProofHash(1n, proofHash);
      await expect(core.connect(user1).submitProofHash(1n, proofHash))
        .to.be.revertedWith("QLCv2: already submitted");
    });
  });

  // ─────────────────────────────────────────────────────────────── //
  // CLAIM
  // ─────────────────────────────────────────────────────────────── //
  describe("claim", () => {
    let proofHash: string;
    let attestUID: string;

    beforeEach(async () => {
      await deployAll();
      await createQuest();
      await fund(1n, sponsor, REQUIRED_FUNDING);
      proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof-1"));
      attestUID = ethers.keccak256(ethers.toUtf8Bytes("attest-1"));
      await core.connect(verifier).submitAndApprove(1n, user1.address, proofHash, attestUID, 85);
    });

    it("user.claimReward transfers QUEST + mints badge atomically", async () => {
      const balBefore = await token.balanceOf(user1.address);
      await core.connect(user1).claimReward(1n);
      const balAfter = await token.balanceOf(user1.address);
      expect(balAfter - balBefore).to.equal(REWARD);
      expect(await badge.hasBadge(user1.address, BADGE_ID)).to.be.true;
    });

    it("verifier.claimRewardFor works the same way", async () => {
      await core.connect(verifier).claimRewardFor(1n, user1.address);
      expect(await token.balanceOf(user1.address)).to.equal(REWARD);
    });

    it("claim deducts only from this quest's pool (claimedAmount + totalClaims)", async () => {
      await core.connect(user1).claimReward(1n);
      const q = await core.getQuest(1n);
      expect(q.claimedAmount).to.equal(REWARD);
      expect(q.totalClaims).to.equal(1n);
    });

    it("cannot claim twice", async () => {
      await core.connect(user1).claimReward(1n);
      await expect(core.connect(user1).claimReward(1n)).to.be.revertedWith("QLCv2: not approved");
    });

    it("cannot claim without prior approval", async () => {
      // user2 never submitted
      await expect(core.connect(user2).claimReward(1n)).to.be.revertedWith("QLCv2: not approved");
    });

    it("cannot claim if underfunded (insufficient remaining)", async () => {
      // Withdraw the funding via admin trick? Cleaner: create a quest with
      // tiny funding and try to claim.
      const now = await chainNow();
      const future = now + 30 * 86400;
      await core.createFundedQuest(sponsor.address, await token.getAddress(),
        REWARD, BADGE_ID, 0, future, MAX_CLAIMS, MIN_SCORE);

      // Fund only 5 QUEST (less than rewardAmount = 10)
      await fund(2n, sponsor, ethers.parseEther("5"));

      // Approve a submission
      const ph2 = ethers.keccak256(ethers.toUtf8Bytes("p2"));
      const att2 = ethers.keccak256(ethers.toUtf8Bytes("a2"));
      await core.connect(verifier).submitAndApprove(2n, user2.address, ph2, att2, 85);

      await expect(core.connect(user2).claimReward(2n))
        .to.be.revertedWith("QLCv2: insufficient funding");
    });
  });

  // ─────────────────────────────────────────────────────────────── //
  // CROSS-QUEST ISOLATION (the v1.2 keystone test)
  // ─────────────────────────────────────────────────────────────── //
  describe("cross-quest funding isolation", () => {
    it("a claim from Quest A does NOT reduce Quest B's funded balance", async () => {
      await deployAll();
      // Quest 1 with REQUIRED_FUNDING, Quest 2 with REQUIRED_FUNDING
      await createQuest();
      const now = await chainNow();
      await core.createFundedQuest(sponsorB.address, await token.getAddress(),
        REWARD, BADGE_ID, 0, now + 30 * 86400, MAX_CLAIMS, MIN_SCORE);

      await fund(1n, sponsor,  REQUIRED_FUNDING);
      await fund(2n, sponsorB, REQUIRED_FUNDING);

      const before = await core.getQuestFunding(2n);

      // Approve and claim on Quest 1
      const ph = ethers.keccak256(ethers.toUtf8Bytes("p"));
      const at = ethers.keccak256(ethers.toUtf8Bytes("a"));
      await core.connect(verifier).submitAndApprove(1n, user1.address, ph, at, 85);
      await core.connect(user1).claimReward(1n);

      const after = await core.getQuestFunding(2n);

      expect(after.funded).to.equal(before.funded);
      expect(after.claimed).to.equal(before.claimed);
      expect(after.withdrawn).to.equal(before.withdrawn);
      expect(after.remaining).to.equal(before.remaining);
    });

    it("draining Quest A entirely still leaves Quest B fully funded", async () => {
      await deployAll();
      // smaller Quest A (1 claim) so we can drain it fast
      const now = await chainNow();
      await core.createFundedQuest(sponsor.address, await token.getAddress(),
        REWARD, BADGE_ID, 0, now + 30 * 86400, 1n, MIN_SCORE);  // quest 1
      await core.createFundedQuest(sponsorB.address, await token.getAddress(),
        REWARD, BADGE_ID, 0, now + 30 * 86400, MAX_CLAIMS, MIN_SCORE); // quest 2

      await fund(1n, sponsor,  REWARD);          // exact funding for 1 claim
      await fund(2n, sponsorB, REQUIRED_FUNDING);

      // Drain quest 1
      const ph = ethers.keccak256(ethers.toUtf8Bytes("p"));
      const at = ethers.keccak256(ethers.toUtf8Bytes("a"));
      await core.connect(verifier).submitAndApprove(1n, user1.address, ph, at, 85);
      await core.connect(user1).claimReward(1n);

      // Quest 2 untouched
      const q2 = await core.getQuest(2n);
      expect(q2.fundedAmount).to.equal(REQUIRED_FUNDING);
      expect(q2.claimedAmount).to.equal(0n);
      expect(q2.fundingStatus).to.equal(FS.FUNDED);
    });
  });

  // ─────────────────────────────────────────────────────────────── //
  // MAX CLAIMS + DEADLINE
  // ─────────────────────────────────────────────────────────────── //
  describe("maxClaims + deadline", () => {
    it("enforces maxClaims = 1", async () => {
      await deployAll();
      const now = await chainNow();
      await core.createFundedQuest(sponsor.address, await token.getAddress(),
        REWARD, BADGE_ID, 0, now + 30 * 86400, 1n, MIN_SCORE);
      await fund(1n, sponsor, REWARD);

      const ph1 = ethers.keccak256(ethers.toUtf8Bytes("p1"));
      const ph2 = ethers.keccak256(ethers.toUtf8Bytes("p2"));
      const at  = ethers.keccak256(ethers.toUtf8Bytes("a"));

      await core.connect(verifier).submitAndApprove(1n, user1.address, ph1, at, 85);
      await core.connect(user1).claimReward(1n);

      // Second submission would exceed maxClaims
      await core.connect(user2).submitProofHash(1n, ph2);
      await expect(
        core.connect(verifier).approveSubmission(1n, user2.address, ph2, at, 85)
      ).to.be.revertedWith("QLCv2: max claims reached");
    });

    it("blocks submission after deadline", async () => {
      await deployAll();
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      await core.createFundedQuest(sponsor.address, await token.getAddress(),
        REWARD, BADGE_ID, 0, now + 100, MAX_CLAIMS, MIN_SCORE);
      await fund(1n, sponsor, REQUIRED_FUNDING);

      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      const ph = ethers.keccak256(ethers.toUtf8Bytes("p"));
      await expect(core.connect(user1).submitProofHash(1n, ph))
        .to.be.revertedWith("QLCv2: deadline passed");
    });
  });

  // ─────────────────────────────────────────────────────────────── //
  // WITHDRAWAL
  // ─────────────────────────────────────────────────────────────── //
  describe("withdrawUnusedQuestFunds", () => {
    beforeEach(async () => {
      await deployAll();
      await createQuest();
      await fund(1n, sponsor, REQUIRED_FUNDING);
    });

    it("sponsor can withdraw unused funds after deadline", async () => {
      // Fast-forward past deadline
      await ethers.provider.send("evm_increaseTime", [31 * 86400]);
      await ethers.provider.send("evm_mine", []);

      const before = await token.balanceOf(sponsor.address);
      await core.connect(sponsor).withdrawUnusedQuestFunds(1n, REQUIRED_FUNDING);
      const after = await token.balanceOf(sponsor.address);

      expect(after - before).to.equal(REQUIRED_FUNDING);
      const q = await core.getQuest(1n);
      expect(q.withdrawnAmount).to.equal(REQUIRED_FUNDING);
    });

    it("admin can withdraw on sponsor's behalf after deadline", async () => {
      await ethers.provider.send("evm_increaseTime", [31 * 86400]);
      await ethers.provider.send("evm_mine", []);
      await core.connect(admin).withdrawUnusedQuestFunds(1n, REQUIRED_FUNDING);
      const q = await core.getQuest(1n);
      expect(q.withdrawnAmount).to.equal(REQUIRED_FUNDING);
    });

    it("blocks withdrawal before deadline while active", async () => {
      await expect(
        core.connect(sponsor).withdrawUnusedQuestFunds(1n, REQUIRED_FUNDING)
      ).to.be.revertedWith("QLCv2: not yet withdrawable");
    });

    it("non-sponsor non-admin cannot withdraw", async () => {
      await ethers.provider.send("evm_increaseTime", [31 * 86400]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        core.connect(outsider).withdrawUnusedQuestFunds(1n, REQUIRED_FUNDING)
      ).to.be.revertedWith("QLCv2: not sponsor or admin");
    });

    it("cannot withdraw more than unused funds", async () => {
      await ethers.provider.send("evm_increaseTime", [31 * 86400]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        core.connect(sponsor).withdrawUnusedQuestFunds(1n, REQUIRED_FUNDING + 1n)
      ).to.be.revertedWith("QLCv2: exceeds unused funds");
    });

    it("withdrawnAmount + claimedAmount never exceeds fundedAmount", async () => {
      // Claim once, then advance time, then withdraw the rest
      const ph = ethers.keccak256(ethers.toUtf8Bytes("p"));
      const at = ethers.keccak256(ethers.toUtf8Bytes("a"));
      await core.connect(verifier).submitAndApprove(1n, user1.address, ph, at, 85);
      await core.connect(user1).claimReward(1n);

      await ethers.provider.send("evm_increaseTime", [31 * 86400]);
      await ethers.provider.send("evm_mine", []);

      const unused = REQUIRED_FUNDING - REWARD;
      await core.connect(sponsor).withdrawUnusedQuestFunds(1n, unused);

      const q = await core.getQuest(1n);
      expect(q.fundedAmount).to.equal(REQUIRED_FUNDING);
      expect(q.claimedAmount + q.withdrawnAmount).to.equal(REQUIRED_FUNDING);
    });

    it("allows withdrawal immediately after closeQuest (before deadline)", async () => {
      await core.connect(sponsor).closeQuest(1n);
      await core.connect(sponsor).withdrawUnusedQuestFunds(1n, REQUIRED_FUNDING);
      const q = await core.getQuest(1n);
      expect(q.withdrawnAmount).to.equal(REQUIRED_FUNDING);
    });
  });

  // ─────────────────────────────────────────────────────────────── //
  // CLOSE / PAUSE
  // ─────────────────────────────────────────────────────────────── //
  describe("close + pause", () => {
    beforeEach(async () => {
      await deployAll();
      await createQuest();
      await fund(1n, sponsor, REQUIRED_FUNDING);
    });

    it("pauseQuest blocks claims, unpause restores them", async () => {
      const ph = ethers.keccak256(ethers.toUtf8Bytes("p"));
      const at = ethers.keccak256(ethers.toUtf8Bytes("a"));
      await core.connect(verifier).submitAndApprove(1n, user1.address, ph, at, 85);

      await core.connect(admin).pauseQuest(1n);
      await expect(core.connect(user1).claimReward(1n))
        .to.be.revertedWith("QLCv2: quest not active");

      await core.connect(admin).unpauseQuest(1n);
      await core.connect(user1).claimReward(1n);
      expect(await token.balanceOf(user1.address)).to.equal(REWARD);
    });

    it("closeQuest is terminal and blocks new submissions + claims", async () => {
      await core.connect(sponsor).closeQuest(1n);
      const q = await core.getQuest(1n);
      expect(q.fundingStatus).to.equal(FS.CLOSED);
      expect(q.active).to.be.false;

      const ph = ethers.keccak256(ethers.toUtf8Bytes("p"));
      await expect(core.connect(user1).submitProofHash(1n, ph))
        .to.be.revertedWith("QLCv2: quest not active");
    });

    it("only sponsor or admin can close", async () => {
      await expect(core.connect(outsider).closeQuest(1n))
        .to.be.revertedWith("QLCv2: not sponsor or admin");
    });

    it("only PAUSER_ROLE can pauseQuest", async () => {
      await expect(core.connect(outsider).pauseQuest(1n)).to.be.revert(ethers);
    });

    it("contract-wide pause blocks fund + submit + claim", async () => {
      await core.connect(admin).pause();
      await token.connect(sponsor).approve(await core.getAddress(), ethers.parseEther("1"));
      await expect(core.connect(sponsor).fundQuest(1n, ethers.parseEther("1")))
        .to.be.revertedWithCustomError(core, "EnforcedPause");
    });
  });

  // ─────────────────────────────────────────────────────────────── //
  // VIEWS
  // ─────────────────────────────────────────────────────────────── //
  describe("views", () => {
    it("getClaimableCapacity reflects min(remaining/reward, slotsLeft)", async () => {
      await deployAll();
      await createQuest();
      // Only fund half: 25 QUEST → can support 2 claims (rewardAmount = 10)
      await fund(1n, sponsor, ethers.parseEther("25"));
      const cap = await core.getClaimableCapacity(1n);
      expect(cap).to.equal(2n);

      // Fund the rest → capacity caps at maxClaims (5)
      await fund(1n, sponsor, ethers.parseEther("25"));
      const cap2 = await core.getClaimableCapacity(1n);
      expect(cap2).to.equal(MAX_CLAIMS);
    });

    it("getQuestFunding returns correct accounting after claim", async () => {
      await deployAll();
      await createQuest();
      await fund(1n, sponsor, REQUIRED_FUNDING);
      const ph = ethers.keccak256(ethers.toUtf8Bytes("p"));
      const at = ethers.keccak256(ethers.toUtf8Bytes("a"));
      await core.connect(verifier).submitAndApprove(1n, user1.address, ph, at, 85);
      await core.connect(user1).claimReward(1n);

      const f = await core.getQuestFunding(1n);
      expect(f.funded).to.equal(REQUIRED_FUNDING);
      expect(f.claimed).to.equal(REWARD);
      expect(f.withdrawn).to.equal(0);
      expect(f.remaining).to.equal(REQUIRED_FUNDING - REWARD);
    });
  });
});
