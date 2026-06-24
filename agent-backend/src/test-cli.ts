#!/usr/bin/env node

/**
 * CLI Test Script for Hybrid Reasoning Architecture
 *
 * This script tests the complete hybrid reasoning flow:
 * 1. search_events → track candidate eventIds
 * 2. recommend_campaign_window → get baseline scores
 * 3. LLM reasoning → adjust scores based on context
 * 4. present_recommendation → schema-enforced output
 * 5. Validation guardrail → verify eventIds
 * 6. Result: either LLM recommendations or graceful fallback
 *
 * Run: npm run test-cli
 */

import dotenv from 'dotenv';
import path from 'path';
import { LangChainEventAgent } from './langchainAgent.js';
import { MCPClient } from './mcpClient.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { logger } from './logger.js';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

// Also load MCP server's .env
const mcpServerEnvPath = path.resolve(process.cwd(), '../mcp-server/.env');
dotenv.config({ path: mcpServerEnvPath });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH || '../mcp-server/src/index.ts';

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not found in environment');
  process.exit(1);
}

async function runCLI() {
  console.log('='.repeat(80));
  console.log('HYBRID REASONING ARCHITECTURE - CLI TEST');
  console.log('='.repeat(80));
  console.log();
  console.log('Architecture:');
  console.log('  • Deterministic baseline scoring (auditable, consistent)');
  console.log('  • LLM reasoning layer (context-aware adjustments)');
  console.log('  • Schema-enforced output (prevents hallucination)');
  console.log('  • Validation guardrails (graceful degradation)');
  console.log();

  try {
    // Initialize MCP client
    console.log('Initializing MCP client...');
    const mcpClient = new MCPClient();
    await mcpClient.connect(MCP_SERVER_PATH);
    console.log('✅ MCP client connected');
    console.log();

    // Initialize LangChain agent with hybrid reasoning
    console.log('Initializing LangChain agent...');
    console.log('  • Temperature: 0.2 (business reasoning mode)');
    console.log('  • Tools: 6 (includes present_recommendation)');
    console.log('  • Validation: enabled');
    const agent = new LangChainEventAgent(mcpClient, ANTHROPIC_API_KEY!);
    await agent.initializeAgent(SYSTEM_PROMPT);
    console.log('✅ Agent initialized');
    console.log();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let chatHistory: Array<{ role: string; content: string }> = [];

    console.log('You can now chat with the agent. Type "exit" to quit, "reset" to clear history.');
    console.log();
    console.log('Suggested test queries:');
    console.log('  1. "Find music events in Chicago for my restaurant in August 2026"');
    console.log('  2. "Find events within 5 miles of downtown LA for my QSR brand"');
    console.log('  3. "Show me Taylor Swift tour dates for my entertainment brand"');
    console.log();

    const prompt = () => {
      rl.question('You: ', async (input) => {
        const message = input.trim();

        if (!message) {
          prompt();
          return;
        }

        if (message.toLowerCase() === 'exit') {
          console.log('\nGoodbye!');
          await mcpClient.close();
          rl.close();
          process.exit(0);
        }

        if (message.toLowerCase() === 'reset') {
          chatHistory = [];
          console.log('\n[Conversation reset]\n');
          prompt();
          return;
        }

        try {
          console.log('\n[Agent thinking...]\n');
          const formattedHistory = agent.formatChatHistory(chatHistory);
          const response = await agent.sendMessage(message, formattedHistory);

          // Add to history
          chatHistory.push({ role: 'user', content: message });
          chatHistory.push({ role: 'assistant', content: response });

          console.log(`Assistant: ${response}\n`);
        } catch (error) {
          console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
          if (error instanceof Error && error.stack) {
            console.error('Stack:', error.stack);
          }
        }

        prompt();
      });
    };

    prompt();
  } catch (error) {
    console.error();
    console.error('='.repeat(80));
    console.error('INITIALIZATION FAILED');
    console.error('='.repeat(80));
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Handle signals
process.on('SIGINT', async () => {
  console.log('\nTest interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nTest terminated');
  process.exit(0);
});

// Run CLI
runCLI();
