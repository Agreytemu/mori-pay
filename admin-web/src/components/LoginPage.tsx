import { useState } from 'react';
import type { FormEvent } from 'react';

import { Alert } from './Alert';

export function LoginPage({
  error,
  busy,
  onSignIn,
  onClearError,
}: {
  error: string;
  busy: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onClearError: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSignIn(email.trim(), password);
  }

  return (
    <main className="login-layout">
      <section className="login-card" aria-labelledby="login-title">
        <img className="brand-logo" src="/brand/mori-pay-official-logo.png" alt="Mori Pay" />
        <p className="eyebrow">STAFF OPERATIONS</p>
        <h1 id="login-title">Admin console</h1>
        <p className="login-intro">
          Sign in with your Mori Pay staff account. Access is verified by Mori Pay.
        </p>
        <form onSubmit={(event) => void submit(event)}>
          {error ? (
            <Alert tone="error" onDismiss={onClearError}>
              {error}
            </Alert>
          ) : null}
          <label className="field">
            <span>Staff email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                onClearError();
              }}
              placeholder="name@moripay.co.tz"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                onClearError();
              }}
              placeholder="Enter your password"
            />
          </label>
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {busy ? 'Verifying access…' : 'Sign in securely'}
          </button>
        </form>
        <p className="login-security">
          Only accounts authorized by Mori Pay can access this console.
        </p>
      </section>
      <aside className="login-aside" aria-hidden="true">
        <div className="aside-orb orb-one" />
        <div className="aside-orb orb-two" />
        <span className="aside-kicker">MORI PAY · OPERATIONS</span>
        <h2>Clarity for every part of the system.</h2>
        <p>
          A secure workspace for the people responsible for keeping Mori Pay
          reliable.
        </p>
        <div className="aside-footer"><span /> Secure staff access</div>
      </aside>
    </main>
  );
}
