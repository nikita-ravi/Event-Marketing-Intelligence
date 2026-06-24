import { TicketmasterClient } from '../ticketmasterClient.js';
import { EventDetails } from '../types.js';

/**
 * Shape raw event details response into clean EventDetails structure
 * CRITICAL: Never return raw API JSON - always transform first
 */
function shapeEventDetails(rawEvent: any): EventDetails {
  // Extract classification
  const classifications = rawEvent.classifications?.[0];
  const classification =
    classifications?.segment?.name ||
    classifications?.genre?.name ||
    classifications?.subGenre?.name ||
    'Unknown';

  // Extract genre and subGenre
  const genre = classifications?.genre?.name || null;
  const subGenre = classifications?.subGenre?.name || null;

  // Extract venue info
  const venue = rawEvent._embedded?.venues?.[0];
  const venueName = venue?.name || 'Unknown Venue';
  const venueId = venue?.id || '';
  const city = venue?.city?.name || 'Unknown City';
  const stateCode = venue?.state?.stateCode || null;

  // Extract location coordinates
  const lat = venue?.location?.latitude
    ? parseFloat(venue.location.latitude)
    : null;
  const lon = venue?.location?.longitude
    ? parseFloat(venue.location.longitude)
    : null;

  // Build address from available components
  let address: string | null = null;
  if (venue?.address) {
    const parts = [
      venue.address.line1,
      venue.address.line2,
      venue.city?.name,
      venue.state?.stateCode,
      venue.postalCode
    ].filter(Boolean);
    address = parts.length > 0 ? parts.join(', ') : null;
  }

  // Extract parking and accessibility details
  const parkingDetail = venue?.parkingDetail || null;
  const accessibleSeatingDetail = venue?.accessibleSeatingDetail || null;

  // Extract capacity (sparsely populated - treat as optional bonus)
  const capacity = venue?.capacity ? parseInt(venue.capacity, 10) : null;

  // Extract date/time
  const dates = rawEvent.dates?.start;
  const date = dates?.localDate || 'TBD';
  const time = dates?.localTime || null;

  // Extract price ranges
  let priceRanges: { min: number; max: number } | null = null;
  if (rawEvent.priceRanges && rawEvent.priceRanges.length > 0) {
    const prices = rawEvent.priceRanges[0];
    if (prices.min !== undefined && prices.max !== undefined) {
      priceRanges = {
        min: parseFloat(prices.min),
        max: parseFloat(prices.max)
      };
    }
  }

  // Extract images
  const images = rawEvent.images
    ? rawEvent.images.map((img: any) => ({
        url: img.url,
        width: img.width,
        height: img.height
      }))
    : [];

  // Extract attractions (artists/teams)
  const attractions = rawEvent._embedded?.attractions
    ? rawEvent._embedded.attractions.map((attr: any) => ({
        id: attr.id,
        name: attr.name,
        url: attr.url || null
      }))
    : [];

  // Extract on-sale dates
  const onsaleStartDate = rawEvent.sales?.public?.startDateTime || null;
  const onsaleEndDate = rawEvent.sales?.public?.endDateTime || null;
  const presaleStartDate = rawEvent.sales?.presales?.[0]?.startDateTime || null;

  // Extract URL
  const url = rawEvent.url || '';

  return {
    id: rawEvent.id,
    name: rawEvent.name,
    date,
    time,
    venue: {
      id: venueId,
      name: venueName,
      address,
      city,
      stateCode,
      lat,
      lon,
      parkingDetail,
      accessibleSeatingDetail,
      capacity
    },
    classification,
    genre,
    subGenre,
    attractions,
    priceRanges,
    images,
    url,
    onsaleStartDate,
    onsaleEndDate,
    presaleStartDate
  };
}

/**
 * Get detailed information for a specific event
 */
export async function getEventDetails(
  client: TicketmasterClient,
  eventId: string
): Promise<EventDetails> {
  const rawEvent = await client.getEventDetails(eventId);
  const shaped = shapeEventDetails(rawEvent);

  console.log(`[Event details shaped] ${shaped.name} at ${shaped.venue.name}`);

  return shaped;
}
