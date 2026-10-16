import { useEffect, useRef } from 'react';

export function Alert({
  tone,
  children,
  onDismiss,
}: {
  tone: 'error' | 'success';
  children: string;
  onDismiss: () => void;
}) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss.current(), 5000);
    return () => window.clearTimeout(timer);
  }, [children]);

  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span aria-hidden="true">{tone === 'error' ? '!' : '✓'}</span>
      <p>{children}</p>
      <button type="button" aria-label="Dismiss notification" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
