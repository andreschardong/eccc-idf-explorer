// Light/dark theme: follows the system until the viewer picks one, then remembers the choice.

export type Theme = 'light' | 'dark';

export function currentTheme(): Theme {
  const explicit = document.documentElement.dataset['theme'];
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset['theme'] = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Storage is blocked: the choice lasts for this visit only.
  }
  return next;
}

/** Calls `onChange` when the system theme flips and the viewer has not chosen one. */
export function watchSystemTheme(onChange: () => void): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!document.documentElement.dataset['theme']) onChange();
  });
}

/** Reads a CSS custom property from the root, e.g. cssVar('--bin-1'). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
