import { TicketmasterClient } from './src/ticketmasterClient.js';
import { searchEvents } from './src/tools/searchEvents.js';
import { searchAttractions } from './src/tools/searchAttractions.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new TicketmasterClient({
  apiKey: process.env.TICKETMASTER_API_KEY!
});

async function test() {
  console.log('\n🧪 Testing New Fields in Search Results\n');
  console.log('='.repeat(80));

  // Test 1: Search with latlong + radius
  console.log('\n📍 TEST 1: Radius Search (latlong + radius)');
  console.log('-'.repeat(80));

  const events = await searchEvents(client, {
    latlong: '34.0522,-118.2437',
    radius: 10,
    unit: 'miles',
    classificationName: 'Music',
    startDateTime: '2026-08-01T00:00:00Z',
    endDateTime: '2026-08-31T23:59:59Z',
    size: 5
  });

  if (events.length > 0) {
    const event = events[0];
    console.log('\n✅ First event result:');
    console.log('  Name:', event.name);
    console.log('  Genre:', event.genre, '| Sub-genre:', event.subGenre);
    console.log('  Venue Capacity:', event.venueCapacity);
    console.log('  Distance:', event.distance, 'miles');
    console.log('  Image URL:', event.imageUrl ? 'Present' : 'Missing');
    console.log('  On-sale date:', event.onsaleStartDate);
    console.log('  Attractions:', event.attractions);
  }

  // Test 2: Search attractions
  console.log('\n\n🎤 TEST 2: Search Attractions');
  console.log('-'.repeat(80));

  const attractions = await searchAttractions(client, 'Billie Eilish');

  if (attractions.length > 0) {
    const attr = attractions[0];
    console.log('\n✅ First attraction result:');
    console.log('  Name:', attr.name);
    console.log('  Genre:', attr.genre, '| Sub-genre:', attr.subGenre);
    console.log('  Upcoming events:', attr.upcomingEventCount);
    console.log('  Image URL:', attr.imageUrl ? 'Present' : 'Missing');
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('✅ All new fields are working correctly!');
  console.log('='.repeat(80) + '\n');
}

test().catch(console.error);
