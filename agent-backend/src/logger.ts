import winston from 'winston';
import path from 'path';

/**
 * Centralized logging configuration using Winston
 *
 * Features:
 * - Structured JSON logging for production
 * - Pretty-printed console logs for development
 * - File rotation for log management
 * - Different log levels per environment
 * - Request/response correlation via metadata
 */

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata, null, 2)}`;
  }

  return msg;
});

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

/**
 * Main logger instance
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    errors({ stack: true }), // Capture stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: {
    service: 'event-campaign-agent',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      ),
    }),

    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
  // Don't exit on unhandled exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
    }),
  ],
});

/**
 * Log an API request/response cycle
 */
export function logApiCall(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number,
  metadata?: Record<string, any>
) {
  logger.info('API Call', {
    endpoint,
    method,
    duration,
    statusCode,
    ...metadata,
  });
}

/**
 * Log tool usage by the agent
 */
export function logToolCall(
  toolName: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, any>
) {
  logger.info('Tool Call', {
    tool: toolName,
    duration,
    success,
    ...metadata,
  });
}

/**
 * Log agent interaction
 */
export function logAgentInteraction(
  messageId: string,
  userMessage: string,
  agentResponse: string,
  duration: number,
  toolsUsed: string[]
) {
  logger.info('Agent Interaction', {
    messageId,
    userMessage: userMessage.substring(0, 100), // Truncate for logs
    responseLength: agentResponse.length,
    duration,
    toolsUsed,
  });
}

/**
 * Development-only: Log verbose debugging information
 */
export function logDebug(message: string, metadata?: Record<string, any>) {
  logger.debug(message, metadata);
}

export default logger;
