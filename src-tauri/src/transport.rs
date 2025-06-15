// ─── NaiHe Transport Layer ───
// MQTT-based message relay with optional offline storage.

use rumqttc::{AsyncClient, MqttOptions};
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::config;

/// Parsed broker address.
pub struct Broker {
    pub host: String,
    pub port: u16,
}

/// Parse "host:port" or "host" into a Broker.
/// Returns an error if the address is empty — no default fallback.
pub fn parse_broker(addr: &str) -> Result<Broker, String> {
    let trimmed = addr.trim();
    if trimmed.is_empty() {
        return Err("MQTT server address is required".into());
    }
    if let Some((h, p)) = trimmed.rsplit_once(':') {
        let port = p
            .parse::<u16>()
            .map_err(|_| format!("invalid port: {p}"))?;
        Ok(Broker {
            host: h.to_string(),
            port,
        })
    } else {
        Ok(Broker {
            host: trimmed.to_string(),
            port: config::MQTT_DEFAULT_PORT,
        })
    }
}

/// Build MQTT options for an ephemeral (public) or persistent (private) session.
pub fn build_options(
    broker: &Broker,
    room: &str,
    nickname: &str,
    persistent: bool,
) -> MqttOptions {
    let client_id = if persistent {
        // Deterministic ID so the broker can queue messages
        let room_hash = crate::cipher::room_topic(room);
        let nick_part: String = nickname.chars().take(4).collect();
        format!(
            "{}{}-{}",
            config::CLIENT_PREFIX,
            &room_hash[room_hash.len().saturating_sub(4)..],
            nick_part
        )
    } else {
        // Random ephemeral ID
        format!("{}{}", config::CLIENT_PREFIX, rand::random::<u32>())
    };

    let mut opts = MqttOptions::new(client_id, &broker.host, broker.port);
    opts.set_keep_alive(Duration::from_secs(config::MQTT_KEEPALIVE_SECS));
    opts.set_clean_session(!persistent);
    opts
}

/// Shared MQTT connection state.
pub struct MqttLink {
    pub client: AsyncClient,
    pub topic: String,
    pub nickname: String,
    pub passphrase: String,
    pub is_persistent: bool,
}

/// A decrypted chat message ready for the frontend.
#[derive(Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub nickname: String,
    pub text: String,
    pub time: String,
    pub timestamp: i64,
    pub is_self: bool,
}

/// Fetch offline messages from the companion HTTP service.
pub async fn fetch_offline(
    host: &str,
    topic: &str,
    passphrase: &str,
    since: i64,
) -> Result<Vec<ChatMessage>, String> {
    let url = format!(
        "http://{}:{}/messages?topic={}&since={}",
        host,
        config::OFFLINE_SERVICE_PORT,
        topic,
        since
    );

    let body = reqwest_lite(&url).await?;

    #[derive(Deserialize)]
    #[allow(dead_code)]
    struct RawMsg {
        payload: String,
        ts: i64,
    }

    let raw: Vec<RawMsg> =
        serde_json::from_str(&body).map_err(|e| format!("parse offline: {e}"))?;

    let mut out = Vec::new();
    for rm in raw {
        if let Ok(json_str) = crate::cipher::unseal(&rm.payload, passphrase) {
            if let Ok(msg) = serde_json::from_str::<ChatMessage>(&json_str) {
                out.push(msg);
            }
        }
    }
    Ok(out)
}

/// Minimal HTTP GET without pulling in reqwest.
async fn reqwest_lite(url: &str) -> Result<String, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;

    let url_str = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_str
        .split_once('/')
        .map(|(h, p)| (h, format!("/{p}")))
        .unwrap_or((url_str, "/".to_string()));

    let mut stream = TcpStream::connect(host_port)
        .await
        .map_err(|e| format!("connect: {e}"))?;

    let host_header = host_port.split(':').next().unwrap_or(host_port);
    let req = format!("GET {path} HTTP/1.1\r\nHost: {host_header}\r\nConnection: close\r\n\r\n");
    stream
        .write_all(req.as_bytes())
        .await
        .map_err(|e| format!("write: {e}"))?;

    let mut buf = Vec::new();
    stream
        .read_to_end(&mut buf)
        .await
        .map_err(|e| format!("read: {e}"))?;

    let text = String::from_utf8_lossy(&buf);
    if let Some(idx) = text.find("\r\n\r\n") {
        Ok(text[idx + 4..].to_string())
    } else {
        Ok(text.to_string())
    }
}
