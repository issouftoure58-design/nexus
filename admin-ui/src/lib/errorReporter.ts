/**
 * Error Reporter — Frontend error tracking for SENTINEL
 * Reports errors to POST /api/errors/report (fire-and-forget)
 * Installs global handlers for uncaught errors + unhandled rejections
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';
const MAX_ERRORS_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

let errorCount = 0;
let windowStart = Date.now();

function isThrottled(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    errorCount = 0;
    windowStart = now;
  }
  errorCount++;
  return errorCount > MAX_ERRORS_PER_MINUTE;
}

/**
 * Report an error to the backend (fire-and-forget)
 */
export function reportError(
  error: Error | string,
  context: Record<string, unknown> = {}
): void {
  if (isThrottled()) return;

  const message = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'string' ? undefined : error.stack;

  // Fire-and-forget — no await, no blocking
  fetch(`${API_URL}/errors/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      stack,
      level: 'error',
      context: {
        ...context,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    }),
  }).catch(() => {
    // Silently ignore — never let error reporting break the app
  });
}

/**
 * Initialize global error handlers
 * Call once before ReactDOM.createRoot
 */
export function initErrorReporter(): void {
  window.onerror = (message, source, lineno, colno, error) => {
    reportError(error || String(message), {
      source,
      lineno,
      colno,
      type: 'window.onerror',
    });
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error
      ? event.reason
      : String(event.reason);
    reportError(error, { type: 'unhandledrejection' });
  };
}
