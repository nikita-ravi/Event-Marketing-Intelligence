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
    // Location filters
    dmaId: params.dmaId || null,
    city: params.city || null,
    state: params.stateCode || null,
    geoPoint: params.geoPoint || null,
    latlong: params.latlong || null,
    radius: params.radius || null,
    unit: params.unit || null,
    // Classification filters
    classification: params.classificationName || null,
    genreId: params.genreId || null,
    subGenreId: params.subGenreId || null,
    segmentId: params.segmentId || null,
    // Attraction/venue filters
    attractionId: params.attractionId || null,
    venueId: params.venueId || null,
    // Date/time filters
    start: params.startDateTime,
    end: params.endDateTime,
    onsaleStart: params.onsaleStartDateTime || null,
    onsaleEnd: params.onsaleEndDateTime || null,
    // Other filters
    size: params.size || 20,
    includeFamily: params.includeFamily || null,
    keyword: params.keyword || null
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

    // Extract genre and subGenre
    const genre = classifications?.genre?.name || null;
    const subGenre = classifications?.subGenre?.name || null;

    // Extract venue info
    const venue = event._embedded?.venues?.[0];
    const venueName = venue?.name || 'Unknown Venue';
    const venueId = venue?.id || null;
    const venueCapacity = venue?.capacity ? parseInt(venue.capacity, 10) : null;
    const city = venue?.city?.name || 'Unknown City';
    const stateCode = venue?.state?.stateCode || null;

    // Extract location coordinates
    const lat = venue?.location?.latitude
      ? parseFloat(venue.location.latitude)
      : null;
    const lon = venue?.location?.longitude
      ? parseFloat(venue.location.longitude)
      : null;

    // Extract distance if available (from geo-based search)
    const distance = event.distance ? parseFloat(event.distance) : null;

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

    // Extract image (first image if available)
    const imageUrl =
      event.images && event.images.length > 0 ? event.images[0].url : null;

    // Extract URL
    const url = event.url || null;

    // Extract on-sale date
    const onsaleStartDate = event.sales?.public?.startDateTime || null;

    // Extract attractions (artists/teams)
    const attractions = event._embedded?.attractions
      ? event._embedded.attractions.map((attr: any) => ({
          id: attr.id,
          name: attr.name
        }))
      : null;

    return {
      id: event.id,
      name: event.name,
      date,
      time,
      classification,
      genre,
      subGenre,
      venueName,
      venueId,
      venueCapacity,
      city,
      stateCode,
      lat,
      lon,
      distance,
      priceRange,
      imageUrl,
      url,
      onsaleStartDate,
      attractions
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
  // Set default size to 10 and enforce hard cap of 10
  const cappedParams = {
    ...params,
    size: Math.min(params.size || 10, 10)
  };

  const cacheKey = getCacheKey(cappedParams);

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[Cache HIT] Returning cached results for query`);
    return cached.data;
  }

  console.log(`[Cache MISS] Fetching fresh data from Ticketmaster`);

  // Fetch fresh data
  const rawResponse = await client.searchEvents(cappedParams);
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
