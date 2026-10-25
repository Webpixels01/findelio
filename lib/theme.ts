export const THEME_STORAGE_KEY = "findelio-theme";
export const THEME_EVENT = "findelio-theme-change";
export type ThemePreference = "light" | "dark" | "system";

export function normalizeTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Runs in the head before the first paint; no user-controlled content is inserted.
export const THEME_INIT_SCRIPT = `(() => {
  let preference = "system";
  try {
    const saved = localStorage.getItem("${THEME_STORAGE_KEY}");
    if (saved === "light" || saved === "dark") preference = saved;
  } catch {}
  const dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();`;

export function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch {
    // Switching remains available when browser storage is blocked.
  }
  applyTheme(next);
}

export function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (document.documentElement.dataset.themePreference === "system") applyTheme("system");
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      applyTheme(normalizeTheme(event.newValue));
    }
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onSystemChange);
  };
}

export function getDarkThemeSnapshot() {
  return document.documentElement.dataset.theme === "dark";
}

export function getServerThemeSnapshot() { return false; }
