import * as Sentry from '@sentry/nextjs';
import LogRocket from 'logrocket';

export interface MonitoringConfig {
  sentryDsn?: string;
  logRocketAppId?: string;
  environment?: string;
}

export const initMonitoring = () => {
  if (typeof window === 'undefined') {
    // Server-side monitoring (Sentry only)
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 1.0,
      });
    }
    return;
  }

  // Client-side monitoring
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const logRocketAppId = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID;

  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.replayIntegration(),
      ],
    });
  }

  if (logRocketAppId) {
    LogRocket.init(logRocketAppId);
    
    // Integrate LogRocket with Sentry
    if (sentryDsn) {
      LogRocket.getSessionURL(sessionURL => {
        Sentry.withScope(scope => {
          scope.setExtra('logRocketSessionURL', sessionURL);
        });
      });
    }
  }
};

export const logError = (error: Error, context?: Record<string, any>) => {
  console.error(error, context);
  Sentry.captureException(error, { extra: context });
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_LOGROCKET_APP_ID) {
    LogRocket.captureException(error, { extra: context });
  }
};

export const logEvent = (name: string, properties?: Record<string, any>) => {
  console.log(`[Event] ${name}`, properties);
  Sentry.captureMessage(name, {
    level: 'info',
    extra: properties,
  });
  // LogRocket doesn't have a direct "track event" like Mixpanel, but we can log to console or identify
};

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_LOGROCKET_APP_ID) {
    LogRocket.identify(userId, traits);
  }
  Sentry.setUser({ id: userId, ...traits });
};
