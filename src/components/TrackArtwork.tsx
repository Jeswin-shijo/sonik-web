import { apiBaseUrl } from '../config';
import type { MusicTrack } from '../types';

const dummyCoverPalettes = [
  ['#f05a8a', '#6f38d8', '#ffc3d9'],
  ['#53d6c5', '#2767a3', '#dbfff8'],
  ['#ffb15d', '#f05f57', '#ffe0b7'],
  ['#7ea8ff', '#28715e', '#d7e5ff'],
  ['#b58cff', '#cf5d87', '#f0d9ff'],
  ['#f3cf65', '#1b8f89', '#fff1b0'],
];

function getDummyCoverDataUrl(title: string) {
  const paletteIndex = Math.abs(
    title.split('').reduce((total, character) => total + character.charCodeAt(0), 0),
  ) % dummyCoverPalettes.length;
  const [first, second, accent] = dummyCoverPalettes[paletteIndex];
  const initial = title.trim().charAt(0).toUpperCase() || 'S';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${first}"/>
          <stop offset="100%" stop-color="${second}"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#111827" flood-opacity=".32"/>
        </filter>
      </defs>
      <rect width="512" height="512" rx="46" fill="url(#bg)"/>
      <circle cx="394" cy="370" r="74" fill="#ffffff" opacity=".18"/>
      <circle cx="118" cy="126" r="130" fill="#ffffff" opacity=".08"/>
      <path d="M132 336c76 32 162 38 254 17" fill="none" stroke="#111827" stroke-width="34" stroke-linecap="round" opacity=".32"/>
      <rect x="148" y="112" width="216" height="248" rx="12" fill="none" stroke="${accent}" stroke-width="12" opacity=".52" transform="rotate(20 256 256)" filter="url(#shadow)"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#fff7ed" font-family="Inter, Arial, sans-serif" font-size="150" font-weight="900" opacity=".92">${initial}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function TrackArtwork({
  track,
  className = '',
}: {
  track: Pick<MusicTrack, 'title' | 'coverClass' | 'coverUrl'>;
  className?: string;
}) {
  const normalizedCoverUrl =
    track.coverUrl && !track.coverUrl.startsWith('http')
      ? track.coverUrl.startsWith('/')
        ? track.coverUrl
        : `/${track.coverUrl}`
      : track.coverUrl;
  const imageSource = track.coverUrl
    ? normalizedCoverUrl?.startsWith('http')
      ? normalizedCoverUrl
      : `${apiBaseUrl}${normalizedCoverUrl}`
    : getDummyCoverDataUrl(track.title);

  return (
    <div className={`track-art ${track.coverClass} ${className}`}>
      <img src={imageSource} alt="" aria-hidden="true" />
    </div>
  );
}
