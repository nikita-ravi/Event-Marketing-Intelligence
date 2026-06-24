#!/usr/bin/env node

import { ChatAnthropic } from '@langchain/anthropic';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MCPClient } from './src/mcpClient.js';
import dotenv from 'dotenv';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const MCP_SERVER_PATH = '../mcp-server/src/index.ts';

async function test() {
  console.log('Testing LangGraph agent with MCP client...\n');

  // Initialize MCP client
  console.log('Connecting to MCP server...');
  const mcpClient = new MCPClient();
  await mcpClient.connect(MCP_SERVER_PATH);
  console.log('✅ MCP client connected\n');

  // Create a tool that calls MCP
  const searchTool = new DynamicStructuredTool({
    name: 'search_events',
    description: 'Search for events. Returns event data.',
    schema: z.object({
      city: z.string().optional(),
      stateCode: z.string().optional(),
      startDateTime: z.string(),
      endDateTime: z.string(),
    }),
    func: async (input) => {
      console.log('Calling search_events tool...');
      const mcpResult = await mcpClient.callTool('search_events', input);
      const actualData = mcpResult.content[0].text;
      console.log('Tool returned data length:', actualData.length);
      return actualData;
    },
  });

  // Create model
  const model = new ChatAnthropic({
    modelName: 'claude-sonnet-4-5-20250929',
    anthropicApiKey: ANTHROPIC_API_KEY,
    temperature: 0.2,
    maxTokens: 2000,
  });

  // Create agent
  const agent = createReactAgent({
    llm: model,
    tools: [searchTool],
  });

  console.log('Agent created. Invoking...\n');

  try {
    const result = await Promise.race([
      agent.invoke({
        messages: [{
          role: 'user',
          content: 'Search for events in Washington DC in the next week. Use the search_events tool.'
        }],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 60s')), 60000)
      ),
    ]);

    console.log('\n✅ SUCCESS!');
    console.log('Messages:', result.messages?.length || 0);
    const lastMessage = result.messages[result.messages.length - 1];
    console.log('Last message type:', lastMessage?.type || 'unknown');
    console.log('Last message preview:', String(lastMessage?.content).slice(0, 200));
  } catch (error) {
    console.error('\n❌ FAILED');
    console.error('Error:', error instanceof Error ? error.message : error);
  }

  await mcpClient.close();
}

test();
