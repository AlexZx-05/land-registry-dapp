// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract LandRegistry is ERC721 {
    struct Property {
        uint256 id;
        address owner;
        string polygon;
        string ipfsHash;
        bool verified;
    }

    uint256 public propertyCount;
    address public immutable registrar;

    mapping(uint256 => Property) public properties;

    event PropertyRegistered(uint256 indexed id, address indexed owner, string polygon, string ipfsHash);
    event PropertyVerified(uint256 indexed id, address indexed verifier);
    event OwnershipTransferred(uint256 indexed id, address indexed from, address indexed to);

    modifier onlyRegistrar() {
        require(msg.sender == registrar, "Not registrar");
        _;
    }

    modifier propertyExists(uint256 _id) {
        require(_id > 0 && _id <= propertyCount, "Invalid property");
        _;
    }

    constructor() ERC721("LandRegistryProperty", "LRP") {
        registrar = msg.sender;
    }

    function registerProperty(string memory _polygon, string memory _ipfsHash) external {
        propertyCount += 1;
        properties[propertyCount] = Property({
            id: propertyCount,
            owner: msg.sender,
            polygon: _polygon,
            ipfsHash: _ipfsHash,
            verified: false
        });
        _safeMint(msg.sender, propertyCount);

        emit PropertyRegistered(propertyCount, msg.sender, _polygon, _ipfsHash);
    }

    function verifyProperty(uint256 _id) external onlyRegistrar propertyExists(_id) {
        properties[_id].verified = true;
        emit PropertyVerified(_id, msg.sender);
    }

    function transferOwnership(uint256 _id, address _newOwner) external propertyExists(_id) {
        require(msg.sender == properties[_id].owner, "Not owner");
        require(_newOwner != address(0), "Invalid owner");

        address currentOwner = properties[_id].owner;
        require(ownerOf(_id) == currentOwner, "NFT owner mismatch");

        _transfer(currentOwner, _newOwner, _id);
        properties[_id].owner = _newOwner;

        emit OwnershipTransferred(_id, currentOwner, _newOwner);
    }

    function getProperty(uint256 _id)
        external
        view
        propertyExists(_id)
        returns (
            uint256 id,
            address owner,
            string memory polygon,
            string memory ipfsHash,
            bool verified
        )
    {
        Property memory p = properties[_id];
        return (p.id, p.owner, p.polygon, p.ipfsHash, p.verified);
    }
}
