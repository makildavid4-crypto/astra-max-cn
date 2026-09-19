// 部署 MessageBoard 合约到本地网络，并自动生成前端配置文件
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const MessageBoard = await hre.ethers.getContractFactory("MessageBoard");
  const messageBoard = await MessageBoard.deploy();
  await messageBoard.waitForDeployment();

  const address = await messageBoard.getAddress();
  console.log("MessageBoard deployed to:", address);

  // 读取编译后的 ABI
  const artifact = await hre.artifacts.readArtifact("MessageBoard");
  const abi = artifact.abi;

  // 生成前端配置文件
  const frontendDir = path.join(__dirname, "..", "frontend");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  const configContent = `// 本文件由 scripts/deploy.js 自动生成，请勿手动修改
window.CONTRACT_CONFIG = {
  address: "${address}",
  abi: ${JSON.stringify(abi, null, 2)}
};
`;

  fs.writeFileSync(path.join(frontendDir, "contractConfig.js"), configContent);
  console.log("Frontend config written to frontend/contractConfig.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
