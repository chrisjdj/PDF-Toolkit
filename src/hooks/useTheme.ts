import { useCallback, useEffect, useState } from 'react';

/**
 * Theme preference shared by every tool on this origin.
 * - 'system' (default) follows the OS live via CSS `prefers-color-scheme` and the
 *   media-qualified <meta name="theme-color"> tags, so no JS listener is needed.
 * - 'light' / 'dark' force a theme through <html data-theme>.
 * index.html applies the stored preference before first paint; this hook keeps it in
 * sync afterwards (including across tabs).
 */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme-preference';
const META_COLORS = { light: '#fafafa', dark: '#09090b' } as const;

const normalize = (value: string | null | undefined): ThemePreference =>
  value === 'light' || value === 'dark' ? value : 'system';

function readPreference(): ThemePreference {
  const attr = document.documentElement.getAttribute('data-theme-pref');
  if (attr) return normalize(attr);
  try {
    return normalize(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function applyPreference(pref: ThemePreference) {
  const root = document.documentElement;
  // Disable colour transitions for the frame in which the theme flips.
  root.setAttribute('data-theme-switching', '');
  root.setAttribute('data-theme-pref', pref);
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);

  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    const forScheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = META_COLORS[pref === 'system' ? forScheme : pref];
  });

  requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute('data-theme-switching')));
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    applyPreference(preference);
  }, [preference]);

  // Another tab (or another tool on this origin) changed the preference.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY || e.key === null) setPreferenceState(normalize(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    try {
      if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* storage unavailable (private mode) — still apply for this session */
    }
    setPreferenceState(pref);
  }, []);

  return { preference, setPreference };
}
