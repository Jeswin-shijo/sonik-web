import { RefObject, useEffect, useRef, useState } from 'react';
import { apiBaseUrl } from '../config';
import { usePrompt } from '../components/ConfirmDialog';
import { formatSeconds, getDurationLabel, isUsableDuration } from '../helpers/time';
import type {
  MusicTrack,
  AlbumSummary,
  ArtistSummary,
  PlaylistSummary,
  QueueItemSummary,
  RepeatMode,
  SessionState,
  ThemeMode,
  SessionUser,
} from '../types';
import { ActionIcon } from '../components/ActionIcon';
import { IconButton } from '../components/IconButton';
import { PlayerControls } from '../components/PlayerControls';
import { ThemeToggle } from '../components/ThemeToggle';
import { TrackArtwork } from '../components/TrackArtwork';
import { getTranslation } from '../helpers/translations';

function parseDurationToSeconds(d: string): number {
  if (!d || d.includes('NaN')) return 0;
  const parts = d.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return 0;
}

function formatTotalDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '--';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

function getTopMood(tracks: MusicTrack[]): string | null {
  const counts: Record<string, number> = {};
  for (const track of tracks) {
    if (track.mood) counts[track.mood] = (counts[track.mood] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0] ?? null;
}

export function MusicPlayer({
  session,
  audioRef,
  tracks,
  favoriteTrackIds,
  playlists,
  artists,
  singers = [],
  lyricists = [],
  albums,
  queueItems,
  selectedPlaylistId,
  selectedSourceLabel,
  addToPlaylistId,
  searchQuery,
  durationByTrackId,
  selectedTrack,
  selectedTrackId,
  progress,
  currentTime,
  duration,
  isPlaying,
  isShuffle,
  repeatMode,
  volume,
  onSelectTrack,
  onSelectPlaylist,
  onSelectArtist,
  onSelectSinger,
  onSelectLyricist,
  onSelectAlbum,
  onSearchChange,
  onAddToPlaylistTargetChange,
  onCreatePlaylist,
  onAddToPlaylist,
  onSaveTrackToPlaylist,
  onRemoveFromPlaylist,
  onToggleFavorite,
  onPlayNext,
  onAddToQueue,
  onShareTrack,
  onProgressChange,
  onPlayToggle,
  onNext,
  onPrevious,
  onShuffleToggle,
  onRepeatToggle,
  onVolumeChange,
  onLoadedMetadata,
  onTimeUpdate,
onEnded,
  onLogout,
  onDeleteAccount,
  onOpenAdmin,
  onUpdateProfile,
  onChangePassword,
  onUploadAvatar,
  themeMode,
  onThemeToggle,
}: {
  session: SessionState;
  audioRef: RefObject<HTMLAudioElement | null>;
  tracks: MusicTrack[];
  favoriteTrackIds: string[];
  playlists: PlaylistSummary[];
  artists: ArtistSummary[];
  singers?: import('../types').SingerSummary[];
  lyricists?: import('../types').LyricistSummary[];
  albums: AlbumSummary[];
  queueItems: QueueItemSummary[];
  selectedPlaylistId: string;
  selectedSourceLabel: string;
  addToPlaylistId: string;
  searchQuery: string;
  durationByTrackId: Record<string, string>;
  selectedTrack: MusicTrack;
  selectedTrackId: string;
  progress: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  volume: number;
  onSelectTrack: (trackId: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onSelectArtist: (artistId: string) => void;
  onSelectSinger?: (id: string) => void;
  onSelectLyricist?: (id: string) => void;
  onSelectAlbum: (albumId: string) => void;
  onSearchChange: (query: string) => void;
  onAddToPlaylistTargetChange: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => void;
  onAddToPlaylist: () => void;
  onSaveTrackToPlaylist: (trackId: string, playlistId?: string) => void;
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => void;
  onToggleFavorite: (trackId: string) => void;
  onPlayNext: (trackId: string) => void;
  onAddToQueue: (trackId: string) => void;
  onShareTrack: (track: MusicTrack) => void;
  onProgressChange: (value: number) => void;
  onPlayToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffleToggle: () => void;
  onRepeatToggle: () => void;
  onVolumeChange: (value: number) => void;
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
onEnded: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onOpenAdmin: () => void;
  onUpdateProfile: (updates: { profileName?: string; birthday?: string | null; language?: string }) => Promise<{ message: string; user: SessionUser } | undefined>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<{ message: string } | undefined>;
  onUploadAvatar: (file: File) => Promise<{ message: string; user: SessionUser } | undefined>;
  themeMode: ThemeMode;
  onThemeToggle: () => void;
}) {
  const t = (key: string) => getTranslation(session.user.language, key);
  const [openMenuTrackId, setOpenMenuTrackId] = useState('');
  const [menuPlaylistIdByTrackId, setMenuPlaylistIdByTrackId] = useState<
    Record<string, string>
  >({});
  const [activeGridTab, setActiveGridTab] = useState<'albums' | 'artists' | 'singers' | 'lyricists'>('albums');
  const [trackView, setTrackView] = useState<'grid' | 'list'>('grid');
  const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down');
  const [menuAlign, setMenuAlign] = useState<'left' | 'right'>('right');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [profileForm, setProfileForm] = useState({
    profileName: session.user.profileName,
    birthday: session.user.birthday ?? '',
    language: session.user.language ?? 'en',
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [searchFocused, setSearchFocused] = useState(false);
const [appBannerOpen, setAppBannerOpen] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [activeDownloadTab, setActiveDownloadTab] = useState<'ios' | 'android' | 'desktop'>(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  });
  const [preMuteVolume, setPreMuteVolume] = useState<number | null>(null);
  const isMuted = preMuteVolume !== null;

  function handleMuteToggle() {
    if (preMuteVolume !== null) {
      onVolumeChange(preMuteVolume);
      setPreMuteVolume(null);
    } else {
      setPreMuteVolume(volume);
      onVolumeChange(0);
    }
  }

  const contextSinger = selectedPlaylistId.startsWith('singer:')
    ? singers?.find((s) => s.id === selectedPlaylistId.slice(7))
    : null;
  const contextLyricist = selectedPlaylistId.startsWith('lyricist:')
    ? lyricists?.find((l) => l.id === selectedPlaylistId.slice(9))
    : null;
  const contextArtist = selectedPlaylistId.startsWith('artist:')
    ? artists.find((a) => a.id === selectedPlaylistId.slice(7))
    : null;
  const contextAlbum = selectedPlaylistId.startsWith('album:')
    ? albums.find((a) => a.id === selectedPlaylistId.slice(6))
    : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (
        openMenuTrackId &&
        !target?.closest('.track-action-menu') &&
        !target?.closest('.track-menu-button')
      ) {
        setOpenMenuTrackId('');
      }
      if (
        profileMenuOpen &&
        !target?.closest('.account-menu')
      ) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuTrackId, profileMenuOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPwaPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);
  const prompt = usePrompt();
  const audioSource = selectedTrack.streamUrl
    ? `${apiBaseUrl}${selectedTrack.streamUrl}`
    : undefined;

  const EXPO_PROJECT_URL = 'https://expo.dev/projects/471ea68e-b3fc-450c-9482-0f5b407c51c8';
  const ANDROID_APK_URL = 'https://expo.dev/accounts/jeswin123/projects/sonik-mobile-app/builds';
  const qrUrl = (data: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=fbf7ef&bgcolor=1d1723&data=${encodeURIComponent(data)}`;

  function handleInstallPWA() {
    if (pwaPrompt) {
      (pwaPrompt as any).prompt();
      (pwaPrompt as any).userChoice.then((choice: { outcome: string }) => {
        if (choice.outcome === 'accepted') setPwaPrompt(null);
      });
    }
  }

  function getAppPlatform() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return 'Android';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Win/i.test(ua)) return 'Windows';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'your device';
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  }

  async function handleCreatePlaylist() {
    const name = await prompt({
      title: 'New playlist',
      message: 'Give your playlist a name. You can rename it later.',
      placeholder: 'e.g. Late night drives',
      confirmLabel: 'Create',
      maxLength: 80,
    });
    if (name) {
      onCreatePlaylist(name);
    }
  }
  const selectedPlaylist = playlists.find(
    (playlist) => playlist.id === selectedPlaylistId,
  );
  const addToPlaylist = playlists.find(
    (playlist) => playlist.id === addToPlaylistId,
  );
  const isFavorite = favoriteTrackIds.includes(selectedTrack.id);
  const isInAddTargetPlaylist = Boolean(
    addToPlaylist?.tracks.some((track) => track.id === selectedTrack.id),
  );
  const selectedRuntime = isUsableDuration(duration)
    ? formatSeconds(duration)
    : getDurationLabel(durationByTrackId[selectedTrack.id] ?? selectedTrack.duration);
  const selectedPlaylistTrackCount =
    selectedPlaylist?.trackCount ?? tracks.length;
  const likedPercent = tracks.length
    ? Math.round((favoriteTrackIds.length / tracks.length) * 100)
    : 0;
  const totalDuration = formatTotalDuration(
    tracks.reduce((sum, t) => sum + parseDurationToSeconds(durationByTrackId[t.id] ?? t.duration), 0),
  );
  const uniqueArtistCount = new Set(tracks.map((t) => t.artist)).size;
  const topMood = getTopMood(tracks);
  const queuedTracks = queueItems.map((queueItem) => queueItem.track);

  return (
    <div className="player-shell">
      <audio
        ref={audioRef}
        loop={repeatMode === 'one'}
        src={audioSource}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        preload="metadata"
      />

      <header className="sonik-header">
        <a className="brand-lockup" href="/" aria-label="Sonik home">
          <span className="brand-mark">
            <svg viewBox="0 0 1024 1024" width="32" height="32" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="bmlg" x1="215" y1="0" x2="809" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#f5c15d" />
                  <stop offset="0.5" stopColor="#ff8c69" />
                  <stop offset="1" stopColor="#55d6c2" />
                </linearGradient>
              </defs>
              <rect width="1024" height="1024" rx="236" fill="#120f18" />
              <rect x="215" y="404" width="90" height="216" rx="45" fill="url(#bmlg)" />
              <rect x="341" y="359" width="90" height="306" rx="45" fill="url(#bmlg)" />
              <rect x="467" y="314" width="90" height="396" rx="45" fill="url(#bmlg)" />
              <rect x="593" y="359" width="90" height="306" rx="45" fill="url(#bmlg)" />
              <rect x="719" y="404" width="90" height="216" rx="45" fill="url(#bmlg)" />
            </svg>
          </span>
          <span className="header-greeting">{getGreeting()}, {session.user.profileName.split(' ')[0]}</span>
        </a>

        <div className="search-wrap">
          <label className="command-bar" role="search">
            <span className="control-icon icon-search" aria-hidden="true" />
            <input
              aria-label={t('searchPlaceholder')}
              onChange={(event) => onSearchChange(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => onSearchChange('')}
                type="button"
                aria-label="Clear search"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </label>
          {(searchFocused || searchQuery.length > 0) && searchQuery.length > 0 && (
            <div className="search-dropdown">
              {tracks.length === 0 ? (
                <div className="search-no-results">No results for "{searchQuery}"</div>
              ) : (
                <>
                  <div className="search-section-label">Tracks ({tracks.length})</div>
                  {tracks.slice(0, 6).map((track) => (
                    <button
                      key={track.id}
                      className={`search-result-item ${selectedTrackId === track.id ? 'is-playing' : ''}`}
                      onClick={() => { onSelectTrack(track.id); onSearchChange(''); }}
                      type="button"
                    >
                      <TrackArtwork track={track} className="search-result-art" />
                      <span className="search-result-meta">
                        <strong>{track.title}</strong>
                        <small>{track.artist}</small>
                      </span>
                      {selectedTrackId === track.id && isPlaying && (
                        <span className="mini-eq"><i /><i /><i /></span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <button
          className={`header-install-btn${appBannerOpen ? ' is-active' : ''}`}
          type="button"
          onClick={() => setAppBannerOpen((o) => !o)}
          aria-expanded={appBannerOpen}
          title="Install Sonik app"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Install App
        </button>

        <ThemeToggle themeMode={themeMode} onToggle={onThemeToggle} />

        <div className="account-menu">
          <button
            className="avatar-button"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            type="button"
            aria-label="Open profile menu"
          >
            {session.user.avatarUrl ? (
              <img
                src={session.user.avatarUrl.startsWith('http') ? session.user.avatarUrl : `${apiBaseUrl}/uploads/avatars/${session.user.avatarUrl}`}
                alt={session.user.profileName}
                className="header-avatar-img"
              />
            ) : (
              <span className="avatar">{session.user.profileName.charAt(0).toUpperCase()}</span>
            )}
          </button>

          {profileMenuOpen && (
            <div className="profile-dropdown-menu">
              {/* Profile header */}
              <div className="dropdown-profile-header">
                <div className="dropdown-avatar">
                  {session.user.avatarUrl ? (
                    <img
                      src={session.user.avatarUrl.startsWith('http') ? session.user.avatarUrl : `${apiBaseUrl}/uploads/avatars/${session.user.avatarUrl}`}
                      alt={session.user.profileName}
                      className="dropdown-avatar-img"
                    />
                  ) : (
                    <span className="dropdown-avatar-fallback">
                      {session.user.profileName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="dropdown-profile-info">
                  <strong>{session.user.profileName}</strong>
                  <span>{session.user.email}</span>
                </div>
              </div>

              <div className="dropdown-divider" />

              {/* Menu items */}
              <button
                onClick={() => {
                  setShowSettings(true);
                  setProfileMenuOpen(false);
                  setProfileForm({
                    profileName: session.user.profileName,
                    birthday: session.user.birthday ?? '',
                    language: session.user.language ?? 'en',
                  });
                  setProfileMessage('');
                  setPasswordMessage('');
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
                type="button"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                {t('settings')}
              </button>

              {session.user.role === 'admin' && (
                <button onClick={() => { setProfileMenuOpen(false); onOpenAdmin(); }} type="button">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  {t('adminPanel')}
                </button>
              )}

              <div className="dropdown-divider" />

              <button onClick={() => { setProfileMenuOpen(false); onLogout(); }} type="button" className="danger">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                {t('logOut')}
              </button>
            </div>
          )}
        </div>
      </header>

      <aside className="control-rail" aria-label="Primary">
        <nav className="nav-stack">
          <button
            className={`nav-item ${selectedPlaylistId === 'library' ? 'is-active' : ''}`}
            onClick={() => onSelectPlaylist('library')}
            type="button"
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {t('home')}
          </button>
          <button
            className={`nav-item ${selectedPlaylistId === 'favorites' ? 'is-active' : ''}`}
            onClick={() => onSelectPlaylist('favorites')}
            type="button"
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill={selectedPlaylistId === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>
            </svg>
            {t('liked')}
          </button>
          <button
            className={`nav-item ${selectedPlaylistId === 'recent' ? 'is-active' : ''}`}
            onClick={() => onSelectPlaylist('recent')}
            type="button"
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {t('recent')}
          </button>
        </nav>

        <section className="crate-panel">
          <p className="section-kicker">{t('crates')}</p>
          <button
            className={`playlist-link ${
              selectedPlaylistId === 'library' ? 'is-active' : ''
            }`}
            onClick={() => onSelectPlaylist('library')}
            type="button"
          >
            {t('library')}
          </button>
          <button
            className={`playlist-link ${
              selectedPlaylistId === 'favorites' ? 'is-active' : ''
            }`}
            onClick={() => onSelectPlaylist('favorites')}
            type="button"
          >
            {t('likedSongs')}
          </button>
          <button
            className={`playlist-link ${
              selectedPlaylistId === 'recent' ? 'is-active' : ''
            }`}
            onClick={() => onSelectPlaylist('recent')}
            type="button"
          >
            {t('recentPlays')}
          </button>
          {playlists.map((playlist) => (
            <button
              className={`playlist-link ${
                selectedPlaylistId === playlist.id ? 'is-active' : ''
              }`}
              key={playlist.id}
              onClick={() => onSelectPlaylist(playlist.id)}
              type="button"
            >
              {playlist.name}
              <span>{playlist.trackCount}</span>
            </button>
          ))}
        </section>

        <div className="playlist-create">
          <button
            className="playlist-create-trigger"
            onClick={handleCreatePlaylist}
            type="button"
          >
            <ActionIcon name="plus" />
            {t('createPlaylist')}
          </button>
        </div>

        <section className="pulse-card">
          <p className="section-kicker">{t('libraryPulse')}</p>
          <strong>{selectedPlaylistTrackCount}</strong>
          <span>
            {selectedPlaylist ? selectedPlaylist.name : 'tracks in view'}
          </span>
          <div className="pulse-meta-row">
            <span>{totalDuration}</span>
            <span>{uniqueArtistCount} artists</span>
          </div>
          <div className="pulse-liked-row">
            <span>{favoriteTrackIds.length} liked</span>
            <div className="pulse-bar-track">
              <div
                className="pulse-bar-fill"
                style={{ width: `${likedPercent}%` }}
              />
            </div>
            <span>{likedPercent}%</span>
          </div>
          {topMood && (
            <div className="pulse-mood">
              <span className="pulse-mood-label">top mood</span>
              <span className="pulse-mood-value">{topMood}</span>
            </div>
          )}
        </section>
      </aside>

      <main className="music-main">
        <div className={`app-accordion-body${appBannerOpen ? ' is-open' : ''}`}>
              <div className="app-download-card">
                <div className="app-download-icon" aria-hidden="true">
                  <svg viewBox="0 0 34 27" width="28" height="28" fill="none">
                    <defs>
                      <linearGradient id="adlg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#f5c15d" />
                        <stop offset="0.5" stopColor="#ff8c69" />
                        <stop offset="1" stopColor="#55d6c2" />
                      </linearGradient>
                    </defs>
                    <rect x="1" y="15" width="5" height="12" rx="2.5" fill="url(#adlg)" />
                    <rect x="8" y="10" width="5" height="17" rx="2.5" fill="url(#adlg)" />
                    <rect x="15" y="5" width="5" height="22" rx="2.5" fill="url(#adlg)" />
                    <rect x="22" y="10" width="5" height="17" rx="2.5" fill="url(#adlg)" />
                    <rect x="29" y="15" width="5" height="12" rx="2.5" fill="url(#adlg)" />
                  </svg>
                </div>
                <div className="app-download-copy">
                  <h3>Get Sonik for {getAppPlatform()}</h3>
                  <p>Better audio quality, offline playback, and your full library — always with you.</p>
                </div>
                <button
                  className="app-download-btn"
                  type="button"
                  onClick={() => setShowDownloadModal(true)}
                >
                  Download the free app
                </button>
              </div>
          </div>

        <section className="signal-deck" aria-labelledby="hero-title">
          <div className={`deck-art-wrap${isPlaying ? ' is-playing' : ''}`}>
            {(contextSinger?.imageName || contextLyricist?.imageName) ? (
              <div className="hero-person-wrap">
                <img
                  src={`${apiBaseUrl}/uploads/people/${(contextSinger ?? contextLyricist)!.imageName}`}
                  alt={(contextSinger ?? contextLyricist)!.name}
                  className="hero-person-img"
                />
              </div>
            ) : (
              <TrackArtwork track={selectedTrack} className="hero-art" />
            )}
            <span className="orbit-ring" />
          </div>

          <div className="deck-copy">
            <p className="section-kicker">
              {isPlaying && <span className="mini-eq" aria-hidden="true"><i /><i /><i /></span>}
              {t('playingFrom')} {selectedSourceLabel}
            </p>
            <h1 id="hero-title">
              {contextSinger?.name ?? contextLyricist?.name ?? contextArtist?.name ?? contextAlbum?.title ?? selectedTrack.title}
            </h1>
            <p>
              {contextSinger ? `${contextSinger.trackCount} tracks` :
               contextLyricist ? `${contextLyricist.trackCount} tracks` :
               contextArtist ? `${contextArtist.trackCount} tracks · ${contextArtist.albumCount} albums` :
               contextAlbum ? `${contextAlbum.artist} · ${contextAlbum.trackCount} tracks` :
               `${selectedTrack.artist} - ${selectedTrack.album}`}
            </p>
            <div className="mood-row">
              <span>{selectedTrack.mood}</span>
              <span>{selectedTrack.plays} plays</span>
              <span>{selectedRuntime}</span>
            </div>
            <div className="hero-actions">
              <button className="play-action" onClick={onPlayToggle} type="button">
                {isPlaying ? t('pause') : t('play')}
              </button>
              <button
                className={`subtle-action ${isFavorite ? 'is-active' : ''}`}
                onClick={() => onToggleFavorite(selectedTrack.id)}
                type="button"
              >
                <ActionIcon name={isFavorite ? 'heart-filled' : 'heart'} />
                {isFavorite ? t('liked') : t('like')}
              </button>
              <div className="playlist-add-control">
                <label className="playlist-select">
                  <span className="screen-reader-only">Add to playlist</span>
                  <select
                    aria-label="Add to playlist"
                    disabled={!playlists.length}
                    onChange={(event) =>
                      onAddToPlaylistTargetChange(event.target.value)
                    }
                    value={addToPlaylistId}
                  >
                    {playlists.length ? (
                      playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Create playlist first</option>
                    )}
                  </select>
                </label>
                <button
                  className={`subtle-action ${
                    isInAddTargetPlaylist ? 'is-active' : ''
                  }`}
                  disabled={!playlists.length || isInAddTargetPlaylist}
                  onClick={onAddToPlaylist}
                  type="button"
                >
                  <ActionIcon name={isInAddTargetPlaylist ? 'check' : 'plus'} />
                  {isInAddTargetPlaylist ? 'Added' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="content-section metadata-tabs-section">
          <div className="metadata-tabs">
            <button
              className={`metadata-tab-btn ${activeGridTab === 'albums' ? 'is-active' : ''}`}
              onClick={() => setActiveGridTab('albums')}
              type="button"
            >
              {t('albums')}
              {albums.length > 0 && <span className="tab-count">{albums.length}</span>}
            </button>
            <button
              className={`metadata-tab-btn ${activeGridTab === 'artists' ? 'is-active' : ''}`}
              onClick={() => setActiveGridTab('artists')}
              type="button"
            >
              {t('artists')}
              {artists.length > 0 && <span className="tab-count">{artists.length}</span>}
            </button>
            {singers && singers.length > 0 && (
              <button
                className={`metadata-tab-btn ${activeGridTab === 'singers' ? 'is-active' : ''}`}
                onClick={() => setActiveGridTab('singers')}
                type="button"
              >
                {t('singers')}
                <span className="tab-count">{singers.length}</span>
              </button>
            )}
            {lyricists && lyricists.length > 0 && (
              <button
                className={`metadata-tab-btn ${activeGridTab === 'lyricists' ? 'is-active' : ''}`}
                onClick={() => setActiveGridTab('lyricists')}
                type="button"
              >
                {t('lyricists')}
                <span className="tab-count">{lyricists.length}</span>
              </button>
            )}
          </div>

          <div className="metadata-tab-content fade-in-up" key={activeGridTab}>
            {activeGridTab === 'albums' && albums.length > 0 && (
              <div className="mix-grid">
                {albums.map((album) => {
                  const isActive = selectedPlaylistId === `album:${album.id}`;
                  const sampleTrack = album.tracks[0];
                  return (
                    <button
                      aria-pressed={isActive}
                      className={`mix-card${isActive ? ' is-active' : ''}`}
                      key={album.id}
                      onClick={() => onSelectAlbum(album.id)}
                      type="button"
                    >
                      <TrackArtwork
                        track={{
                          title: album.title,
                          coverClass: sampleTrack?.coverClass ?? 'cover-default',
                          coverUrl: sampleTrack?.coverUrl ?? null,
                        }}
                      />
                      <h3>{album.title}</h3>
                      <p>
                        {album.artist} · {album.trackCount}{' '}
                        {album.trackCount === 1 ? 'track' : 'tracks'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {activeGridTab === 'artists' && artists.length > 0 && (
              <div className="mix-grid">
                {artists.map((artist) => {
                  const isActive = selectedPlaylistId === `artist:${artist.id}`;
                  const sampleTrack = artist.tracks[0];
                  return (
                    <button
                      aria-pressed={isActive}
                      className={`mix-card${isActive ? ' is-active' : ''}`}
                      key={artist.id}
                      onClick={() => onSelectArtist(artist.id)}
                      type="button"
                    >
                      <TrackArtwork
                        track={{
                          title: artist.name,
                          coverClass: sampleTrack?.coverClass ?? 'cover-velvet',
                          coverUrl: sampleTrack?.coverUrl ?? null,
                        }}
                      />
                      <h3>{artist.name}</h3>
                      <p>
                        {artist.trackCount}{' '}
                        {artist.trackCount === 1 ? 'track' : 'tracks'} ·{' '}
                        {artist.albumCount}{' '}
                        {artist.albumCount === 1 ? 'album' : 'albums'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {activeGridTab === 'singers' && singers && singers.length > 0 && (
              <div className="mix-grid">
                {singers.map((singer) => {
                  const isActive = selectedPlaylistId === `singer:${singer.id}`;
                  const sampleTrack = singer.tracks[0];
                  return (
                    <button
                      aria-pressed={isActive}
                      className={`mix-card person-card${isActive ? ' is-active' : ''}`}
                      key={singer.id}
                      onClick={() => onSelectSinger?.(singer.id)}
                      type="button"
                    >
                      {singer.imageName ? (
                        <img src={`${apiBaseUrl}/uploads/people/${singer.imageName}`} alt={singer.name} className="admin-track-cover" style={{ objectFit: 'cover', width: '100%', aspectRatio: '1/1', borderRadius: '8px', marginBottom: '0.75rem' }} />
                      ) : (
                        <TrackArtwork
                          track={{
                            title: singer.name,
                            coverClass: sampleTrack?.coverClass ?? 'cover-summer',
                            coverUrl: null,
                          }}
                        />
                      )}
                      <h3>{singer.name}</h3>
                      <p>
                        {singer.trackCount}{' '}
                        {singer.trackCount === 1 ? 'track' : 'tracks'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {activeGridTab === 'lyricists' && lyricists && lyricists.length > 0 && (
              <div className="mix-grid">
                {lyricists.map((lyricist) => {
                  const isActive = selectedPlaylistId === `lyricist:${lyricist.id}`;
                  const sampleTrack = lyricist.tracks[0];
                  return (
                    <button
                      aria-pressed={isActive}
                      className={`mix-card person-card${isActive ? ' is-active' : ''}`}
                      key={lyricist.id}
                      onClick={() => onSelectLyricist?.(lyricist.id)}
                      type="button"
                    >
                      {lyricist.imageName ? (
                        <img src={`${apiBaseUrl}/uploads/people/${lyricist.imageName}`} alt={lyricist.name} className="admin-track-cover" style={{ objectFit: 'cover', width: '100%', aspectRatio: '1/1', borderRadius: '8px', marginBottom: '0.75rem' }} />
                      ) : (
                        <TrackArtwork
                          track={{
                            title: lyricist.name,
                            coverClass: sampleTrack?.coverClass ?? 'cover-autumn',
                            coverUrl: null,
                          }}
                        />
                      )}
                      <h3>{lyricist.name}</h3>
                      <p>
                        {lyricist.trackCount}{' '}
                        {lyricist.trackCount === 1 ? 'track' : 'tracks'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="content-section" aria-labelledby="tracks-heading">
          <div className="section-heading">
            <h2 id="tracks-heading">{t('trackRunway')}</h2>
            <div className="view-toggles">
              <button
                className={`view-toggle ${trackView === 'grid' ? 'is-active' : ''}`}
                onClick={() => setTrackView('grid')}
                title="Grid view"
                type="button"
              >
                <ActionIcon name="grid" />
              </button>
              <button
                className={`view-toggle ${trackView === 'list' ? 'is-active' : ''}`}
                onClick={() => setTrackView('list')}
                title="List view"
                type="button"
              >
                <ActionIcon name="list" />
              </button>
              <button type="button">{tracks.length} tracks</button>
            </div>
          </div>
          {trackView === 'list' ? (
            <div className="track-table">
            {tracks.map((track, index) => {
              const menuPlaylistId =
                menuPlaylistIdByTrackId[track.id] ??
                addToPlaylistId ??
                playlists[0]?.id ??
                '';
              const artist = artists.find(
                (candidate) => candidate.name === track.artist,
              );
              const album = albums.find(
                (candidate) =>
                  candidate.title === track.album &&
                  candidate.artist === track.artist,
              );
              const singer = singers?.find((s) => s.id === track.singerId);
              const lyricist = lyricists?.find((l) => l.id === track.lyricistId);

              return (
                <div
                  className={`track-row ${
                    selectedTrackId === track.id ? 'is-selected' : ''
                  }`}
                  key={track.id}
                  onClick={() => onSelectTrack(track.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectTrack(track.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                <button
                  className="track-cell-button track-index"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectTrack(track.id);
                  }}
                  type="button"
                >
                  {selectedTrackId === track.id && isPlaying ? (
                    <span className="mini-eq" aria-label="Playing">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    index + 1
                  )}
                </button>
                <TrackArtwork track={track} className="row-art" />
                <span className="track-meta">
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </span>
                <span className="track-album">{track.album}</span>
                <span className="track-plays">{track.plays}</span>
                <span className="track-duration">
                  {getDurationLabel(durationByTrackId[track.id] ?? track.duration)}
                </span>
                <button
                  aria-label={
                    favoriteTrackIds.includes(track.id)
                      ? 'Unlike track'
                      : 'Like track'
                  }
                  className={`track-action ${
                    favoriteTrackIds.includes(track.id) ? 'is-active' : ''
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite(track.id);
                  }}
                  type="button"
                >
                  <ActionIcon
                    name={
                      favoriteTrackIds.includes(track.id)
                        ? 'heart-filled'
                        : 'heart'
                    }
                  />
                  {favoriteTrackIds.includes(track.id) ? t('liked') : t('like')}
                </button>
                <div className="track-menu-wrap">
                  <button
                    aria-expanded={openMenuTrackId === track.id}
                    aria-label={`Open actions for ${track.title}`}
                    className="track-menu-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      const spaceAbove = rect.top;
                      setMenuDirection(spaceBelow < 320 && spaceAbove >= 280 ? 'up' : 'down');
                      setMenuAlign(rect.left < window.innerWidth / 2 ? 'left' : 'right');
                      setOpenMenuTrackId((current) =>
                        current === track.id ? '' : track.id,
                      );
                    }}
                    type="button"
                  >
                    <ActionIcon name="more" />
                  </button>

                  {openMenuTrackId === track.id ? (
                    <div
                      className={`track-action-menu pop-${menuDirection} align-${menuAlign}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          onPlayNext(track.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="play-next" />
                        Play next
                      </button>
                      <button
                        onClick={() => {
                          onAddToQueue(track.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="queue-add" />
                        Add to queue
                      </button>
                      <button
                        onClick={() => {
                          onShareTrack(track);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="share" />
                        Share
                      </button>
                      <button
                        disabled={!artist}
                        onClick={() => {
                          if (artist) {
                            onSelectArtist(artist.id);
                          }
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="artist" />
                        Go to artist
                      </button>
                      <button
                        disabled={!album}
                        onClick={() => {
                          if (album) {
                            onSelectAlbum(album.id);
                          }
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="album" />
                        Go to album
                      </button>
                      <button
                        disabled={!singer}
                        onClick={() => {
                          if (singer) onSelectSinger?.(singer.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="artist" />
                        Go to singer
                      </button>
                      <button
                        disabled={!lyricist}
                        onClick={() => {
                          if (lyricist) onSelectLyricist?.(lyricist.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="artist" />
                        Go to lyricist
                      </button>
                      <div className="menu-playlist-control">
                        <label>
                          <span>Add to playlist</span>
                          <select
                            disabled={!playlists.length}
                            onChange={(event) =>
                              setMenuPlaylistIdByTrackId((current) => ({
                                ...current,
                                [track.id]: event.target.value,
                              }))
                            }
                            value={menuPlaylistId}
                          >
                            {playlists.length ? (
                              playlists.map((playlist) => (
                                <option key={playlist.id} value={playlist.id}>
                                  {playlist.name}
                                </option>
                              ))
                            ) : (
                              <option value="">Create playlist first</option>
                            )}
                          </select>
                        </label>
                        <button
                          disabled={!playlists.length}
                          onClick={() => {
                            onSaveTrackToPlaylist(track.id, menuPlaylistId);
                            setOpenMenuTrackId('');
                          }}
                          type="button"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              );
            })}
            {!tracks.length ? (
              <div className="empty-state">No tracks match your search.</div>
            ) : null}
          </div>
          ) : (
            <div className="track-grid">
              {tracks.map((track) => {
                const menuPlaylistId =
                  menuPlaylistIdByTrackId[track.id] ??
                  addToPlaylistId ??
                  playlists[0]?.id ??
                  '';
                const artist = artists.find(
                  (candidate) => candidate.name === track.artist,
                );
                const album = albums.find(
                  (candidate) =>
                    candidate.title === track.album &&
                    candidate.artist === track.artist,
                );
                const singer = singers?.find((s) => s.id === track.singerId);
                const lyricist = lyricists?.find((l) => l.id === track.lyricistId);

                return (
                <div
                  className={`track-grid-card ${selectedTrackId === track.id ? 'is-selected' : ''}`}
                  key={track.id}
                  onClick={() => onSelectTrack(track.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectTrack(track.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="track-grid-art-wrap">
                    <TrackArtwork track={track} className="track-art" />
                    {selectedTrackId === track.id && isPlaying && (
                      <span className="mini-eq track-grid-eq" aria-label="Playing"><i /><i /><i /></span>
                    )}
                    <button
                      className="track-grid-play"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (selectedTrackId === track.id) {
                          onPlayToggle();
                        } else {
                          onSelectTrack(track.id);
                        }
                      }}
                      type="button"
                      aria-label={`Play ${track.title}`}
                    >
                      <ActionIcon name={selectedTrackId === track.id && isPlaying ? "pause" : "play"} />
                    </button>
                  </div>
                  <div className="track-grid-info">
                    <div className="track-grid-meta">
                      <strong>{track.title}</strong>
                      <small>{track.artist}</small>
                    </div>
                    <div className="track-menu-wrap">
                      <button
                        aria-expanded={openMenuTrackId === track.id}
                        aria-label={`Open actions for ${track.title}`}
                        className="track-menu-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const spaceAbove = rect.top;
                          setMenuDirection(spaceBelow < 320 && spaceAbove >= 280 ? 'up' : 'down');
                          setMenuAlign(rect.left < window.innerWidth / 2 ? 'left' : 'right');
                          setOpenMenuTrackId((current) =>
                            current === track.id ? '' : track.id,
                          );
                        }}
                        type="button"
                      >
                        <ActionIcon name="more" />
                      </button>

                      {openMenuTrackId === track.id ? (
                        <div
                          className={`track-action-menu pop-${menuDirection} align-${menuAlign}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              onPlayNext(track.id);
                              setOpenMenuTrackId('');
                            }}
                            type="button"
                          >
                            <ActionIcon name="play-next" />
                            Play next
                          </button>
                          <button
                            onClick={() => {
                              onAddToQueue(track.id);
                              setOpenMenuTrackId('');
                            }}
                            type="button"
                          >
                            <ActionIcon name="queue-add" />
                            Add to queue
                          </button>
                          <button
                            onClick={() => {
                              onShareTrack(track);
                              setOpenMenuTrackId('');
                            }}
                            type="button"
                          >
                            <ActionIcon name="share" />
                            Share
                          </button>
                          <button
                            disabled={!artist}
                            onClick={() => {
                              if (artist) {
                                onSelectArtist(artist.id);
                              }
                              setOpenMenuTrackId('');
                            }}
                            type="button"
                          >
                            <ActionIcon name="artist" />
                            Go to artist
                          </button>
                          <button
                            disabled={!album}
                            onClick={() => {
                              if (album) {
                                onSelectAlbum(album.id);
                              }
                              setOpenMenuTrackId('');
                            }}
                            type="button"
                          >
                            <ActionIcon name="album" />
                            Go to album
                          </button>
                          <button
                            disabled={!singer}
                            onClick={() => {
                              if (singer) onSelectSinger?.(singer.id);
                              setOpenMenuTrackId('');
                            }}
                            type="button"
                          >
                            <ActionIcon name="artist" />
                            Go to singer
                          </button>
                          <button
                            disabled={!lyricist}
                            onClick={() => {
                              if (lyricist) onSelectLyricist?.(lyricist.id);
                              setOpenMenuTrackId('');
                            }}
                            type="button"
                          >
                            <ActionIcon name="artist" />
                            Go to lyricist
                          </button>
                          <div className="menu-playlist-control">
                            <label>
                              <span>Add to playlist</span>
                              <select
                                disabled={!playlists.length}
                                onChange={(event) =>
                                  setMenuPlaylistIdByTrackId((current) => ({
                                    ...current,
                                    [track.id]: event.target.value,
                                  }))
                                }
                                value={menuPlaylistId}
                              >
                                {playlists.length ? (
                                  playlists.map((playlist) => (
                                    <option key={playlist.id} value={playlist.id}>
                                      {playlist.name}
                                    </option>
                                  ))
                                ) : (
                                  <option value="">Create playlist first</option>
                                )}
                              </select>
                            </label>
                            <button
                              disabled={!playlists.length}
                              onClick={() => {
                                onSaveTrackToPlaylist(track.id, menuPlaylistId);
                                setOpenMenuTrackId('');
                              }}
                              type="button"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
              })}
              {!tracks.length ? (
                <div className="empty-state">No tracks match your search.</div>
              ) : null}
            </div>
          )}
        </section>
      </main>

      {showDownloadModal && (
        <div
          className="dl-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Download Sonik"
          onClick={() => setShowDownloadModal(false)}
        >
          <div className="dl-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="dl-header">
              <div className="dl-brand">
                <span className="brand-mark">
                  <svg viewBox="0 0 1024 1024" width="36" height="36" fill="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="dllg" x1="215" y1="0" x2="809" y2="0" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#f5c15d" />
                        <stop offset="0.5" stopColor="#ff8c69" />
                        <stop offset="1" stopColor="#55d6c2" />
                      </linearGradient>
                    </defs>
                    <rect width="1024" height="1024" rx="236" fill="#120f18" />
                    <rect x="215" y="404" width="90" height="216" rx="45" fill="url(#dllg)" />
                    <rect x="341" y="359" width="90" height="306" rx="45" fill="url(#dllg)" />
                    <rect x="467" y="314" width="90" height="396" rx="45" fill="url(#dllg)" />
                    <rect x="593" y="359" width="90" height="306" rx="45" fill="url(#dllg)" />
                    <rect x="719" y="404" width="90" height="216" rx="45" fill="url(#dllg)" />
                  </svg>
                </span>
                <div>
                  <strong className="dl-brand-name">Sonik</strong>
                  <p className="dl-brand-sub">Get the full experience on any device</p>
                </div>
              </div>
              <button
                className="dl-close"
                type="button"
                onClick={() => setShowDownloadModal(false)}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Platform tabs */}
            <div className="dl-tabs" role="tablist">
              {(['ios', 'android', 'desktop'] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeDownloadTab === tab}
                  className={`dl-tab${activeDownloadTab === tab ? ' is-active' : ''}`}
                  onClick={() => setActiveDownloadTab(tab)}
                  type="button"
                >
                  {tab === 'ios' && (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  )}
                  {tab === 'android' && (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path d="M17.523 15.341 15.5 11.5l2.023-3.841A1 1 0 0 0 16.65 6.5l-2.1 3.99L12 12l-2.55-1.51L7.35 6.5a1 1 0 0 0-1.873 1.159L7.5 11.5l-2.023 3.841a1 1 0 0 0 1.873.818L9.45 12.51 12 14l2.55 1.51 2.1 3.99a1 1 0 0 0 1.873-.818zM8.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                    </svg>
                  )}
                  {tab === 'desktop' && (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                    </svg>
                  )}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* iOS panel */}
            {activeDownloadTab === 'ios' && (
              <div className="dl-panel fade-in-up" role="tabpanel">
                <div className="dl-qr-wrap">
                  <img
                    src={qrUrl('https://apps.apple.com')}
                    alt="QR code for iOS download"
                    className="dl-qr"
                    width="160"
                    height="160"
                  />
                  <p className="dl-qr-hint">Scan with your iPhone camera</p>
                </div>
                <div className="dl-panel-info">
                  <h3>Download on the App Store</h3>
                  <p>Requires iOS 15 or later. Compatible with iPhone and iPad.</p>
                  <a
                    className="dl-store-btn dl-apple-btn"
                    href="https://apps.apple.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    App Store
                  </a>
                </div>
              </div>
            )}

            {/* Android panel */}
            {activeDownloadTab === 'android' && (
              <div className="dl-panel fade-in-up" role="tabpanel">
                <div className="dl-qr-wrap">
                  <img
                    src={qrUrl(EXPO_PROJECT_URL)}
                    alt="QR code for Android download"
                    className="dl-qr"
                    width="160"
                    height="160"
                  />
                  <p className="dl-qr-hint">Scan with your Android camera</p>
                </div>
                <div className="dl-panel-info">
                  <h3>Download for Android</h3>
                  <p>Get the APK directly or find us on the Play Store soon.</p>
                  <div className="dl-btn-row">
                    <a
                      className="dl-store-btn dl-apk-btn"
                      href={ANDROID_APK_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download APK
                    </a>
                    <a
                      className="dl-store-btn dl-play-btn"
                      href="https://play.google.com/store"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="m3 3 18 9-18 9V3z"/>
                      </svg>
                      Google Play
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop panel */}
            {activeDownloadTab === 'desktop' && (
              <div className="dl-panel dl-desktop-panel fade-in-up" role="tabpanel">
                <div className="dl-desktop-graphic" aria-hidden="true">
                  <svg viewBox="0 0 80 60" width="80" height="60" fill="none">
                    <rect x="4" y="4" width="72" height="44" rx="5" fill="var(--surface-raised)" stroke="var(--border-strong)" strokeWidth="1.5"/>
                    <rect x="10" y="10" width="60" height="32" rx="3" fill="var(--bg)"/>
                    <rect x="30" y="50" width="20" height="3" rx="1.5" fill="var(--border-strong)"/>
                    <rect x="14" y="14" width="24" height="24" rx="3" fill="var(--surface-warm)" opacity=".6"/>
                    <rect x="44" y="14" width="20" height="6" rx="2" fill="var(--border-strong)" opacity=".5"/>
                    <rect x="44" y="24" width="14" height="4" rx="2" fill="var(--border-strong)" opacity=".35"/>
                    <rect x="44" y="32" width="16" height="4" rx="2" fill="var(--border-strong)" opacity=".35"/>
                  </svg>
                </div>
                <div className="dl-panel-info">
                  <h3>Install on Desktop</h3>
                  <p>Install Sonik as a Progressive Web App for a native-like experience — no browser chrome, works offline.</p>
                  {pwaPrompt ? (
                    <button
                      className="dl-store-btn dl-pwa-btn"
                      type="button"
                      onClick={handleInstallPWA}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Install App
                    </button>
                  ) : (
                    <p className="dl-pwa-hint">
                      Open Sonik in <strong>Chrome</strong> or <strong>Edge</strong>, then click the install icon in the address bar.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <aside className="right-rail" aria-label="Listening queue">
        <section className="rail-section">
          <div className="section-heading">
            <h2>{t('upNext')}</h2>
            <button type="button">{queueItems.length ? 'Queue' : 'View'}</button>
          </div>
          <div className="queue-list">
            {(queuedTracks.length
              ? queuedTracks
              : tracks.filter((track) => track.id !== selectedTrack.id)
            )
              .slice(0, 4)
              .map((track) => (
                <button
                  className="queue-item"
                  key={track.id}
                  onClick={() => onSelectTrack(track.id)}
                  type="button"
                >
                  <TrackArtwork track={track} className="row-art" />
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                </button>
              ))}
          </div>
        </section>

        <section className="rail-section listener-card">
          <p className="section-kicker">{t('source')}</p>
          <h2>{selectedPlaylist?.name ?? selectedSourceLabel}</h2>
          <p>
            {selectedPlaylist
              ? `${selectedPlaylist.trackCount} saved tracks`
              : `${tracks.length} available tracks`}
          </p>
          {selectedPlaylist ? (
            <button
              className="subtle-action full-width"
              onClick={() =>
                onRemoveFromPlaylist(selectedPlaylist.id, selectedTrack.id)
              }
              type="button"
            >
              Remove current
            </button>
          ) : null}
        </section>

<section className="rail-section listener-card">
          <p className="section-kicker">{t('listeningAs')}</p>
          <h2>{session.user.profileName}</h2>
          <p>{session.user.email}</p>
          {session.user.role === 'admin' ? (
            <span className="role-badge">Admin</span>
          ) : null}
          {session.user.role === 'admin' ? (
            <div className='margin-top'>
            <button
              className="subtle-action full-width"
              onClick={onOpenAdmin}
              type="button"
            >
              Admin panel
            </button>
            </div>
          ) : null}
        </section>
      </aside>

      {showSettings && (
        <div className="settings-screen-overlay">
          <div className="settings-screen">
            <header className="settings-header">
              <h1>Settings</h1>
              <button className="close-settings" onClick={() => setShowSettings(false)}>✕</button>
            </header>

            <div className="settings-content">
              <div className="settings-grid">
                <section className="settings-section avatar-section">
                  <h3>{t('avatar')}</h3>
                  <div className="avatar-edit-container">
                    <div className="profile-avatar-wrap-large">
                       {session.user.avatarUrl ? (
                        <img
                          src={session.user.avatarUrl.startsWith('http') ? session.user.avatarUrl : `${apiBaseUrl}/uploads/avatars/${session.user.avatarUrl}`}
                          alt={session.user.profileName}
                          className="profile-avatar-img-large"
                        />
                      ) : (
                        <span className="profile-avatar-fallback-large">{session.user.profileName.charAt(0).toUpperCase()}</span>
                      )}
                      <button className="change-avatar-overlay" onClick={() => avatarInputRef.current?.click()}>
                        📷 Change
                      </button>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setProfileMessage(''); // Clear previous messages
                        try {
                          await onUploadAvatar(file);
                          setProfileMessage('Avatar updated successfully!');
                        } catch {
                          setProfileMessage('Failed to upload avatar.');
                        }
                      }}
                    />
                    <div className="user-basics">
                      <h2>{session.user.profileName}</h2>
                      <p>{session.user.email}</p>
                    </div>
                  </div>
                </section>

                <section className="settings-section">
                  <h3>{t('general')}</h3>
                  <div className="form-grid">
                    <div className="field-group">
                      <label>{t('displayName')}</label>
                      <input
                        type="text"
                        value={profileForm.profileName}
                        onChange={(e) => setProfileForm({ ...profileForm, profileName: e.target.value })}
                      />
                    </div>
                    <div className="field-group">
                      <label>{t('birthday')}</label>
                      <input
                        type="date"
                        value={profileForm.birthday}
                        onChange={(e) => setProfileForm({ ...profileForm, birthday: e.target.value })}
                      />
                    </div>
                    <div className="field-group">
                      <label>{t('language')}</label>
                      <select
                        value={profileForm.language}
                        onChange={(e) => {
                          setProfileForm({ ...profileForm, language: e.target.value });
                          setProfileMessage(''); // Clear message on change
                        }}
                      >
                        <option value="en">English</option>
                        <option value="ta">Tamil</option>
                        <option value="hi">Hindi</option>
                        <option value="te">Telugu</option>
                        <option value="ml">Malayalam</option>
                        <option value="kn">Kannada</option>
                      </select>
                      <small className="field-hint">Your language preference for the Sonik interface.</small>
                    </div>
                  </div>
                  <button
                    className="save-settings-btn"
                    onClick={async () => {
                      setProfileSaving(true);
                      setProfileMessage('');
                      try {
                        await onUpdateProfile(profileForm);
                        setProfileMessage('Profile updated successfully! ✨');
                        setTimeout(() => {
                           setShowSettings(false);
                           setProfileMessage('');
                        }, 1500);
                      } catch {
                        setProfileMessage('Error: Could not update profile.');
                      } finally {
                        setProfileSaving(false);
                      }
                    }}
                    disabled={profileSaving}
                  >
                    {profileSaving ? 'Saving...' : t('saveProfile')}
                  </button>
                  {profileMessage && (
                    <p className={`feedback-message ${profileMessage.includes('Error') ? 'error' : 'success'}`}>
                      {profileMessage}
                    </p>
                  )}
                </section>

                <section className="settings-section">
                  <h3>{t('security')}</h3>
                  <div className="form-grid">
                    <div className="field-group">
                      <label>Current Password</label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      />
                    </div>
                    <div className="field-group">
                      <label>New Password</label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="field-group">
                      <label>Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    className="save-settings-btn"
                    onClick={async () => {
                      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                        setPasswordMessage('Passwords do not match.');
                        return;
                      }
                      try {
                        await onChangePassword(passwordForm.currentPassword, passwordForm.newPassword);
                        setPasswordMessage('Password changed successfully!');
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      } catch {
                        setPasswordMessage('Error changing password.');
                      }
                    }}
                    disabled={!passwordForm.currentPassword || !passwordForm.newPassword}
                  >
                    {t('changePassword')}
                  </button>
                  {passwordMessage && <p className="feedback-message">{passwordMessage}</p>}
                </section>

                <section className="settings-section danger-zone">
                  <h3>{t('dangerZone')}</h3>
                  <p>Permanently delete your account and all data.</p>
                  <button className="delete-account-btn" onClick={onDeleteAccount}>
                    {t('deleteAccount')}
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className={`nowbar${isPlaying ? ' is-playing' : ''}`} aria-label="Playback controls">
        <div className="nowbar-track">
          <TrackArtwork track={selectedTrack} className="row-art" />
          <div className="nowbar-track-info">
            <span>
              <strong>{selectedTrack.title}</strong>
              <small>{selectedTrack.artist}</small>
            </span>
          {(() => {
            const track = selectedTrack;
            const menuPlaylistId =
              menuPlaylistIdByTrackId[track.id] ??
              addToPlaylistId ??
              playlists[0]?.id ??
              '';
            const artist = artists.find(
              (candidate) => candidate.name === track.artist,
            );
            const album = albums.find(
              (candidate) =>
                candidate.title === track.album &&
                candidate.artist === track.artist,
            );
            const singer = singers?.find((s) => s.id === track.singerId);
            const lyricist = lyricists?.find((l) => l.id === track.lyricistId);
            return (
                <div className="nowbar-menu-wrap track-menu-wrap">
                  <button
                    aria-expanded={openMenuTrackId === track.id + '-nowbar'}
                    aria-label={`Open actions for ${track.title}`}
                    className="track-menu-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      const spaceAbove = rect.top;
                      setMenuDirection(spaceBelow < 320 && spaceAbove >= 280 ? 'up' : 'down');
                      setOpenMenuTrackId((current) =>
                        current === track.id + '-nowbar' ? '' : track.id + '-nowbar',
                      );
                    }}
                    type="button"
                  >
                    <ActionIcon name="more-vertical" />
                  </button>

                  {openMenuTrackId === track.id + '-nowbar' ? (
                    <div
                      className="track-action-menu pop-up"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          onPlayNext(track.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="play-next" />
                        Play next
                      </button>
                      <button
                        onClick={() => {
                          onAddToQueue(track.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="queue-add" />
                        Add to queue
                      </button>
                      <button
                        onClick={() => {
                          onShareTrack(track);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="share" />
                        Share
                      </button>
                      <button
                        disabled={!artist}
                        onClick={() => {
                          if (artist) {
                            onSelectArtist(artist.id);
                          }
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="artist" />
                        Go to artist
                      </button>
                      <button
                        disabled={!album}
                        onClick={() => {
                          if (album) {
                            onSelectAlbum(album.id);
                          }
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="album" />
                        Go to album
                      </button>
                      <button
                        disabled={!singer}
                        onClick={() => {
                          if (singer) onSelectSinger?.(singer.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="artist" />
                        Go to singer
                      </button>
                      <button
                        disabled={!lyricist}
                        onClick={() => {
                          if (lyricist) onSelectLyricist?.(lyricist.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="artist" />
                        Go to lyricist
                      </button>
                      <div className="menu-playlist-control">
                        <label>
                          <span>Add to playlist</span>
                          <select
                            disabled={!playlists.length}
                            onChange={(event) =>
                              setMenuPlaylistIdByTrackId((current) => ({
                                ...current,
                                [track.id]: event.target.value,
                              }))
                            }
                            value={menuPlaylistId}
                          >
                            {playlists.length ? (
                              playlists.map((playlist) => (
                                <option key={playlist.id} value={playlist.id}>
                                  {playlist.name}
                                </option>
                              ))
                            ) : (
                              <option value="">Create playlist first</option>
                            )}
                          </select>
                        </label>
                        <button
                          disabled={!playlists.length}
                          onClick={() => {
                            onSaveTrackToPlaylist(track.id, menuPlaylistId);
                            setOpenMenuTrackId('');
                          }}
                          type="button"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
            );
          })()}
          </div>
        </div>

        <PlayerControls
          trackId={selectedTrackId}
          progress={progress}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          onProgressChange={onProgressChange}
          onPlayToggle={onPlayToggle}
          onNext={onNext}
          onPrevious={onPrevious}
          onShuffleToggle={onShuffleToggle}
          onRepeatToggle={onRepeatToggle}
        />

        <div className="volume-control">
          <IconButton
            label={isMuted ? 'Unmute' : 'Mute'}
            icon={isMuted ? 'icon-mute' : 'icon-volume'}
            onClick={handleMuteToggle}
          />
          <input
            aria-label="Volume"
            max="100"
            min="0"
            onChange={(event) => {
              const val = Number(event.target.value);
              if (preMuteVolume !== null) setPreMuteVolume(null);
              onVolumeChange(val);
            }}
            type="range"
            value={volume}
            style={{ '--progress': `${volume}%` } as React.CSSProperties}
          />
        </div>
      </footer>
    </div>
  );
}
