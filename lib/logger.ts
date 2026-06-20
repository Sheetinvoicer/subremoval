// lib/logger.ts - Simple structured logging

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private static instance: Logger;
  private isProduction: boolean;

  private constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private format(level: LogLevel, message: string, context?: any, error?: any) {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context || {},
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      service: 'sheetinvoicer',
      environment: process.env.NODE_ENV,
    };

    if (this.isProduction) {
      return JSON.stringify(entry);
    }

    const emoji = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' };
    let log = `${emoji[level]} [${entry.timestamp}] ${level.toUpperCase()}: ${message}`;
    if (context && Object.keys(context).length > 0) {
      log += `\n  📦 ${JSON.stringify(context, null, 2)}`;
    }
    if (error) {
      log += `\n  🔥 ${error.name}: ${error.message}`;
    }
    return log;
  }

  public debug(message: string, context?: any) {
    const formatted = this.format('debug', message, context);
    console.debug(formatted);
  }

  public info(message: string, context?: any) {
    const formatted = this.format('info', message, context);
    console.info(formatted);
  }

  public warn(message: string, context?: any) {
    const formatted = this.format('warn', message, context);
    console.warn(formatted);
  }

  public error(message: string, error?: any, context?: any) {
    const err = error instanceof Error ? error : new Error(String(error));
    const formatted = this.format('error', message, context, err);
    console.error(formatted);
  }
}

export const logger = Logger.getInstance();
