#!/usr/bin/env node

import { ChatAnthropic } from '@langchain/anthropic';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MCPClient } from './src/mcpClient.js';
import { extractEventIds } from './src/guardrails.js';
import dotenv from 'dotenv';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const MCP_SERVER_PATH = '../mcp-server/src/index.ts';

let lastSearchResults: string[] = [];

async function test() {
  console.log('Testing multi-tool agent...\n');

  // Initialize MCP client
  console.log('Connecting to MCP server...');
  const mcpClient = new MCPClient();
  await mcpClient.connect(MCP_SERVER_PATH);
  console.log('✅ MCP client connected\n');

  // Tool 1: Search Events
  const searchTool = new DynamicStructuredTool({
    name: 'search_events',
    description: 'Search for events. Call this FIRST.',
    schema: z.object({
      city: z.string().optional(),
      stateCode: z.string().optional(),
      startDateTime: z.string(),
      endDateTime: z.string(),
      size: z.number().optional(),
    }),
    func: async (input) => {
      console.log('[Tool 1] search_events called');
      const mcpResult = await mcpClient.callTool('search_events', input);
      const actualData = mcpResult.content[0].text;

      lastSearchResults = extractEventIds(actualData);
      console.log(`[Tool 1] Tracked ${lastSearchResults.length} event IDs`);

      return actualData;
    },
  });

  // Tool 2: Score Events
  const scoreTool = new DynamicStructuredTool({
    name: 'score_events',
    description: 'Score events based on brand category. Call AFTER search_events.',
    schema: z.object({
      events: z.array(z.any()),
      brandCategory: z.string(),
    }),
    func: async (input) => {
      console.log('[Tool 2] score_events called with', input.events?.length || 0, 'events');
      const mcpResult = await mcpClient.callTool('score_events_baseline', input);
      const actualData = mcpResult.content[0].text;
      console.log('[Tool 2] Scored events, response length:', actualData.length);
      return actualData;
    },
  });

  // Tool 3: Present Recommendation
  const presentTool = new DynamicStructuredTool({
    name: 'present_recommendation',
    description: 'FINAL ANSWER - present recommendations to user',
    schema: z.object({
      recommendations: z.array(z.object({
        eventId: z.string(),
        adjustedScore: z.number(),
        rationale: z.string(),
      })),
    }),
    func: async (input) => {
      console.log('[Tool 3] present_recommendation called with', input.recommendations.length, 'recommendations');
      return JSON.stringify({ validationPassed: true, ...input });
    },
  });

  const model = new ChatAnthropic({
    modelName: 'claude-sonnet-4-5-20250929',
    anthropicApiKey: ANTHROPIC_API_KEY,
    temperature: 0.2,
    maxTokens: 4096,
  });

  const agent = createReactAgent({
    llm: model,
    tools: [searchTool, scoreTool, presentTool],
  });

  console.log('Agent created with 3 tools. Invoking...\n');

  try {
    const result = await Promise.race([
      agent.invoke({
        messages: [{
          role: 'user',
          content: 'Find events for a restaurant in Washington DC in the next week. Search, score them, and present recommendations.'
        }],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 90s')), 90000)
      ),
    ]);

    console.log('\n✅ SUCCESS!');
    console.log('Messages:', result.messages?.length || 0);
    const lastMessage = result.messages[result.messages.length - 1];
    console.log('Last message preview:', String(lastMessage?.content).slice(0, 300));
  } catch (error) {
    console.error('\n❌ FAILED');
    console.error('Error:', error instanceof Error ? error.message : error);
  }

  await mcpClient.close();
}

test();
