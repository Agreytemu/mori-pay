import type { FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Brand } from '../components/Brand';

export function LoginPage({
  error,
  busy,
  email,
  password,
  pin,
  phone,
  otp,
  otpRequested,
  otpRetrySeconds,
  mode,
  onEmail,
  onPassword,
  onPin,
  onPhone,
  onOtp,
  onResend,
  onResetPhone,
  onMode,
  onSubmit,
}: {
  error: ReactNode;
  busy: boolean;
  email: string;
  password: string;
  pin: string;
  phone: string;
  otp: string;
  otpRequested: boolean;
  otpRetrySeconds: number;
  mode: 'password' | 'pin' | 'phone';
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onPin: (value: string) => void;
  onPhone: (value: string) => void;
  onOtp: (value: string) => void;
  onResend: () => void;
  onResetPhone: () => void;
  onMode: (value: 'password' | 'pin' | 'phone') => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <Brand />
        <div className="auth-pitch">
          <span className="eyebrow">MERCHANT MANAGEMENT</span>
          <h1>Your business.<br />In control.</h1>
          <p>
            Track payments, manage your business QR codes, and get a clearer
            view of everyday activity in one secure Mori Pay workspace.
          </p>
          <div className="auth-highlights">
            <span><b>01</b> Review your merchant application status</span>
            <span><b>02</b> Follow confirmed payments and reports</span>
            <span><b>03</b> Create and manage customer QR codes</span>
          </div>
        </div>
        <p className="auth-footnote">
          Sign in with your existing Mori Pay account. Merchant tools appear
          after approval.
        </p>
      </section>
      <section className="auth-panel">
        <form className="login-card" onSubmit={onSubmit}>
          <span className="eyebrow">WELCOME TO MORI PAY MERCHANT</span>
          <h2>Sign in to continue</h2>
          <p className="muted">
            Every Mori Pay user can sign in to check their merchant application.
            Management tools are enabled for approved merchants.
          </p>
          {error}
          <div className="segmented auth-method" aria-label="Choose sign-in method">
            <button
              type="button"
              className={mode === 'password' ? 'selected' : ''}
              aria-pressed={mode === 'password'}
              onClick={() => onMode('password')}
            >
              Email & password
            </button>
            <button
              type="button"
              className={mode === 'pin' ? 'selected' : ''}
              aria-pressed={mode === 'pin'}
              onClick={() => onMode('pin')}
            >
              Email & PIN
            </button>
            <button
              type="button"
              className={mode === 'phone' ? 'selected' : ''}
              aria-pressed={mode === 'phone'}
              onClick={() => onMode('phone')}
            >
              Phone OTP
            </button>
          </div>
          {mode === 'phone' ? (
            <>
              <label className="field">
                <span>Mobile number linked to Mori Pay</span>
                <span className="phone-input">
                  <span className="phone-prefix" aria-label="Tanzania country code">🇹🇿 +255</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    pattern="[0-9]{9}"
                    maxLength={9}
                    required
                    disabled={otpRequested}
                    value={phone}
                    onChange={(event) => onPhone(event.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="712 345 678"
                  />
                </span>
              </label>
              <p className="otp-help" role="status" aria-live="polite">
                {otpRequested
                  ? `Enter the code sent to +255 ••• ••• ${phone.slice(-3)}.`
                  : 'We will send a one-time sign-in code by SMS to this number.'}
              </p>
              {otpRequested ? (
                <>
                  <label className="field">
                    <span>Six-digit code sent by SMS</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(event) => onOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter verification code"
                    />
                  </label>
                  <div className="otp-actions">
                    <button type="button" className="button button-quiet" onClick={onResetPhone}>
                      Change number
                    </button>
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={onResend}
                      disabled={busy || otpRetrySeconds > 0}
                    >
                      {otpRetrySeconds > 0 ? `Resend in ${otpRetrySeconds}s` : 'Resend code'}
                    </button>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <>
              <label className="field">
                <span>Email address used for Mori Pay</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => onEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              {mode === 'password' ? (
                <label className="field">
                  <span>Mori Pay password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => onPassword(event.target.value)}
                    placeholder="Enter your Mori Pay password"
                  />
                </label>
              ) : (
                <label className="field">
                  <span>Six-digit Mori Pay PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    required
                    value={pin}
                    onChange={(event) => onPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter your six-digit PIN"
                  />
                </label>
              )}
            </>
          )}
          <button
            className="button button-primary button-full"
            disabled={busy || (mode === 'phone' && !otpRequested && otpRetrySeconds > 0)}
          >
            {busy
              ? mode === 'phone' && otpRequested
                ? 'Verifying your number…'
                : 'Checking your Mori Pay account…'
              : mode === 'phone'
                ? otpRequested
                  ? 'Verify and sign in'
                  : otpRetrySeconds > 0
                    ? `Wait ${otpRetrySeconds}s to resend`
                    : 'Send verification code'
                : 'Sign in securely'}
            {!busy && mode !== 'phone' ? <span aria-hidden="true">→</span> : null}
          </button>
          <div className="login-help-card">
            <strong>Applying to become a merchant?</strong>
            <p>
              Sign in with any Mori Pay account to see your current application
              status here. If you have not applied, start your application in
              the Mori Pay mobile app. Reviews and approval decisions are
              managed by Mori Pay.
            </p>
          </div>
          <div className="security-note">
            <span aria-hidden="true">◈</span>
            Authentication is verified by the official Mori Pay server.
          </div>
        </form>
      </section>
    </main>
  );
}
