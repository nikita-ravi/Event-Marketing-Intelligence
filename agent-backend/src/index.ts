#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { EventCampaignAgent } from './agent.js';

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
  console.error('ERROR: ANTHROPIC_API_KEY not found in environment');
  process.exit(1);
}

// Initialize agent (singleton for MVP - stateful per server instance)
let agent: EventCampaignAgent | null = null;

async function initializeAgent() {
  agent = new EventCampaignAgent(ANTHROPIC_API_KEY!);
  await agent.initialize(MCP_SERVER_PATH);
  console.log('Agent initialized successfully');
}

// Routes

/**
 * POST /chat
 * Send a message to the agent and get a response
 */
app.post('/chat', async (req, res) => {
  try {
    if (!agent) {
      return res.status(503).json({ error: 'Agent not initialized' });
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`[User] ${message}`);

    const response = await agent.chat(message);

    console.log(`[Assistant] ${response.substring(0, 100)}...`);

    res.json({
      response,
      history: agent.getHistory(),
    });
  } catch (error) {
    console.error('Chat error:', error);
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
    console.log('[Conversation reset]');

    res.json({ success: true });
  } catch (error) {
    console.error('Reset error:', error);
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
    agent: agent ? 'initialized' : 'not initialized',
  });
});

// Start server
async function start() {
  try {
    await initializeAgent();

    app.listen(PORT, () => {
      console.log(`\n🚀 Agent backend running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`\nEndpoints:`);
      console.log(`  POST /chat - Send a message to the agent`);
      console.log(`  POST /reset - Reset conversation history`);
      console.log(`  GET /health - Health check\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (agent) {
    await agent.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  if (agent) {
    await agent.close();
  }
  process.exit(0);
});

start();
