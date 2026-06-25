#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { LangChainEventAgent } from './langchainAgent.js';
import { MCPClient } from './mcpClient.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { logger, logApiCall } from './logger.js';

const GUARDRAILS_URL = process.env.GUARDRAILS_URL || 'http://localhost:8001';

/**
 * Check user input against NeMo Guardrails before passing to the agent.
 * Fails open — if the guardrails service is down, the request is allowed through.
 */
async function checkInputGuardrail(message: string): Promise<{ allowed: boolean; blockedResponse?: string }> {
  try {
    const res = await fetch(`${GUARDRAILS_URL}/check-input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { allowed: true };
    const data = await res.json() as { allowed: boolean; blocked_response?: string };
    return { allowed: data.allowed, blockedResponse: data.blocked_response ?? undefined };
  } catch {
    logger.warn('NeMo guardrails service unreachable — failing open on input check');
    return { allowed: true };
  }
}

/**
 * Check agent output against NeMo Guardrails before sending to the user.
 * Fails open — returns the original response if the service is down.
 */
async function checkOutputGuardrail(userMessage: string, botResponse: string): Promise<string> {
  try {
    const res = await fetch(`${GUARDRAILS_URL}/check-output`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_message: userMessage, bot_response: botResponse }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return botResponse;
    const data = await res.json() as { allowed: boolean; sanitized_response?: string };
    return data.allowed ? botResponse : (data.sanitized_response ?? botResponse);
  } catch {
    logger.warn('NeMo guardrails service unreachable — failing open on output check');
    return botResponse;
  }
}

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

// Initialize LangChain agent (consolidated to single framework)
let langchainAgent: LangChainEventAgent | null = null;
let langchainMcpClient: MCPClient | null = null;
let langchainHistory: Array<{ role: string; content: string }> = [];

async function initializeLangChainAgent() {
  // Create MCP client for LangChain agent
  langchainMcpClient = new MCPClient();
  await langchainMcpClient.connect(MCP_SERVER_PATH);

  langchainAgent = new LangChainEventAgent(langchainMcpClient, ANTHROPIC_API_KEY!);
  await langchainAgent.initializeAgent(SYSTEM_PROMPT);
  logger.info('LangChain agent initialized successfully with hybrid reasoning architecture');
}

// Routes

/**
 * POST /chat
 * Send a message to the LangChain agent with hybrid reasoning architecture
 *
 * Architecture:
 * - Deterministic baseline scoring (auditable, consistent)
 * - LLM reasoning layer (context-aware adjustments)
 * - Schema-enforced output via present_recommendation tool
 * - Validation guardrails (graceful degradation if hallucination detected)
 */
app.post('/chat', async (req, res) => {
  const startTime = Date.now();

  try {
    if (!langchainAgent) {
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

    // Convert history to LangChain format
    const chatHistory = langchainAgent.formatChatHistory(langchainHistory);

    const response = await langchainAgent.sendMessage(message, chatHistory);
    const duration = Date.now() - startTime;

    // Get enriched recommendations if available
    const recommendations = langchainAgent.getEnrichedRecommendations();

    // Add to history
    langchainHistory.push({ role: 'user', content: message });
    langchainHistory.push({ role: 'assistant', content: response });

    logger.info('Agent response generated', {
      responseLength: response.length,
      duration,
      hybridReasoning: true,
      hasRecommendations: recommendations !== null,
      recommendationCount: recommendations?.length || 0
    });

    logApiCall('/chat', 'POST', duration, 200, { framework: 'langchain' });

    res.json({
      message: response,
      recommendations: recommendations,
      history: langchainHistory,
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
 * POST /chat-stream
 * Send a message with Server-Sent Events for real-time pipeline updates
 */
app.post('/chat-stream', async (req, res) => {
  const startTime = Date.now();

  try {
    if (!langchainMcpClient) {
      return res.status(503).json({ error: 'MCP client not initialized' });
    }

    const { message, chatHistory } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    logger.info('User message received (streaming)', {
      message: message.substring(0, 100),
      messageLength: message.length,
      historyTurns: chatHistory ? chatHistory.length : 0
    });

    // ── NeMo input guardrail ──────────────────────────────────────────────────
    const inputCheck = await checkInputGuardrail(message);
    if (!inputCheck.allowed) {
      logger.warn('NeMo guardrail blocked input', { message: message.substring(0, 100) });
      const blockedMsg = inputCheck.blockedResponse!;
      langchainHistory.push({ role: 'user', content: message });
      langchainHistory.push({ role: 'assistant', content: blockedMsg });
      res.write(`data: ${JSON.stringify({
        type: 'final',
        message: blockedMsg,
        recommendations: null,
        history: langchainHistory,
      })}\n\n`);
      res.end();
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Create temporary agent with event callback
    const streamingAgent = new LangChainEventAgent(
      langchainMcpClient,
      ANTHROPIC_API_KEY!,
      (event) => {
        // Send SSE event to frontend
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    );
    await streamingAgent.initializeAgent(SYSTEM_PROMPT);

    // Use last turn only (chatHistory from frontend) instead of full langchainHistory
    // This keeps token costs low while enabling relevant follow-ups
    const lastTurnHistory = chatHistory && Array.isArray(chatHistory)
      ? streamingAgent.formatChatHistory(chatHistory)
      : [];

    const response = await streamingAgent.sendMessage(message, lastTurnHistory);
    const duration = Date.now() - startTime;

    // Get enriched recommendations
    const recommendations = streamingAgent.getEnrichedRecommendations();

    // ── NeMo output guardrail ─────────────────────────────────────────────────
    const safeResponse = await checkOutputGuardrail(message, response);
    if (safeResponse !== response) {
      logger.warn('NeMo guardrail sanitised agent output');
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Add to history
    langchainHistory.push({ role: 'user', content: message });
    langchainHistory.push({ role: 'assistant', content: safeResponse });

    // Send final response
    res.write(`data: ${JSON.stringify({
      type: 'final',
      message: safeResponse,
      recommendations: safeResponse === response ? recommendations : null,
      history: langchainHistory,
    })}\n\n`);

    res.end();

    logger.info('Agent response generated (streaming)', {
      responseLength: response.length,
      duration,
      hybridReasoning: true,
      hasRecommendations: recommendations !== null,
      recommendationCount: recommendations?.length || 0
    });

    logApiCall('/chat-stream', 'POST', duration, 200, { framework: 'langchain', streaming: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Chat stream error', { error: error instanceof Error ? error.message : 'Unknown error', duration });
    logApiCall('/chat-stream', 'POST', duration, 500);

    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    })}\n\n`);
    res.end();
  }
});

/**
 * POST /reset
 * Reset the conversation history
 */
app.post('/reset', (req, res) => {
  try {
    langchainHistory = [];
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
    agent: langchainAgent ? 'initialized' : 'not initialized',
    architecture: 'hybrid-reasoning',
    framework: 'langchain',
    temperature: 0.2,
    validation: 'enabled',
  });
});

// Start server
async function start() {
  try {
    await initializeLangChainAgent();

    app.listen(PORT, () => {
      logger.info(`Agent backend running on http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info('Endpoints:', {
        chat: 'POST /chat (LangChain with hybrid reasoning)',
        reset: 'POST /reset',
        health: 'GET /health'
      });
      logger.info('Architecture:', {
        framework: 'LangChain',
        temperature: 0.2,
        baselineScoring: 'deterministic',
        reasoning: 'LLM-adjusted',
        validation: 'schema-enforced with guardrails',
        degradation: 'graceful fallback to baseline'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down gracefully...');
  if (langchainMcpClient) {
    await langchainMcpClient.close();
  }
  logger.info('Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down gracefully...');
  if (langchainMcpClient) {
    await langchainMcpClient.close();
  }
  logger.info('Shutdown complete');
  process.exit(0);
});

start();
