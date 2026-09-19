/* ============================================================
   去中心化留言板 DApp · 前端主逻辑 app.js
   两种运行模式（页面打开时自动探测）：
     1. 链上模式 chain：本机运行着 Hardhat 节点（127.0.0.1:8545）
        时启用，留言真正写入智能合约，可连接 MetaMask 或用快速模式。
     2. 演示模式 demo：连不上本地区块链节点时自动启用（例如部署在
        Gitee Pages 上被老师/同学访问），留言保存在浏览器 localStorage，
        无需后端、无需插件，完整模拟留言板交互。
   ============================================================ */

const ethers = window.ethers || null; // ethers.js v6（本地引入）；加载失败时为 null，网站自动降级为纯演示模式
const CHAIN_ID = 31337n;   // Hardhat 本地网络
const RPC_URL = "http://127.0.0.1:8545";

// Hardhat 默认账户私钥（仅本地开发/演示用，Hardhat 文档公开的测试私钥，无资产价值）
const HARDHAT_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
];
// ethers 未加载时留空，链上功能整体禁用，不影响演示模式
const HARDHAT_ADDRS = ethers ? HARDHAT_KEYS.map(k => new ethers.Wallet(k).address) : [];

let provider, signer, contract, currentAccount, eip6963Provider;
let mode = null;       // "chain" 或 "demo"
let walletMode = null; // chain 模式下："metamask" 或 "quick"

// ============================================================
// 一、DOM 元素
// ============================================================
const els = {
  modeBanner: document.getElementById("modeBanner"),
  connectBtn: document.getElementById("connectBtn"),
  quickBtn: document.getElementById("quickBtn"),
  userSelect: document.getElementById("userSelect"),
  quickSwitcher: document.getElementById("quickSwitcher"),
  walletBox: document.getElementById("walletBox"),
  balanceRow: document.getElementById("balanceRow"),
  demoBox: document.getElementById("demoBox"),
  demoNick: document.getElementById("demoNick"),
  saveNickBtn: document.getElementById("saveNickBtn"),
  postBtn: document.getElementById("postBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  refreshBalanceBtn: document.getElementById("refreshBalanceBtn"),
  input: document.getElementById("messageInput"),
  messages: document.getElementById("messages"),
  countText: document.getElementById("countText"),
  accountText: document.getElementById("accountText"),
  balanceText: document.getElementById("balanceText"),
  balanceDelta: document.getElementById("balanceDelta"),
  netInfo: document.getElementById("netInfo"),
  netDot: document.getElementById("netDot"),
  status: document.getElementById("status"),
  txInfo: document.getElementById("txInfo"),
  txHashLink: document.getElementById("txHashLink"),
  txReceipt: document.getElementById("txReceipt"),
  explorerLink: document.getElementById("explorerLink"),
};

let lastBalanceWei = null; // 用于计算交易后余额变化量

// ============================================================
// 二、通用工具函数
// ============================================================
function setStatus(msg, type = "") {
  els.status.textContent = msg || "";
  els.status.className = type;
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function fmtTime(ts) {
  // ts 为秒级时间戳
  return new Date(Number(ts) * 1000).toLocaleString("zh-CN", { hour12: false });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function randomHex(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

// 统一的留言列表渲染：两种模式共用
// msg 结构：{ author, content, timestamp(秒), tag: "链上"|"本地" , isSelf }
function renderMessages(list) {
  els.countText.textContent = list.length ? `(${list.length})` : "";
  if (list.length === 0) {
    els.messages.innerHTML = '<li class="empty">暂无留言，发布第一条吧～</li>';
    return;
  }
  const html = list.map((m) => {
    const badge = m.isSelf
      ? '<span class="badge">我</span>'
      : (m.tag === "本地" ? '<span class="badge-demo">本地</span>' : "");
    return `
      <li class="msg-item">
        <div class="top">
          <span class="author">${escapeHtml(m.author)}</span>
          <span>${fmtTime(m.timestamp)} ${badge}</span>
        </div>
        <div class="content">${escapeHtml(m.content)}</div>
      </li>`;
  }).join("");
  els.messages.innerHTML = html;
}

// ============================================================
// 三、演示模式数据层（localStorage，无后端）
// ============================================================
const DemoStore = {
  MSG_KEY: "mb_demo_messages_v1",
  NICK_KEY: "mb_demo_nickname",

  loadMessages() {
    try { return JSON.parse(localStorage.getItem(this.MSG_KEY)) || []; }
    catch (e) { return []; }
  },
  saveMessages(list) {
    localStorage.setItem(this.MSG_KEY, JSON.stringify(list));
  },
  addMessage(content, author) {
    const list = this.loadMessages();
    const msg = {
      id: Date.now() + "_" + randomHex(4),
      author,
      content,
      timestamp: Math.floor(Date.now() / 1000),
      pseudoHash: "0x" + randomHex(64),   // 模拟交易哈希
      pseudoBlock: list.length + 1,       // 模拟区块高度
    };
    list.push(msg);
    this.saveMessages(list);
    return msg;
  },
  getNickname() {
    return localStorage.getItem(this.NICK_KEY) || ("游客-" + randomHex(4));
  },
  setNickname(nick) {
    localStorage.setItem(this.NICK_KEY, nick);
  }
};

// ============================================================
// 四、链上模式 —— MetaMask 多钱包探测（EIP-6963）
// ============================================================
const mmProviders = [];
function findMetaMaskProvider() {
  if (mmProviders.length > 0) return mmProviders[0].provider;
  let p = window.ethereum;
  if (p && p.providerMap) {
    for (const prov of p.providerMap.values()) {
      if (prov.isMetaMask) return prov;
    }
  }
  if (p && p.isMetaMask) return p;
  if (p && p.providers) {
    const mm = p.providers.find(q => q.isMetaMask);
    if (mm) return mm;
  }
  return p;
}
window.addEventListener("eip6963:announceProvider", (ev) => {
  const info = ev.detail || {};
  if (info.info && info.info.rdns && info.info.rdns.includes("metamask")) {
    mmProviders.push(info);
  }
});
try { window.dispatchEvent(new Event("eip6963:requestProvider")); } catch (e) {}

function getContract() {
  const cfg = window.CONTRACT_CONFIG;
  if (!cfg || !cfg.address || cfg.address === "") {
    throw new Error("未找到合约地址，请先运行部署脚本：npm run deploy");
  }
  return new ethers.Contract(cfg.address, cfg.abi, provider);
}

async function refreshBalance(showDelta = false) {
  if (!provider || !currentAccount) {
    els.balanceText.textContent = "—";
    els.balanceDelta.textContent = "";
    return;
  }
  try {
    const balWei = await provider.getBalance(currentAccount);
    const balEth = ethers.formatEther(balWei);
    els.balanceText.textContent = Number(balEth).toFixed(6) + " ETH";
    if (showDelta && lastBalanceWei != null) {
      const diffWei = balWei - lastBalanceWei; // 一般为负（扣 gas）
      const diffEth = ethers.formatEther(diffWei);
      const sign = diffWei < 0 ? "-" : "+";
      els.balanceDelta.textContent = `（交易后变化：${sign}${Math.abs(Number(diffEth)).toFixed(8)} ETH = ${Math.abs(Number(diffEth) * 1e18).toFixed(0)} wei，即 Gas 费扣除）`;
      els.balanceDelta.style.color = diffWei < 0 ? "#e25555" : "#2ecc71";
    } else {
      els.balanceDelta.textContent = "";
    }
    lastBalanceWei = balWei;
  } catch (e) {
    els.balanceText.textContent = "读取失败";
  }
}

async function updateNetworkUI() {
  try {
    const net = await provider.getNetwork();
    const ok = net.chainId === CHAIN_ID;
    els.netDot.className = "status-dot " + (ok ? "dot-on" : "dot-off");
    els.netInfo.textContent = ok
      ? `已连接本地网络 (chainId: ${net.chainId})`
      : `网络不匹配，请在 MetaMask 切换到本地网络 (chainId: ${CHAIN_ID})`;
    return ok;
  } catch (e) {
    els.netInfo.textContent = "网络获取失败";
    return false;
  }
}

// 连接 MetaMask
async function connectMetaMask() {
  const mm = findMetaMaskProvider();
  if (!mm) {
    setStatus("未检测到 MetaMask，请先安装 MetaMask 插件，或使用快速模式", "error");
    return;
  }
  try {
    eip6963Provider = mm;
    provider = new ethers.BrowserProvider(mm);
    const accounts = await provider.send("eth_requestAccounts", []);
    currentAccount = accounts[0];
    signer = await provider.getSigner();

    await updateNetworkUI();
    contract = getContract().connect(signer);

    els.accountText.textContent = currentAccount + " (" + shortAddr(currentAccount) + ")";
    els.postBtn.disabled = false;
    els.connectBtn.textContent = "已连接";
    els.connectBtn.disabled = true;
    els.quickBtn.disabled = true;
    attachWalletHooks(mm);

    setStatus("钱包已连接", "ok");
    await refreshBalance(false);
    await loadChainMessages();
  } catch (e) {
    console.error(e);
    setStatus("连接失败：" + (e.message || e), "error");
  }
}

// 快速模式（无需 MetaMask）：直接用 Hardhat 测试私钥签名
async function connectQuick() {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    const net = await provider.getNetwork();
    const ok = net.chainId === CHAIN_ID;
    els.netDot.className = "status-dot " + (ok ? "dot-on" : "dot-off");
    els.netInfo.textContent = ok
      ? `已连接 Hardhat 本地节点 (chainId: ${net.chainId})`
      : `网络不匹配，请确认 Hardhat 节点运行在 ${RPC_URL} (chainId: ${CHAIN_ID})`;
    if (!ok) { setStatus("无法连接本地节点，请先启动 npx hardhat node", "error"); return; }

    await applyQuickUser(0);
    walletMode = "quick";
    els.quickSwitcher.style.display = "flex";
    els.connectBtn.disabled = true;
    els.connectBtn.textContent = "已使用快速模式";
    els.quickBtn.disabled = true;
    els.quickBtn.textContent = "快速模式已连接";
    setStatus("快速模式已连接（直接连本地 Hardhat 节点，无需 MetaMask）", "ok");
    await loadChainMessages();
  } catch (e) {
    console.error(e);
    setStatus("快速模式连接失败：" + (e.message || e), "error");
  }
}

async function applyQuickUser(idx) {
  const key = HARDHAT_KEYS[idx];
  if (!key) return;
  signer = new ethers.Wallet(key, provider);
  currentAccount = signer.address;
  contract = getContract().connect(signer);
  els.postBtn.disabled = false;
  els.accountText.textContent = currentAccount + " (" + shortAddr(currentAccount) + ")";
  await refreshBalance(false);
}

// 链上发布留言
async function postChainMessage() {
  const content = els.input.value.trim();
  if (!content) { setStatus("留言内容不能为空", "error"); return; }
  if (!contract) { setStatus("请先连接钱包或使用快速模式", "error"); return; }

  els.postBtn.disabled = true;
  setStatus("交易提交中，等待区块确认...");
  try { if (provider && currentAccount) lastBalanceWei = await provider.getBalance(currentAccount); } catch (e) {}
  try {
    const tx = await contract.postMessage(content);
    const receipt = await tx.wait();
    els.input.value = "";

    els.txInfo.style.display = "block";
    els.txHashLink.href = `./explorer.html?tx=${tx.hash}`;
    els.txHashLink.textContent = tx.hash;
    els.txReceipt.textContent = `区块 #${receipt.blockNumber} · gas 消耗 ${receipt.gasUsed.toString()} · 状态成功(${receipt.status === 1 ? "✓" : "✗"}) · 合约事件 ${receipt.logs?.length || 0} 条（点上方哈希跳转区块浏览器）`;

    setStatus("留言已上链 ✓ 区块 #" + receipt.blockNumber, "ok");
    await loadChainMessages();
    await refreshBalance(true);
  } catch (e) {
    console.error(e);
    setStatus("发布失败：" + (e.reason || e.message || e), "error");
  } finally {
    els.postBtn.disabled = false;
  }
}

// 从合约读取留言
async function loadChainMessages() {
  if (!contract) return;
  try {
    const all = await contract.getAllMessages();
    const list = all.map((m) => ({
      author: m.author,
      content: m.content,
      timestamp: m.timestamp,
      tag: "链上",
      isSelf: currentAccount && m.author.toLowerCase() === currentAccount.toLowerCase(),
    }));
    renderMessages(list);
  } catch (e) {
    console.error(e);
    const msg = (e && (e.message || e.reason || e.toString() || "")) + "";
    if (msg.includes("BAD_DATA") || msg.includes('value="0x"') || msg.includes("could not decode result data")) {
      els.messages.innerHTML = '<li class="empty" style="color:#a32525;">⚠️ 检测到合约地址上没有代码（本地节点可能重启过），请重新执行：<b>npx hardhat run scripts/deploy.js --network localhost</b>，然后刷新页面。</li>';
      setStatus("合约未部署或节点已重置", "error");
    } else {
      setStatus("加载留言失败：" + (e.reason || e.message || e), "error");
    }
  }
}

// 监听 MetaMask 账户/网络切换
function attachWalletHooks(wp) {
  if (!wp) return;
  wp.on("accountsChanged", async (accounts) => {
    if (accounts.length === 0) { location.reload(); return; }
    currentAccount = accounts[0];
    signer = await (new ethers.BrowserProvider(wp)).getSigner();
    contract = getContract().connect(signer);
    els.accountText.textContent = currentAccount + " (" + shortAddr(currentAccount) + ")";
    setStatus("已切换账户：" + shortAddr(currentAccount), "ok");
    await loadChainMessages();
  });
  wp.on("chainChanged", () => location.reload());
}

// ============================================================
// 五、演示模式交互
// ============================================================
let demoNick = "";

function enterDemoMode() {
  mode = "demo";
  demoNick = DemoStore.getNickname();
  els.demoNick.value = demoNick;

  // 横幅
  els.modeBanner.className = "mode-banner demo";
  els.modeBanner.innerHTML = "💾 <b>本地演示模式</b>：未检测到本机区块链节点，留言保存在你的浏览器（localStorage）中，无需后端即可体验完整功能。<br>在本机运行 <code>npx hardhat node</code> 后刷新页面，可切换到真正的链上模式。";
  els.modeBanner.style.display = "block";

  // 网络状态
  els.netDot.className = "status-dot dot-demo";
  els.netInfo.textContent = "演示模式（未连接区块链）";
  els.accountText.textContent = demoNick;

  // 隐藏钱包相关 UI，显示昵称设置
  els.connectBtn.style.display = "none";
  els.quickBtn.style.display = "none";
  els.balanceRow.style.display = "none";
  if (els.explorerLink) els.explorerLink.style.display = "none";
  els.demoBox.style.display = "block";

  els.postBtn.disabled = false;
  els.postBtn.textContent = "发布留言";
  setStatus("演示模式已就绪，可直接发布留言", "ok");
  loadDemoMessages();
}

function loadDemoMessages() {
  const list = DemoStore.loadMessages().map(m => ({
    author: m.author,
    content: m.content,
    timestamp: m.timestamp,
    tag: "本地",
    isSelf: m.author === demoNick,
  }));
  renderMessages(list);
}

function demoPost() {
  const content = els.input.value.trim();
  if (!content) { setStatus("留言内容不能为空", "error"); return; }
  const msg = DemoStore.addMessage(content, demoNick);
  els.input.value = "";

  els.txInfo.style.display = "block";
  els.txHashLink.href = "javascript:void(0)";
  els.txHashLink.textContent = msg.pseudoHash;
  els.txReceipt.textContent = `演示模式 · 模拟区块 #${msg.pseudoBlock} · 数据已保存到浏览器 localStorage（未真正上链）`;

  setStatus("留言发布成功 ✓（已保存到本地浏览器）", "ok");
  loadDemoMessages();
}

// ============================================================
// 六、事件绑定
// ============================================================
els.connectBtn.addEventListener("click", connectMetaMask);
els.quickBtn.addEventListener("click", connectQuick);
els.postBtn.addEventListener("click", () => {
  if (mode === "demo") demoPost();
  else postChainMessage();
});
els.refreshBtn.addEventListener("click", () => {
  if (mode === "demo") loadDemoMessages();
  else loadChainMessages();
});
els.input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    if (mode === "demo") demoPost();
    else postChainMessage();
  }
});
if (els.refreshBalanceBtn) {
  els.refreshBalanceBtn.addEventListener("click", () => refreshBalance(false));
}
if (els.userSelect) {
  els.userSelect.addEventListener("change", async () => {
    await applyQuickUser(parseInt(els.userSelect.value, 10));
    setStatus("已切换模拟用户：" + shortAddr(currentAccount), "ok");
    await loadChainMessages();
  });
}
if (els.saveNickBtn) {
  els.saveNickBtn.addEventListener("click", () => {
    const nick = els.demoNick.value.trim();
    if (!nick) { setStatus("昵称不能为空", "error"); return; }
    demoNick = nick;
    DemoStore.setNickname(nick);
    els.accountText.textContent = nick;
    setStatus("昵称已更新：" + nick, "ok");
    loadDemoMessages();
  });
}
if (window.ethereum) attachWalletHooks(window.ethereum);

// ============================================================
// 七、启动：探测本地区块链节点，决定运行模式
// ============================================================
async function detectLocalChain(timeoutMs = 2500) {
  // 通过 JSON-RPC eth_chainId 探测 Hardhat 节点是否在线
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const data = await resp.json();
    return data.result === "0x7a69"; // 31337 的十六进制
  } catch (e) {
    clearTimeout(timer);
    return false; // 节点未启动 / HTTPS 页面无法访问 HTTP 本地地址
  }
}

(async function boot() {
  // ethers 库未加载（如离线/资源被拦截）：直接进入演示模式，保证网站基本可用
  if (!ethers) {
    enterDemoMode();
    return;
  }
  const chainOnline = await detectLocalChain();
  if (!chainOnline) {
    enterDemoMode();
    return;
  }

  // 链上模式：展示横幅 + 只读预加载留言（无需连接钱包即可查看）
  mode = "chain";
  els.modeBanner.className = "mode-banner chain";
  els.modeBanner.innerHTML = "🔗 <b>区块链模式</b>：已连接本机 Hardhat 节点（chainId 31337），留言将写入智能合约，真正上链、不可篡改。连接 MetaMask 或使用快速模式后即可发布。";
  els.modeBanner.style.display = "block";

  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    contract = getContract();
    await loadChainMessages();
  } catch (e) {
    console.warn("只读预加载失败：", e);
  }
})();
