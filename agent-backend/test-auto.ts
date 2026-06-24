#!/usr/bin/env node

import { LangChainEventAgent } from './src/langchainAgent.js';
import { MCPClient } from './src/mcpClient.js';
import { SYSTEM_PROMPT } from './src/systemPrompt.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MCP_SERVER_PATH = '../mcp-server/src/index.ts';

async function runTest() {
  console.log('================================================================================');
  console.log('HYBRID REASONING ARCHITECTURE - AUTOMATED TEST');
  console.log('================================================================================\n');

  console.log('Architecture:');
  console.log('  • Deterministic baseline scoring (auditable, consistent)');
  console.log('  • LLM reasoning layer (context-aware adjustments)');
  console.log('  • Schema-enforced output (prevents hallucination)');
  console.log('  • Validation guardrails (graceful degradation)\n');

  // Initialize MCP client
  console.log('Initializing MCP client...');
  const mcpClient = new MCPClient();
  await mcpClient.connect(MCP_SERVER_PATH);
  console.log('✅ MCP client connected\n');

  // Initialize LangChain agent
  console.log('Initializing LangChain agent...');
  console.log('  • Temperature: 0.2 (business reasoning mode)');
  console.log('  • Tools: 6 (includes present_recommendation)');
  console.log('  • Validation: enabled');
  const agent = new LangChainEventAgent(mcpClient, ANTHROPIC_API_KEY!);
  await agent.initializeAgent(SYSTEM_PROMPT);
  console.log('✅ Agent initialized\n');

  // Run the test query
  const testQuery = 'Find events for my restaurant in Washington DC in the next two weeks';
  console.log('================================================================================');
  console.log('RUNNING TEST QUERY');
  console.log('================================================================================');
  console.log(`Query: "${testQuery}"\n`);
  console.log('[Agent processing...]\n');

  try {
    const response = await agent.sendMessage(testQuery, []);

    console.log('================================================================================');
    console.log('RESPONSE');
    console.log('================================================================================');
    console.log(response);
    console.log('\n');

    console.log('================================================================================');
    console.log('TEST COMPLETED SUCCESSFULLY');
    console.log('================================================================================');
  } catch (error) {
    console.error('\n================================================================================');
    console.error('TEST FAILED');
    console.error('================================================================================');
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
  }

  // Cleanup
  await mcpClient.close();
}

runTest();
