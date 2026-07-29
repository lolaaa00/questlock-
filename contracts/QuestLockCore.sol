// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./QuestBadge.sol";

contract QuestLockCore is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant QUEST_CREATOR_ROLE = keccak256("QUEST_CREATOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    QuestBadge public immutable badgeContract;

    uint256 public questCount;

    struct Quest {
        uint256 id;
        address creator;
        address rewardToken;
        uint256 rewardAmount;
        uint256 badgeId;
        uint256 startTime;
        uint256 deadline;
        uint256 maxClaims;
        uint256 totalClaims;
        uint16 minScore;
        bool active;
    }

    enum SubmissionStatus {
        NONE,
        SUBMITTED,
        APPROVED,
        REJECTED,
        CLAIMED
    }

    struct Submission {
        bytes32 proofHash;
        bytes32 attestationUID;
        uint16 score;
        SubmissionStatus status;
        uint256 submittedAt;
        uint256 reviewedAt;
        uint256 claimedAt;
    }

    mapping(uint256 => Quest) public quests;
    mapping(uint256 => mapping(address => Submission)) public submissions;

    event QuestCreated(
        uint256 indexed questId,
        address indexed creator,
        address rewardToken,
        uint256 rewardAmount,
        uint256 deadline
    );
    event ProofSubmitted(
        uint256 indexed questId,
        address indexed user,
        bytes32 proofHash
    );
    event SubmissionApproved(
        uint256 indexed questId,
        address indexed user,
        bytes32 attestationUID,
        uint16 score
    );
    event SubmissionRejected(
        uint256 indexed questId,
        address indexed user
    );
    event RewardClaimed(
        uint256 indexed questId,
        address indexed user,
        uint256 rewardAmount,
        uint256 badgeId
    );
    event QuestPaused(uint256 indexed questId);
    event QuestUpdated(uint256 indexed questId);

    constructor(address admin, address _badgeContract) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(QUEST_CREATOR_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        badgeContract = QuestBadge(_badgeContract);
    }

    function createQuest(
        address rewardToken,
        uint256 rewardAmount,
        uint256 badgeId,
        uint256 startTime,
        uint256 deadline,
        uint256 maxClaims,
        uint16 minScore
    ) external onlyRole(QUEST_CREATOR_ROLE) whenNotPaused returns (uint256) {
        require(deadline > block.timestamp, "QuestLockCore: deadline in past");
        require(rewardToken != address(0), "QuestLockCore: invalid reward token");
        require(rewardAmount > 0, "QuestLockCore: reward amount must be > 0");
        require(maxClaims > 0, "QuestLockCore: maxClaims must be > 0");

        questCount++;
        uint256 questId = questCount;

        quests[questId] = Quest({
            id: questId,
            creator: msg.sender,
            rewardToken: rewardToken,
            rewardAmount: rewardAmount,
            badgeId: badgeId,
            startTime: startTime == 0 ? block.timestamp : startTime,
            deadline: deadline,
            maxClaims: maxClaims,
            totalClaims: 0,
            minScore: minScore,
            active: true
        });

        emit QuestCreated(questId, msg.sender, rewardToken, rewardAmount, deadline);
        return questId;
    }

    function submitProofHash(uint256 questId, bytes32 proofHash)
        external
        whenNotPaused
    {
        _submitProofHash(questId, msg.sender, proofHash);
    }

    // Called by the backend verifier on behalf of a user (offchain-first flow)
    function submitProofHashFor(
        uint256 questId,
        address user,
        bytes32 proofHash
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        _submitProofHash(questId, user, proofHash);
    }

    function _submitProofHash(
        uint256 questId,
        address user,
        bytes32 proofHash
    ) internal {
        Quest storage quest = quests[questId];
        require(quest.active, "QuestLockCore: quest not active");
        require(block.timestamp <= quest.deadline, "QuestLockCore: deadline passed");
        require(
            submissions[questId][user].status == SubmissionStatus.NONE,
            "QuestLockCore: already submitted"
        );

        submissions[questId][user] = Submission({
            proofHash: proofHash,
            attestationUID: bytes32(0),
            score: 0,
            status: SubmissionStatus.SUBMITTED,
            submittedAt: block.timestamp,
            reviewedAt: 0,
            claimedAt: 0
        });

        emit ProofSubmitted(questId, user, proofHash);
    }

    function approveSubmission(
        uint256 questId,
        address user,
        bytes32 proofHash,
        bytes32 attestationUID,
        uint16 score
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        Quest storage quest = quests[questId];
        require(quest.active, "QuestLockCore: quest not active");
        require(quest.totalClaims < quest.maxClaims, "QuestLockCore: max claims reached");

        Submission storage sub = submissions[questId][user];
        require(
            sub.status == SubmissionStatus.SUBMITTED,
            "QuestLockCore: invalid submission status"
        );
        require(sub.proofHash == proofHash, "QuestLockCore: proof hash mismatch");
        require(score >= quest.minScore, "QuestLockCore: score below minimum");

        sub.attestationUID = attestationUID;
        sub.score = score;
        sub.status = SubmissionStatus.APPROVED;
        sub.reviewedAt = block.timestamp;

        emit SubmissionApproved(questId, user, attestationUID, score);
    }

    function rejectSubmission(uint256 questId, address user)
        external
        onlyRole(VERIFIER_ROLE)
    {
        Submission storage sub = submissions[questId][user];
        require(
            sub.status == SubmissionStatus.SUBMITTED,
            "QuestLockCore: invalid submission status"
        );

        sub.status = SubmissionStatus.REJECTED;
        sub.reviewedAt = block.timestamp;

        emit SubmissionRejected(questId, user);
    }

    function claimReward(uint256 questId)
        external
        nonReentrant
        whenNotPaused
    {
        _claimReward(questId, msg.sender);
    }

    // Single atomic call: submit proof hash + approve — used by backend verifier
    function submitAndApprove(
        uint256 questId,
        address user,
        bytes32 proofHash,
        bytes32 attestationUID,
        uint16 score
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        _submitProofHash(questId, user, proofHash);

        Quest storage quest = quests[questId];
        require(quest.totalClaims < quest.maxClaims, "QuestLockCore: max claims reached");
        require(score >= quest.minScore, "QuestLockCore: score below minimum");

        Submission storage sub = submissions[questId][user];
        sub.attestationUID = attestationUID;
        sub.score = score;
        sub.status = SubmissionStatus.APPROVED;
        sub.reviewedAt = block.timestamp;

        emit SubmissionApproved(questId, user, attestationUID, score);
    }

    // Called by backend verifier on behalf of user — user pays no gas
    function claimRewardFor(uint256 questId, address user)
        external
        onlyRole(VERIFIER_ROLE)
        nonReentrant
        whenNotPaused
    {
        _claimReward(questId, user);
    }

    function _claimReward(uint256 questId, address user) internal {
        Quest storage quest = quests[questId];
        require(quest.active, "QuestLockCore: quest not active");
        require(quest.totalClaims < quest.maxClaims, "QuestLockCore: max claims reached");

        Submission storage sub = submissions[questId][user];
        require(
            sub.status == SubmissionStatus.APPROVED,
            "QuestLockCore: submission not approved"
        );

        sub.status = SubmissionStatus.CLAIMED;
        sub.claimedAt = block.timestamp;
        quest.totalClaims++;

        IERC20(quest.rewardToken).safeTransfer(user, quest.rewardAmount);
        badgeContract.mint(user, quest.badgeId, "");

        emit RewardClaimed(questId, user, quest.rewardAmount, quest.badgeId);
    }

    function pauseQuest(uint256 questId) external onlyRole(PAUSER_ROLE) {
        quests[questId].active = false;
        emit QuestPaused(questId);
    }

    function unpauseQuest(uint256 questId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(quests[questId].id != 0, "QuestLockCore: quest does not exist");
        quests[questId].active = true;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getQuest(uint256 questId) external view returns (Quest memory) {
        return quests[questId];
    }

    function getSubmission(uint256 questId, address user)
        external
        view
        returns (Submission memory)
    {
        return submissions[questId][user];
    }

    function getRewardBalance(uint256 questId) external view returns (uint256) {
        Quest storage quest = quests[questId];
        if (quest.rewardToken == address(0)) return 0;
        return IERC20(quest.rewardToken).balanceOf(address(this));
    }
}
