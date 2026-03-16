const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LandRegistry", () => {
  async function deployFixture() {
    const [registrar, owner, buyer] = await ethers.getSigners();
    const LandRegistry = await ethers.getContractFactory("LandRegistry");
    const landRegistry = await LandRegistry.deploy();
    await landRegistry.waitForDeployment();
    return { landRegistry, registrar, owner, buyer };
  }

  it("registers a property", async () => {
    const { landRegistry, owner } = await deployFixture();
    await landRegistry
      .connect(owner)
      .registerProperty("POLYGON_GEOJSON", "QmFakeHash");

    const property = await landRegistry.properties(1);
    expect(property.id).to.equal(1n);
    expect(property.owner).to.equal(owner.address);
    expect(property.verified).to.equal(false);
  });

  it("allows only registrar to verify", async () => {
    const { landRegistry, owner } = await deployFixture();
    await landRegistry.connect(owner).registerProperty("POLY", "QmHash");

    await expect(landRegistry.connect(owner).verifyProperty(1)).to.be.revertedWith(
      "Not registrar"
    );
  });

  it("transfers ownership by current owner", async () => {
    const { landRegistry, owner, buyer } = await deployFixture();
    await landRegistry.connect(owner).registerProperty("POLY", "QmHash");

    await landRegistry.connect(owner).transferOwnership(1, buyer.address);
    const property = await landRegistry.properties(1);
    expect(property.owner).to.equal(buyer.address);
  });
});
