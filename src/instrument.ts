import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    tracePropagationTargets: ['localhost', /mkvlfnjxeifriagktrbc\.supabase\.co/],
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      // Stale-chunk errors are expected on every deploy: an open tab holds an
      // old index bundle and asks for a lazy chunk whose hash no longer exists.
      // The app already detects these and reloads itself, so they are noise
      // rather than defects. If the reload ever stops working the user is left
      // on the "New version available" screen, which is the real signal.
      'Importing a module script failed',
      'Failed to fetch dynamically imported module',
      'error loading dynamically imported module',
      'Unable to preload CSS',
      'injectTMButton',
      'chrome-extension',
      'message channel closed',
      'Extension context invalidated',
      'ResizeObserver loop',
    ],
  });
}
