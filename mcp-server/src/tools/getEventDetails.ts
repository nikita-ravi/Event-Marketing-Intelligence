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

  // Extract venue info
  const venue = rawEvent._embedded?.venues?.[0];
  const venueName = venue?.name || 'Unknown Venue';
  const city = venue?.city?.name || 'Unknown City';

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

  // Extract URL
  const url = rawEvent.url || '';

  return {
    id: rawEvent.id,
    name: rawEvent.name,
    date,
    time,
    venue: {
      name: venueName,
      address,
      city,
      parkingDetail,
      accessibleSeatingDetail,
      capacity
    },
    classification,
    priceRanges,
    url
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
