// Test script for new features
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

async function testChat(message) {
  console.log(`\n🧪 Testing: "${message}"\n`);

  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  const data = await response.json();
  console.log('Response:', data.response);
  return data;
}

async function runTests() {
  try {
    // Test 1: Search for an artist to verify search_attractions works
    console.log('\n' + '='.repeat(80));
    console.log('TEST 1: Artist Search (search_attractions)');
    console.log('='.repeat(80));
    await testChat('Search for Taylor Swift');

    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s between tests

    // Test 2: Search events in LA with radius to verify latlong + new fields
    console.log('\n' + '='.repeat(80));
    console.log('TEST 2: Radius Search with New Fields');
    console.log('='.repeat(80));
    await testChat('Find music events within 10 miles of downtown Los Angeles (34.0522,-118.2437) for my restaurant in August 2026');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 3: Regular city search to verify enhanced scoring with capacity
    console.log('\n' + '='.repeat(80));
    console.log('TEST 3: Enhanced Scoring with Venue Capacity');
    console.log('='.repeat(80));
    await testChat('Find events in New York City for my retail brand in July 2026');

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();
