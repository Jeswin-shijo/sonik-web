import { FormEvent, RefObject } from 'react';
import { apiBaseUrl } from '../config';
import { mixes } from '../data/mixes';
import { formatSeconds, getDurationLabel, isUsableDuration } from '../helpers/time';
import type { MusicTrack, PlaylistSummary, RepeatMode, SessionState } from '../types';
import { ActionIcon } from '../components/ActionIcon';
import { IconButton } from '../components/IconButton';
import { PlayerControls } from '../components/PlayerControls';
import { TrackArtwork } from '../components/TrackArtwork';

export function MusicPlayer({
  session,
  audioRef,
  tracks,
  favoriteTrackIds,
  playlists,
  selectedPlaylistId,
  addToPlaylistId,
  playlistName,
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
  onPlaylistNameChange,
  onSearchChange,
  onAddToPlaylistTargetChange,
  onCreatePlaylist,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onToggleFavorite,
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
}: {
  session: SessionState;
  audioRef: RefObject<HTMLAudioElement | null>;
  tracks: MusicTrack[];
  favoriteTrackIds: string[];
  playlists: PlaylistSummary[];
  selectedPlaylistId: string;
  addToPlaylistId: string;
  playlistName: string;
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
  onPlaylistNameChange: (name: string) => void;
  onSearchChange: (query: string) => void;
  onAddToPlaylistTargetChange: (playlistId: string) => void;
  onCreatePlaylist: (event: FormEvent<HTMLFormElement>) => void;
  onAddToPlaylist: () => void;
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => void;
  onToggleFavorite: (trackId: string) => void;
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
}) {
  const audioSource = selectedTrack.streamUrl
    ? `${apiBaseUrl}${selectedTrack.streamUrl}`
    : undefined;
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
  const trackSourceLabel = selectedPlaylist
    ? selectedPlaylist.name
    : isFavorite
      ? 'Liked Songs'
      : 'Library';

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
            placeholder="Search songs, artists, moods"
            value={searchQuery}
          />
        </label>

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

        <form className="playlist-create" onSubmit={onCreatePlaylist}>
          <input
            aria-label="Playlist name"
            onChange={(event) => onPlaylistNameChange(event.target.value)}
            placeholder="New playlist"
            value={playlistName}
          />
          <button type="submit">
            <ActionIcon name="plus" />
            Create
          </button>
        </form>

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
            <p className="section-kicker">Playing from {trackSourceLabel}</p>
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

        <section className="content-section" aria-labelledby="mixes-heading">
          <div className="section-heading">
            <h2 id="mixes-heading">Signal blends</h2>
            <button type="button">Refresh</button>
          </div>
          <div className="mix-grid">
            {mixes.map((mix) => (
              <article className="mix-card" key={mix.title}>
                <TrackArtwork
                  track={{ title: mix.title, coverClass: mix.coverClass }}
                />
                <h3>{mix.title}</h3>
                <p>{mix.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section" aria-labelledby="tracks-heading">
          <div className="section-heading">
            <h2 id="tracks-heading">Track runway</h2>
            <button type="button">{tracks.length} tracks</button>
          </div>
          <div className="track-table">
            {tracks.map((track, index) => (
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
              </div>
            ))}
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
          </div>
          <div className="queue-list">
            {tracks
              .filter((track) => track.id !== selectedTrack.id)
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
          <p className="section-kicker">Playlist</p>
          <h2>{selectedPlaylist?.name ?? 'Library'}</h2>
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
