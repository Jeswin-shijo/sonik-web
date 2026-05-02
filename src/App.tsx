import { CredentialResponse, GoogleOAuthProvider } from '@react-oauth/google';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getFriendlyError, requestJson } from './api/client';
import { apiBaseUrl, googleClientId, sessionStorageKey } from './config';
import { fallbackTracks } from './data/fallbackTracks';
import { formatSeconds, getDurationLabel, isUsableDuration } from './helpers/time';
import { AuthForms } from './components/AuthForms';
import { AccessScreen } from './screens/AccessScreen';
import { MusicPlayer } from './screens/MusicPlayer';
import type {
  AuthResponse,
  AuthView,
  ForgotPasswordResponse,
  MusicTrack,
  PlaylistResponse,
  PlaylistSummary,
  PlaylistsResponse,
  RepeatMode,
  SessionState,
  SessionUser,
  TracksResponse,
} from './types';
import './App.css';

function AppContent() {
  const [view, setView] = useState<AuthView>('login');
  const [session, setSession] = useState<SessionState | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>(fallbackTracks);
  const [libraryTracks, setLibraryTracks] = useState<MusicTrack[]>(fallbackTracks);
  const [favoriteTracks, setFavoriteTracks] = useState<MusicTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('library');
  const [addToPlaylistId, setAddToPlaylistId] = useState('');
  const [playlistName, setPlaylistName] = useState('');
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
  const [forgotForm, setForgotForm] = useState({
    email: '',
  });
  const [resetForm, setResetForm] = useState({
    token: '',
    newPassword: '',
  });

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

  useEffect(() => {
    void requestJson<TracksResponse>('/tracks')
      .then((payload) => {
        if (!payload.tracks.length) {
          return;
        }

        setLibraryTracks(payload.tracks);
        setTracks(payload.tracks);
        setSelectedTrackId(payload.tracks[0].id);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
      })
      .catch(() => {
        setNoticeMessage('Local tracks could not be loaded from the backend yet.');
      });
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void refreshPersonalLibrary(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
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
    const audio = audioRef.current;

    if (!audio || !selectedTrack.streamUrl) {
      return;
    }

    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setProgress(0);
  }, [selectedTrack.id, selectedTrack.streamUrl]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !selectedTrack.streamUrl) {
      return;
    }

    if (isPlaying) {
      void audio.play().catch(() => setIsPlaying(false));
      return;
    }

    audio.pause();
  }, [isPlaying, selectedTrack.streamUrl]);

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

    const [favoritesPayload, recentPayload, playlistsPayload] = await Promise.all([
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
    ]);

    setFavoriteTracks(favoritesPayload.tracks);
    setRecentTracks(recentPayload.tracks);
    setPlaylists(playlistsPayload.playlists);
  }

  function clearFeedback() {
    setErrorMessage('');
    setNoticeMessage('');
  }

  function handleApiError(error: unknown) {
    setErrorMessage(getFriendlyError(error, view));
  }

  function selectTrack(trackId: string) {
    if (trackId === selectedTrackId) {
      setIsPlaying((current) => !current);
      return;
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

  function selectNextTrack() {
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
      selectTrack(nextTrack.id);
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
    selectTrack(nextTrack.id);
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
    selectTrack(previousTrack.id);
  }

  function togglePlayback() {
    if (!selectedTrack.streamUrl) {
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

  async function createPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !playlistName.trim()) {
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>('/playlists', {
        method: 'POST',
        body: JSON.stringify({
          name: playlistName,
        }),
      });

      setPlaylists((current) => [payload.playlist, ...current]);
      setSelectedPlaylistId(payload.playlist.id);
      setAddToPlaylistId(payload.playlist.id);
      setPlaylistName('');
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

    if (targetPlaylist.tracks.some((track) => track.id === selectedTrack.id)) {
      setSelectedPlaylistId(targetPlaylist.id);
      return;
    }

    try {
      const payload = await requestAuthorizedJson<PlaylistResponse>(
        `/playlists/${targetPlaylist.id}/tracks/${selectedTrack.id}`,
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
    if (!session || !selectedTrack.streamUrl) {
      return;
    }

    await requestAuthorizedJson(`/tracks/${selectedTrack.id}/recent`, {
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

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    if (registerForm.password !== registerForm.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          profileName: registerForm.profileName,
          email: registerForm.email,
          password: registerForm.password,
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

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<ForgotPasswordResponse>(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify(forgotForm),
        },
      );

      if (payload.devResetToken) {
        setResetForm((current) => ({
          ...current,
          token: payload.devResetToken ?? current.token,
        }));
        setView('reset');
        setNoticeMessage('Choose a new password to finish the reset.');
      } else {
        setNoticeMessage('If the account exists, a reset link is on its way.');
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setIsSubmitting(true);

    try {
      const payload = await requestJson<AuthResponse>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(resetForm),
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
    setSelectedPlaylistId('library');
    setAddToPlaylistId('');
    setView('login');
    setResetForm({
      token: '',
      newPassword: '',
    });
    clearFeedback();
  }

  if (isBootstrapping) {
    return (
      <div className="boot-screen">
        <span className="brand-mark">S</span>
        <p>Opening Sonik</p>
      </div>
    );
  }

  if (session) {
    return (
      <MusicPlayer
        session={session}
        audioRef={audioRef}
        tracks={visibleTracks}
        favoriteTrackIds={favoriteTracks.map((track) => track.id)}
        playlists={playlists}
        selectedPlaylistId={selectedPlaylistId}
        addToPlaylistId={addToPlaylistId}
        playlistName={playlistName}
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
        onPlaylistNameChange={setPlaylistName}
        onSearchChange={setSearchQuery}
        onAddToPlaylistTargetChange={setAddToPlaylistId}
        onCreatePlaylist={createPlaylist}
        onAddToPlaylist={addSelectedTrackToPlaylist}
        onRemoveFromPlaylist={removeTrackFromPlaylist}
        onToggleFavorite={toggleFavorite}
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
      />
    );
  }

  return (
    <AccessScreen
      view={view}
      tracks={tracks}
      selectedTrack={selectedTrack}
      activeForm={
        <AuthForms
          view={view}
          isSubmitting={isSubmitting}
          loginForm={loginForm}
          registerForm={registerForm}
          forgotForm={forgotForm}
          resetForm={resetForm}
          setLoginForm={setLoginForm}
          setRegisterForm={setRegisterForm}
          setForgotForm={setForgotForm}
          setResetForm={setResetForm}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onForgotPassword={handleForgotPassword}
          onResetPassword={handleResetPassword}
        />
      }
      errorMessage={errorMessage}
      noticeMessage={noticeMessage}
      onSelectTrack={selectTrack}
      onViewChange={setView}
      onClearFeedback={clearFeedback}
      onGoogleSuccess={handleGoogleSuccess}
      onGoogleError={() => setErrorMessage('Google sign-in could not be completed.')}
    />
  );
}

function App() {
  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AppContent />
    </GoogleOAuthProvider>
  ) : (
    <AppContent />
  );
}

export default App;
