#!/usr/bin/env node

/**
 * CLI test script for the full agent + MCP tool chain
 * Run: npm run test-cli
 *
 * Tests end-to-end flow WITHOUT the frontend:
 * User query → Agent → MCP tools → Response
 */

import dotenv from 'dotenv';
import { EventCampaignAgent } from './agent.js';
import * as readline from 'readline';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH || '../mcp-server/src/index.ts';

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not found in .env file');
  process.exit(1);
}

async function runCLI() {
  console.log('=== Event Campaign Agent CLI Test ===\n');

  const agent = new EventCampaignAgent(ANTHROPIC_API_KEY!);

  try {
    console.log('Initializing agent and MCP server...');
    await agent.initialize(MCP_SERVER_PATH);
    console.log('✅ Agent initialized\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('You can now chat with the agent. Type "exit" to quit, "reset" to clear history.\n');

    const prompt = () => {
      rl.question('You: ', async (input) => {
        const message = input.trim();

        if (!message) {
          prompt();
          return;
        }

        if (message.toLowerCase() === 'exit') {
          console.log('\nGoodbye!');
          await agent.close();
          rl.close();
          process.exit(0);
        }

        if (message.toLowerCase() === 'reset') {
          agent.resetConversation();
          console.log('\n[Conversation reset]\n');
          prompt();
          return;
        }

        try {
          const response = await agent.chat(message);
          console.log(`\nAssistant: ${response}\n`);
        } catch (error) {
          console.error('\n❌ Error:', error);
        }

        prompt();
      });
    };

    // Suggested test query
    console.log('Suggested test query:');
    console.log('"Find music events in San Francisco for my restaurant brand in the next 30 days"\n');

    prompt();
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    process.exit(1);
  }
}

runCLI();
