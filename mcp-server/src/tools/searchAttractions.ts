import { TicketmasterClient } from '../ticketmasterClient.js';
import { Attraction } from '../types.js';

/**
 * Shape raw attractions search response into clean Attraction array
 */
function shapeAttractions(rawResponse: any): Attraction[] {
  if (!rawResponse._embedded?.attractions) {
    return [];
  }

  return rawResponse._embedded.attractions.map((attr: any): Attraction => {
    const classifications = attr.classifications?.[0];
    const classification =
      classifications?.segment?.name ||
      classifications?.genre?.name ||
      classifications?.subGenre?.name ||
      'Unknown';

    const genre = classifications?.genre?.name || null;
    const subGenre = classifications?.subGenre?.name || null;

    const imageUrl =
      attr.images && attr.images.length > 0 ? attr.images[0].url : null;

    const url = attr.url || null;

    const upcomingEventCount = attr.upcomingEvents?._total || 0;

    return {
      id: attr.id,
      name: attr.name,
      classification,
      genre,
      subGenre,
      url,
      imageUrl,
      upcomingEventCount
    };
  });
}

/**
 * Search for attractions (artists, teams, performers) by keyword
 * Returns up to 10 matching attractions
 */
export async function searchAttractions(
  client: TicketmasterClient,
  keyword: string
): Promise<Attraction[]> {
  const rawResponse = await client.searchAttractions(keyword);
  const shaped = shapeAttractions(rawResponse);

  console.log(
    `[Attractions search] "${keyword}": ${shaped.length} attractions found`
  );

  return shaped;
}
