import {
  CredentialResponse,
  GoogleLogin,
  GoogleOAuthProvider,
} from '@react-oauth/google';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:4001';
const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID ?? '';
const sessionStorageKey = 'sonik.web.session';

type AuthView = 'login' | 'register' | 'forgot' | 'reset';

type AuthProvider = 'local' | 'google' | 'hybrid';

type SessionUser = {
  id: number;
  email: string;
  profileName: string;
  authProvider: AuthProvider;
  googleConnected: boolean;
  createdAt: string;
  updatedAt: string;
};

type SessionState = {
  accessToken: string;
  tokenType: string;
  user: SessionUser;
};

type AuthResponse = {
  message: string;
  accessToken: string;
  tokenType: string;
  user: SessionUser;
};

type ForgotPasswordResponse = {
  message: string;
  devResetToken?: string;
  expiresAt?: string;
  host?: string;
};

type ApiErrorPayload = {
  message?: string | string[];
};

type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  plays: string;
  mood: string;
  coverClass: string;
};

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

const tracks: MusicTrack[] = [
  {
    id: 'neon-afterhours',
    title: 'Neon Afterhours',
    artist: 'Mira Sol',
    album: 'City Lines',
    duration: '3:42',
    plays: '2.4M',
    mood: 'Late night',
    coverClass: 'cover-neon',
  },
  {
    id: 'coastal-static',
    title: 'Coastal Static',
    artist: 'North Pier',
    album: 'Low Tide Radio',
    duration: '4:18',
    plays: '986K',
    mood: 'Focus',
    coverClass: 'cover-coast',
  },
  {
    id: 'velvet-signal',
    title: 'Velvet Signal',
    artist: 'Juno Ray',
    album: 'Soft Machines',
    duration: '2:57',
    plays: '1.1M',
    mood: 'Groove',
    coverClass: 'cover-velvet',
  },
  {
    id: 'summer-loop',
    title: 'Summer Loop',
    artist: 'The Halcyon Room',
    album: 'Warm Start',
    duration: '3:25',
    plays: '742K',
    mood: 'Bright',
    coverClass: 'cover-summer',
  },
  {
    id: 'blue-hour-drive',
    title: 'Blue Hour Drive',
    artist: 'Cassian Vale',
    album: 'Second Avenue',
    duration: '3:59',
    plays: '1.8M',
    mood: 'Drive',
    coverClass: 'cover-blue',
  },
];

const mixes = [
  {
    title: 'Daily Current',
    detail: 'Fresh electronic, indie, and smooth pop picks.',
    coverClass: 'cover-neon',
  },
  {
    title: 'After Dark',
    detail: 'Low-lit tracks for late work and long rides.',
    coverClass: 'cover-velvet',
  },
  {
    title: 'Weekend Lift',
    detail: 'Clean hooks, warm bass, and bright openers.',
    coverClass: 'cover-summer',
  },
];

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json().catch(() => null)) as
    | T
    | ApiErrorPayload
    | null;

  if (!response.ok) {
    const payloadMessage = (payload as ApiErrorPayload | null)?.message;
    const message = Array.isArray(payloadMessage)
      ? payloadMessage.join(', ')
      : payloadMessage;

    throw new ApiRequestError(response.status, message || 'Request failed.');
  }

  return payload as T;
}

function getFriendlyError(error: unknown, view: AuthView) {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return view === 'login'
        ? 'Email or password did not match.'
        : 'Your session has expired. Please sign in again.';
    }

    if (error.status === 409) {
      return 'An account with this email already exists.';
    }

    if (error.status === 400) {
      return 'Please check the details and try again.';
    }
  }

  return 'Sonik could not complete that action right now.';
}

function TrackArtwork({
  track,
  className = '',
}: {
  track: Pick<MusicTrack, 'title' | 'coverClass'>;
  className?: string;
}) {
  return (
    <div className={`track-art ${track.coverClass} ${className}`} aria-hidden="true">
      <span />
    </div>
  );
}

function IconButton({
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
  return (
    <button
      aria-label={label}
      className={`icon-button ${isActive ? 'is-active' : ''} ${
        isLarge ? 'is-large' : ''
      }`}
      onClick={onClick}
      type="button"
    >
      <span className={`control-icon ${icon}`} aria-hidden="true" />
    </button>
  );
}

function PlayerControls({
  progress,
  isPlaying,
  onProgressChange,
  onPlayToggle,
  onNext,
  onPrevious,
}: {
  progress: number;
  isPlaying: boolean;
  onProgressChange: (value: number) => void;
  onPlayToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="player-controls">
      <div className="transport-row">
        <IconButton label="Shuffle" icon="icon-shuffle" />
        <IconButton label="Previous track" icon="icon-previous" onClick={onPrevious} />
        <IconButton
          label={isPlaying ? 'Pause' : 'Play'}
          icon={isPlaying ? 'icon-pause' : 'icon-play'}
          isLarge
          onClick={onPlayToggle}
        />
        <IconButton label="Next track" icon="icon-next" onClick={onNext} />
        <IconButton label="Repeat" icon="icon-repeat" />
      </div>
      <div className="progress-row">
        <span>{formatProgress(progress)}</span>
        <input
          aria-label="Playback progress"
          max="100"
          min="0"
          onChange={(event) => onProgressChange(Number(event.target.value))}
          type="range"
          value={progress}
        />
        <span>3:42</span>
      </div>
    </div>
  );
}

function formatProgress(progress: number) {
  const seconds = Math.round((progress / 100) * 222);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, '0');

  return `${minutes}:${remainingSeconds}`;
}

function MusicPlayer({
  session,
  selectedTrack,
  selectedTrackId,
  progress,
  isPlaying,
  volume,
  onSelectTrack,
  onProgressChange,
  onPlayToggle,
  onNext,
  onPrevious,
  onVolumeChange,
  onLogout,
}: {
  session: SessionState;
  selectedTrack: MusicTrack;
  selectedTrackId: string;
  progress: number;
  isPlaying: boolean;
  volume: number;
  onSelectTrack: (trackId: string) => void;
  onProgressChange: (value: number) => void;
  onPlayToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeChange: (value: number) => void;
  onLogout: () => void;
}) {
  return (
    <div className="player-shell">
      <header className="sonik-header">
        <a className="brand-lockup" href="/" aria-label="Sonik home">
          <span className="brand-mark">S</span>
          <span>Sonik</span>
        </a>

        <div className="command-bar" role="search">
          <span className="control-icon icon-search" aria-hidden="true" />
          <span>Search songs, artists, moods</span>
        </div>

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
          {['Home', 'Discover', 'Library', 'Queue'].map((item, index) => (
            <button
              className={`nav-item ${index === 0 ? 'is-active' : ''}`}
              key={item}
              type="button"
            >
              <span className="nav-dot" />
              {item}
            </button>
          ))}
        </nav>

        <section className="crate-panel">
          <p className="section-kicker">Crates</p>
          {['Liked Songs', 'Indie Current', 'Night Drive', 'Focus Room'].map(
            (playlist) => (
              <button className="playlist-link" key={playlist} type="button">
                {playlist}
              </button>
            ),
          )}
        </section>

        <section className="pulse-card">
          <p className="section-kicker">Today</p>
          <strong>84%</strong>
          <span>Discovery match</span>
        </section>
      </aside>

      <main className="music-main">
        <section className="signal-deck" aria-labelledby="hero-title">
          <div className="deck-art-wrap">
            <TrackArtwork track={selectedTrack} className="hero-art" />
            <span className="orbit-ring" />
          </div>

          <div className="deck-copy">
            <p className="section-kicker">Playing from Flow State</p>
            <h1 id="hero-title">{selectedTrack.title}</h1>
            <p>
              {selectedTrack.artist} - {selectedTrack.album}
            </p>
            <div className="mood-row">
              <span>{selectedTrack.mood}</span>
              <span>{selectedTrack.plays} plays</span>
              <span>{selectedTrack.duration}</span>
            </div>
            <div className="hero-actions">
              <button
                className="play-action"
                onClick={onPlayToggle}
                type="button"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button className="subtle-action" type="button">
                Save
              </button>
            </div>
          </div>

          <div className="wave-card" aria-label="Track energy">
            {Array.from({ length: 24 }, (_, index) => (
              <span key={index} />
            ))}
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
            <button type="button">Sort by mood</button>
          </div>
          <div className="track-table">
            {tracks.map((track, index) => (
              <button
                className={`track-row ${
                  selectedTrackId === track.id ? 'is-selected' : ''
                }`}
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                type="button"
              >
                <span className="track-index">
                  {selectedTrackId === track.id && isPlaying ? (
                    <span className="mini-eq" aria-label="Playing">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    index + 1
                  )}
                </span>
                <TrackArtwork track={track} className="row-art" />
                <span className="track-meta">
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </span>
                <span className="track-album">{track.album}</span>
                <span className="track-plays">{track.plays}</span>
                <span className="track-duration">{track.duration}</span>
              </button>
            ))}
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
          isPlaying={isPlaying}
          onProgressChange={onProgressChange}
          onPlayToggle={onPlayToggle}
          onNext={onNext}
          onPrevious={onPrevious}
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

function AppContent() {
  const [view, setView] = useState<AuthView>('login');
  const [session, setSession] = useState<SessionState | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState(tracks[0].id);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(36);
  const [volume, setVolume] = useState(76);
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
    [selectedTrackId],
  );

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
    if (!isPlaying) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setProgress((current) => (current >= 99 ? 0 : current + 1));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [isPlaying, selectedTrackId]);

  function persistSession(nextSession: SessionState) {
    localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function clearFeedback() {
    setErrorMessage('');
    setNoticeMessage('');
  }

  function handleApiError(error: unknown) {
    setErrorMessage(getFriendlyError(error, view));
  }

  function selectTrack(trackId: string) {
    setSelectedTrackId(trackId);
    setProgress(8);
    setIsPlaying(true);
  }

  function selectNextTrack() {
    const currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
    const nextTrack = tracks[(currentIndex + 1) % tracks.length];
    selectTrack(nextTrack.id);
  }

  function selectPreviousTrack() {
    const currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
    const previousTrack =
      tracks[(currentIndex - 1 + tracks.length) % tracks.length];
    selectTrack(previousTrack.id);
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
    setView('login');
    setResetForm({
      token: '',
      newPassword: '',
    });
    clearFeedback();
  }

  const activeForm =
    view === 'login' ? (
      <form className="auth-form" onSubmit={handleLogin}>
        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            value={loginForm.email}
            onChange={(event) =>
              setLoginForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="listener@sonik.app"
            required
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            value={loginForm.password}
            onChange={(event) =>
              setLoginForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="Your password"
            required
          />
        </label>
        <button className="primary-action full-width" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    ) : view === 'register' ? (
      <form className="auth-form" onSubmit={handleRegister}>
        <label>
          Profile name
          <input
            value={registerForm.profileName}
            onChange={(event) =>
              setRegisterForm((current) => ({
                ...current,
                profileName: event.target.value,
              }))
            }
            placeholder="Jeswin"
            required
          />
        </label>
        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            value={registerForm.email}
            onChange={(event) =>
              setRegisterForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="listener@sonik.app"
            required
          />
        </label>
        <label>
          Password
          <input
            autoComplete="new-password"
            type="password"
            value={registerForm.password}
            onChange={(event) =>
              setRegisterForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="Create a password"
            required
          />
        </label>
        <label>
          Confirm password
          <input
            autoComplete="new-password"
            type="password"
            value={registerForm.confirmPassword}
            onChange={(event) =>
              setRegisterForm((current) => ({
                ...current,
                confirmPassword: event.target.value,
              }))
            }
            placeholder="Repeat your password"
            required
          />
        </label>
        <button className="primary-action full-width" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account' : 'Create account'}
        </button>
      </form>
    ) : view === 'forgot' ? (
      <form className="auth-form" onSubmit={handleForgotPassword}>
        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            value={forgotForm.email}
            onChange={(event) =>
              setForgotForm({
                email: event.target.value,
              })
            }
            placeholder="listener@sonik.app"
            required
          />
        </label>
        <button className="primary-action full-width" disabled={isSubmitting}>
          {isSubmitting ? 'Sending link' : 'Send reset link'}
        </button>
      </form>
    ) : (
      <form className="auth-form" onSubmit={handleResetPassword}>
        {resetForm.token ? (
          <input readOnly type="hidden" value={resetForm.token} />
        ) : (
          <label>
            Reset code
            <input
              value={resetForm.token}
              onChange={(event) =>
                setResetForm((current) => ({
                  ...current,
                  token: event.target.value,
                }))
              }
              placeholder="Reset code"
              required
            />
          </label>
        )}
        <label>
          New password
          <input
            autoComplete="new-password"
            type="password"
            value={resetForm.newPassword}
            onChange={(event) =>
              setResetForm((current) => ({
                ...current,
                newPassword: event.target.value,
              }))
            }
            placeholder="Create a new password"
            required
          />
        </label>
        <button className="primary-action full-width" disabled={isSubmitting}>
          {isSubmitting ? 'Updating password' : 'Update password'}
        </button>
      </form>
    );

  const authTitle =
    view === 'login'
      ? 'Sign in to Sonik'
      : view === 'register'
        ? 'Create your account'
        : view === 'forgot'
          ? 'Reset your password'
          : 'Choose a new password';

  const authCopy =
    view === 'login'
      ? 'Your library, playlists, and playback stay in sync.'
      : view === 'register'
        ? 'Start with a clean music workspace built around your taste.'
        : view === 'forgot'
          ? 'We will send a secure reset link if the email is registered.'
          : 'Finish the reset and return to your music.';

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
        selectedTrack={selectedTrack}
        selectedTrackId={selectedTrackId}
        progress={progress}
        isPlaying={isPlaying}
        volume={volume}
        onSelectTrack={selectTrack}
        onProgressChange={setProgress}
        onPlayToggle={() => setIsPlaying((current) => !current)}
        onNext={selectNextTrack}
        onPrevious={selectPreviousTrack}
        onVolumeChange={setVolume}
        onLogout={logout}
      />
    );
  }

  return (
    <main className="access-shell">
      <section className="access-preview" aria-label="Sonik player preview">
        <div className="preview-topbar">
          <a className="brand-lockup" href="/" aria-label="Sonik home">
            <span className="brand-mark">S</span>
            <span>Sonik</span>
          </a>
          <span className="preview-pill">Web player</span>
        </div>

        <section className="preview-player">
          <TrackArtwork track={selectedTrack} className="preview-art" />
          <div className="preview-copy">
            <p className="section-kicker">Featured mix</p>
            <h1>Music that keeps moving with you.</h1>
            <p>Browse, collect, and play your favorite tracks from one account.</p>
          </div>
        </section>

        <div className="preview-list">
          {tracks.slice(0, 3).map((track) => (
            <button
              className={`queue-item ${
                selectedTrack.id === track.id ? 'is-selected' : ''
              }`}
              key={track.id}
              onClick={() => selectTrack(track.id)}
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

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-tabs" role="tablist" aria-label="Account options">
          {[
            ['login', 'Sign in'],
            ['register', 'Create'],
            ['forgot', 'Reset'],
          ].map(([value, label]) => (
            <button
              aria-selected={view === value}
              className={`tab-button ${view === value ? 'is-active' : ''}`}
              key={value}
              onClick={() => {
                clearFeedback();
                setView(value as AuthView);
              }}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="auth-copy">
          <p className="section-kicker">Sonik Access</p>
          <h2 id="auth-title">{authTitle}</h2>
          <p>{authCopy}</p>
        </div>

        {errorMessage ? <p className="feedback feedback-error">{errorMessage}</p> : null}
        {noticeMessage ? (
          <p className="feedback feedback-notice">{noticeMessage}</p>
        ) : null}

        {activeForm}

        {view !== 'forgot' && view !== 'reset' && googleClientId ? (
          <>
            <div className="divider">
              <span>or</span>
            </div>
            <div className="google-slot">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() =>
                  setErrorMessage('Google sign-in could not be completed.')
                }
                theme="filled_black"
                text={view === 'register' ? 'signup_with' : 'signin_with'}
                shape="pill"
              />
            </div>
          </>
        ) : null}

        {view === 'forgot' ? (
          <button
            className="text-action"
            onClick={() => {
              clearFeedback();
              setView('reset');
            }}
            type="button"
          >
            I already have a reset code
          </button>
        ) : null}
      </section>
    </main>
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
