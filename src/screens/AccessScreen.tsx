import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import { ReactNode } from 'react';
import { googleClientId } from '../config';
import type { AuthView, MusicTrack } from '../types';
import { TrackArtwork } from '../components/TrackArtwork';

export function AccessScreen({
  view,
  tracks,
  selectedTrack,
  activeForm,
  errorMessage,
  noticeMessage,
  onSelectTrack,
  onViewChange,
  onClearFeedback,
  onGoogleSuccess,
  onGoogleError,
}: {
  view: AuthView;
  tracks: MusicTrack[];
  selectedTrack: MusicTrack;
  activeForm: ReactNode;
  errorMessage: string;
  noticeMessage: string;
  onSelectTrack: (trackId: string) => void;
  onViewChange: (view: AuthView) => void;
  onClearFeedback: () => void;
  onGoogleSuccess: (credentialResponse: CredentialResponse) => void;
  onGoogleError: () => void;
}) {
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
                onClearFeedback();
                onViewChange(value as AuthView);
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
                onSuccess={onGoogleSuccess}
                onError={onGoogleError}
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
              onClearFeedback();
              onViewChange('reset');
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
