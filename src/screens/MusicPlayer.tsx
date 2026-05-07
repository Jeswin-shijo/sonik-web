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
  const prompt = usePrompt();
  const audioSource = selectedTrack.streamUrl
    ? `${apiBaseUrl}${selectedTrack.streamUrl}`
    : undefined;

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
          <span className="brand-mark">S</span>
          <span>Sonik</span>
        </a>

        <label className="command-bar" role="search">
          <span className="control-icon icon-search" aria-hidden="true" />
          <input
            aria-label={t('searchPlaceholder')}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
          />
        </label>

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
          <span>{session.user.profileName}</span>

          {profileMenuOpen && (
            <div className="profile-dropdown-menu">
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
                <ActionIcon name="heart" /> {t('settings')}
              </button>
              {session.user.role === 'admin' && (
                <button onClick={() => { setProfileMenuOpen(false); onOpenAdmin(); }} type="button">
                   {t('adminPanel')}
                </button>
              )}
              <hr />
              <button onClick={() => { setProfileMenuOpen(false); onLogout(); }} type="button" className="danger">
                {t('logOut')}
              </button>
            </div>
          )}
        </div>
      </header>

      <aside className="control-rail" aria-label="Primary">
        <nav className="nav-stack">
          {[
            [t('home'), 'library'],
            [t('liked'), 'favorites'],
            [t('recent'), 'recent'],
          ].map(([item, playlistId]) => (
            <button
              className={`nav-item ${
                selectedPlaylistId === playlistId ? 'is-active' : ''
              }`}
              key={item}
              onClick={() => onSelectPlaylist(playlistId)}
              type="button"
            >
              <span className="nav-dot" />
              {item}
            </button>
          ))}
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
          <div className="pulse-stat-row">
            <span>{favoriteTrackIds.length} liked</span>
            <span>{likedPercent}%</span>
          </div>
        </section>
      </aside>

      <main className="music-main">
        <section className="signal-deck" aria-labelledby="hero-title">
          <div className="deck-art-wrap">
            <TrackArtwork track={selectedTrack} className="hero-art" />
            <span className="orbit-ring" />
          </div>

          <div className="deck-copy">
            <p className="section-kicker">{t('playingFrom')} {selectedSourceLabel}</p>
            <h1 id="hero-title">{selectedTrack.title}</h1>
            <p>
              {selectedTrack.artist} - {selectedTrack.album}
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
                      className={`mix-card${isActive ? ' is-active' : ''}`}
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
                      className={`mix-card${isActive ? ' is-active' : ''}`}
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
                      <div className="menu-playlist-control">
                        <label>
                          <span>Save to playlist</span>
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
                          <div className="menu-playlist-control">
                            <label>
                              <span>Save to playlist</span>
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
          <button
            className="subtle-action full-width danger"
            onClick={onDeleteAccount}
            type="button"
          >
            {t('deleteAccount')}
          </button>
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

      <footer className="nowbar" aria-label="Playback controls">
        <div className="nowbar-track">
          <TrackArtwork track={selectedTrack} className="row-art" />
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
                      <div className="menu-playlist-control">
                        <label>
                          <span>Save to playlist</span>
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

        <PlayerControls
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
          <IconButton label="Volume" icon="icon-volume" />
          <input
            aria-label="Volume"
            max="100"
            min="0"
            onChange={(event) => onVolumeChange(Number(event.target.value))}
            type="range"
            value={volume}
          />
        </div>
      </footer>
    </div>
  );
}
