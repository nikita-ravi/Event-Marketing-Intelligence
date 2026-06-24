#!/usr/bin/env node

import { ChatAnthropic } from '@langchain/anthropic';
import dotenv from 'dotenv';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

async function test() {
  console.log('Testing ChatAnthropic with temperature only...');

  const model = new ChatAnthropic({
    modelName: 'claude-sonnet-4-5-20250929',
    anthropicApiKey: ANTHROPIC_API_KEY,
    temperature: 0.2,
    maxTokens: 100,
  });

  try {
    const result = await model.invoke('Say hello in 5 words');
    console.log('SUCCESS:', result.content);
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : error);
  }
}

test();
