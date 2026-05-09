export function IconButton({
  label,
  icon,
  isActive = false,
  isLarge = false,
  onClick,
}: {
  label: string;
  icon: string;
  isActive?: boolean;
  isLarge?: boolean;
  onClick?: () => void;
}) {
  const iconPaths: Record<string, string[]> = {
    'icon-shuffle': [
      'M16 3h5v5',
      'M4 20 21 3',
      'M21 16v5h-5',
      'M15 15l6 6',
      'M4 4l5 5',
    ],
    'icon-previous': ['M19 20 9 12l10-8v16Z', 'M5 19V5'],
    'icon-play': ['M8 5v14l11-7L8 5Z'],
    'icon-pause': ['M8 5v14', 'M16 5v14'],
    'icon-next': ['M5 4l10 8-10 8V4Z', 'M19 5v14'],
    'icon-repeat': [
      'M17 2l4 4-4 4',
      'M3 11V9a3 3 0 0 1 3-3h15',
      'M7 22l-4-4 4-4',
      'M21 13v2a3 3 0 0 1-3 3H3',
    ],
    'icon-volume': [
      'M11 5 6 9H3v6h3l5 4V5Z',
      'M15.5 8.5a5 5 0 0 1 0 7',
      'M18.5 5.5a9 9 0 0 1 0 13',
    ],
    'icon-mute': [
      'M11 5 6 9H3v6h3l5 4V5Z',
      'M23 9l-6 6',
      'M17 9l6 6',
    ],
  };
  const paths = iconPaths[icon];

  return (
    <button
      aria-label={label}
      className={`icon-button ${isActive ? 'is-active' : ''} ${
        isLarge ? 'is-large' : ''
      }`}
      onClick={onClick}
      type="button"
    >
      {paths ? (
        <svg
          aria-hidden="true"
          className="control-svg"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
        >
          {paths.map((path) => (
            <path d={path} key={path} />
          ))}
        </svg>
      ) : (
        <span className={`control-icon ${icon}`} aria-hidden="true" />
      )}
    </button>
  );
}
