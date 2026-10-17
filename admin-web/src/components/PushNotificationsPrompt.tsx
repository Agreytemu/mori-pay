import { useEffect, useState } from 'react';

import {
  enableBrowserPush,
  isPushConfigured,
  listenForForegroundPush,
} from '../push';

export function PushNotificationsPrompt() {
  const [status, setStatus] = useState<'ready' | 'enabled' | 'busy' | 'error'>(
    'ready',
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isPushConfigured() || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    let active = true;
    void enableBrowserPush(false)
      .then(() => {
        if (active) setStatus('enabled');
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'Could not register this browser.');
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status !== 'enabled') return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void listenForForegroundPush()
      .then((stop) => {
        if (active) unsubscribe = stop;
        else stop();
      })
      .catch((error: unknown) => {
        console.warn('Could not start foreground browser notifications.', error);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [status]);

  if (!isPushConfigured()) return null;
  if (status === 'enabled') {
    return (
      <div className="alert alert-success" role="status">
        <p>Browser notifications are enabled for important transaction and account updates.</p>
      </div>
    );
  }

  async function handleEnable() {
    setStatus('busy');
    setMessage('');
    try {
      await enableBrowserPush(true);
      setStatus('enabled');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not enable browser notifications.');
      setStatus('error');
    }
  }

  return (
    <section className="verification-banner" aria-label="Browser notifications">
      <div>
        <strong>Get important account updates</strong>
        <p>
          Mori Pay can show transaction and account alerts in this browser. Push
          notifications contain no account numbers or transaction amounts.
          {message ? ` ${message}` : ''}
        </p>
      </div>
      <button
        className="button-secondary"
        type="button"
        onClick={() => void handleEnable()}
        disabled={status === 'busy'}
      >
        {status === 'busy' ? 'Enabling…' : status === 'error' ? 'Try again' : 'Enable'}
      </button>
    </section>
  );
}
