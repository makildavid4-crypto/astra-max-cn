# 📝 去中心化留言板 DApp

一个基于 **以太坊智能合约 + 原生 HTML/CSS/JavaScript** 的留言板网站，支持两种运行模式，无需传统后端服务器即可部署到静态网站托管平台。

## 🌐 在线访问

线上网址（GitHub Pages 自动部署，`frontend` 为站点目录）：

**https://makildavid4-crypto.github.io/astra-max-cn/**

> 访客打开即为本地演示模式，留言数据保存在各自浏览器中；本机启动 Hardhat 节点后访问则自动进入链上模式。

代码仓库（Git 版本控制）：

- Gitee（国内）：https://gitee.com/liu---zishan/astra-max-cn
- GitHub：https://github.com/makildavid4-crypto/astra-max-cn

> 说明：Gitee Pages 服务已官方下线（帮助文档标注"功能已下线"），故静态网站改由 GitHub Pages 托管；源码仍以 Gitee 仓库为主。

## ✨ 功能特性

网站打开时自动探测本机区块链节点，无缝切换两种模式：

| 模式 | 触发条件 | 数据存储 | 功能 |
| --- | --- | --- | --- |
| 🔗 链上模式 | 本机运行 Hardhat 节点 | 区块链智能合约 | MetaMask 连接、测试私钥快速模式、留言上链、Gas 余额变化、交易回执、自制区块浏览器验签 |
| 💾 演示模式 | 访问线上静态网址（无节点） | 浏览器 localStorage | 昵称切换、发布留言、模拟交易哈希与区块号，完整交互无需任何后端 |

## 🛠 技术栈

- **前端**：原生 HTML5 + CSS3 + JavaScript（ES6+），ethers.js v6
- **智能合约**：Solidity ^0.8.19
- **本地区块链**：Hardhat
- **版本控制**：Git
- **线上托管**：Gitee Pages（纯静态）

## 📁 目录结构

```
.
├── contracts/
│   └── MessageBoard.sol      # 智能合约：发布留言 / 读取全部留言 / MessagePosted 事件
├── scripts/
│   ├── deploy.js             # 合约部署脚本（自动生成前端配置）
│   └── serve.js              # 零依赖本地静态服务器
├── frontend/                 # 网站根目录（Gitee Pages 部署目录）
│   ├── index.html           # 首页（结构层）
│   ├── explorer.html        # 自制区块浏览器（链上模式）
│   ├── contractConfig.js    # 合约地址与 ABI（部署脚本自动生成）
│   ├── css/
│   │   └── style.css        # 样式表（表现层）
│   └── js/
│       └── app.js           # 业务逻辑（行为层：双模式自动切换）
├── hardhat.config.js
└── package.json
```

## 🚀 本地运行（链上模式）

前置要求：Node.js ≥ 16

```bash
# 1. 安装依赖
npm install

# 2. 编译合约
npx hardhat compile

# 3. 启动本地区块链节点（保持终端窗口开启）
npx hardhat node

# 4. 新开一个终端，部署合约
npx hardhat run scripts/deploy.js --network localhost

# 5. 启动前端服务器
node scripts/serve.js
```

浏览器打开 http://localhost:3000 ，点击「⚡ 快速模式」即可用 Hardhat 测试账户发布上链留言；也可安装 MetaMask 后连接本地网络（chainId `31337`，RPC `http://127.0.0.1:8545`）。

## ☁️ 静态部署（演示模式）

通过仓库内的 GitHub Actions 工作流（`.github/workflows/deploy-pages.yml`）自动部署：

1. 推送代码到 GitHub 仓库的 `master` 分支即自动触发构建；
2. 工作流把 `frontend` 目录发布到 GitHub Pages（仓库 Settings → Pages → Source 需设为 "GitHub Actions"）；
3. 部署成功后通过 `https://<用户名>.github.io/<仓库名>/` 访问，访客无需任何插件即可使用留言功能（数据保存在各自浏览器 localStorage 中）。

> ethers.js 已本地化存放于 `frontend/js/vendor/`，网站不依赖任何外部 CDN，离线/国内网络均可完整打开。
