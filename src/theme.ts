export const theme = {
  background: '#0a0e1a',
  surface: '#111827',
  primary: '#ffce2e',
  secondary: '#ff6b6b',
  text: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.6)',
};

export type Theme = typeof theme;

export function applyTheme(t: Theme): void {
  const s = document.documentElement.style;
  s.setProperty('--color-background', t.background);
  s.setProperty('--color-surface', t.surface);
  s.setProperty('--color-primary', t.primary);
  s.setProperty('--color-secondary', t.secondary);
  s.setProperty('--color-text', t.text);
  s.setProperty('--color-text-muted', t.textMuted);
}
