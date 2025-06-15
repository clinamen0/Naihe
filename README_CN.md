[English](README.md) | [中文](README_CN.md) | [Русский](README_RU.md) | [فارسی](README_FA.md)

# NaiHe

*愿我们在有光的地方相见。*

NaiHe 是一个轻量级端到端加密通讯工具，旨在帮助审查严重地区的普通人规避监控、自由沟通。

这不仅仅是一个加密聊天工具。它是为那些无法自由说话的人而生的——他们的消息被监控，他们的账号被封禁，他们的声音被消灭。NaiHe 让他们能够无所畏惧地对话。

无需账号。无需手机号。无需中心化服务器。只需一个口令和一个共享密钥。

---

## 下载

**[下载最新版本](https://github.com/anynoe12451242/Naihe/releases/latest)**

- `naihe.exe` — 免安装便携版（双击即用）
- `NaiHe_1.0.0_x64-setup.exe` — NSIS 安装包
- `NaiHe_1.0.0_x64_en-US.msi` — MSI 安装包

默认口令：`technology is innocent`

---

## 许可证

**The Unlicense** — 本软件发布至**公共领域**。你可以自由复制、修改、分发和使用，用于任何目的（包括商业用途），没有任何限制。无需署名。

完整文本见 [UNLICENSE](UNLICENSE)。

---

## 接力包声明

本项目由匿名作者一次性发布，后续将不再维护。

**欢迎社区：**
- Fork 本仓库并继续开发
- 审计加密实现
- 添加新功能、修复 Bug、改进界面
- 翻译为更多语言
- 以任何条款重新分发

如果本仓库消失，任何 fork 过的人都可以接棒。**这是设计之初的意图。**

---

## 默认口令

进入应用的默认口令为：

```
technology is innocent
```

可在 `src-tauri/src/config.rs` → `GATE_PASSPHRASE` 中修改。

---

## 功能说明

### 加密聊天室 (Secure Room)
通过你自己控制的 MQTT 服务器进行实时加密聊天。双方共享一个房间名和加密密钥；所有消息在发送方设备上加密，在接收方设备上解密。中转服务器只能看到密文。

### 密码板 (Cipher Pad)
剪贴板加密模式。监控剪贴板中的密文并自动解密；输入明文加密后自动复制到剪贴板。适用于在粘贴到任何其他应用之前先加密消息。

---

## 使用场景

- **记者** 在审查地区与信源沟通
- **活动人士** 在不依赖可被监控的中心化平台的情况下协调行动
- **普通人** 只是想要不被政府监控的私密对话
- **举报人** 安全地分享信息
- **任何人** 在端到端加密通讯应用被封禁或监控的地区

---

## 安全架构

| 组件 | 算法 |
|------|------|
| 加密 | ChaCha20-Poly1305 (IETF AEAD) |
| 密钥推导 | Argon2id (64 MB, 3 轮, 4 并行) |
| 频道哈希 | SHA-256 (前 8 位十六进制) |
| 本地历史 | ChaCha20-Poly1305 加密存储 |

### 工作原理

1. 你和对方约定一个**加密密钥**（任意字符串）。
2. 每条消息在你的设备上使用 ChaCha20-Poly1305 加密，密钥通过 Argon2id 从你的密码短语推导而来。
3. 每条消息都会生成全新的随机 salt（16 字节）和 nonce（12 字节）。
4. 加密后的数据通过 MQTT 服务器发送。**服务器永远看不到明文。**
5. 对方设备接收密文并使用相同密钥在本地解密。

**所有加密和解密都在你的设备上进行。服务器上没有任何东西被解密。服务器只是一个哑的中转。**

### 传输格式

```
Base64( version[1] | salt[16] | nonce[12] | ciphertext | poly1305_tag[16] )
```

---

## 安全边界与非目标

### NaiHe 能防护的：
- 服务器端消息窥探（所有流量已加密）
- 被动网络监控（线路上只有密文）
- 消息篡改（Poly1305 认证标签）
- 暴力破解密钥（Argon2id 64 MB 内存开销）

### NaiHe 不能防护的：
- **终端被入侵** — 如果你的设备有恶意软件/键盘记录器，任何加密都无济于事
- **流量分析** — 观察者可以看到你*连接了* MQTT 服务器，即使他们无法读取你*发送了什么*
- **密钥交换** — NaiHe 不解决密钥交换问题。你必须通过另一个安全渠道分享加密密钥
- **元数据** — 连接时间戳、IP 地址和消息大小对 MQTT 服务器运营者可见
- **屏幕截取 / 窥屏** — 如果有人能看到你的屏幕，加密毫无意义
- **法律强制** — 如果你被法律强制要求交出密钥，消息可以被解密

### 潜在风险

> **警告：** 在某些司法管辖区，使用加密软件本身可能会引起关注。在使用此工具之前，请了解你所在地区的法律和个人风险。

- 在某些国家，使用或持有加密工具是违法的
- 连接到不常见的 MQTT 服务器可能触发网络监控警报
- 本软件**未经专业安全审计** — 使用风险自负
- 作者是匿名的，不会提供支持或更新

---

## 构建

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri CLI](https://tauri.app/start/)

### 开发模式

```bash
npm install
npm run tauri dev
```

### 生产构建

```bash
npm run tauri build
```

输出目录：`src-tauri/target/release/bundle/`

---

## 使用方法

1. 启动 `naihe.exe`
2. 输入口令（默认：`technology is innocent`）
3. 使用顶栏 **EN / 中 / RU / فا** 按钮切换语言
4. 选择 **Secure Room** 或 **Cipher Pad**

### 加密聊天室
- 输入你的 MQTT 服务器地址（必填 — 无默认服务器）
- 输入房间名和加密密钥（两者都需要分享给对方）
- 开始聊天 — 所有消息端到端加密

### 密码板
- 输入加密密钥
- **自动模式**：监控剪贴板，自动解密复制的密文
- **手动模式**：粘贴密文解密，或输入明文加密
- 加密结果自动复制到剪贴板

---

## 自定义指南

### 修改入口口令

编辑 `src-tauri/src/config.rs`：

```rust
pub const GATE_PASSPHRASE: &str = "你的自定义口令";
pub const GATE_SALT: &[u8; 16] = b"your-16byte-salt";  // 必须恰好 16 字节
```

### 修改加密参数

```rust
pub const ARGON2_MEMORY_KB: u32 = 65536;   // 内存开销 (KB)
pub const ARGON2_ITERATIONS: u32 = 3;       // 时间开销
pub const ARGON2_PARALLELISM: u32 = 4;      // 并行通道数
```

值越高 = 越慢但越安全。值越低 = 越快但越弱。

### 重写加密逻辑

如果你想使用不同的密码算法，替换 `src-tauri/src/cipher.rs` 的内容。该模块对外暴露以下函数接口，其余代码都依赖这些接口：

```rust
pub fn check_gate(input: &str) -> bool;                                    // 验证入口口令
pub fn seal(plaintext: &str, passphrase: &str) -> Result<String, String>;  // 加密文本
pub fn unseal(encoded: &str, passphrase: &str) -> Result<String, String>;  // 解密文本
pub fn seal_bytes(data: &[u8], passphrase: &str) -> Result<Vec<u8>, String>;   // 加密字节
pub fn unseal_bytes(raw: &[u8], passphrase: &str) -> Result<Vec<u8>, String>;  // 解密字节
pub fn resembles_cipher(text: &str) -> bool;    // 判断是否像密文
pub fn room_topic(room: &str) -> String;         // 房间名转 MQTT 主题
```

只要你用相同的函数签名实现这 7 个函数，就可以换入 AES-GCM、XSalsa20 或任何其他 AEAD 算法，而无需修改代码库的其余部分。

### 为什么你应该重写加密逻辑——并加入反编译保护

**我们强烈建议每个部署都重写 `cipher.rs` 中的加密方案**，并对编译后的二进制文件添加反逆向工程措施（混淆、反调试、完整性校验）。

#### 防御层如何协同工作

即使攻击者获得了加密密钥（例如通过胁迫或泄露），他们仍然无法解密截获的消息——**除非他们同时逆向工程了二进制文件，提取出你这个特定构建版本所使用的确切算法和参数**。如果攻击者既无法获取密语进入程序，又无法反编译出加密逻辑，那么他们手里的密钥毫无用处——有钥匙，但不知道锁长什么样。

```
密语门禁      →  保护对运行中程序的访问
自定义加密    →  仅你的构建版本知晓的算法
反逆向措施    →  提高从二进制中提取算法的成本
             =  仅凭泄露的密钥不足以解密
```

#### 诚实的说明

你应当假设：**任何交到对手手里的客户端程序，最终都可以被理解、被修改、被绕过**——区别只在于所需的时间、技术水平和资源投入。反编译保护并不是让这件事变得不可能，而是：

- **提高分析门槛** — 使随手一查变得远远不够
- **延长所需时间** — 为用户争取轮换密钥或迁移的时间窗口
- **增加规模化利用的成本** — 破解一个自定义构建不等于破解所有构建

它的价值不在于建造一堵不可攻破的墙，而在于让这堵墙足够昂贵，使得对每一个独特部署逐个击破在规模上变得不现实。

#### 实践建议

- 用你自己的算法、密钥推导和传输格式重写 `cipher.rs`
- 添加二进制混淆（字符串加密、控制流平坦化等）
- 强化 `shield.rs` 中的反调试手段
- 更改入口密语和盐值
- **不要公开你修改后的源代码**

每一个使用不同加密方案的 fork 都是一把不同的锁。没有万能钥匙能同时打开它们——这正是设计的意图。

### 添加语言

1. 复制 `ui/i18n/en.js` 为新文件（如 `ui/i18n/fr.js`）
2. 翻译所有字符串值
3. 在 `ui/i18n/index.js` 中导入并注册：
   ```js
   import fr from "./fr.js";
   // 添加到 LANGUAGES:
   fr: { label: "FR", name: "Francais", strings: fr },
   ```
4. 完成 — 新语言自动出现在界面中

---

## 自建 MQTT 服务器

任何标准 MQTT 服务器均可：

```bash
# EMQX（推荐）
docker run -d --name emqx -p 1883:1883 emqx/emqx

# Mosquitto
docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto
```

如需离线消息功能，在同一主机的 3777 端口部署配套 HTTP 服务。

---

## 项目结构

```
NaiHe/
├── ui/                         # 前端 (React)
│   ├── i18n/                   # 语言包（可扩展）
│   │   ├── index.js            # i18n 引擎
│   │   ├── en.js               # 英文
│   │   └── zh.js               # 中文
│   ├── views/                  # 视图组件
│   │   ├── Gateway.jsx         # 口令入口
│   │   ├── Dashboard.jsx       # 模式选择
│   │   ├── SecureChat.jsx      # 聊天设置 + 实时聊天
│   │   └── CipherPad.jsx       # 剪贴板加密
│   ├── components/TopBar.jsx   # 标题栏 + 主题/语言切换
│   ├── theme/base.css          # 商务主题（浅色 + 深色）
│   └── NaiHe.jsx               # 应用根组件
├── src-tauri/src/              # 后端 (Rust)
│   ├── config.rs               # 所有可配置预设
│   ├── cipher.rs               # ChaCha20-Poly1305 + Argon2id
│   ├── transport.rs            # MQTT 通讯
│   ├── shield.rs               # 运行时完整性校验
│   ├── app.rs                  # Tauri IPC 命令
│   └── lib.rs / main.rs        # 入口点
├── README.md                   # 英文文档
└── README_CN.md                # 中文文档
```

---

## 结语

这个软件是一个工具。和所有工具一样，它可以被用于善或恶。它的诞生基于这样一个信念：**私密通讯的权利是一项基本人权**，而技术本身是无罪的。

如果你觉得它有用，fork 它。改进它。分享它。让它活下去。

*技术无罪。*
