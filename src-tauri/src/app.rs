// ─── NaiHe Application Commands ───
// Tauri IPC command handlers bridging the frontend to the core modules.

use std::sync::Arc;
use tokio::sync::Mutex;
use rumqttc::{AsyncClient, Event, Incoming, QoS};
use tauri::{AppHandle, Emitter};

use crate::{cipher, config, shield, transport};

/// Global MQTT connection state.
struct MqttState(Arc<Mutex<Option<transport::MqttLink>>>);

/// Initialize Tauri with all commands registered.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(MqttState(Arc::new(Mutex::new(None))))
        .invoke_handler(tauri::generate_handler![
            cmd_verify_gate,
            cmd_connect,
            cmd_disconnect,
            cmd_send_text,
            cmd_encrypt,
            cmd_decrypt,
            cmd_is_cipher,
            cmd_save_history,
            cmd_load_history,
            cmd_clear_history,
            cmd_pull_offline,
        ])
        .run(tauri::generate_context!())
        .expect("failed to launch NaiHe");
}

// ── Gate ──

#[tauri::command]
fn cmd_verify_gate(input: String) -> bool {
    // Optional: run integrity check on first gate attempt
    if config::ENABLE_SHIELD && shield::probe() == shield::Verdict::Suspicious {
        return false;
    }
    cipher::check_gate(&input)
}

// ── Encryption ──

#[tauri::command]
fn cmd_encrypt(plaintext: String, passphrase: String) -> Result<String, String> {
    cipher::seal(&plaintext, &passphrase)
}

#[tauri::command]
fn cmd_decrypt(encoded: String, passphrase: String) -> Result<String, String> {
    cipher::unseal(&encoded, &passphrase)
}

#[tauri::command]
fn cmd_is_cipher(text: String) -> bool {
    cipher::resembles_cipher(&text)
}

// ── MQTT ──

#[tauri::command]
async fn cmd_connect(
    handle: AppHandle,
    state: tauri::State<'_, MqttState>,
    server: String,
    room: String,
    nickname: String,
    passphrase: String,
    offline: bool,
) -> Result<String, String> {
    let broker = transport::parse_broker(&server)?;
    let topic = cipher::room_topic(&room);
    let persistent = offline && !server.trim().is_empty();

    let opts = transport::build_options(&broker, &room, &nickname, persistent);
    let (client, mut eventloop) = AsyncClient::new(opts, 64);

    client
        .subscribe(&topic, QoS::AtLeastOnce)
        .await
        .map_err(|e| format!("subscribe: {e}"))?;

    // Store connection
    {
        let mut guard = state.0.lock().await;
        *guard = Some(transport::MqttLink {
            client: client.clone(),
            topic: topic.clone(),
            nickname: nickname.clone(),
            passphrase: passphrase.clone(),
            is_persistent: persistent,
        });
    }

    // Spawn event loop reader
    let pass_clone = passphrase.clone();
    let nick_clone = nickname.clone();
    let handle_clone = handle.clone();

    tokio::spawn(async move {
        loop {
            match eventloop.poll().await {
                Ok(Event::Incoming(Incoming::Publish(pub_msg))) => {
                    let payload = String::from_utf8_lossy(&pub_msg.payload).to_string();

                    // Strip ephemeral marker if present
                    let cipher_text = if payload.starts_with('~') {
                        &payload[1..]
                    } else {
                        &payload
                    };

                    if let Ok(json_str) = cipher::unseal(cipher_text, &pass_clone) {
                        if let Ok(mut msg) =
                            serde_json::from_str::<transport::ChatMessage>(&json_str)
                        {
                            msg.is_self = msg.nickname == nick_clone;
                            if !msg.is_self {
                                let _ = handle_clone.emit("incoming-message", &msg);
                            }
                        }
                    }
                }
                Err(_) => break,
                _ => {}
            }
        }
    });

    let mode = if persistent { "persistent" } else { "ephemeral" };
    Ok(format!("connected ({mode}) to {}", broker.host))
}

#[tauri::command]
async fn cmd_disconnect(state: tauri::State<'_, MqttState>) -> Result<(), String> {
    let mut guard = state.0.lock().await;
    if let Some(link) = guard.take() {
        let _ = link.client.disconnect().await;
    }
    Ok(())
}

#[tauri::command]
async fn cmd_send_text(
    text: String,
    state: tauri::State<'_, MqttState>,
) -> Result<transport::ChatMessage, String> {
    let guard = state.0.lock().await;
    let link = guard.as_ref().ok_or("not connected")?;

    let now = chrono::Local::now();
    let msg = transport::ChatMessage {
        nickname: link.nickname.clone(),
        text: text.clone(),
        time: now.format("%H:%M:%S").to_string(),
        timestamp: now.timestamp(),
        is_self: true,
    };

    let json = serde_json::to_string(&msg).map_err(|e| format!("serialize: {e}"))?;
    let sealed = cipher::seal(&json, &link.passphrase)?;

    // Prepend ephemeral marker for non-persistent connections
    let payload = if link.is_persistent {
        sealed
    } else {
        format!("~{sealed}")
    };

    link.client
        .publish(&link.topic, rumqttc::QoS::AtLeastOnce, false, payload.as_bytes())
        .await
        .map_err(|e| format!("publish: {e}"))?;

    Ok(msg)
}

// ── History ──

fn history_path(room: &str) -> std::path::PathBuf {
    // Use LOCALAPPDATA on Windows, HOME/.local/share on Linux, ~/Library on macOS
    let base = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("HOME").map(|h| format!("{h}/.local/share")))
        .unwrap_or_else(|_| ".".to_string());
    let dir = std::path::PathBuf::from(base).join("naihe");
    std::fs::create_dir_all(&dir).ok();

    // Reuse cipher module's topic hash for consistent naming
    let topic = cipher::room_topic(room);
    let name = topic.replace('/', "_");
    dir.join(format!("{name}.{}", config::HISTORY_EXT))
}

#[tauri::command]
fn cmd_save_history(
    room: String,
    passphrase: String,
    messages: Vec<transport::ChatMessage>,
) -> Result<(), String> {
    let json = serde_json::to_vec(&messages).map_err(|e| format!("serialize: {e}"))?;
    let encrypted = cipher::seal_bytes(&json, &passphrase)?;
    std::fs::write(history_path(&room), &encrypted).map_err(|e| format!("write: {e}"))
}

#[tauri::command]
fn cmd_load_history(
    room: String,
    passphrase: String,
) -> Result<Vec<transport::ChatMessage>, String> {
    let path = history_path(&room);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = std::fs::read(&path).map_err(|e| format!("read: {e}"))?;
    let decrypted = cipher::unseal_bytes(&data, &passphrase)?;
    serde_json::from_slice(&decrypted).map_err(|e| format!("deserialize: {e}"))
}

#[tauri::command]
fn cmd_clear_history(room: String) -> Result<(), String> {
    let path = history_path(&room);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("delete: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
async fn cmd_pull_offline(
    server: String,
    room: String,
    passphrase: String,
    since: i64,
) -> Result<Vec<transport::ChatMessage>, String> {
    let broker = transport::parse_broker(&server)?;
    let topic = cipher::room_topic(&room);
    transport::fetch_offline(&broker.host, &topic, &passphrase, since).await
}
