import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { motion } from "framer-motion";

const slide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

/* ── Setup ── */

export function PadSetup({ passphrase, setPassphrase, showKey, toggleKey, onBack, onStart, _ }) {
  const ready = passphrase.trim();
  return (
    <motion.div className="view setup-form" {...slide}>
      <div className="sf-title">{_("padSetup.title")}</div>
      <div className="sf-desc">{_("padSetup.desc")}</div>

      <label className="sf-label">{_("padSetup.key")}</label>
      <div className="sf-row">
        <input
          className="sf-input"
          type={showKey ? "text" : "password"}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoFocus
        />
        <button className="sf-eye" onClick={toggleKey}>
          {showKey ? "\uD83D\uDE48" : "\uD83D\uDC41"}
        </button>
      </div>

      <div className="sf-actions">
        <button className="btn-secondary" onClick={onBack}>{_("padSetup.back")}</button>
        <button className="btn-primary" disabled={!ready} onClick={onStart}>{_("padSetup.start")}</button>
      </div>
    </motion.div>
  );
}

/* ── Live Pad ── */

export function LivePad({ results, input, setInput, status, onEncrypt, onClear, onExit, endRef, passphrase, _ }) {
  const [tab, setTab] = useState("auto");
  const [mode, setMode] = useState("decrypt");
  const [manIn, setManIn] = useState("");
  const [manOut, setManOut] = useState("");
  const [manErr, setManErr] = useState("");

  const handleManual = async () => {
    const text = manIn.trim();
    if (!text) return;
    setManErr("");
    try {
      if (mode === "encrypt") {
        const ct = await invoke("cmd_encrypt", { plaintext: text, passphrase });
        setManOut(ct);
      } else {
        const pt = await invoke("cmd_decrypt", { encoded: text, passphrase });
        setManOut(pt);
      }
    } catch (e) {
      setManErr(String(e));
      setManOut("");
    }
  };

  const copyOutput = async () => {
    if (manOut) {
      try { await writeText(manOut); } catch {}
    }
  };

  return (
    <motion.div className="view live-pad" {...slide}>
      <div className="lp-header">
        <div className="lp-tabs">
          <button className={`lp-tab ${tab === "auto" ? "on" : ""}`} onClick={() => setTab("auto")}>
            {_("livePad.auto")}
          </button>
          <button className={`lp-tab ${tab === "manual" ? "on" : ""}`} onClick={() => setTab("manual")}>
            {_("livePad.manual")}
          </button>
        </div>
        {tab === "auto" && <span className="lp-badge">{_("livePad.monitoring")}</span>}
        <div className="lp-spacer" />
        {tab === "auto" && <button className="btn-flat" onClick={onClear}>{_("livePad.clear")}</button>}
        <button className="btn-flat" onClick={onExit}>{_("livePad.exit")}</button>
      </div>

      {tab === "auto" ? (
        <>
          <div className="lp-feed">
            {results.length === 0 ? (
              <div className="lr-empty">
                {_("livePad.waiting")}<br /><br />
                {_("livePad.waitingSub")}
              </div>
            ) : (
              results.map((r, i) => (
                <motion.div key={i} className="lp-entry" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="lp-entry-meta">
                    <span className="lp-entry-time">{r.time}</span>
                    <span className={`lp-entry-tag ${r.type}`}>
                      {r.type === "decrypted" ? _("livePad.decrypted") : _("livePad.encrypted")}
                    </span>
                  </div>
                  <div className="lp-entry-text">{r.text}</div>
                  {r.source && <div className="lp-entry-src">&darr; {r.source}</div>}
                </motion.div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {status && <div className="lp-status">{status}</div>}

          <div className="lr-input-bar">
            <input
              className="lr-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onEncrypt()}
              placeholder={_("livePad.placeholder")}
              autoFocus
            />
            <button className="btn-primary compact" onClick={onEncrypt}>{_("livePad.encrypt")}</button>
          </div>
        </>
      ) : (
        <div className="lp-manual">
          <div className="sf-toggles" style={{ marginBottom: 16 }}>
            <button
              className={`sf-toggle ${mode === "decrypt" ? "on" : ""}`}
              onClick={() => { setMode("decrypt"); setManIn(""); setManOut(""); setManErr(""); }}
            >
              {_("livePad.decrypt")}
            </button>
            <button
              className={`sf-toggle ${mode === "encrypt" ? "on" : ""}`}
              onClick={() => { setMode("encrypt"); setManIn(""); setManOut(""); setManErr(""); }}
            >
              {_("livePad.encrypt")}
            </button>
          </div>

          <label className="sf-label">{mode === "decrypt" ? _("livePad.ciphertext") : _("livePad.plaintext")}</label>
          <textarea className="lp-textarea" value={manIn} onChange={(e) => setManIn(e.target.value)} rows={4} />

          <button className="btn-primary" onClick={handleManual} style={{ marginTop: 12 }}>
            {mode === "decrypt" ? _("livePad.decrypt") : _("livePad.encrypt")} &rarr;
          </button>

          {manErr && <div className="lp-error">{manErr}</div>}

          {manOut && (
            <>
              <div className="sf-label" style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
                <span>{mode === "decrypt" ? _("livePad.plaintext") : _("livePad.ciphertext")}</span>
                <button className="btn-flat" onClick={copyOutput}>{_("livePad.copy")}</button>
              </div>
              <textarea className="lp-textarea output" value={manOut} readOnly rows={4} />
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
