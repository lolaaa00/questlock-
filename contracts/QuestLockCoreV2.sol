// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./QuestBadge.sol";

/// @title QuestLockCoreV2 — sponsor-funded per-quest reward pools
/// @notice v1.2 successor to QuestLockCore. Keeps the V1 surface
///         (submitAndApprove / approveSubmission / claimRewardFor / etc.)
///         and ADDS per-quest funded balances so that one quest cannot drain
///         another quest's allocation. Legacy v1 contract is unchanged and
///         continues to host all quests created before v1.2.
contract QuestLockCoreV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- //
    // Roles                                                             //
    // ---------------------------------------------------------------- //
    bytes32 public constant QUEST_CREATOR_ROLE = keccak256("QUEST_CREATOR_ROLE");
    bytes32 public constant VERIFIER_ROLE      = keccak256("VERIFIER_ROLE");
    bytes32 public constant PAUSER_ROLE        = keccak256("PAUSER_ROLE");

    // ---------------------------------------------------------------- //
    // Types                                                             //
    // ---------------------------------------------------------------- //
    enum SubmissionStatus { NONE, SUBMITTED, APPROVED, REJECTED, CLAIMED }

    /// @dev EXPIRED is computed at the view layer from `deadline`. PAUSED is
    ///      computed from `active`. Stored fundingStatus reflects the
    ///      funding lifecycle only and never holds EXPIRED / PAUSED.
    enum FundingStatus {
        UNFUNDED,
        PARTIALLY_FUNDED,
        FUNDED,
        UNDERFUNDED,
        CLOSED,
        REFUNDED
    }

    struct FundedQuest {
        uint256 id;
        address creator;        // wallet that called createFundedQuest
        address sponsor;        // wallet with withdrawal rights
        address rewardToken;
        uint256 rewardAmount;
        uint256 badgeId;
        uint256 startTime;
        uint256 deadline;
        uint256 maxClaims;
        uint256 totalClaims;
        uint16  minScore;
        bool    active;         // false when paused or closed
        // funding accounting
        uint256 requiredFunding;  // rewardAmount * maxClaims (fixed at create)
        uint256 fundedAmount;     // total QUEST deposited into this quest
        uint256 claimedAmount;    // total QUEST paid out to users
        uint256 withdrawnAmount;  // total QUEST refunded to sponsor
        FundingStatus fundingStatus;
    }

    struct Submission {
        bytes32 proofHash;
        bytes32 attestationUID;
        uint16  score;
        SubmissionStatus status;
        uint256 submittedAt;
        uint256 reviewedAt;
        uint256 claimedAt;
    }

    // ---------------------------------------------------------------- //
    // Storage                                                           //
    // ---------------------------------------------------------------- //
    QuestBadge public immutable badgeContract;
    uint256 public questCount;

    mapping(uint256 => FundedQuest) public quests;
    mapping(uint256 => mapping(address => Submission)) public submissions;

    // ---------------------------------------------------------------- //
    // Events                                                            //
    // ---------------------------------------------------------------- //
    event FundedQuestCreated(
        uint256 indexed questId,
        address indexed sponsor,
        address indexed creator,
        address rewardToken,
        uint256 rewardAmount,
        uint256 maxClaims,
        uint256 deadline,
        uint256 requiredFunding
    );
    event QuestFunded(
        uint256 indexed questId,
        address indexed funder,
        uint256 amount,
        uint256 newFundedAmount
    );
    event QuestToppedUp(
        uint256 indexed questId,
        address indexed funder,
        uint256 amount,
        uint256 newFundedAmount
    );
    event QuestUnderfunded(
        uint256 indexed questId,
        uint256 fundedAmount,
        uint256 requiredFunding
    );
    event QuestFundingStatusChanged(
        uint256 indexed questId,
        FundingStatus oldStatus,
        FundingStatus newStatus
    );
    event ProofSubmitted(uint256 indexed questId, address indexed user, bytes32 proofHash);
    event SubmissionApproved(uint256 indexed questId, address indexed user, bytes32 attestationUID, uint16 score);
    event SubmissionRejected(uint256 indexed questId, address indexed user);
    event RewardClaimed(uint256 indexed questId, address indexed user, uint256 rewardAmount, uint256 badgeId);
    event UnusedFundsWithdrawn(uint256 indexed questId, address indexed to, uint256 amount);
    event QuestClosed(uint256 indexed questId, address indexed by);
    event QuestPaused(uint256 indexed questId);
    event QuestUnpaused(uint256 indexed questId);

    // ---------------------------------------------------------------- //
    // Constructor                                                       //
    // ---------------------------------------------------------------- //
    constructor(address admin, address _badgeContract) {
        require(admin != address(0), "QLCv2: zero admin");
        require(_badgeContract != address(0), "QLCv2: zero badge");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(QUEST_CREATOR_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        badgeContract = QuestBadge(_badgeContract);
    }

    // ---------------------------------------------------------------- //
    // Quest creation                                                    //
    // ---------------------------------------------------------------- //
    function createFundedQuest(
        address sponsor,
        address rewardToken,
        uint256 rewardAmount,
        uint256 badgeId,
        uint256 startTime,
        uint256 deadline,
        uint256 maxClaims,
        uint16  minScore
    ) external onlyRole(QUEST_CREATOR_ROLE) whenNotPaused returns (uint256) {
        require(sponsor != address(0),     "QLCv2: zero sponsor");
        require(rewardToken != address(0), "QLCv2: zero reward token");
        require(rewardAmount > 0,          "QLCv2: reward must be > 0");
        require(maxClaims > 0,             "QLCv2: maxClaims must be > 0");
        require(deadline > block.timestamp, "QLCv2: deadline in past");

        questCount += 1;
        uint256 qid = questCount;
        uint256 required = rewardAmount * maxClaims;

        // Field-by-field assignment to avoid solc "stack too deep" on the
        // 16-field struct literal + 8 fn parameters.
        FundedQuest storage q = quests[qid];
        q.id              = qid;
        q.creator         = msg.sender;
        q.sponsor         = sponsor;
        q.rewardToken     = rewardToken;
        q.rewardAmount    = rewardAmount;
        q.badgeId         = badgeId;
        q.startTime       = startTime == 0 ? block.timestamp : startTime;
        q.deadline        = deadline;
        q.maxClaims       = maxClaims;
        q.minScore        = minScore;
        q.active          = true;
        q.requiredFunding = required;
        // totalClaims / fundedAmount / claimedAmount / withdrawnAmount
        // default to 0; fundingStatus defaults to UNFUNDED (enum value 0).

        emit FundedQuestCreated(
            qid, sponsor, msg.sender,
            rewardToken, rewardAmount, maxClaims, deadline, required
        );
        return qid;
    }

    // ---------------------------------------------------------------- //
    // Funding                                                           //
    // ---------------------------------------------------------------- //
    /// @notice Deposit QUEST into a specific quest. Anyone can fund; the
    ///         sponsor's withdrawal rights are unaffected.
    function fundQuest(uint256 questId, uint256 amount) external nonReentrant whenNotPaused {
        FundedQuest storage q = quests[questId];
        require(q.id != 0,                      "QLCv2: quest missing");
        require(q.fundingStatus != FundingStatus.CLOSED &&
                q.fundingStatus != FundingStatus.REFUNDED, "QLCv2: quest closed");
        require(amount > 0,                     "QLCv2: zero amount");

        IERC20(q.rewardToken).safeTransferFrom(msg.sender, address(this), amount);
        bool wasFunded = (q.fundingStatus == FundingStatus.FUNDED);
        q.fundedAmount += amount;

        _recomputeFundingStatus(q);

        if (wasFunded) {
            emit QuestToppedUp(questId, msg.sender, amount, q.fundedAmount);
        } else {
            emit QuestFunded(questId, msg.sender, amount, q.fundedAmount);
        }
    }

    /// @notice Convenience alias for funding an already-FUNDED quest.
    function topUpQuest(uint256 questId, uint256 amount) external nonReentrant whenNotPaused {
        FundedQuest storage q = quests[questId];
        require(q.id != 0,                       "QLCv2: quest missing");
        require(q.fundingStatus != FundingStatus.CLOSED &&
                q.fundingStatus != FundingStatus.REFUNDED, "QLCv2: quest closed");
        require(amount > 0,                      "QLCv2: zero amount");

        IERC20(q.rewardToken).safeTransferFrom(msg.sender, address(this), amount);
        q.fundedAmount += amount;
        _recomputeFundingStatus(q);

        emit QuestToppedUp(questId, msg.sender, amount, q.fundedAmount);
    }

    // ---------------------------------------------------------------- //
    // Submission                                                        //
    // ---------------------------------------------------------------- //
    function submitProofHash(uint256 questId, bytes32 proofHash) external whenNotPaused {
        _submitProofHash(questId, msg.sender, proofHash);
    }

    function submitProofHashFor(
        uint256 questId, address user, bytes32 proofHash
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        _submitProofHash(questId, user, proofHash);
    }

    function _submitProofHash(uint256 questId, address user, bytes32 proofHash) internal {
        FundedQuest storage q = quests[questId];
        require(q.id != 0,                      "QLCv2: quest missing");
        require(q.active,                       "QLCv2: quest not active");
        require(q.fundingStatus != FundingStatus.CLOSED, "QLCv2: quest closed");
        require(block.timestamp <= q.deadline,  "QLCv2: deadline passed");
        require(
            submissions[questId][user].status == SubmissionStatus.NONE,
            "QLCv2: already submitted"
        );

        submissions[questId][user] = Submission({
            proofHash:      proofHash,
            attestationUID: bytes32(0),
            score:          0,
            status:         SubmissionStatus.SUBMITTED,
            submittedAt:    block.timestamp,
            reviewedAt:     0,
            claimedAt:      0
        });
        emit ProofSubmitted(questId, user, proofHash);
    }

    function approveSubmission(
        uint256 questId, address user, bytes32 proofHash,
        bytes32 attestationUID, uint16 score
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        FundedQuest storage q = quests[questId];
        require(q.id != 0,                          "QLCv2: quest missing");
        require(q.active,                           "QLCv2: quest not active");
        require(q.totalClaims < q.maxClaims,        "QLCv2: max claims reached");

        Submission storage s = submissions[questId][user];
        require(s.status == SubmissionStatus.SUBMITTED, "QLCv2: bad submission status");
        require(s.proofHash == proofHash,               "QLCv2: proof hash mismatch");
        require(score >= q.minScore,                    "QLCv2: score below minimum");

        s.attestationUID = attestationUID;
        s.score          = score;
        s.status         = SubmissionStatus.APPROVED;
        s.reviewedAt     = block.timestamp;
        emit SubmissionApproved(questId, user, attestationUID, score);
    }

    /// @notice Atomic submit + approve in one tx. Used by the backend
    ///         verifier after offchain scoring + EAS attestation.
    function submitAndApprove(
        uint256 questId, address user, bytes32 proofHash,
        bytes32 attestationUID, uint16 score
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        _submitProofHash(questId, user, proofHash);

        FundedQuest storage q = quests[questId];
        require(q.totalClaims < q.maxClaims, "QLCv2: max claims reached");
        require(score >= q.minScore,         "QLCv2: score below minimum");

        Submission storage s = submissions[questId][user];
        s.attestationUID = attestationUID;
        s.score          = score;
        s.status         = SubmissionStatus.APPROVED;
        s.reviewedAt     = block.timestamp;
        emit SubmissionApproved(questId, user, attestationUID, score);
    }

    function rejectSubmission(uint256 questId, address user) external onlyRole(VERIFIER_ROLE) {
        Submission storage s = submissions[questId][user];
        require(s.status == SubmissionStatus.SUBMITTED, "QLCv2: bad submission status");
        s.status     = SubmissionStatus.REJECTED;
        s.reviewedAt = block.timestamp;
        emit SubmissionRejected(questId, user);
    }

    // ---------------------------------------------------------------- //
    // Claim                                                             //
    // ---------------------------------------------------------------- //
    function claimReward(uint256 questId) external nonReentrant whenNotPaused {
        _claimReward(questId, msg.sender);
    }

    function claimRewardFor(uint256 questId, address user)
        external onlyRole(VERIFIER_ROLE) nonReentrant whenNotPaused
    {
        _claimReward(questId, user);
    }

    function _claimReward(uint256 questId, address user) internal {
        FundedQuest storage q = quests[questId];
        require(q.id != 0,                       "QLCv2: quest missing");
        require(q.active,                        "QLCv2: quest not active");
        require(q.fundingStatus != FundingStatus.CLOSED, "QLCv2: quest closed");
        require(q.totalClaims < q.maxClaims,     "QLCv2: max claims reached");

        Submission storage s = submissions[questId][user];
        require(s.status == SubmissionStatus.APPROVED, "QLCv2: not approved");

        // Per-quest funding isolation — the keystone of v1.2.
        uint256 remaining = q.fundedAmount - q.claimedAmount - q.withdrawnAmount;
        require(remaining >= q.rewardAmount,    "QLCv2: insufficient funding");

        s.status      = SubmissionStatus.CLAIMED;
        s.claimedAt   = block.timestamp;
        q.totalClaims += 1;
        q.claimedAmount += q.rewardAmount;

        IERC20(q.rewardToken).safeTransfer(user, q.rewardAmount);
        badgeContract.mint(user, q.badgeId, "");

        _recomputeFundingStatus(q);

        emit RewardClaimed(questId, user, q.rewardAmount, q.badgeId);
    }

    // ---------------------------------------------------------------- //
    // Withdrawal                                                        //
    // ---------------------------------------------------------------- //
    /// @notice Refund unused funded QUEST back to the sponsor (or anyone the
    ///         admin chooses, since admin override exists). Only callable
    ///         after deadline OR after closeQuest, so users are never
    ///         left mid-claim.
    function withdrawUnusedQuestFunds(uint256 questId, uint256 amount) external nonReentrant {
        FundedQuest storage q = quests[questId];
        require(q.id != 0, "QLCv2: quest missing");
        require(
            msg.sender == q.sponsor || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "QLCv2: not sponsor or admin"
        );
        // Allowed only if the quest has actually finished accepting new work.
        bool expired = block.timestamp > q.deadline;
        bool closed  = q.fundingStatus == FundingStatus.CLOSED;
        require(expired || closed, "QLCv2: not yet withdrawable");

        uint256 unused = q.fundedAmount - q.claimedAmount - q.withdrawnAmount;
        require(amount > 0,            "QLCv2: zero amount");
        require(amount <= unused,      "QLCv2: exceeds unused funds");

        q.withdrawnAmount += amount;
        IERC20(q.rewardToken).safeTransfer(q.sponsor, amount);

        // If everything has been refunded, mark REFUNDED.
        if (q.fundedAmount - q.claimedAmount - q.withdrawnAmount == 0 && q.claimedAmount == 0) {
            _setFundingStatus(q, FundingStatus.REFUNDED);
        }

        emit UnusedFundsWithdrawn(questId, q.sponsor, amount);
    }

    // ---------------------------------------------------------------- //
    // Close / pause                                                     //
    // ---------------------------------------------------------------- //
    function closeQuest(uint256 questId) external {
        FundedQuest storage q = quests[questId];
        require(q.id != 0, "QLCv2: quest missing");
        require(
            msg.sender == q.sponsor || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "QLCv2: not sponsor or admin"
        );
        require(q.fundingStatus != FundingStatus.CLOSED, "QLCv2: already closed");
        q.active = false;
        _setFundingStatus(q, FundingStatus.CLOSED);
        emit QuestClosed(questId, msg.sender);
    }

    function pauseQuest(uint256 questId) external onlyRole(PAUSER_ROLE) {
        FundedQuest storage q = quests[questId];
        require(q.id != 0, "QLCv2: quest missing");
        require(q.active,  "QLCv2: already paused");
        require(q.fundingStatus != FundingStatus.CLOSED, "QLCv2: closed");
        q.active = false;
        emit QuestPaused(questId);
    }

    function unpauseQuest(uint256 questId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        FundedQuest storage q = quests[questId];
        require(q.id != 0, "QLCv2: quest missing");
        require(!q.active, "QLCv2: not paused");
        require(q.fundingStatus != FundingStatus.CLOSED, "QLCv2: closed");
        q.active = true;
        emit QuestUnpaused(questId);
    }

    function pause() external onlyRole(PAUSER_ROLE)            { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE)   { _unpause(); }

    // ---------------------------------------------------------------- //
    // Views                                                             //
    // ---------------------------------------------------------------- //
    function getQuest(uint256 questId) external view returns (FundedQuest memory) {
        return quests[questId];
    }
    function getSubmission(uint256 questId, address user) external view returns (Submission memory) {
        return submissions[questId][user];
    }
    function getQuestFunding(uint256 questId)
        external view
        returns (uint256 funded, uint256 claimed, uint256 withdrawn, uint256 remaining)
    {
        FundedQuest storage q = quests[questId];
        funded    = q.fundedAmount;
        claimed   = q.claimedAmount;
        withdrawn = q.withdrawnAmount;
        remaining = funded - claimed - withdrawn;
    }
    function getRemainingFunding(uint256 questId) external view returns (uint256) {
        FundedQuest storage q = quests[questId];
        return q.fundedAmount - q.claimedAmount - q.withdrawnAmount;
    }
    /// @notice How many additional claims the current funded balance can support,
    ///         capped by the unclaimed slot count.
    function getClaimableCapacity(uint256 questId) external view returns (uint256) {
        FundedQuest storage q = quests[questId];
        uint256 remaining = q.fundedAmount - q.claimedAmount - q.withdrawnAmount;
        uint256 slotsLeft = q.maxClaims - q.totalClaims;
        uint256 byFunding = remaining / q.rewardAmount;
        return byFunding < slotsLeft ? byFunding : slotsLeft;
    }

    // ---------------------------------------------------------------- //
    // Internal funding state machine                                    //
    // ---------------------------------------------------------------- //
    function _recomputeFundingStatus(FundedQuest storage q) internal {
        // CLOSED and REFUNDED are terminal; never overwrite.
        if (q.fundingStatus == FundingStatus.CLOSED ||
            q.fundingStatus == FundingStatus.REFUNDED) {
            return;
        }

        FundingStatus newStatus;
        uint256 remaining = q.fundedAmount - q.claimedAmount - q.withdrawnAmount;
        uint256 slotsLeft = q.maxClaims - q.totalClaims;

        if (q.fundedAmount == 0) {
            newStatus = FundingStatus.UNFUNDED;
        } else if (q.fundedAmount >= q.requiredFunding) {
            // Always FUNDED if total deposits met the required amount, even
            // if some has since been claimed.
            newStatus = FundingStatus.FUNDED;
        } else if (slotsLeft > 0 && remaining < q.rewardAmount) {
            // Funded but can no longer pay even one more claim — actively
            // underfunded relative to the next claim attempt.
            newStatus = FundingStatus.UNDERFUNDED;
            if (q.fundingStatus != FundingStatus.UNDERFUNDED) {
                emit QuestUnderfunded(q.id, q.fundedAmount, q.requiredFunding);
            }
        } else {
            // Below required total but still operational for the next claim.
            newStatus = FundingStatus.PARTIALLY_FUNDED;
        }

        if (newStatus != q.fundingStatus) {
            _setFundingStatus(q, newStatus);
        }
    }

    function _setFundingStatus(FundedQuest storage q, FundingStatus s) internal {
        FundingStatus old = q.fundingStatus;
        q.fundingStatus = s;
        emit QuestFundingStatusChanged(q.id, old, s);
    }
}
