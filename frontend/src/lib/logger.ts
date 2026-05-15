// src/lib/logger.ts

/**
 * Application logger utility
 * 
 * Provides controlled logging that can be disabled in production
 * and easily integrated with external logging services (Sentry, LogRocket, etc.)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private enabledLevels: Set<LogLevel> = new Set(['info', 'warn', 'error']);

  constructor() {
    // In development, enable all log levels
    if (this.isDevelopment) {
      this.enabledLevels.add('debug');
    }
  }

  /**
   * Debug level logging (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.enabledLevels.has('debug')) return;
    console.debug(`[DEBUG] ${message}`, context ?? '');
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    if (!this.enabledLevels.has('info')) return;
    console.info(`[INFO] ${message}`, context ?? '');
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    if (!this.enabledLevels.has('warn')) return;
    console.warn(`[WARN] ${message}`, context ?? '');
  }

  /**
   * Error level logging
   * In production, errors are logged to console.
   * For production error tracking, integrate services like Sentry via environment setup.
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.enabledLevels.has('error')) return;
    
    console.error(`[ERROR] ${message}`, error ?? '', context ?? '');
    
    // For production error tracking integration:
    // 1. Install Sentry: npm install @sentry/react
    // 2. Initialize in main.tsx
    // 3. Errors will be automatically captured
  }

  /**
   * Transaction logging helper
   */
  transaction(action: string, hash?: string, details?: LogContext): void {
    this.info(`Transaction: ${action}`, {
      hash,
      ...details,
    });
  }

  /**
   * Contract interaction logging
   */
  contract(action: string, contractAddress?: string, details?: LogContext): void {
    this.debug(`Contract: ${action}`, {
      contractAddress,
      ...details,
    });
  }

  /**
   * User action logging for analytics
   * For production analytics integration:
   * 1. Install your analytics provider (e.g., Google Analytics, PostHog)
   * 2. Initialize in main.tsx
   * 3. Events will be automatically tracked
   */
  userAction(action: string, details?: LogContext): void {
    this.info(`User Action: ${action}`, details);
  }
}

// Export singleton instance
export const logger = new Logger();
