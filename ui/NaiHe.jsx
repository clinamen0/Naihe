import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { AnimatePresence } from "framer-motion";

import TopBar from "./components/TopBar";
import Gateway from "./views/Gateway";
import Dashboard from "./views/Dashboard";
import { RoomSetup, LiveRoom } from "./views/SecureChat";
import { PadSetup, LivePad } from "./views/CipherPad";
import { t, LANGUAGES, DEFAULT_LANG } from "./i18n/index.js";

export default function NaiHe() {
  // ── Navigation ──
  const [view, setView] = useState("gateway");
  const [theme, setTheme] = useState(() => localStorage.getItem("nh-theme") || "light");
  const [lang, setLang] = useState(() => localStorage.getItem("nh-lang") || DEFAULT_LANG);

  // ── Gateway ──
  const [gateVal, setGateVal] = useState("");
  const [gateFail, setGateFail] = useState(false);

  // ── Shared ──
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  // ── Secure Room ──
  const [server, setServer] = useState("");
  const [roomName, setRoomName] = useState("");
  const [nick, setNick] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [chatText, setChatText] = useState("");
  const [linked, setLinked] = useState(false);
  const [keepHistory, setKeepHistory] = useState(false);
  const [autoClear, setAutoClear] = useState("off");
  const [offline, setOffline] = useState(false);
  const [linkInfo, setLinkInfo] = useState("");
  const lastPull = useRef(0);
  const msgEnd = useRef(null);

  // ── Cipher Pad ──
  const [padItems, setPadItems] = useState([]);
  const [padText, setPadText] = useState("");
  const [padNote, setPadNote] = useState("");
  const [watching, setWatching] = useState(false);
  const prevClip = useRef("");
  const padEnd = useRef(null);

  // ── Theme & lang sync ──
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("nh-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("nh-lang", lang);
    // RTL support for Persian, Arabic, etc.
    const rtlLangs = ["fa", "ar", "he"];
    document.documentElement.dir = rtlLangs.includes(lang) ? "rtl" : "ltr";
  }, [lang]);

  // Shorthand for current language translation
  const _ = (key) => t(key, lang);

  // ── Auto-scroll ──
  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  useEffect(() => { padEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [padItems]);

  // ── Incoming MQTT messages ──
  useEffect(() => {
    const unsub = listen("incoming-message", (ev) => {
      setMsgs((prev) => [...prev, ev.payload]);
    });
    return () => { unsub.then((f) => f()); };
  }, []);

  // ── Clipboard watcher ──
  useEffect(() => {
    if (!watching) return;
    const tick = setInterval(async () => {
      try {
        const clip = await readText();
        if (!clip || clip === prevClip.current) return;
        prevClip.current = clip;

        const yes = await invoke("cmd_is_cipher", { text: clip });
        if (!yes) return;

        try {
          const pt = await invoke("cmd_decrypt", { encoded: clip, passphrase: key });
          const now = new Date().toLocaleTimeString("en-GB", { hour12: false });
          setPadItems((prev) => [
            ...prev,
            {
              text: pt,
              source: clip.length > 40 ? clip.slice(0, 40) + "\u2026" : clip,
              type: "decrypted",
              time: now,
            },
          ]);
          setPadNote("auto-decrypted");
        } catch {
          // Wrong key — ignore
        }
      } catch {
        // Clipboard inaccessible
      }
    }, 500);
    return () => clearInterval(tick);
  }, [watching, key]);

  // ── Auto-clear ──
  useEffect(() => {
    if (autoClear === "off") return;
    const limit = autoClear === "24h" ? 86400 : 604800;
    const now = Math.floor(Date.now() / 1000);
    setMsgs((prev) => prev.filter((m) => now - m.timestamp < limit));
  }, [autoClear, msgs.length]);

  // ── Handlers ──

  const submitGate = async () => {
    const ok = await invoke("cmd_verify_gate", { input: gateVal });
    if (ok) {
      setGateFail(false);
      setView("dashboard");
    } else {
      setGateFail(true);
      setGateVal("");
    }
  };

  const connectRoom = async () => {
    setLinked(true);
    setView("live-room");
    try {
      if (keepHistory) {
        invoke("cmd_load_history", { room: roomName, passphrase: key })
          .then((h) => setMsgs(h))
          .catch(() => {});
      }
      const info = await invoke("cmd_connect", {
        server, room: roomName, nickname: nick, passphrase: key, offline,
      });
      setLinkInfo(info);

      if (server.trim() && offline) {
        invoke("cmd_pull_offline", {
          server, room: roomName, passphrase: key, since: lastPull.current,
        })
          .then((offMsgs) => {
            if (offMsgs.length > 0) {
              const maxTs = Math.max(...offMsgs.map((m) => m.timestamp));
              lastPull.current = maxTs;
              setMsgs((prev) => {
                const seen = new Set(prev.map((m) => m.text + m.timestamp));
                const fresh = offMsgs.filter((m) => !seen.has(m.text + m.timestamp));
                return fresh.length ? [...prev, ...fresh].sort((a, b) => a.timestamp - b.timestamp) : prev;
              });
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error(e);
      setLinked(false);
      setView("room-setup");
    }
  };

  const sendMsg = async () => {
    const text = chatText.trim();
    if (!text) return;
    try {
      const msg = await invoke("cmd_send_text", { text });
      setMsgs((prev) => [...prev, msg]);
      setChatText("");
    } catch (e) {
      console.error(e);
    }
  };

  const leaveRoom = async () => {
    if (keepHistory && msgs.length > 0) {
      try { await invoke("cmd_save_history", { room: roomName, passphrase: key, messages: msgs }); } catch {}
    }
    await invoke("cmd_disconnect");
    setLinked(false);
    if (!keepHistory) setMsgs([]);
    setView("dashboard");
  };

  const clearMsgs = async () => {
    setMsgs([]);
    try { await invoke("cmd_clear_history", { room: roomName }); } catch {}
  };

  const encryptPad = async () => {
    const text = padText.trim();
    if (!text) return;
    try {
      const ct = await invoke("cmd_encrypt", { plaintext: text, passphrase: key });
      await writeText(ct);
      prevClip.current = ct;
      const now = new Date().toLocaleTimeString("en-GB", { hour12: false });
      setPadItems((prev) => [
        ...prev,
        { text, source: "copied to clipboard", type: "encrypted", time: now },
      ]);
      setPadText("");
      setPadNote("encrypted \u2192 clipboard");
    } catch (e) {
      setPadNote("error: " + e);
    }
  };

  // ── Render ──

  return (
    <>
      <TopBar theme={theme} onThemeChange={setTheme} lang={lang} setLang={setLang} languages={LANGUAGES} _={_} />
      <main className="app-root">
        <AnimatePresence mode="wait">
          {view === "gateway" && (
            <Gateway key="gw" value={gateVal} onChange={setGateVal} failed={gateFail} onSubmit={submitGate} _={_} />
          )}
          {view === "dashboard" && (
            <Dashboard key="dash" onRoom={() => setView("room-setup")} onCipher={() => setView("pad-setup")} _={_} />
          )}
          {view === "room-setup" && (
            <RoomSetup
              key="rs" _={_}
              server={server} setServer={setServer}
              room={roomName} setRoom={setRoomName}
              nickname={nick} setNickname={setNick}
              passphrase={key} setPassphrase={setKey}
              showKey={showKey} toggleKey={() => setShowKey(!showKey)}
              saveHistory={keepHistory} setSaveHistory={setKeepHistory}
              autoClear={autoClear} setAutoClear={setAutoClear}
              offline={offline} setOffline={setOffline}
              onBack={() => setView("dashboard")}
              onConnect={connectRoom}
            />
          )}
          {view === "live-room" && (
            <LiveRoom
              key="lr" _={_}
              room={roomName} messages={msgs} input={chatText} setInput={setChatText}
              onSend={sendMsg} onLeave={leaveRoom} onClear={clearMsgs}
              saveHistory={keepHistory} autoClear={autoClear} connInfo={linkInfo} endRef={msgEnd}
            />
          )}
          {view === "pad-setup" && (
            <PadSetup
              key="ps" _={_}
              passphrase={key} setPassphrase={setKey}
              showKey={showKey} toggleKey={() => setShowKey(!showKey)}
              onBack={() => setView("dashboard")}
              onStart={() => { setWatching(true); setView("live-pad"); }}
            />
          )}
          {view === "live-pad" && (
            <LivePad
              key="lp" _={_}
              results={padItems} input={padText} setInput={setPadText} status={padNote}
              onEncrypt={encryptPad}
              onClear={() => setPadItems([])}
              onExit={() => { setWatching(false); setPadItems([]); setView("dashboard"); }}
              endRef={padEnd} passphrase={key}
            />
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
