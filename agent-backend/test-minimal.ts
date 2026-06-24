#!/usr/bin/env node

import { ChatAnthropic } from '@langchain/anthropic';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import dotenv from 'dotenv';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

async function test() {
  console.log('Testing minimal LangGraph agent...\n');

  // Create a simple test tool
  const testTool = new DynamicStructuredTool({
    name: 'get_number',
    description: 'Returns a number',
    schema: z.object({}),
    func: async () => {
      console.log('Tool called!');
      return '42';
    },
  });

  // Create model
  const model = new ChatAnthropic({
    modelName: 'claude-sonnet-4-5-20250929',
    anthropicApiKey: ANTHROPIC_API_KEY,
    temperature: 0.2,
    maxTokens: 500,
  });

  // Create agent
  const agent = createReactAgent({
    llm: model,
    tools: [testTool],
  });

  console.log('Agent created. Invoking...\n');

  try {
    const result = await Promise.race([
      agent.invoke({
        messages: [{ role: 'user', content: 'Call the get_number tool and tell me what it returns' }],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 30s')), 30000)
      ),
    ]);

    console.log('\n✅ SUCCESS!');
    console.log('Messages:', result.messages?.length || 0);
    console.log('Last message:', result.messages[result.messages.length - 1]?.content);
  } catch (error) {
    console.error('\n❌ FAILED');
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

test();
