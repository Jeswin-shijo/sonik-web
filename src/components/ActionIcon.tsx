import type { ActionIconName } from '../types';

export function ActionIcon({ name }: { name: ActionIconName }) {
  const paths: Record<ActionIconName, string[]> = {
    heart: [
      'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z',
    ],
    'heart-filled': [
      'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z',
    ],
    plus: ['M12 5v14', 'M5 12h14'],
    check: ['M20 6 9 17l-5-5'],
    more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
    queue: ['M4 7h12', 'M4 12h16', 'M4 17h10', 'M18 15l2 2-2 2'],
    'play-next': ['M4 6h10', 'M4 12h10', 'M4 18h10', 'M17 9l5 3-5 3z'],
    'queue-add': ['M4 7h10', 'M4 12h10', 'M4 17h6', 'M18 14v6', 'M15 17h6'],
    share: ['M18 8a3 3 0 1 0-2.8-4', 'M6 15a3 3 0 1 0 2.8 4', 'M8.6 15.9l6.8-3.8', 'M15.4 8.1 8.6 4.3'],
    artist: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21a8 8 0 0 1 16 0'],
    album: ['M5 4h14v16H5z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
  };

  return (
    <svg
      aria-hidden="true"
      className="action-svg"
      fill={name === 'heart-filled' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      {paths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
