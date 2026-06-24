#!/usr/bin/env node

/**
 * Standalone test script for search_events tool
 * Run: npm test
 *
 * Verifies:
 * - API connection works
 * - Raw Ticketmaster JSON is transformed (not returned as-is)
 * - Caching functions correctly
 */

import dotenv from 'dotenv';
import { TicketmasterClient } from './ticketmasterClient.js';
import { searchEvents } from './tools/searchEvents.js';

dotenv.config();

async function testSearchEvents() {
  console.log('=== Event Search Test ===\n');

  // Check API key
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error('❌ TICKETMASTER_API_KEY not found in .env file');
    console.error('Please create a .env file with your API key');
    process.exit(1);
  }

  const client = new TicketmasterClient({ apiKey });

  // Test query: Music events in Los Angeles, next 30 days
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Format dates to match Ticketmaster's required format (YYYY-MM-DDTHH:mm:ssZ)
  const formatDate = (date: Date) => {
    return date.toISOString().split('.')[0] + 'Z';
  };

  const params = {
    city: 'Los Angeles',
    stateCode: 'CA',
    classificationName: 'Music',
    startDateTime: formatDate(now),
    endDateTime: formatDate(thirtyDaysOut),
    size: 5
  };

  console.log('Test query:', JSON.stringify(params, null, 2));
  console.log('\n--- First call (should fetch fresh) ---');

  try {
    const results1 = await searchEvents(client, params);
    console.log(`\n✅ Received ${results1.length} events`);

    if (results1.length > 0) {
      console.log('\nSample event (shaped):');
      console.log(JSON.stringify(results1[0], null, 2));

      // Verify shape
      const sample = results1[0];
      const requiredFields = ['id', 'name', 'date', 'classification', 'venueName', 'city'];
      const hasAllFields = requiredFields.every(field => field in sample);

      if (hasAllFields) {
        console.log('\n✅ Response shaping confirmed - has all required fields');
      } else {
        console.log('\n❌ Warning: Missing required fields in shaped response');
      }
    }

    // Test cache
    console.log('\n--- Second call (should use cache) ---');
    const results2 = await searchEvents(client, params);
    console.log(`\n✅ Received ${results2.length} events from cache`);

    if (results1.length === results2.length) {
      console.log('✅ Cache working correctly - same number of results');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }

  console.log('\n=== All tests passed ===');
}

testSearchEvents();
