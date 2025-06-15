// ─── NaiHe Configurable Presets ───
// Developers: modify these constants to customize your build.
// All settings below can be changed without touching other modules.

/// The passphrase required to unlock the application.
/// Users must type this exactly (case-insensitive, trimmed) to enter.
/// Change this to any string you want for your own deployment.
pub const GATE_PASSPHRASE: &str = "technology is innocent";

/// Salt used for hashing the gate passphrase with Argon2id.
/// Must be exactly 16 bytes. Change this if you change GATE_PASSPHRASE.
pub const GATE_SALT: &[u8; 16] = b"nh:gate:verify!0";

/// Argon2id parameters for gate verification.
/// Higher values = slower but more secure.
pub const ARGON2_MEMORY_KB: u32 = 65536; // 64 MB
pub const ARGON2_ITERATIONS: u32 = 3;
pub const ARGON2_PARALLELISM: u32 = 4;

/// Topic prefix for MQTT channels.
/// Messages are published to "{TOPIC_PREFIX}/{room_hash}".
pub const TOPIC_PREFIX: &str = "nh";

/// Client ID prefix for MQTT connections.
pub const CLIENT_PREFIX: &str = "nh-";

/// File extension for encrypted local history files.
pub const HISTORY_EXT: &str = "naihe";

/// Ciphertext version byte. Bump this if you change the wire format.
pub const CIPHER_VERSION: u8 = 0x01;

/// Minimum Base64-encoded ciphertext length to trigger auto-detection.
/// Format overhead: version(1) + salt(16) + nonce(12) + tag(16) = 45 bytes
/// Base64 of 45 bytes ≈ 60 chars, plus at least 1 byte of actual content.
pub const MIN_CIPHER_LEN: usize = 62;

/// MQTT keep-alive interval in seconds.
pub const MQTT_KEEPALIVE_SECS: u64 = 30;

/// Default MQTT port when not specified by user.
pub const MQTT_DEFAULT_PORT: u16 = 1883;

/// Offline message service port offset from MQTT port.
/// The HTTP service runs on the same host at this port.
pub const OFFLINE_SERVICE_PORT: u16 = 3777;

/// Whether to enable runtime integrity checks.
/// Set to false during development/debugging.
pub const ENABLE_SHIELD: bool = true;
