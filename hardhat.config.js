require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      // 默认 Hardhat 网络的第一个账户私钥（仅用于本地测试）
      // 实际部署脚本会自动用 Hardhat 提供的账户，这里留空即可
      // accounts: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf8fbc251"]
    },
  },
};
