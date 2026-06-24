/**
 * Monitoring and Observability Configuration
 *
 * This module provides LangSmith integration for local monitoring and debugging.
 * LangSmith is ideal for this project because:
 * - Works locally without requiring deployment
 * - Provides automatic tracing for LangChain agents
 * - Visualizes tool calls and agent reasoning
 * - Enables debugging of complex agent behaviors
 *
 * Setup Instructions:
 * 1. Sign up for free at https://smith.langchain.com
 * 2. Get your API key from settings
 * 3. Set environment variables in .env:
 *    LANGCHAIN_TRACING_V2=true
 *    LANGCHAIN_API_KEY=your-api-key
 *    LANGCHAIN_PROJECT=event-marketing-agent
 *
 * Usage:
 * - When running locally, traces will appear at https://smith.langchain.com
 * - Each conversation will create a new trace with all tool calls visible
 * - Can be disabled by setting LANGCHAIN_TRACING_V2=false
 */

import { Client } from 'langsmith';
import { logger } from './logger.js';

let langsmithClient: Client | null = null;
let langsmithEnabled = false;

/**
 * Initialize LangSmith monitoring
 * This is optional and will only activate if LANGCHAIN_TRACING_V2=true
 */
export function initializeMonitoring() {
  const tracingEnabled = process.env.LANGCHAIN_TRACING_V2 === 'true';
  const apiKey = process.env.LANGCHAIN_API_KEY;
  const projectName = process.env.LANGCHAIN_PROJECT || 'event-marketing-agent';

  if (!tracingEnabled) {
    logger.info('LangSmith tracing is disabled');
    logger.info('To enable monitoring, set LANGCHAIN_TRACING_V2=true in .env');
    return;
  }

  if (!apiKey) {
    logger.warn('LANGCHAIN_API_KEY not found - monitoring disabled');
    logger.info('Get a free API key at https://smith.langchain.com');
    return;
  }

  try {
    langsmithClient = new Client({
      apiKey,
    });

    langsmithEnabled = true;

    logger.info('LangSmith monitoring enabled', {
      project: projectName,
      dashboard: 'https://smith.langchain.com'
    });
  } catch (error) {
    logger.error('Failed to initialize LangSmith', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Check if monitoring is enabled
 */
export function isMonitoringEnabled(): boolean {
  return langsmithEnabled;
}

/**
 * Get LangSmith client (if available)
 */
export function getMonitoringClient(): Client | null {
  return langsmithClient;
}

/**
 * Log a custom event to LangSmith (optional)
 */
export async function logMonitoringEvent(
  name: string,
  metadata: Record<string, any>
) {
  if (!langsmithClient || !langsmithEnabled) {
    return;
  }

  try {
    // Custom event logging can be implemented here
    logger.debug('Monitoring event logged', { name, ...metadata });
  } catch (error) {
    logger.error('Failed to log monitoring event', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * LangSmith Alternatives (for reference)
 *
 * If evaluators prefer a different monitoring solution, here are alternatives:
 *
 * 1. **LangFuse** (Open Source)
 *    - Self-hosted option available
 *    - npm install langfuse
 *    - Great for teams wanting full control
 *
 * 2. **Phoenix Arize** (Open Source)
 *    - Completely local, no cloud service
 *    - npm install @arizeai/phoenix
 *    - Ideal for air-gapped environments
 *
 * 3. **Custom Winston File Logging**
 *    - Already implemented in logger.ts
 *    - Check logs/combined.log for structured traces
 *    - No external service needed
 *
 * Implementation Note:
 * The current setup uses LangSmith because it's:
 * - Free tier available
 * - Zero configuration for LangChain
 * - Excellent visualization of agent behavior
 * - Optional (can be disabled with one env var)
 */

export default {
  initializeMonitoring,
  isMonitoringEnabled,
  getMonitoringClient,
  logMonitoringEvent,
};
