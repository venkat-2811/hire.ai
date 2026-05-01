/**
 * Structured JSON logger for backend functions.
 * Outputs structured logs to stdout for Netlify/Vercel log aggregation.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: any;
}

function formatEntry(level: LogLevel, message: string, ctx?: Record<string, any>): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...ctx,
  };
  return JSON.stringify(entry);
}

export const logger = {
  info(message: string, ctx?: Record<string, any>) {
    console.log(formatEntry('info', message, ctx));
  },

  warn(message: string, ctx?: Record<string, any>) {
    console.warn(formatEntry('warn', message, ctx));
  },

  error(message: string, ctx?: Record<string, any>) {
    console.error(formatEntry('error', message, ctx));
  },

  debug(message: string, ctx?: Record<string, any>) {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
      console.log(formatEntry('debug', message, ctx));
    }
  },
};
