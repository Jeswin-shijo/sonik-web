import { CredentialResponse, GoogleOAuthProvider } from '@react-oauth/google';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getFriendlyError, requestJson } from './api/client';
import { apiBaseUrl, googleClientId, sessionStorageKey } from './config';
import { fallbackTracks } from './data/fallbackTracks';
import { formatSeconds, getDurationLabel, isUsableDuration } from './helpers/time';
import { AuthForms } from './components/AuthForms';
import { ConfirmProvider, useConfirm } from './components/ConfirmDialog';
import { AccessScreen } from './screens/AccessScreen';
import { AdminScreen } from './screens/AdminScreen';
import { MusicPlayer } from './screens/MusicPlayer';
import type {
  AuthResponse,
  AuthView,
  AlbumsResponse,
  AlbumSummary,
  ArtistsResponse,
  ArtistSummary,
  ForgotPasswordResponse,
  MusicTrack,
  PlaylistResponse,
  PlaylistSummary,
  PlaylistsResponse,
  QueueActionResponse,
  QueueItemSummary,
  QueueResponse,
  RepeatMode,
  SessionState,
  SessionUser,
  ThemeMode,
  TracksResponse,
} from './types';
import './App.css';

const themeStorageKey = 'sonik-theme-mode';

function getInitialThemeMode(): ThemeMode {
  const storedTheme = localStorage.getItem(themeStorageKey);

  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function buildArtistsFromTracks(tracks: MusicTrack[]): ArtistSummary[] {
  const artistsByName = new Map<string, MusicTrack[]>();

  tracks.forEach((track) => {
    const artistTracks = artistsByName.get(track.artist) ?? [];
    artistTracks.push(track);
    artistsByName.set(track.artist, artistTracks);
  });
  const artists: ArtistSummary[] = [];
  let index = 0;

  artistsByName.forEach((artistTracks, name) => {
    artists.push({
      id: `artist-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      trackCount: artistTracks.length,
      albumCount: new Set(artistTracks.map((track) => track.album)).size,
      tracks: artistTracks,
    });
    index += 1;
  });

  return artists.sort((first, second) => first.name.localeCompare(second.name));
}

function buildAlbumsFromTracks(tracks: MusicTrack[]): AlbumSummary[] {
  const albumsByKey = new Map<string, MusicTrack[]>();

  tracks.forEach((track) => {
    const key = `${track.album}\u0000${track.artist}`;
    const albumTracks = albumsByKey.get(key) ?? [];
    albumTracks.push(track);
    albumsByKey.set(key, albumTracks);
  });
  const albums: AlbumSummary[] = [];
  let index = 0;

  albumsByKey.forEach((albumTracks, key) => {
    const [title, artist] = key.split('\u0000');

    albums.push({
      id: `album-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title,
      artist,
      trackCount: albumTracks.length,
      tracks: albumTracks,
    });
    index += 1;
  });

  return albums.sort((first, second) => first.title.localeCompare(second.title));
}

function AppContent() {
  const confirm = useConfirm();
  const [view, setView] = useState<AuthView>('login');
  const [session, setSession] = useState<SessionState | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>(fallbackTracks);
  const [libraryTracks, setLibraryTracks] = useState<MusicTrack[]>(fallbackTracks);
  const [favoriteTracks, setFavoriteTracks] = useState<MusicTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [artists, setArtists] = useState<ArtistSummary[]>(
    buildArtistsFromTracks(fallbackTracks),
  );
  const [albums, setAlbums] = useState<AlbumSummary[]>(
    buildAlbumsFromTracks(fallbackTracks),
  );
  const [queueItems, setQueueItems] = useState<QueueItemSummary[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('library');
  const [addToPlaylistId, setAddToPlaylistId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [durationByTrackId, setDurationByTrackId] = useState<Record<string, string>>({});
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState(fallbackTracks[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(76);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [registerForm, setRegisterForm] = useState({
    profileName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [resetForm, setResetForm] = useState({
    newPassword: '',
  });
  const [otpForm, setOtpForm] = useState({
    email: '',
    otp: '',
  });
  const [otpStep, setOtpStep] = useState<'email' | 'verify'>('email');
  const [isAdminViewOpen, setIsAdminViewOpen] = useState(false);

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedTrackId) ?? tracks[0],
    [selectedTrackId, tracks],
  );
  const visibleTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return tracks;
    }

    return tracks.filter((track) =>
      [track.title, track.artist, track.album, track.mood]
        .join(' ')
        .toLowerCase()
        .includes(query),
      );
  }, [searchQuery, tracks]);
  const selectedSourceLabel = useMemo(() => {
    if (selectedPlaylistId.startsWith('artist:')) {
      const artist = artists.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(7),
      );

      return artist ? `Artist: ${artist.name}` : 'Artist';
    }

    if (selectedPlaylistId.startsWith('album:')) {
      const album = albums.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(6),
      );

      return album ? `Album: ${album.title}` : 'Album';
    }

    if (selectedPlaylistId === 'favorites') {
      return 'Liked Songs';
    }

    if (selectedPlaylistId === 'recent') {
      return 'Recent Plays';
    }

    const selectedPlaylist = playlists.find(
      (playlist) => playlist.id === selectedPlaylistId,
    );

    return selectedPlaylist?.name ?? 'Library';
  }, [albums, artists, playlists, selectedPlaylistId]);

  useEffect(() => {
    if (!visibleTracks.length) {
      return;
    }

    if (!visibleTracks.some((track) => track.id === selectedTrackId)) {
      setSelectedTrackId(visibleTracks[0].id);
      setIsPlaying(false);
    }
  }, [selectedTrackId, visibleTracks]);

  useEffect(() => {
    const tracksNeedingRuntime = libraryTracks.filter(
      (track) => track.streamUrl && !durationByTrackId[track.id],
    );

    if (!tracksNeedingRuntime.length) {
      return undefined;
    }

    let isCancelled = false;
    const loadedAudio: HTMLAudioElement[] = [];

    tracksNeedingRuntime.forEach((track) => {
      const audio = new Audio(`${apiBaseUrl}${track.streamUrl}`);
      loadedAudio.push(audio);
      audio.preload = 'metadata';
      audio.addEventListener('loadedmetadata', () => {
        if (isCancelled || !isUsableDuration(audio.duration)) {
          return;
        }

        setDurationByTrackId((current) => ({
          ...current,
          [track.id]: getDurationLabel(formatSeconds(audio.duration)),
        }));
      });
      audio.load();
    });

    return () => {
      isCancelled = true;
      loadedAudio.forEach((audio) => {
        audio.src = '';
      });
    };
  }, [durationByTrackId, libraryTracks]);

  async function loadLibraryTracks(resetPlayback = false) {
    try {
      const [tracksPayload, artistsPayload, albumsPayload] = await Promise.all([
        requestJson<TracksResponse>('/tracks'),
        requestJson<ArtistsResponse>('/tracks/artists').catch(() => null),
        requestJson<AlbumsResponse>('/tracks/albums').catch(() => null),
      ]);

      if (!tracksPayload.tracks.length) {
        return;
      }

      setLibraryTracks(tracksPayload.tracks);
      setTracks(tracksPayload.tracks);
      setArtists(
        artistsPayload?.artists.length
          ? artistsPayload.artists
          : buildArtistsFromTracks(tracksPayload.tracks),
      );
      setAlbums(
        albumsPayload?.albums.length
          ? albumsPayload.albums
          : buildAlbumsFromTracks(tracksPayload.tracks),
      );

      if (resetPlayback) {
        setSelectedTrackId(tracksPayload.tracks[0].id);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
      }
    } catch {
      setNoticeMessage('Local tracks could not be loaded from the backend yet.');
    }
  }

  useEffect(() => {
    void loadLibraryTracks(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

useEffect(() => {
    if (!session) {
      return;
    }

    void refreshPersonalLibrary(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (view === 'login') {
      setOtpStep('email');
      setOtpForm({ email: '', otp: '' });
    }
  }, [view]);

  useEffect(() => {
    if (selectedPlaylistId.startsWith('artist:')) {
      const artist = artists.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(7),
      );
      setTracks(artist?.tracks.length ? artist.tracks : libraryTracks);
      return;
    }

    if (selectedPlaylistId.startsWith('album:')) {
      const album = albums.find(
        (candidate) => candidate.id === selectedPlaylistId.slice(6),
      );
      setTracks(album?.tracks.length ? album.tracks : libraryTracks);
      return;
    }

    if (selectedPlaylistId === 'library') {
      setTracks(libraryTracks);
      return;
    }

    if (selectedPlaylistId === 'favorites') {
      setTracks(favoriteTracks.length ? favoriteTracks : libraryTracks);
      return;
    }

    if (selectedPlaylistId === 'recent') {
      setTracks(recentTracks.length ? recentTracks : libraryTracks);
      return;
    }

    const selectedPlaylist = playlists.find(
      (playlist) => playlist.id === selectedPlaylistId,
    );
    setTracks(selectedPlaylist?.tracks.length ? selectedPlaylist.tracks : libraryTracks);
  }, [
    favoriteTracks,
    albums,
    artists,
    libraryTracks,
    playlists,
    recentTracks,
    selectedPlaylistId,
  ]);

  useEffect(() => {
    if (!playlists.length) {
      setAddToPlaylistId('');
      return;
    }

    if (!playlists.some((playlist) => playlist.id === addToPlaylistId)) {
      setAddToPlaylistId(playlists[0].id);
    }
  }, [addToPlaylistId, playlists]);

  useEffect(() => {
    const storedSession = localStorage.getItem(sessionStorageKey);

    if (!storedSession) {
      setIsBootstrapping(false);
      return;
    }

    const parsedSession = JSON.parse(storedSession) as SessionState;

    void requestJson<{ user: SessionUser }>('/auth/me', {
      headers: {
        Authorization: `Bearer ${parsedSession.accessToken}`,
      },
    })
      .then((payload) => {
        setSession({
          ...parsedSession,
          user: payload.user,
        });
      })
      .catch(() => {
        localStorage.removeItem(sessionStorageKey);
      })
      .finally(() => {
        setIsBootstrapping(false);
      });
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(themeStorageKey, themeMode);
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !selectedTrack) {
      return;
    }

    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setProgress(0);
  }, [selectedTrack?.id, selectedTrack?.streamUrl]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !selectedTrack?.streamUrl) {
      return;
    }

    if (isPlaying) {
      void audio.play().catch(() => setIsPlaying(false));
      return;
    }

    audio.pause();
  }, [isPlaying, selectedTrack?.streamUrl]);

  function persistSession(nextSession: SessionState) {
    localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function authHeaders(activeSession = session): Record<string, string> {
    return activeSession
      ? {
          Authorization: `Bearer ${activeSession.accessToken}`,
        }
      : {};
  }

  async function requestAuthorizedJson<T>(
    path: string,
    init?: RequestInit,
    activeSession = session,
  ) {
    return requestJson<T>(path, {
      ...init,
      headers: {
        ...authHeaders(activeSession),
        ...((init?.headers ?? {}) as Record<string, string>),
      },
    });
  }

  async function refreshPersonalLibrary(activeSession = session) {
    if (!activeSession) {
      return;
    }

    const [favoritesPayload, recentPayload, playlistsPayload, queuePayload] =
      await Promise.all([
        requestAuthorizedJson<TracksResponse>(
          '/tracks/favorites/me',
          undefined,
          activeSession,
        ),
        requestAuthorizedJson<TracksResponse>(
          '/tracks/recent/me',
          undefined,
          activeSession,
        ),
        requestAuthorizedJson<PlaylistsResponse>(
          '/playlists',
          undefined,
          activeSession,
        ),
        requestAuthorizedJson<QueueResponse>(
          '/tracks/queue/me',
          undefined,
          activeSession,
        ),
      ]);

    setFavoriteTracks(favoritesPayload.tracks);
    setRecentTracks(recentPayload.tracks);
    setPlaylists(playlistsPayload.playlists);
    setQueueItems(queuePayload.queue);
  }

  function clearFeedback() {
    setErrorMessage('');
    setNoticeMessage('');
  }

  function handleApiError(error: unknown) {
    setErrorMessage(getFriendlyError(error, view));
  }

  function selectTrack(trackId: string, forcePlay = false) {
    if (trackId === selectedTrackId && !forcePlay) {
      setIsPlaying((current) => !current);
      return;
    }

    if (trackId === selectedTrackId && audioRef.current) {
      audioRef.current.currentTime = 0;
    }

    setSelectedTrackId(trackId);
    setIsPlaying(true);
  }

  function selectPlaylist(playlistId: string) {
    setSelectedPlaylistId(playlistId);
    setSearchQuery('');
    setProgress(0);
    setCurrentTime(0);
  }

  function selectArtist(artistId: string) {
    setSelectedPlaylistId(`artist:${artistId}`);
    setSearchQuery('');
    setProgress(0);
    setCurrentTime(0);
  }

  function selectAlbum(albumId: string) {
    setSelectedPlaylistId(`album:${albumId}`);
    setSearchQuery('');
    setProgress(0);
    setCurrentTime(0);
  }

  function selectNextTrack() {
    const queuedItem = queueItems[0];

    if (queuedItem) {
      setQueueItems((current) =>
        current.filter((item) => item.id !== queuedItem.id),
      );
      void requestAuthorizedJson<QueueResponse>(
        `/tracks/queue/${queuedItem.id}`,
        {
          method: 'DELETE',
        },
      )
        .then((payload) => setQueueItems(payload.queue))
        .catch(() => undefined);
      selectTrack(queuedItem.track.id, true);
      return;
    }

    const playbackTracks = visibleTracks.length ? visibleTracks : tracks;

    if (!playbackTracks.length) {
      return;
    }

    if (isShuffle && playbackTracks.length > 1) {
      const nextChoices = playbackTracks.filter(
        (track) => track.id !== selectedTrackId,
      );
      const nextTrack =
        nextChoices[Math.floor(Math.random() * nextChoices.length)];
      selectTrack(nextTrack.id, true);
      return;
    }

    const currentIndex = playbackTracks.findIndex(
      (track) => track.id === selectedTrackId,
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex >= playbackTracks.length && repeatMode === 'off') {
      setIsPlaying(false);
      return;
    }

    const nextTrack = playbackTracks[nextIndex % playbackTracks.length];
    selectTrack(nextTrack.id, true);
  }

  function selectPreviousTrack() {
    const playbackTracks = visibleTracks.length ? visibleTracks : tracks;

    if (!playbackTracks.length) {
      return;
    }

    const currentIndex = playbackTracks.findIndex(
      (track) => track.id === selectedTrackId,
    );
    const previousTrack =
      playbackTracks[
        (currentIndex - 1 + playbackTracks.length) % playbackTracks.length
      ];
    selectTrack(previousTrack.id, true);
  }

  function togglePlayback() {
    if (!selectedTrack?.streamUrl) {
      setErrorMessage('This track does not have a backend audio file yet.');
      return;
    }

    setIsPlaying((current) => !current);
  }

  function toggleRepeatMode() {
    setRepeatMode((current) => (current === 'one' ? 'off' : 'one'));
  }

  function seekToProgress(value: number) {
    const audio = audioRef.current;

    setProgress(value);

    if (!audio || !isUsableDuration(audio.duration)) {
      return;
    }

    audio.currentTime = (value / 100) * audio.duration;
  }

  function syncAudioTime() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setCurrentTime(audio.currentTime);

    if (isUsableDuration(audio.duration)) {
      setDuration(audio.duration);
      setProgress((audio.currentTime / audio.duration) * 100);
    }
  }

  function syncAudioMetadata() {
    const audio = audioRef.current;

    if (!audio || !isUsableDuration(audio.duration)) {
      return;
    }

    setDuration(audio.duration);
  }

  async function toggleFavorite(trackId: string) {
    if (!session) {
      return;
    }

    const isFavorite = favoriteTracks.some((track) => track.id === trackId);

    try {
      if (isFavorite) {
        await requestAuthorizedJson(`/tracks/${trackId}/favorite`, {
          method: 'DELETE',
        });
        setFavoriteTracks((current) =>
          current.filter((track) => track.id !== trackId),
        );
      } else {
        await requestAuthorizedJson(`/tracks/${trackId}/favorite`, {
          method: 'POST',
        });
        const track =
          libraryTracks.find((candidate) => candidate.id === trackId) ??
          tracks.find((candidate) => candidate.id === trackId);

        if (track) {
          setFavoriteTracks((current) => [track, ...current]);
        }
      }
    } catch (error) {
      handleApiError(error);
    }
  }

  async function enqueueTrack(trackId: string, mode: 'next' | 'end') {
    if (!session) {
      return;
    }

    try {
      const payload = await requestAuthorizedJson<QueueActionResponse>(
        `/tracks/${trackId}/queue`,
        {
          method: 'POST',
          body: JSON.stringify({
            mode,
          }),
        },
      );

      setQueueItems(payload.queue);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function shareTrack(track: MusicTrack) {
    const shareText = `${track.title} by ${track.artist} on Sonik`;
    const canShare = typeof navigator.share === 'function';

    if (canShare) {
      await navigator.share({
        title: track.title,
        text: shareText,
      });
      return;
    }

    await navigator.clipboard?.writeText(shareText);
    setNoticeMessage('Track details copied to clipboard.');
  }

  async function saveTrackToPlaylist(trackId: string, playlistId?: string) {
    if (!session || !playlists.length) {
      return;
    }

    const targetPlaylist =
      playlists.find((playlist) => playlist.id === playlistId) ??
      playlists.find((playlist) => playlist.id === addToPlaylistId) ??
      playlists[0];

    if (targetPlaylist.tracks.some((track) => track.id === trackId)) {
      setSelectedPlaylistId(targetPlaylist.id);
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${targetPlaylist.id}/tracks/${trackId}`,
        {
          method: 'POST',
        },
      );

      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === payload.playlist.id ? payload.playlist : playlist,
        ),
      );
      setSelectedPlaylistId(payload.playlist.id);
      setAddToPlaylistId(payload.playlist.id);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createPlaylist(name: string) {
    if (!session) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>('/playlists', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
        }),
      });

      setPlaylists((current) => [payload.playlist, ...current]);
      setSelectedPlaylistId(payload.playlist.id);
      setAddToPlaylistId(payload.playlist.id);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function addSelectedTrackToPlaylist() {
    if (!session || !playlists.length) {
      return;
    }

    const targetPlaylist =
      playlists.find((playlist) => playlist.id === addToPlaylistId) ??
      playlists[0];

    if (targetPlaylist.tracks.some((track) => track.id === selectedTrack?.id)) {
      setSelectedPlaylistId(targetPlaylist.id);
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${targetPlaylist.id}/tracks/${selectedTrack?.id}`,
        {
          method: 'POST',
        },
      );

      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === payload.playlist.id ? payload.playlist : playlist,
        ),
      );
      setSelectedPlaylistId(payload.playlist.id);
      setAddToPlaylistId(payload.playlist.id);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function removeTrackFromPlaylist(playlistId: string, trackId: string) {
    if (!session) {
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${playlistId}/tracks/${trackId}`,
        {
          method: 'DELETE',
        },
      );

      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === payload.playlist.id ? payload.playlist : playlist,
        ),
      );
    } catch (error) {
      handleApiError(error);
    }
  }

  async function recordCurrentPlay(completed: boolean) {
    if (!session || !selectedTrack?.streamUrl) {
      return;
    }

    await requestAuthorizedJson(`/tracks/${selectedTrack?.id}/recent`, {
      method: 'POST',
      body: JSON.stringify({
        progressSeconds: Math.floor(currentTime),
        completed,
      }),
    }).catch(() => undefined);

    await refreshPersonalLibrary().catch(() => undefined);
  }

  function handleTrackEnded() {
    void recordCurrentPlay(true);

    if (repeatMode === 'one') {
      const audio = audioRef.current;

      if (audio) {
        audio.currentTime = 0;
        void audio.play().catch(() => setIsPlaying(false));
      }
      return;
    }

    selectNextTrack();
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });

      persistSession({
        accessToken: payload.accessToken,
        tokenType: payload.tokenType,
        user: payload.user,
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendOtp(email: string, purpose: 'signup' | 'reset') {
    clearFeedback();

    if (purpose === 'signup') {
      if (!registerForm.profileName || !registerForm.password) {
        setErrorMessage('Please fill in all fields.');
        return;
      }
      if (registerForm.password !== registerForm.confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = await requestJson<{ message: string; devOtp?: string }>(
        '/auth/send-otp',
        {
          method: 'POST',
          body: JSON.stringify({ email, purpose }),
        },
      );

      setOtpForm((current) => ({ ...current, email }));
      setOtpStep('verify');
      const devSuffix = payload.devOtp ? ` (dev: ${payload.devOtp})` : '';
      setNoticeMessage(`Verification code sent to ${email}${devSuffix}`);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtpSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/verify-otp-signup', {
        method: 'POST',
        body: JSON.stringify({
          profileName: registerForm.profileName,
          email: otpForm.email,
          password: registerForm.password,
          otp: otpForm.otp,
        }),
      });

      persistSession({
        accessToken: payload.accessToken,
        tokenType: payload.tokenType,
        user: payload.user,
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtpResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/verify-otp-reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: otpForm.email,
          otp: otpForm.otp,
          newPassword: resetForm.newPassword,
        }),
      });

      persistSession({
        accessToken: payload.accessToken,
        tokenType: payload.tokenType,
        user: payload.user,
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!session) {
      return;
    }

    const confirmed = await confirm({
      title: 'Delete your account?',
      message:
        'This permanently removes your playlists, favorites, queue, and play history. This cannot be undone.',
      confirmLabel: 'Delete account',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    clearFeedback();
    setIsSubmitting(true);

    try {
      await requestAuthorizedJson('/auth/account', {
        method: 'DELETE',
      });

      logout();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    clearFeedback();

    if (!credentialResponse.credential) {
      setErrorMessage('Google sign-in could not be completed.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          idToken: credentialResponse.credential,
        }),
      });

      persistSession({
        accessToken: payload.accessToken,
        tokenType: payload.tokenType,
        user: payload.user,
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function logout() {
    localStorage.removeItem(sessionStorageKey);
    setSession(null);
    setFavoriteTracks([]);
    setRecentTracks([]);
    setPlaylists([]);
    setQueueItems([]);
    setSelectedPlaylistId('library');
    setAddToPlaylistId('');
    setView('login');
    setResetForm({
      newPassword: '',
    });
    clearFeedback();
  }

  function toggleThemeMode() {
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  if (isBootstrapping) {
    return (
      <div className={`app-theme theme-${themeMode}`}>
        <div className="boot-screen">
          <span className="brand-mark">S</span>
          <p>Opening Sonik</p>
        </div>
      </div>
    );
  }

  if (session && isAdminViewOpen && session.user.role === 'admin') {
    return (
      <div className={`app-theme theme-${themeMode}`}>
        <AdminScreen
          session={session}
          tracks={libraryTracks}
          onClose={() => setIsAdminViewOpen(false)}
          onTrackUploaded={() => {
            void loadLibraryTracks();
          }}
          onTrackDeleted={(trackId) => {
            setLibraryTracks((current) =>
              current.filter((track) => track.id !== trackId),
            );
            setTracks((current) =>
              current.filter((track) => track.id !== trackId),
            );
            void loadLibraryTracks();
          }}
          themeMode={themeMode}
          onThemeToggle={toggleThemeMode}
        />
      </div>
    );
  }

  if (session) {
    if (!selectedTrack) {
      return (
        <div className={`app-theme theme-${themeMode}`}>
          <div className="boot-screen">
            <span className="brand-mark">S</span>
            <p>Loading library…</p>
          </div>
        </div>
      );
    }
    return (
      <div className={`app-theme theme-${themeMode}`}>
        <MusicPlayer
          session={session}
          onOpenAdmin={() => setIsAdminViewOpen(true)}
          audioRef={audioRef}
          tracks={visibleTracks}
          favoriteTrackIds={favoriteTracks.map((track) => track.id)}
          playlists={playlists}
          artists={artists}
          albums={albums}
          queueItems={queueItems}
          selectedPlaylistId={selectedPlaylistId}
          selectedSourceLabel={selectedSourceLabel}
          addToPlaylistId={addToPlaylistId}
          searchQuery={searchQuery}
          durationByTrackId={durationByTrackId}
          selectedTrack={selectedTrack}
          selectedTrackId={selectedTrackId}
          progress={progress}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          volume={volume}
          onSelectTrack={selectTrack}
          onSelectPlaylist={selectPlaylist}
          onSelectArtist={selectArtist}
          onSelectAlbum={selectAlbum}
          onSearchChange={setSearchQuery}
          onAddToPlaylistTargetChange={setAddToPlaylistId}
          onCreatePlaylist={createPlaylist}
          onAddToPlaylist={addSelectedTrackToPlaylist}
          onSaveTrackToPlaylist={saveTrackToPlaylist}
          onRemoveFromPlaylist={removeTrackFromPlaylist}
          onToggleFavorite={toggleFavorite}
          onPlayNext={(trackId) => void enqueueTrack(trackId, 'next')}
          onAddToQueue={(trackId) => void enqueueTrack(trackId, 'end')}
          onShareTrack={(track) => void shareTrack(track).catch(() => undefined)}
          onProgressChange={seekToProgress}
          onPlayToggle={togglePlayback}
          onNext={selectNextTrack}
          onPrevious={selectPreviousTrack}
          onShuffleToggle={() => setIsShuffle((current) => !current)}
          onRepeatToggle={toggleRepeatMode}
          onVolumeChange={setVolume}
          onLoadedMetadata={syncAudioMetadata}
onTimeUpdate={syncAudioTime}
          onEnded={handleTrackEnded}
          onLogout={logout}
          onDeleteAccount={handleDeleteAccount}
          themeMode={themeMode}
          onThemeToggle={toggleThemeMode}
        />
      </div>
    );
  }

  const onViewChange = (val: any) => {
    setView(val);
    setRegisterForm((pre: any) => ({
      ...pre,
      password: '',
      confirmPassword: '',
    }));
  };

  return (
    <div className={`app-theme theme-${themeMode}`}>
      <AccessScreen
        view={view}
        activeForm={
<AuthForms
            view={view}
            isSubmitting={isSubmitting}
            loginForm={loginForm}
            registerForm={registerForm}
            resetForm={resetForm}
            otpForm={otpForm}
            otpStep={otpStep}
            setLoginForm={setLoginForm}
            setRegisterForm={setRegisterForm}
            setResetForm={setResetForm}
            setOtpForm={setOtpForm}
            onLogin={handleLogin}
            onSendOtp={handleSendOtp}
            onVerifyOtpSignup={handleVerifyOtpSignup}
            onVerifyOtpResetPassword={handleVerifyOtpResetPassword}
          />
        }
        errorMessage={errorMessage}
        noticeMessage={noticeMessage}
        onViewChange={onViewChange}
        onClearFeedback={clearFeedback}
        onGoogleSuccess={handleGoogleSuccess}
        onGoogleError={() =>
          setErrorMessage('Google sign-in could not be completed.')
        }
        themeMode={themeMode}
        onThemeToggle={toggleThemeMode}
      />
    </div>
  );
}

function App() {
  const inner = (
    <ConfirmProvider>
      <AppContent />
    </ConfirmProvider>
  );
  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{inner}</GoogleOAuthProvider>
  ) : (
    inner
  );
}

export default App;
