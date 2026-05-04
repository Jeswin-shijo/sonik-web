import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AuthView } from "../types";
import { OtpInput } from "./OtpInput";
import { apiBaseUrl } from "../config";

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

type ResetForm = {
  newPassword: string;
};

type OtpForm = {
  email: string;
  otp: string;
};

export function AuthForms({
  view,
  isSubmitting,
  loginForm,
  registerForm,
  resetForm,
  otpForm,
  otpStep,
  setLoginForm,
  setRegisterForm,
  setResetForm,
  setOtpForm,
  onLogin,
  onSendOtp,
  onVerifyOtpSignup,
  onVerifyOtpResetPassword,
}: {
  view: AuthView;
  isSubmitting: boolean;
  loginForm: LoginForm;
  registerForm: RegisterForm;
  resetForm: ResetForm;
  otpForm: OtpForm;
  otpStep: "email" | "verify";
  setLoginForm: Dispatch<SetStateAction<LoginForm>>;
  setRegisterForm: Dispatch<SetStateAction<RegisterForm>>;
  setResetForm: Dispatch<SetStateAction<ResetForm>>;
  setOtpForm: Dispatch<SetStateAction<OtpForm>>;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onSendOtp: (email: string, purpose: "signup" | "reset") => void;
  onVerifyOtpSignup: (event: FormEvent<HTMLFormElement>) => void;
  onVerifyOtpResetPassword: (event: FormEvent<HTMLFormElement>) => void;
}) {
  // ── Async email availability check (for sign-up) ──
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (view !== "register-otp" || otpStep !== "email") {
      return;
    }
    const email = otpForm.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus("idle");
      return;
    }
    setEmailStatus("checking");
    clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/auth/check-email?email=${encodeURIComponent(email)}`,
        );
        const data = await response.json();
        setEmailStatus(data.available ? "available" : "taken");
      } catch {
        setEmailStatus("idle");
      }
    }, 500);
    return () => clearTimeout(emailCheckTimer.current);
  }, [otpForm.email, view, otpStep]);

  if (view === "login") {
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
          {isSubmitting ? "Signing in" : "Sign in"}
        </button>
      </form>
    );
  }

  if (view === "register-otp") {
    const handleRegisterOtpSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (otpStep === "email") {
        if (registerForm.password !== registerForm.confirmPassword) {
          return;
        }
        if (emailStatus === "taken") {
          return;
        }
        onSendOtp(otpForm.email, "signup");
      } else {
        onVerifyOtpSignup(event);
      }
    };
    const passwordsMatch =
      !registerForm.confirmPassword ||
      registerForm.password === registerForm.confirmPassword;
    return (
      <form className="auth-form" onSubmit={handleRegisterOtpSubmit}>
        {otpStep === "email" ? (
          <>
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
                placeholder="Your name"
                required
              />
            </label>
            <label>
              Email
              <input
                autoComplete="email"
                type="email"
                value={otpForm.email}
                onChange={(event) =>
                  setOtpForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="listener@sonik.app"
                required
              />
              {emailStatus === "checking" && (
                <small
                  style={{
                    color: "var(--text-secondary)",
                    marginTop: "0.25rem",
                  }}
                >
                  Checking availability…
                </small>
              )}
              {emailStatus === "taken" && (
                <small style={{ color: "#ef4444", marginTop: "0.25rem" }}>
                  This email is already registered. Please sign in instead.
                </small>
              )}
              {emailStatus === "available" && (
                <small style={{ color: "#22c55e", marginTop: "0.25rem" }}>
                  ✓ Email is available
                </small>
              )}
            </label>
            <label>
              Password
              <input
                autoComplete="new-password"
                type="password"
                minLength={6}
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
                minLength={6}
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
            {!passwordsMatch ? (
              <p className="feedback feedback-error">Passwords do not match.</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="otp-instruction">
              Enter the verification code sent to {otpForm.email}
            </p>
            <div className="otp-field">
              <span className="otp-field-label">Verification code</span>
              <OtpInput
                value={otpForm.otp}
                onChange={(next) =>
                  setOtpForm((current) => ({ ...current, otp: next }))
                }
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            <button
              type="button"
              className="text-action"
              onClick={() => onSendOtp(otpForm.email, "signup")}
              disabled={isSubmitting}
            >
              Resend code
            </button>
          </>
        )}
        <button
          className="primary-action full-width"
          disabled={
            isSubmitting ||
            (otpStep === "email" && !passwordsMatch) ||
            (otpStep === "email" &&
              (emailStatus === "taken" || emailStatus === "checking")) ||
            (otpStep === "verify" && otpForm.otp.length !== 6)
          }
        >
          {isSubmitting
            ? otpStep === "email"
              ? "Sending code"
              : "Creating account"
            : otpStep === "email"
              ? "Send verification code"
              : "Verify & create account"}
        </button>
      </form>
    );
  }

  const handleForgotOtpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otpStep === "email") {
      onSendOtp(otpForm.email, "reset");
    } else {
      onVerifyOtpResetPassword(event);
    }
  };
  return (
    <form className="auth-form" onSubmit={handleForgotOtpSubmit}>
      {otpStep === "email" ? (
        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            value={otpForm.email}
            onChange={(event) =>
              setOtpForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="listener@sonik.app"
            required
          />
        </label>
      ) : (
        <>
          <p className="otp-instruction">
            Enter the verification code sent to {otpForm.email}
          </p>
          <div className="otp-field">
            <span className="otp-field-label">Verification code</span>
            <OtpInput
              value={otpForm.otp}
              onChange={(next) =>
                setOtpForm((current) => ({ ...current, otp: next }))
              }
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <label>
            New password
            <input
              autoComplete="new-password"
              type="password"
              minLength={6}
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
          <button
            type="button"
            className="text-action"
            onClick={() => onSendOtp(otpForm.email, "reset")}
            disabled={isSubmitting}
          >
            Resend code
          </button>
        </>
      )}
      <button
        className="primary-action full-width"
        disabled={
          isSubmitting ||
          (otpStep === "verify" &&
            (otpForm.otp.length !== 6 || !resetForm.newPassword))
        }
      >
        {isSubmitting
          ? otpStep === "email"
            ? "Sending code"
            : "Updating password"
          : otpStep === "email"
            ? "Send reset code"
            : "Verify & reset password"}
      </button>
    </form>
  );
}
