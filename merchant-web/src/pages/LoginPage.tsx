import type { FormEvent } from 'react';
import type { ReactNode } from 'react';

export function LoginPage({
  error,
  busy,
  email,
  password,
  pin,
  mode,
  onEmail,
  onPassword,
  onPin,
  onMode,
  onSubmit,
  onHome,
}: {
  error: ReactNode;
  busy: boolean;
  email: string;
  password: string;
  pin: string;
  mode: 'password' | 'pin';
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onPin: (value: string) => void;
  onMode: (value: 'password' | 'pin') => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onHome: () => void;
}) {
  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="login-title">
        <img
          className="auth-logo"
          src="/brand/mori-pay-official-logo.png"
          alt="Mori Pay"
        />
        <header className="auth-heading">
          <span className="eyebrow">MERCHANT PORTAL</span>
          <h1 id="login-title">Sign in to Mori Pay</h1>
          <p>Use your Mori Pay account to manage your business or check your application.</p>
        </header>
        <form className="login-card" onSubmit={onSubmit}>
          {error}
          <div className="segmented auth-method" aria-label="Choose sign-in method">
            <button
              type="button"
              className={mode === 'password' ? 'selected' : ''}
              aria-pressed={mode === 'password'}
              onClick={() => onMode('password')}
            >
              Password
            </button>
            <button
              type="button"
              className={mode === 'pin' ? 'selected' : ''}
              aria-pressed={mode === 'pin'}
              onClick={() => onMode('pin')}
            >
              Mori Pay PIN
            </button>
          </div>
          <label className="field">
            <span>Email address</span>
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
              <span>Password</span>
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
              <span>Six-digit PIN</span>
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
          <button className="button button-primary button-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <aside className="auth-note">
          <strong>Checking a merchant application?</strong>
          <p>
            Sign in with your Mori Pay account to see its current status. If you
            have not applied yet, submit an application in the Mori Pay app.
          </p>
        </aside>
        <p className="auth-security">Your sign-in is verified securely by Mori Pay.</p>
        <button type="button" className="auth-home-link" onClick={onHome}>
          Back to merchant home
        </button>
      </section>
    </main>
  );
}
