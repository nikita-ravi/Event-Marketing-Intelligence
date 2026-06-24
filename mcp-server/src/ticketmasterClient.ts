import fetch from 'node-fetch';

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

export interface TicketmasterConfig {
  apiKey: string;
}

export interface SearchEventsParams {
  // Location filters
  dmaId?: string;
  city?: string;
  stateCode?: string;
  geoPoint?: string; // geoHash for precise location
  latlong?: string; // "lat,long" format
  radius?: number;
  unit?: 'miles' | 'km';

  // Classification filters
  classificationName?: string;
  genreId?: string;
  subGenreId?: string;
  segmentId?: string;

  // Attraction/venue filters
  attractionId?: string;
  venueId?: string;

  // Date/time filters
  startDateTime: string;
  endDateTime: string;
  onsaleStartDateTime?: string; // Tickets going on sale
  onsaleEndDateTime?: string;

  // Other filters
  size?: number;
  includeFamily?: 'yes' | 'no' | 'only';
  keyword?: string;
}

export class TicketmasterClient {
  private apiKey: string;

  constructor(config: TicketmasterConfig) {
    if (!config.apiKey) {
      throw new Error('Ticketmaster API key is required');
    }
    this.apiKey = config.apiKey;
  }

  /**
   * Search for events using Ticketmaster Discovery API
   * Returns raw API response - shaping happens in the tool layer
   */
  async searchEvents(params: SearchEventsParams): Promise<any> {
    const url = new URL(`${BASE_URL}/events.json`);

    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('sort', params.latlong || params.geoPoint ? 'distance,asc' : 'date,asc');
    url.searchParams.set('startDateTime', params.startDateTime);
    url.searchParams.set('endDateTime', params.endDateTime);

    if (params.size) {
      url.searchParams.set('size', params.size.toString());
    }

    // Geographic radius search
    if (params.geoPoint) {
      url.searchParams.set('geoPoint', params.geoPoint);
    } else if (params.latlong) {
      url.searchParams.set('latlong', params.latlong);
      if (params.radius) {
        url.searchParams.set('radius', params.radius.toString());
        url.searchParams.set('unit', params.unit || 'miles');
      }
    }
    // Location filters - prefer geoPoint/latlong, then DMA ID, then city
    else if (params.dmaId) {
      url.searchParams.set('dmaId', params.dmaId);
    } else if (params.city) {
      url.searchParams.set('city', params.city);
      if (params.stateCode) {
        url.searchParams.set('stateCode', params.stateCode);
      }
    }

    // Classification filters
    if (params.classificationName) {
      url.searchParams.set('classificationName', params.classificationName);
    }
    if (params.genreId) {
      url.searchParams.set('genreId', params.genreId);
    }
    if (params.subGenreId) {
      url.searchParams.set('subGenreId', params.subGenreId);
    }
    if (params.segmentId) {
      url.searchParams.set('segmentId', params.segmentId);
    }

    // Attraction/venue filters
    if (params.attractionId) {
      url.searchParams.set('attractionId', params.attractionId);
    }
    if (params.venueId) {
      url.searchParams.set('venueId', params.venueId);
    }

    // On-sale date filters
    if (params.onsaleStartDateTime) {
      url.searchParams.set('onsaleStartDateTime', params.onsaleStartDateTime);
    }
    if (params.onsaleEndDateTime) {
      url.searchParams.set('onsaleEndDateTime', params.onsaleEndDateTime);
    }

    // Other filters
    if (params.includeFamily) {
      url.searchParams.set('includeFamily', params.includeFamily);
    }
    if (params.keyword) {
      url.searchParams.set('keyword', params.keyword);
    }

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ticketmaster API error (${response.status}): ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search events: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get detailed information about a specific event
   * Returns raw API response - shaping happens in the tool layer
   */
  async getEventDetails(eventId: string): Promise<any> {
    const url = new URL(`${BASE_URL}/events/${eventId}.json`);
    url.searchParams.set('apikey', this.apiKey);

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Event not found: ${eventId}`);
        }
        const errorText = await response.text();
        throw new Error(
          `Ticketmaster API error (${response.status}): ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get event details: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Search for attractions (artists, teams, performers)
   * Returns raw API response - shaping happens in the tool layer
   */
  async searchAttractions(keyword: string): Promise<any> {
    const url = new URL(`${BASE_URL}/attractions.json`);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('size', '10');

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ticketmaster API error (${response.status}): ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search attractions: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get detailed information about a specific attraction
   * Returns raw API response - shaping happens in the tool layer
   */
  async getAttractionDetails(attractionId: string): Promise<any> {
    const url = new URL(`${BASE_URL}/attractions/${attractionId}.json`);
    url.searchParams.set('apikey', this.apiKey);

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Attraction not found: ${attractionId}`);
        }
        const errorText = await response.text();
        throw new Error(
          `Ticketmaster API error (${response.status}): ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get attraction details: ${error.message}`);
      }
      throw error;
    }
  }
}
