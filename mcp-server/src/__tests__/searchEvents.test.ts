import { describe, it, expect, beforeAll, vi } from 'vitest';
import { TicketmasterClient } from '../ticketmasterClient.js';
import { searchEvents } from '../tools/searchEvents.js';

describe('searchEvents', () => {
  let client: TicketmasterClient;

  beforeAll(() => {
    // Use test API key or mock client
    client = new TicketmasterClient({
      apiKey: process.env.TICKETMASTER_API_KEY || 'test-key',
    });
  });

  describe('Response Shaping', () => {
    it('should return trimmed events with all required fields', async () => {
      const mockResponse = {
        _embedded: {
          events: [
            {
              id: 'test-event-1',
              name: 'Test Concert',
              dates: {
                start: {
                  localDate: '2026-08-15',
                  localTime: '20:00:00',
                },
              },
              classifications: [
                {
                  segment: { name: 'Music' },
                  genre: { name: 'Rock' },
                  subGenre: { name: 'Alternative Rock' },
                },
              ],
              _embedded: {
                venues: [
                  {
                    id: 'venue-123',
                    name: 'Test Arena',
                    city: { name: 'Los Angeles' },
                    state: { stateCode: 'CA' },
                    location: {
                      latitude: '34.0522',
                      longitude: '-118.2437',
                    },
                    capacity: '20000',
                  },
                ],
                attractions: [
                  { id: 'artist-1', name: 'Test Band' },
                ],
              },
              priceRanges: [{ min: 50, max: 150 }],
              images: [{ url: 'https://example.com/image.jpg' }],
              url: 'https://example.com/event',
              sales: {
                public: {
                  startDateTime: '2026-06-01T10:00:00Z',
                },
              },
              distance: 5.2,
            },
          ],
        },
      };

      // Mock the client's searchEvents method
      vi.spyOn(client, 'searchEvents').mockResolvedValue(mockResponse);

      const results = await searchEvents(client, {
        city: 'Los Angeles',
        stateCode: 'CA',
        startDateTime: '2026-08-01T00:00:00Z',
        endDateTime: '2026-08-31T23:59:59Z',
      });

      expect(results).toHaveLength(1);

      const event = results[0];
      expect(event).toHaveProperty('id', 'test-event-1');
      expect(event).toHaveProperty('name', 'Test Concert');
      expect(event).toHaveProperty('date', '2026-08-15');
      expect(event).toHaveProperty('time', '20:00:00');
      expect(event).toHaveProperty('classification', 'Music');
      expect(event).toHaveProperty('genre', 'Rock');
      expect(event).toHaveProperty('subGenre', 'Alternative Rock');
      expect(event).toHaveProperty('venueName', 'Test Arena');
      expect(event).toHaveProperty('venueId', 'venue-123');
      expect(event).toHaveProperty('venueCapacity', 20000);
      expect(event).toHaveProperty('city', 'Los Angeles');
      expect(event).toHaveProperty('stateCode', 'CA');
      expect(event).toHaveProperty('lat', 34.0522);
      expect(event).toHaveProperty('lon', -118.2437);
      expect(event).toHaveProperty('distance', 5.2);
      expect(event).toHaveProperty('imageUrl', 'https://example.com/image.jpg');
      expect(event).toHaveProperty('url', 'https://example.com/event');
      expect(event).toHaveProperty('onsaleStartDate', '2026-06-01T10:00:00Z');
      expect(event.attractions).toEqual([{ id: 'artist-1', name: 'Test Band' }]);
      expect(event.priceRange).toEqual({ min: 50, max: 150 });
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockResponse = {
        _embedded: {
          events: [
            {
              id: 'test-event-2',
              name: 'Test Event',
              dates: { start: { localDate: '2026-08-15' } },
              _embedded: {
                venues: [{ name: 'Test Venue', city: { name: 'Test City' } }],
              },
            },
          ],
        },
      };

      vi.spyOn(client, 'searchEvents').mockResolvedValue(mockResponse);

      const results = await searchEvents(client, {
        city: 'Test City',
        stateCode: 'CA',
        startDateTime: '2026-08-01T00:00:00Z',
        endDateTime: '2026-08-31T23:59:59Z',
      });

      expect(results).toHaveLength(1);

      const event = results[0];
      expect(event.time).toBeNull();
      expect(event.genre).toBeNull();
      expect(event.subGenre).toBeNull();
      expect(event.venueId).toBeNull();
      expect(event.venueCapacity).toBeNull();
      expect(event.stateCode).toBeNull();
      expect(event.lat).toBeNull();
      expect(event.lon).toBeNull();
      expect(event.distance).toBeNull();
      expect(event.imageUrl).toBeNull();
      expect(event.url).toBeNull();
      expect(event.onsaleStartDate).toBeNull();
      expect(event.attractions).toBeNull();
      expect(event.priceRange).toBeNull();
    });

    it('should return empty array when no events found', async () => {
      const mockResponse = {};

      vi.spyOn(client, 'searchEvents').mockResolvedValue(mockResponse);

      const results = await searchEvents(client, {
        city: 'Nowhere',
        stateCode: 'CA',
        startDateTime: '2026-08-01T00:00:00Z',
        endDateTime: '2026-08-31T23:59:59Z',
      });

      expect(results).toEqual([]);
    });
  });

  describe('Caching', () => {
    it('should cache results for identical queries', async () => {
      const mockResponse = {
        _embedded: {
          events: [
            {
              id: 'cached-event',
              name: 'Cached Event',
              dates: { start: { localDate: '2026-08-15' } },
              _embedded: {
                venues: [{ name: 'Venue', city: { name: 'LA' } }],
              },
            },
          ],
        },
      };

      const spy = vi.spyOn(client, 'searchEvents').mockResolvedValue(mockResponse);

      const params = {
        city: 'Los Angeles',
        stateCode: 'CA',
        startDateTime: '2026-08-01T00:00:00Z',
        endDateTime: '2026-08-31T23:59:59Z',
      };

      // First call
      const results1 = await searchEvents(client, params);

      // Second call with same params (should use cache)
      const results2 = await searchEvents(client, params);

      expect(results1).toEqual(results2);
      expect(spy).toHaveBeenCalledTimes(1); // API called only once
    });
  });

  describe('Data Validation', () => {
    it('should parse numeric fields correctly', async () => {
      const mockResponse = {
        _embedded: {
          events: [
            {
              id: 'test-validation',
              name: 'Validation Test',
              dates: { start: { localDate: '2026-08-15' } },
              _embedded: {
                venues: [
                  {
                    name: 'Venue',
                    city: { name: 'LA' },
                    location: { latitude: '34.0522', longitude: '-118.2437' },
                    capacity: '5000',
                  },
                ],
              },
              priceRanges: [{ min: '25.50', max: '100.99' }],
              distance: '12.5',
            },
          ],
        },
      };

      vi.spyOn(client, 'searchEvents').mockResolvedValue(mockResponse);

      const results = await searchEvents(client, {
        city: 'LA',
        stateCode: 'CA',
        startDateTime: '2026-08-01T00:00:00Z',
        endDateTime: '2026-08-31T23:59:59Z',
      });

      const event = results[0];
      expect(typeof event.lat).toBe('number');
      expect(typeof event.lon).toBe('number');
      expect(typeof event.venueCapacity).toBe('number');
      expect(typeof event.distance).toBe('number');
      expect(typeof event.priceRange?.min).toBe('number');
      expect(typeof event.priceRange?.max).toBe('number');
    });
  });
});
