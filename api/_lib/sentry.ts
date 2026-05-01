/**
 * Sentry error tracking for backend (Node.js) functions.
 * Gracefully no-ops if SENTRY_DSN is not configured.
 */
import * as Sentry from '@sentry/node';

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('[sentry] SENTRY_DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1,
  });
}

export function captureException(err: unknown, ctx?: Record<string, any>): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (!_initialized) initSentry();

  Sentry.withScope((scope) => {
    if (ctx) {
      Object.entries(ctx).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(err);
  });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (!_initialized) initSentry();
  Sentry.captureMessage(message, level);
}
