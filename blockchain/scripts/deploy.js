async function main() {
  const LandRegistry = await ethers.getContractFactory("LandRegistry");
  const landRegistry = await LandRegistry.deploy();
  await landRegistry.waitForDeployment();

  console.log("LandRegistry deployed to:", await landRegistry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
