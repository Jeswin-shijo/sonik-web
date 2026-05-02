import type { ThemeMode } from '../types';

export function ThemeToggle({
  themeMode,
  onToggle,
}: {
  themeMode: ThemeMode;
  onToggle: () => void;
}) {
  const isLight = themeMode === 'light';

  return (
    <button
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      className="theme-toggle"
      onClick={onToggle}
      type="button"
    >
      <span
        className={`theme-toggle-icon ${
          isLight ? 'icon-moon' : 'icon-sun'
        }`}
        aria-hidden="true"
      />
      <span>{isLight ? 'Dark' : 'Light'}</span>
    </button>
  );
}
