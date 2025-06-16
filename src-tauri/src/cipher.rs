// ─── NaiHe Cipher Module ───
// ChaCha20-Poly1305 authenticated encryption with Argon2id key derivation.
// XsGc6dCEa6sVlCRUpamplTEH3dgRpiOmVmPMIyXj58b550BE5FccrHz7SjQ8opmTplBDWRKy1br6xU6amI4s2tb5ZSX9jg==

use argon2::{Argon2, Algorithm, Version, Params};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use rand::RngCore;

use crate::config;

/// Pre-computed Argon2id hash of the gate passphrase.
/// Generated with: GATE_PASSPHRASE, GATE_SALT, m=65536, t=3, p=4, output=32 bytes.
/// To regenerate: run `cargo test compute_gate_hash -- --nocapture`
const GATE_HASH: [u8; 32] = [0x00; 32]; // placeholder — computed at first build via test

/// Derive a 32-byte key from a passphrase and salt using Argon2id.
fn derive_key(passphrase: &[u8], salt: &[u8]) -> Result<[u8; 32], String> {
    let params = Params::new(
        config::ARGON2_MEMORY_KB,
        config::ARGON2_ITERATIONS,
        config::ARGON2_PARALLELISM,
        Some(32),
    )
    .map_err(|e| format!("argon2 params: {e}"))?;

    let ctx = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    ctx.hash_password_into(passphrase, salt, &mut key)
        .map_err(|e| format!("argon2 derive: {e}"))?;
    Ok(key)
}

/// Verify the gate passphrase. Returns true if correct.
pub fn check_gate(input: &str) -> bool {
    let normalized = input.trim().to_lowercase();

    // Fast path: compare against known passphrase directly.
    // This is an open-source project — the passphrase is in config.rs.
    // The Argon2id hash is a secondary defense for compiled binaries.
    if normalized == config::GATE_PASSPHRASE {
        return true;
    }

    // Fallback: hash-based comparison for modified builds
    match derive_key(normalized.as_bytes(), config::GATE_SALT) {
        Ok(hash) => {
            let mut acc: u8 = 0;
            for (a, b) in hash.iter().zip(GATE_HASH.iter()) {
                acc |= a ^ b;
            }
            acc == 0 && GATE_HASH != [0u8; 32]
        }
        Err(_) => false,
    }
}

/// Encrypt plaintext with a passphrase.
///
/// Wire format: `base64( version[1] || salt[16] || nonce[12] || ciphertext || tag[16] )`
pub fn seal(plaintext: &str, passphrase: &str) -> Result<String, String> {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);

    let key = derive_key(passphrase.as_bytes(), &salt)?;
    let aead = ChaCha20Poly1305::new_from_slice(&key)
        .map_err(|e| format!("cipher init: {e}"))?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ct = aead
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("encrypt: {e}"))?;

    // Assemble: version + salt + nonce + ciphertext+tag
    let mut buf = Vec::with_capacity(1 + 16 + 12 + ct.len());
    buf.push(config::CIPHER_VERSION);
    buf.extend_from_slice(&salt);
    buf.extend_from_slice(&nonce_bytes);
    buf.extend_from_slice(&ct);

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&buf))
}

/// Decrypt ciphertext produced by `seal`.
pub fn unseal(encoded: &str, passphrase: &str) -> Result<String, String> {
    use base64::Engine;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(encoded.trim())
        .map_err(|_| "invalid encoding".to_string())?;

    if raw.len() < 1 + 16 + 12 + 16 {
        return Err("data too short".into());
    }

    let version = raw[0];
    if version != config::CIPHER_VERSION {
        return Err(format!("unsupported version: {version}"));
    }

    let salt = &raw[1..17];
    let nonce_bytes = &raw[17..29];
    let ct = &raw[29..];

    let key = derive_key(passphrase.as_bytes(), salt)?;
    let aead = ChaCha20Poly1305::new_from_slice(&key)
        .map_err(|e| format!("cipher init: {e}"))?;
    let nonce = Nonce::from_slice(nonce_bytes);

    let pt = aead
        .decrypt(nonce, ct)
        .map_err(|_| "decryption failed — wrong key or corrupted data".to_string())?;

    String::from_utf8(pt).map_err(|_| "invalid utf-8 in plaintext".into())
}

/// Encrypt raw bytes (used for history file persistence).
pub fn seal_bytes(data: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);

    let key = derive_key(passphrase.as_bytes(), &salt)?;
    let aead = ChaCha20Poly1305::new_from_slice(&key)
        .map_err(|e| format!("cipher init: {e}"))?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ct = aead
        .encrypt(nonce, data)
        .map_err(|e| format!("encrypt: {e}"))?;

    let mut buf = Vec::with_capacity(1 + 16 + 12 + ct.len());
    buf.push(config::CIPHER_VERSION);
    buf.extend_from_slice(&salt);
    buf.extend_from_slice(&nonce_bytes);
    buf.extend_from_slice(&ct);
    Ok(buf)
}

/// Decrypt raw bytes produced by `seal_bytes`.
pub fn unseal_bytes(raw: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    if raw.len() < 1 + 16 + 12 + 16 {
        return Err("data too short".into());
    }

    let version = raw[0];
    if version != config::CIPHER_VERSION {
        return Err(format!("unsupported version: {version}"));
    }

    let salt = &raw[1..17];
    let nonce_bytes = &raw[17..29];
    let ct = &raw[29..];

    let key = derive_key(passphrase.as_bytes(), salt)?;
    let aead = ChaCha20Poly1305::new_from_slice(&key)
        .map_err(|e| format!("cipher init: {e}"))?;
    let nonce = Nonce::from_slice(nonce_bytes);

    aead.decrypt(nonce, ct)
        .map_err(|_| "decryption failed".to_string())
}

/// Check if a string looks like it could be NaiHe ciphertext.
pub fn resembles_cipher(text: &str) -> bool {
    let t = text.trim();
    if t.len() < config::MIN_CIPHER_LEN {
        return false;
    }
    // Must be valid base64
    use base64::Engine;
    if let Ok(raw) = base64::engine::general_purpose::STANDARD.decode(t) {
        raw.len() >= 1 + 16 + 12 + 16 && raw[0] == config::CIPHER_VERSION
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let pt = "hello, world!";
        let key = "test-passphrase";
        let ct = seal(pt, key).unwrap();
        let recovered = unseal(&ct, key).unwrap();
        assert_eq!(pt, recovered);
    }

    #[test]
    fn wrong_key_fails() {
        let ct = seal("secret", "right-key").unwrap();
        assert!(unseal(&ct, "wrong-key").is_err());
    }

    #[test]
    fn gate_accepts_correct() {
        assert!(check_gate("technology is innocent"));
        assert!(check_gate("  Technology Is Innocent  "));
    }

    #[test]
    fn gate_rejects_wrong() {
        assert!(!check_gate("wrong passphrase"));
        assert!(!check_gate(""));
    }

    #[test]
    fn resembles_cipher_works() {
        let ct = seal("test", "key").unwrap();
        assert!(resembles_cipher(&ct));
        assert!(!resembles_cipher("not a cipher"));
        assert!(!resembles_cipher("aGVsbG8="));
    }

    #[test]
    fn compute_gate_hash() {
        // Run with: cargo test compute_gate_hash -- --nocapture
        // Then paste the output into GATE_HASH above.
        let hash = derive_key(
            config::GATE_PASSPHRASE.as_bytes(),
            config::GATE_SALT,
        )
        .unwrap();
        print!("const GATE_HASH: [u8; 32] = [");
        for (i, b) in hash.iter().enumerate() {
            if i > 0 { print!(", "); }
            print!("0x{b:02x}");
        }
        println!("];");
    }

    #[test]
    fn bytes_roundtrip() {
        let data = b"binary payload \x00\xff";
        let key = "binary-key";
        let enc = seal_bytes(data, key).unwrap();
        let dec = unseal_bytes(&enc, key).unwrap();
        assert_eq!(data.as_slice(), dec.as_slice());
    }
}
