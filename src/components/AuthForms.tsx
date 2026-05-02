import { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AuthView } from '../types';

type LoginForm = {
  email: string;
  password: string;
};

type RegisterForm = {
  profileName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type ForgotForm = {
  email: string;
};

type ResetForm = {
  token: string;
  newPassword: string;
};

export function AuthForms({
  view,
  isSubmitting,
  loginForm,
  registerForm,
  forgotForm,
  resetForm,
  setLoginForm,
  setRegisterForm,
  setForgotForm,
  setResetForm,
  onLogin,
  onRegister,
  onForgotPassword,
  onResetPassword,
}: {
  view: AuthView;
  isSubmitting: boolean;
  loginForm: LoginForm;
  registerForm: RegisterForm;
  forgotForm: ForgotForm;
  resetForm: ResetForm;
  setLoginForm: Dispatch<SetStateAction<LoginForm>>;
  setRegisterForm: Dispatch<SetStateAction<RegisterForm>>;
  setForgotForm: Dispatch<SetStateAction<ForgotForm>>;
  setResetForm: Dispatch<SetStateAction<ResetForm>>;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
  onForgotPassword: (event: FormEvent<HTMLFormElement>) => void;
  onResetPassword: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (view === 'login') {
    return (
      <form className="auth-form" onSubmit={onLogin}>
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
    );
  }

  if (view === 'register') {
    return (
      <form className="auth-form" onSubmit={onRegister}>
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
    );
  }

  if (view === 'forgot') {
    return (
      <form className="auth-form" onSubmit={onForgotPassword}>
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
    );
  }

  return (
    <form className="auth-form" onSubmit={onResetPassword}>
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
}
