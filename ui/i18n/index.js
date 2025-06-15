// ─── NaiHe i18n System ───
// To add a new language:
// 1. Create a new file in this folder (e.g. ja.js)
// 2. Copy the structure from en.js and translate all values
// 3. Import it below and add it to the LANGUAGES object
// 4. That's it — the language will appear in the UI automatically.

import en from "./en.js";
import zh from "./zh.js";
import ru from "./ru.js";
import fa from "./fa.js";

export const LANGUAGES = {
  en: { label: "EN", name: "English", strings: en },
  zh: { label: "中", name: "中文", strings: zh },
  ru: { label: "RU", name: "Русский", strings: ru },
  fa: { label: "فا", name: "فارسی", strings: fa },
};

export const DEFAULT_LANG = "en";

/**
 * Get a translated string by dot-path key.
 * Example: t("gateway.brand", lang) => "NaiHe"
 */
export function t(key, lang = DEFAULT_LANG) {
  const strings = LANGUAGES[lang]?.strings || LANGUAGES[DEFAULT_LANG].strings;
  const parts = key.split(".");
  let val = strings;
  for (const p of parts) {
    val = val?.[p];
    if (val === undefined) break;
  }
  // Fallback to English if key not found in current language
  if (val === undefined) {
    val = LANGUAGES[DEFAULT_LANG].strings;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined) break;
    }
  }
  return val ?? key;
}
