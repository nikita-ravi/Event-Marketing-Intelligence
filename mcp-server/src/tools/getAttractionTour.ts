import { TicketmasterClient } from '../ticketmasterClient.js';
import { Attraction, AttractionTour, TrimmedEvent } from '../types.js';
import { searchEvents } from './searchEvents.js';

/**
 * Shape raw attraction response into clean Attraction structure
 */
function shapeAttraction(rawAttraction: any): Attraction {
  const classifications = rawAttraction.classifications?.[0];
  const classification =
    classifications?.segment?.name ||
    classifications?.genre?.name ||
    classifications?.subGenre?.name ||
    'Unknown';

  const genre = classifications?.genre?.name || null;
  const subGenre = classifications?.subGenre?.name || null;

  const imageUrl =
    rawAttraction.images && rawAttraction.images.length > 0
      ? rawAttraction.images[0].url
      : null;

  const url = rawAttraction.url || null;

  const upcomingEventCount = rawAttraction.upcomingEvents?._total || 0;

  return {
    id: rawAttraction.id,
    name: rawAttraction.name,
    classification,
    genre,
    subGenre,
    url,
    imageUrl,
    upcomingEventCount
  };
}

/**
 * Get all upcoming events for a specific attraction (artist, team, performer)
 * This enables "tour tracking" - marketers can follow artists and plan campaigns
 * around their tour dates
 */
export async function getAttractionTour(
  client: TicketmasterClient,
  attractionId: string
): Promise<AttractionTour> {
  // Get attraction details first
  const rawAttraction = await client.getAttractionDetails(attractionId);
  const attraction = shapeAttraction(rawAttraction);

  // Search for all upcoming events for this attraction
  // Use a 1-year window from today
  const now = new Date();
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(now.getFullYear() + 1);

  const startDateTime = now.toISOString().split('.')[0] + 'Z';
  const endDateTime = oneYearFromNow.toISOString().split('.')[0] + 'Z';

  const events = await searchEvents(client, {
    attractionId,
    startDateTime,
    endDateTime,
    size: 100 // Get up to 100 tour dates
  });

  console.log(
    `[Attraction tour] ${attraction.name}: ${events.length} upcoming events`
  );

  return {
    attraction,
    events
  };
}
