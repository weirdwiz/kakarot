import { appendFileSync, existsSync, mkdirSync, statSync, renameSync } from 'fs';
import { join } from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Set via environment variable, defaults to 'info' in production
const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

// Redact sensitive data from log values
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TOKEN_RE = /\b(eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|[a-f0-9]{32,})\b/g;
const ABS_PATH_RE = /\/Users\/[^\s"',}]+/g;

function redactString(value: string): string {
  return value
    .replace(EMAIL_RE, '[email]')
    .replace(TOKEN_RE, '[token]')
    .replace(ABS_PATH_RE, '[path]');
}

function sanitize(data: LogContext): LogContext {
  const clean: LogContext = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      clean[key] = redactString(value);
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value as LogContext);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function formatMessage(context: string, level: LogLevel, message: string, data?: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;

  if (data && Object.keys(data).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(sanitize(data))}`;
  }
  return `${prefix} ${message}`;
}

// File-based log persistence
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_LOG_FILES = 3;
let logDir: string | null = null;
let logFilePath: string | null = null;

/**
 * Initialize file logging. Call once after app.getPath('userData') is available.
 */
export function initializeFileLogging(userDataPath: string): void {
  logDir = join(userDataPath, 'logs');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  logFilePath = join(logDir, 'treeto.log');
  rotateIfNeeded();
}

function rotateIfNeeded(): void {
  if (!logFilePath || !logDir) return;
  try {
    if (!existsSync(logFilePath)) return;
    const stats = statSync(logFilePath);
    if (stats.size < MAX_LOG_SIZE) return;

    // Rotate: treeto.log -> treeto.1.log -> treeto.2.log (drop oldest)
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const older = join(logDir, `treeto.${i}.log`);
      const newer = i === 1 ? logFilePath : join(logDir, `treeto.${i - 1}.log`);
      if (existsSync(newer)) {
        renameSync(newer, older);
      }
    }
  } catch {
    // Rotation failure is non-fatal
  }
}

function writeToFile(formatted: string): void {
  if (!logFilePath) return;
  try {
    appendFileSync(logFilePath, formatted + '\n');
  } catch {
    // File write failure is non-fatal
  }
}

const CONSOLE_METHODS: Record<LogLevel, 'log' | 'warn' | 'error'> = {
  debug: 'log',
  info: 'log',
  warn: 'warn',
  error: 'error',
};

export class Logger {
  constructor(private context: string) {}

  private log(level: LogLevel, message: string, data?: LogContext): void {
    if (!shouldLog(level)) return;
    const formatted = formatMessage(this.context, level, message, data);
    console[CONSOLE_METHODS[level]](formatted); // eslint-disable-line no-console
    writeToFile(formatted);
  }

  debug(message: string, data?: LogContext): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: LogContext): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: LogContext): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | unknown, data?: LogContext): void {
    const errorInfo = error instanceof Error
      ? { errorMessage: error.message, stack: error.stack }
      : error
        ? { errorValue: String(error) }
        : {};
    this.log('error', message, { ...data, ...errorInfo });
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}
