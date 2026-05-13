import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import { ReactNode } from 'react';
import { googleClientId } from '../config';
import type { AuthView, ThemeMode } from '../types';
import { ThemeToggle } from '../components/ThemeToggle';

function SonikSignal() {
  return (
    <svg
      aria-hidden="true"
      className="sonik-signal"
      fill="none"
      viewBox="0 0 320 320"
    >
      <defs>
        <linearGradient id="sonikSignalGradient" x1="54" x2="266" y1="54" y2="266">
          <stop stopColor="var(--gold)" />
          <stop offset="0.52" stopColor="var(--coral)" />
          <stop offset="1" stopColor="var(--violet)" />
        </linearGradient>
      </defs>
      <circle className="signal-ring signal-ring-one" cx="160" cy="160" r="116" />
      <circle className="signal-ring signal-ring-two" cx="160" cy="160" r="82" />
      <path
        className="signal-wave signal-wave-back"
        d="M72 176c27-45 52-45 78 0s51 45 78 0 39-45 52 0"
      />
      <path
        className="signal-wave"
        d="M52 144c35-58 69-58 102 0s67 58 102 0"
      />
      <circle className="signal-core" cx="160" cy="160" r="54" />
      <text className="signal-letter" x="160" y="177" textAnchor="middle">
        S
      </text>
      <circle className="signal-dot signal-dot-one" cx="86" cy="96" r="7" />
      <circle className="signal-dot signal-dot-two" cx="244" cy="224" r="6" />
    </svg>
  );
}

export function AccessScreen({
  view,
  activeForm,
  errorMessage,
  noticeMessage,
  onViewChange,
  onClearFeedback,
  onGoogleSuccess,
  onGoogleError,
  onGuestLogin,
  isSubmitting,
  themeMode,
  onThemeToggle,
}: {
  view: AuthView;
  activeForm: ReactNode;
  errorMessage: string;
  noticeMessage: string;
  onViewChange: (view: AuthView) => void;
  onClearFeedback: () => void;
  onGoogleSuccess: (credentialResponse: CredentialResponse) => void;
  onGoogleError: () => void;
  onGuestLogin: () => void;
  isSubmitting: boolean;
  themeMode: ThemeMode;
  onThemeToggle: () => void;
}) {
  const authTitle =
    view === 'login'
      ? 'Sign in to Sonik'
      : view === 'register-otp'
        ? 'Create your account'
        : 'Reset your password';

  const authCopy =
    view === 'login'
      ? 'Your library, playlists, and playback stay in sync.'
      : view === 'register-otp'
        ? 'Verify your email with a one-time code, then choose a password.'
        : 'We will send a code to your email if the account exists.';

  return (
    <main className="access-shell">
      <section className="access-preview" aria-label="Sonik player preview">
        <div className="preview-topbar">
          <a className="brand-lockup" href="/" aria-label="Sonik home">
            <span className="brand-mark">S</span>
            <span>Sonik</span>
          </a>
        <div className="auth-toolbar">
          <ThemeToggle themeMode={themeMode} onToggle={onThemeToggle} />
        </div>
        </div>

        <section className="preview-player">
          <div className="sonik-signal-wrap">
            <SonikSignal />
          </div>
          <div className="preview-copy">
            <p className="section-kicker">Featured mix</p>
            <h1>Music that keeps moving with you.</h1>
            <p>Browse, collect, and play your favorite tracks from one account.</p>
          </div>
        </section>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">

<div className="auth-tabs" role="tablist" aria-label="Account options">
          {[
            ['login', 'Sign in'],
            ['register-otp', 'Create'],
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

        {view === 'login' ? (
          <div className="auth-links">
            <button
              className="text-action"
              onClick={() => {
                onClearFeedback();
                onViewChange('forgot-otp');
              }}
              type="button"
            >
              Forgot password?
            </button>
            <span className="auth-link-row">
              Don&apos;t have an account?{' '}
              <button
                className="text-action inline"
                onClick={() => {
                  onClearFeedback();
                  onViewChange('register-otp');
                }}
                type="button"
              >
                Create one
              </button>
            </span>
          </div>
        ) : null}

        {view === 'forgot-otp' ? (
          <button
            className="text-action"
            onClick={() => {
              onClearFeedback();
              onViewChange('login');
            }}
            type="button"
          >
            Back to sign in
          </button>
        ) : null}

        {view === 'login' ? (
          <>
            <div className="divider">
              <span>or</span>
            </div>
            {googleClientId ? (
              <div className="google-slot">
                <GoogleLogin
                  onSuccess={onGoogleSuccess}
                  onError={onGoogleError}
                  theme="filled_black"
                  text="signin_with"
                  shape="pill"
                />
              </div>
            ) : null}
            <button
              className="guest-login-button"
              disabled={isSubmitting}
              onClick={onGuestLogin}
              type="button"
            >
              Continue as Guest
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}
