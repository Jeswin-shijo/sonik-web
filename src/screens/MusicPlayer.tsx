import { RefObject, useState } from 'react';
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
} from '../types';
import { ActionIcon } from '../components/ActionIcon';
import { IconButton } from '../components/IconButton';
import { PlayerControls } from '../components/PlayerControls';
import { ThemeToggle } from '../components/ThemeToggle';
import { TrackArtwork } from '../components/TrackArtwork';

export function MusicPlayer({
  session,
  audioRef,
  tracks,
  favoriteTrackIds,
  playlists,
  artists,
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
  themeMode,
  onThemeToggle,
}: {
  session: SessionState;
  audioRef: RefObject<HTMLAudioElement | null>;
  tracks: MusicTrack[];
  favoriteTrackIds: string[];
  playlists: PlaylistSummary[];
  artists: ArtistSummary[];
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
  themeMode: ThemeMode;
  onThemeToggle: () => void;
}) {
  const [openMenuTrackId, setOpenMenuTrackId] = useState('');
  const [menuPlaylistIdByTrackId, setMenuPlaylistIdByTrackId] = useState<
    Record<string, string>
  >({});
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
            aria-label="Search songs, artists, albums, or moods"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search songs, artists, albums"
            value={searchQuery}
          />
        </label>

        <ThemeToggle themeMode={themeMode} onToggle={onThemeToggle} />

        <div className="account-menu">
          <span className="avatar">{session.user.profileName.charAt(0).toUpperCase()}</span>
          <span>{session.user.profileName}</span>
          <button onClick={onLogout} type="button">
            Log out
          </button>
        </div>
      </header>

      <aside className="control-rail" aria-label="Primary">
        <nav className="nav-stack">
          {[
            ['Home', 'library'],
            ['Liked', 'favorites'],
            ['Recent', 'recent'],
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
          <p className="section-kicker">Crates</p>
          <button
            className={`playlist-link ${
              selectedPlaylistId === 'library' ? 'is-active' : ''
            }`}
            onClick={() => onSelectPlaylist('library')}
            type="button"
          >
            Library
          </button>
          <button
            className={`playlist-link ${
              selectedPlaylistId === 'favorites' ? 'is-active' : ''
            }`}
            onClick={() => onSelectPlaylist('favorites')}
            type="button"
          >
            Liked Songs
          </button>
          <button
            className={`playlist-link ${
              selectedPlaylistId === 'recent' ? 'is-active' : ''
            }`}
            onClick={() => onSelectPlaylist('recent')}
            type="button"
          >
            Recent Plays
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
            Create playlist
          </button>
        </div>

        <section className="pulse-card">
          <p className="section-kicker">Library pulse</p>
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
            <p className="section-kicker">Playing from {selectedSourceLabel}</p>
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
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                className={`subtle-action ${isFavorite ? 'is-active' : ''}`}
                onClick={() => onToggleFavorite(selectedTrack.id)}
                type="button"
              >
                <ActionIcon name={isFavorite ? 'heart-filled' : 'heart'} />
                {isFavorite ? 'Liked' : 'Like'}
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

        {artists.length ? (
          <section className="content-section" aria-labelledby="artists-heading">
            <div className="section-heading">
              <h2 id="artists-heading">Artists</h2>
              <span className="section-count">
                {artists.length} {artists.length === 1 ? 'artist' : 'artists'}
              </span>
            </div>
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
          </section>
        ) : null}

        {albums.length ? (
          <section className="content-section" aria-labelledby="albums-heading">
            <div className="section-heading">
              <h2 id="albums-heading">Albums</h2>
              <span className="section-count">
                {albums.length} {albums.length === 1 ? 'album' : 'albums'}
              </span>
            </div>
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
                        coverClass: sampleTrack?.coverClass ?? 'cover-summer',
                        coverUrl: sampleTrack?.coverUrl ?? null,
                      }}
                    />
                    <h3>{album.title}</h3>
                    <p>
                      {album.artist} ·{' '}
                      {album.trackCount}{' '}
                      {album.trackCount === 1 ? 'track' : 'tracks'}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="content-section" aria-labelledby="tracks-heading">
          <div className="section-heading">
            <h2 id="tracks-heading">Track runway</h2>
            <button type="button">{tracks.length} tracks</button>
          </div>
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
                  {favoriteTrackIds.includes(track.id) ? 'Liked' : 'Like'}
                </button>
                <div className="track-menu-wrap">
                  <button
                    aria-expanded={openMenuTrackId === track.id}
                    aria-label={`Open actions for ${track.title}`}
                    className="track-menu-button"
                    onClick={(event) => {
                      event.stopPropagation();
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
                      className="track-action-menu"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          onPlayNext(track.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="queue" />
                        Play next
                      </button>
                      <button
                        onClick={() => {
                          onAddToQueue(track.id);
                          setOpenMenuTrackId('');
                        }}
                        type="button"
                      >
                        <ActionIcon name="queue" />
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
        </section>
      </main>

      <aside className="right-rail" aria-label="Listening queue">
        <section className="rail-section">
          <div className="section-heading">
            <h2>Up next</h2>
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
          <p className="section-kicker">Source</p>
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
          <p className="section-kicker">Listening as</p>
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
            Delete Account
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

      <footer className="nowbar" aria-label="Playback controls">
        <div className="nowbar-track">
          <TrackArtwork track={selectedTrack} className="row-art" />
          <span>
            <strong>{selectedTrack.title}</strong>
            <small>{selectedTrack.artist}</small>
          </span>
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
