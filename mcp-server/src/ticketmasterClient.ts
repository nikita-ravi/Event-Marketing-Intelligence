import fetch from 'node-fetch';

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

export interface TicketmasterConfig {
  apiKey: string;
}

export interface SearchEventsParams {
  dmaId?: string;
  city?: string;
  stateCode?: string;
  classificationName?: string;
  startDateTime: string;
  endDateTime: string;
  size?: number;
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
    url.searchParams.set('sort', 'date,asc');
    url.searchParams.set('startDateTime', params.startDateTime);
    url.searchParams.set('endDateTime', params.endDateTime);

    if (params.size) {
      url.searchParams.set('size', params.size.toString());
    }

    // Location filters - prefer DMA ID over city
    if (params.dmaId) {
      url.searchParams.set('dmaId', params.dmaId);
    } else if (params.city) {
      url.searchParams.set('city', params.city);
      if (params.stateCode) {
        url.searchParams.set('stateCode', params.stateCode);
      }
    }

    if (params.classificationName) {
      url.searchParams.set('classificationName', params.classificationName);
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
}
