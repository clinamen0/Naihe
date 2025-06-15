[English](README.md) | [中文](README_CN.md) | [Русский](README_RU.md) | [فارسی](README_FA.md)

# NaiHe

*May we meet where there is light.*

NaiHe is a lightweight, end-to-end encrypted communication tool. It is designed to help ordinary people in heavily censored regions circumvent surveillance and communicate freely.

This is not just an encrypted messenger. It is a tool for people who cannot speak freely — whose messages are monitored, whose accounts are suspended, whose voices are silenced. NaiHe gives them a way to talk without fear.

No accounts. No phone numbers. No centralized servers. Just a passphrase and a shared key.

---

## Download

**[Download latest release](https://github.com/anynoe12451242/Naihe/releases/latest)**

- `naihe.exe` — Portable executable (no install needed, just run)
- `NaiHe_1.0.0_x64-setup.exe` — NSIS installer
- `NaiHe_1.0.0_x64_en-US.msi` — MSI installer

Default passphrase: `technology is innocent`

---

## License

**The Unlicense** — This software is released into the **public domain**. You can copy, modify, distribute, and use it for any purpose, commercial or non-commercial, without any restrictions whatsoever. No attribution required.

See [UNLICENSE](UNLICENSE) for the full text.

---

## Relay Handoff Package

This project is published anonymously as a one-time release. The author will not maintain it going forward.

**The community is encouraged to:**
- Fork this repository and continue development
- Audit the cryptographic implementation
- Add new features, fix bugs, improve UI
- Translate into more languages
- Redistribute under any terms you choose

If this repository disappears, anyone who has forked it can carry the torch. **That is by design.**

---

## Default Passphrase

The default passphrase to enter the application is:

```
technology is innocent
```

This can be changed in `src-tauri/src/config.rs` → `GATE_PASSPHRASE`.

---

## What It Does

### Secure Room
Real-time encrypted chat over any MQTT broker you control. Two people share a room name and encryption key; all messages are encrypted on the sender's device and decrypted on the receiver's device. The relay server sees only ciphertext.

### Cipher Pad
Clipboard-based encryption mode. Monitors your clipboard for ciphertext and auto-decrypts it; type plaintext to encrypt and auto-copy to clipboard. Useful for encrypting messages before pasting them into any other app.

---

## Use Cases

- **Journalists** communicating with sources in censored regions
- **Activists** coordinating without centralized platforms that can be monitored
- **Ordinary people** who simply want private conversations without government surveillance
- **Whistleblowers** sharing information securely
- **Anyone** in a region where end-to-end encrypted messaging apps are banned or monitored

---

## Security Architecture

| Component | Algorithm |
|-----------|-----------|
| Encryption | ChaCha20-Poly1305 (IETF AEAD) |
| Key Derivation | Argon2id (64 MB, 3 iterations, 4 lanes) |
| Topic Hashing | SHA-256 (first 8 hex chars) |
| Local History | ChaCha20-Poly1305 encrypted files |

### How It Works

1. You and your peer agree on an **encryption key** (any string).
2. Each message is encrypted on your device using ChaCha20-Poly1305 with a key derived from your passphrase via Argon2id.
3. A fresh random salt (16 bytes) and nonce (12 bytes) are generated for every single message.
4. The encrypted blob is sent through an MQTT broker. The broker **never sees plaintext**.
5. Your peer's device receives the blob and decrypts it locally using the same key.

**All encryption and decryption happens on your device. Nothing is decrypted on the server. The server is a dumb relay.**

### Wire Format

```
Base64( version[1] | salt[16] | nonce[12] | ciphertext | poly1305_tag[16] )
```

---

## Security Boundaries & Non-Goals

### What NaiHe protects against:
- Server-side message inspection (all traffic is encrypted)
- Passive network surveillance (ciphertext only on the wire)
- Message tampering (Poly1305 authentication tag)
- Brute-force key attacks (Argon2id with 64 MB memory cost)

### What NaiHe does NOT protect against:
- **Compromised endpoints** — If your device has malware/keyloggers, no encryption helps
- **Traffic analysis** — An observer can see *that* you connect to an MQTT server, even if they can't read *what* you send
- **Key exchange** — NaiHe does not solve the key exchange problem. You must share your encryption key through a separate secure channel
- **Metadata** — Connection timestamps, IP addresses, and message sizes are visible to the MQTT broker operator
- **Screen capture / shoulder surfing** — If someone can see your screen, encryption is irrelevant
- **Legal compulsion** — If you are legally compelled to reveal your key, the messages can be decrypted

### Potential Risks

> **WARNING:** Using encryption software may itself attract attention in some jurisdictions. Understand the legal and personal risks in your specific situation before using this tool.

- In some countries, using or possessing encryption tools is illegal
- Connecting to an unusual MQTT server may trigger network monitoring alerts
- This software has NOT been professionally audited — use at your own risk
- The author is anonymous and will not provide support or updates

---

## Build

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri CLI](https://tauri.app/start/)

### Development

```bash
npm install
npm run tauri dev
```

### Production Build

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/`

---

## Usage

1. Launch `naihe.exe`
2. Enter the passphrase (default: `technology is innocent`)
3. Switch language with the **EN/中** buttons in the top bar
4. Choose **Secure Room** or **Cipher Pad**

### Secure Room
- Enter your MQTT server address (required — no default server)
- Enter a room name and encryption key (share both with your peer)
- Start chatting — all messages are end-to-end encrypted

### Cipher Pad
- Enter an encryption key
- **Auto mode**: monitors clipboard, auto-decrypts copied ciphertext
- **Manual mode**: paste ciphertext to decrypt, or type plaintext to encrypt
- Encrypted output is auto-copied to clipboard

---

## Customization Guide

### Change the Gate Passphrase

Edit `src-tauri/src/config.rs`:

```rust
pub const GATE_PASSPHRASE: &str = "your custom passphrase";
pub const GATE_SALT: &[u8; 16] = b"your-16byte-salt";  // must be exactly 16 bytes
```

### Change Crypto Parameters

```rust
pub const ARGON2_MEMORY_KB: u32 = 65536;   // memory cost (KB)
pub const ARGON2_ITERATIONS: u32 = 3;       // time cost
pub const ARGON2_PARALLELISM: u32 = 4;      // parallel lanes
```

Higher values = slower but more secure. Lower values = faster but weaker.

### Change MQTT Namespace

```rust
pub const TOPIC_PREFIX: &str = "nh";        // MQTT topic prefix
pub const CLIENT_PREFIX: &str = "nh-";      // client ID prefix
```

### Disable Runtime Integrity Checks

```rust
pub const ENABLE_SHIELD: bool = false;      // disable for debugging
```

### Rewrite the Encryption Logic

If you want to use a different cipher, replace the contents of `src-tauri/src/cipher.rs`. The module exposes these functions that the rest of the app depends on:

```rust
pub fn check_gate(input: &str) -> bool;
pub fn seal(plaintext: &str, passphrase: &str) -> Result<String, String>;
pub fn unseal(encoded: &str, passphrase: &str) -> Result<String, String>;
pub fn seal_bytes(data: &[u8], passphrase: &str) -> Result<Vec<u8>, String>;
pub fn unseal_bytes(raw: &[u8], passphrase: &str) -> Result<Vec<u8>, String>;
pub fn resembles_cipher(text: &str) -> bool;
pub fn room_topic(room: &str) -> String;
```

As long as you implement these 7 functions with the same signatures, you can swap in AES-GCM, XSalsa20, or any other AEAD cipher without changing the rest of the codebase.

### Add a Language

1. Copy `ui/i18n/en.js` to a new file (e.g. `ui/i18n/fr.js`)
2. Translate all string values
3. In `ui/i18n/index.js`, import and register it:
   ```js
   import fr from "./fr.js";
   // add to LANGUAGES:
   fr: { label: "FR", name: "Francais", strings: fr },
   ```
4. Done — it appears in the UI automatically

---

## Self-Hosting MQTT

Any standard MQTT broker works:

```bash
# EMQX (recommended)
docker run -d --name emqx -p 1883:1883 emqx/emqx

# Mosquitto
docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto
```

For offline message support, deploy the companion HTTP service on port 3777 on the same host.

---

## Project Structure

```
NaiHe/
├── ui/                         # Frontend (React)
│   ├── i18n/                   # Language packs (extensible)
│   │   ├── index.js            # i18n engine
│   │   ├── en.js               # English
│   │   └── zh.js               # Chinese
│   ├── views/                  # Screen components
│   │   ├── Gateway.jsx         # Passphrase entry
│   │   ├── Dashboard.jsx       # Mode selection
│   │   ├── SecureChat.jsx      # Chat setup + live chat
│   │   └── CipherPad.jsx       # Clipboard encryption
│   ├── components/TopBar.jsx   # Title bar + theme/lang switch
│   ├── theme/base.css          # Business theme (light + dark)
│   └── NaiHe.jsx               # App root
├── src-tauri/src/              # Backend (Rust)
│   ├── config.rs               # All configurable presets
│   ├── cipher.rs               # ChaCha20-Poly1305 + Argon2id
│   ├── transport.rs            # MQTT communication
│   ├── shield.rs               # Runtime integrity checks
│   ├── app.rs                  # Tauri IPC commands
│   └── lib.rs / main.rs        # Entry points
├── README.md                   # English documentation
└── README_CN.md                # Chinese documentation
```

---

## Final Note

This software is a tool. Like all tools, it can be used for good or ill. It was built with the belief that **the right to private communication is a fundamental human right**, and that technology itself is innocent.

If you find this useful, fork it. Improve it. Share it. Keep it alive.

*Technology is innocent.*
