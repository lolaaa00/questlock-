// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

// Badge IDs:
// 1 = Verified Builder
// 2 = GitHub Contributor
// 3 = Protocol Researcher
// 4 = Serious Learner
contract QuestBadge is ERC1155, AccessControl, ERC1155Supply {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    string public name = "QuestLock Badges";
    string public symbol = "QLBADGE";

    mapping(uint256 => string) private _tokenURIs;
    mapping(address => mapping(uint256 => bool)) private _hasBadge;

    event BadgeMinted(address indexed recipient, uint256 indexed badgeId);

    constructor(address admin, string memory baseURI) ERC1155(baseURI) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function mint(address to, uint256 badgeId, bytes memory data)
        external
        onlyRole(MINTER_ROLE)
    {
        require(!_hasBadge[to][badgeId], "QuestBadge: already holds this badge");
        _hasBadge[to][badgeId] = true;
        _mint(to, badgeId, 1, data);
        emit BadgeMinted(to, badgeId);
    }

    function hasBadge(address account, uint256 badgeId) external view returns (bool) {
        return _hasBadge[account][badgeId];
    }

    function setTokenURI(uint256 tokenId, string memory tokenURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _tokenURIs[tokenId] = tokenURI;
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenURI = _tokenURIs[tokenId];
        if (bytes(tokenURI).length > 0) return tokenURI;
        return super.uri(tokenId);
    }

    // Soulbound: block transfers except mint (from == address(0))
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public override {
        require(from == address(0), "QuestBadge: badges are soulbound");
        super.safeTransferFrom(from, to, id, amount, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public override {
        require(from == address(0), "QuestBadge: badges are soulbound");
        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
