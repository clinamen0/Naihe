import { useState } from "react";
import { motion } from "framer-motion";

const slide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

/* ── Setup Form ── */

export function RoomSetup({
  server, setServer,
  room, setRoom,
  nickname, setNickname,
  passphrase, setPassphrase,
  showKey, toggleKey,
  saveHistory, setSaveHistory,
  autoClear, setAutoClear,
  offline, setOffline,
  onBack, onConnect, _,
}) {
  const ready = server.trim() && room.trim() && passphrase.trim();

  return (
    <motion.div className="view setup-form" {...slide}>
      <div className="sf-title">{_("roomSetup.title")}</div>

      <label className="sf-label">{_("roomSetup.server")}</label>
      <input
        className="sf-input"
        placeholder={_("roomSetup.serverPlaceholder")}
        value={server}
        onChange={(e) => setServer(e.target.value)}
        autoFocus
      />
      <div className="sf-hint">{_("roomSetup.serverHint")}</div>

      <label className="sf-label">{_("roomSetup.nickname")}</label>
      <input className="sf-input" value={nickname} onChange={(e) => setNickname(e.target.value)} />

      <label className="sf-label">{_("roomSetup.room")}</label>
      <input className="sf-input" value={room} onChange={(e) => setRoom(e.target.value)} />

      <label className="sf-label">{_("roomSetup.key")}</label>
      <div className="sf-row">
        <input
          className="sf-input"
          type={showKey ? "text" : "password"}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <button className="sf-eye" onClick={toggleKey}>
          {showKey ? "\uD83D\uDE48" : "\uD83D\uDC41"}
        </button>
      </div>

      {server.trim() && (
        <div className="sf-check" onClick={() => setOffline(!offline)}>
          <input type="checkbox" checked={offline} readOnly />
          <span>{_("roomSetup.offline")}</span>
        </div>
      )}
      {offline && server.trim() && (
        <div className="sf-hint" style={{ marginBottom: 8 }}>{_("roomSetup.offlineHint")}</div>
      )}

      <div className="sf-divider" />
      <div className="sf-section">{_("roomSetup.history")}</div>

      <div className="sf-check" onClick={() => setSaveHistory(!saveHistory)}>
        <input type="checkbox" checked={saveHistory} readOnly />
        <span>{_("roomSetup.saveHistory")}</span>
      </div>

      {saveHistory && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="sf-label" style={{ marginTop: 8 }}>{_("roomSetup.autoClear")}</div>
          <div className="sf-toggles">
            {["off", "24h", "7d"].map((v) => (
              <button
                key={v}
                className={`sf-toggle ${autoClear === v ? "on" : ""}`}
                onClick={() => setAutoClear(v)}
              >
                {v === "off" ? _("roomSetup.off") : v}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <div className="sf-actions">
        <button className="btn-secondary" onClick={onBack}>{_("roomSetup.back")}</button>
        <button className="btn-primary" disabled={!ready} onClick={onConnect}>{_("roomSetup.connect")}</button>
      </div>
    </motion.div>
  );
}

/* ── Live Chat ── */

export function LiveRoom({
  room, messages, input, setInput,
  onSend, onLeave, onClear,
  saveHistory, autoClear, connInfo, endRef, _,
}) {
  const statusParts = [
    connInfo ? "connected" : null,
    saveHistory ? "history on" : null,
    autoClear !== "off" ? `clear: ${autoClear}` : null,
  ].filter(Boolean);

  return (
    <motion.div className="view live-room" {...slide}>
      <div className="lr-header">
        <div className="lr-info">
          <span className="lr-dot" />
          <span className="lr-name">#{room}</span>
          <span className="lr-status">{statusParts.join(" \u00b7 ")}</span>
        </div>
        <div className="lr-btns">
          <button className="btn-flat" onClick={onClear}>{_("liveRoom.clear")}</button>
          <button className="btn-flat" onClick={onLeave}>{_("liveRoom.leave")}</button>
        </div>
      </div>

      <div className="lr-messages">
        {messages.length === 0 ? (
          <div className="lr-empty">
            {_("liveRoom.waiting")}<br />
            {_("liveRoom.waitingSub")}
          </div>
        ) : (
          messages.map((m, i) => (
            <motion.div
              key={i}
              className={`lr-bubble ${m.is_self ? "self" : "peer"}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="lr-meta">{m.time}</div>
              <div className="lr-text">{m.text}</div>
            </motion.div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="lr-input-bar">
        <input
          className="lr-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder={_("liveRoom.placeholder")}
          autoFocus
        />
        <button className="btn-primary compact" onClick={onSend}>{_("liveRoom.send")}</button>
      </div>
    </motion.div>
  );
}
