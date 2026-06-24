#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { EventCampaignAgent } from './agent.js';
import { LangChainEventAgent } from './langchainAgent.js';
import { MCPClient } from './mcpClient.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { logger, logApiCall, logAgentInteraction } from './logger.js';
import { initializeMonitoring, isMonitoringEnabled } from './monitoring.js';

dotenv.config();

// Also load MCP server's .env to pass to child process
const mcpServerEnvPath = path.resolve(process.cwd(), '../mcp-server/.env');
dotenv.config({ path: mcpServerEnvPath });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Validate environment
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH || '../mcp-server/src/index.ts';

if (!ANTHROPIC_API_KEY) {
  logger.error('ANTHROPIC_API_KEY not found in environment');
  process.exit(1);
}

// Initialize agents (singletons for MVP - stateful per server instance)
let agent: EventCampaignAgent | null = null;
let langchainAgent: LangChainEventAgent | null = null;
let langchainMcpClient: MCPClient | null = null;
let langchainHistory: Array<{ role: string; content: string }> = [];

async function initializeAgent() {
  agent = new EventCampaignAgent(ANTHROPIC_API_KEY!);
  await agent.initialize(MCP_SERVER_PATH);
  logger.info('Anthropic SDK agent initialized successfully');
}

async function initializeLangChainAgent() {
  // Create separate MCP client for LangChain agent
  langchainMcpClient = new MCPClient();
  await langchainMcpClient.connect(MCP_SERVER_PATH);

  langchainAgent = new LangChainEventAgent(langchainMcpClient, ANTHROPIC_API_KEY!);
  await langchainAgent.initializeAgent(SYSTEM_PROMPT);
  logger.info('LangChain agent initialized successfully');
}

// Routes

/**
 * POST /chat
 * Send a message to the agent and get a response
 */
app.post('/chat', async (req, res) => {
  const startTime = Date.now();

  try {
    if (!agent) {
      return res.status(503).json({ error: 'Agent not initialized' });
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    logger.info('User message received', {
      message: message.substring(0, 100),
      messageLength: message.length
    });

    const response = await agent.chat(message);
    const duration = Date.now() - startTime;

    logger.info('Agent response generated', {
      responseLength: response.length,
      duration
    });

    logApiCall('/chat', 'POST', duration, 200, { framework: 'anthropic-sdk' });

    res.json({
      response,
      history: agent.getHistory(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Chat error', { error: error instanceof Error ? error.message : 'Unknown error', duration });
    logApiCall('/chat', 'POST', duration, 500);

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /chat/langchain
 * Send a message to the LangChain agent (alternative implementation)
 *
 * This endpoint demonstrates framework versatility by using LangChain
 * instead of the Anthropic SDK directly. Both implementations provide
 * identical functionality through different frameworks.
 */
app.post('/chat/langchain', async (req, res) => {
  const startTime = Date.now();

  try {
    if (!langchainAgent) {
      return res.status(503).json({ error: 'LangChain agent not initialized' });
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    logger.info('User message received (LangChain)', {
      message: message.substring(0, 100),
      messageLength: message.length
    });

    // Convert history to LangChain format
    const chatHistory = langchainAgent.formatChatHistory(langchainHistory);

    const response = await langchainAgent.sendMessage(message, chatHistory);
    const duration = Date.now() - startTime;

    // Add to history
    langchainHistory.push({ role: 'user', content: message });
    langchainHistory.push({ role: 'assistant', content: response });

    logger.info('Agent response generated (LangChain)', {
      responseLength: response.length,
      duration
    });

    logApiCall('/chat/langchain', 'POST', duration, 200, { framework: 'langchain' });

    res.json({
      response,
      history: langchainHistory,
      framework: 'langchain'
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('LangChain chat error', { error: error instanceof Error ? error.message : 'Unknown error', duration });
    logApiCall('/chat/langchain', 'POST', duration, 500);

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /reset
 * Reset the conversation history
 */
app.post('/reset', (req, res) => {
  try {
    if (!agent) {
      return res.status(503).json({ error: 'Agent not initialized' });
    }

    agent.resetConversation();
    langchainHistory = []; // Also reset LangChain history
    logger.info('Conversation history reset');

    res.json({ success: true });
  } catch (error) {
    logger.error('Reset error', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agents: {
      anthropic: agent ? 'initialized' : 'not initialized',
      langchain: langchainAgent ? 'initialized' : 'not initialized',
    },
  });
});

// Start server
async function start() {
  try {
    // Initialize monitoring (optional)
    initializeMonitoring();

    await initializeAgent();
    await initializeLangChainAgent();

    app.listen(PORT, () => {
      logger.info(`Agent backend running on http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info('Endpoints:', {
        chat: 'POST /chat (Anthropic SDK)',
        chatLangchain: 'POST /chat/langchain (LangChain)',
        reset: 'POST /reset',
        health: 'GET /health'
      });
      logger.info('Framework Comparison:', {
        langchain: 'Framework-agnostic, built-in memory, extensive ecosystem',
        anthropic: 'Direct API access, latest features, less overhead'
      });

      if (isMonitoringEnabled()) {
        logger.info('📊 Monitoring active at https://smith.langchain.com');
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down gracefully...');
  if (agent) {
    await agent.close();
  }
  if (langchainMcpClient) {
    await langchainMcpClient.close();
  }
  logger.info('Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down gracefully...');
  if (agent) {
    await agent.close();
  }
  if (langchainMcpClient) {
    await langchainMcpClient.close();
  }
  logger.info('Shutdown complete');
  process.exit(0);
});

start();
