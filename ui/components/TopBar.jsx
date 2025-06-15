import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

const THEMES = [
  { id: "light" },
  { id: "dark" },
];

export default function TopBar({ theme, onThemeChange, lang, setLang, languages, _ }) {
  const langKeys = Object.keys(languages);

  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="topbar-brand" data-tauri-drag-region>
        NAIHE
      </div>
      <div className="topbar-controls">
        {/* Language switcher */}
        <div className="topbar-lang">
          {langKeys.map((k) => (
            <button
              key={k}
              className={`lang-btn ${lang === k ? "active" : ""}`}
              onClick={() => setLang(k)}
              title={languages[k].name}
            >
              {languages[k].label}
            </button>
          ))}
        </div>
        <div className="topbar-sep" />
        {/* Theme switcher */}
        <div className="topbar-theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-dot ${theme === t.id ? "active" : ""}`}
              title={_(`topbar.${t.id}`)}
              onClick={() => onThemeChange(t.id)}
            />
          ))}
        </div>
        <button className="win-btn" onClick={() => appWindow.minimize()}>
          &#x2500;
        </button>
        <button className="win-btn win-close" onClick={() => appWindow.close()}>
          &#x2715;
        </button>
      </div>
    </header>
  );
}
