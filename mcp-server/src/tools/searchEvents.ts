import { TicketmasterClient, SearchEventsParams } from '../ticketmasterClient.js';
import { TrimmedEvent } from '../types.js';

interface CacheEntry {
  data: TrimmedEvent[];
  timestamp: number;
}

// In-memory cache: protects daily API quota during dev/demo
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS || '900000'); // 15 min default

function getCacheKey(params: SearchEventsParams): string {
  return JSON.stringify({
    dmaId: params.dmaId || null,
    city: params.city || null,
    state: params.stateCode || null,
    classification: params.classificationName || null,
    start: params.startDateTime,
    end: params.endDateTime,
    size: params.size || 20
  });
}

/**
 * Shape raw Ticketmaster response into clean TrimmedEvent structure
 * CRITICAL: Never return raw API JSON - always transform first
 */
function shapeEvents(rawResponse: any): TrimmedEvent[] {
  if (!rawResponse._embedded?.events) {
    return [];
  }

  return rawResponse._embedded.events.map((event: any): TrimmedEvent => {
    // Extract classification - prefer segment > genre > subGenre
    const classifications = event.classifications?.[0];
    const classification =
      classifications?.segment?.name ||
      classifications?.genre?.name ||
      classifications?.subGenre?.name ||
      'Unknown';

    // Extract venue info
    const venue = event._embedded?.venues?.[0];
    const venueName = venue?.name || 'Unknown Venue';
    const city = venue?.city?.name || 'Unknown City';

    // Extract location coordinates
    const lat = venue?.location?.latitude
      ? parseFloat(venue.location.latitude)
      : null;
    const lon = venue?.location?.longitude
      ? parseFloat(venue.location.longitude)
      : null;

    // Extract date/time
    const dates = event.dates?.start;
    const date = dates?.localDate || 'TBD';
    const time = dates?.localTime || null;

    // Extract price range
    let priceRange: { min: number; max: number } | null = null;
    if (event.priceRanges && event.priceRanges.length > 0) {
      const prices = event.priceRanges[0];
      if (prices.min !== undefined && prices.max !== undefined) {
        priceRange = {
          min: parseFloat(prices.min),
          max: parseFloat(prices.max)
        };
      }
    }

    return {
      id: event.id,
      name: event.name,
      date,
      time,
      classification,
      venueName,
      city,
      lat,
      lon,
      priceRange
    };
  });
}

/**
 * Search for events with automatic caching
 */
export async function searchEvents(
  client: TicketmasterClient,
  params: SearchEventsParams
): Promise<TrimmedEvent[]> {
  const cacheKey = getCacheKey(params);

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[Cache HIT] Returning cached results for query`);
    return cached.data;
  }

  console.log(`[Cache MISS] Fetching fresh data from Ticketmaster`);

  // Fetch fresh data
  const rawResponse = await client.searchEvents(params);
  const shaped = shapeEvents(rawResponse);

  // Update cache
  cache.set(cacheKey, {
    data: shaped,
    timestamp: Date.now()
  });

  console.log(
    `[Response shaped] ${shaped.length} events returned (raw response had ${rawResponse._embedded?.events?.length || 0} events)`
  );

  return shaped;
}
