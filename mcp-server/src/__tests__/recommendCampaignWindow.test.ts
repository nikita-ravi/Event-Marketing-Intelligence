import { describe, it, expect } from 'vitest';
import { recommendCampaignWindow } from '../tools/recommendCampaignWindow.js';
import { TrimmedEvent } from '../types.js';

describe('recommendCampaignWindow', () => {
  const createMockEvent = (overrides: Partial<TrimmedEvent> = {}): TrimmedEvent => ({
    id: 'test-event',
    name: 'Test Event',
    date: '2026-08-15',
    time: '20:00:00',
    classification: 'Music',
    genre: 'Rock',
    subGenre: 'Alternative Rock',
    venueName: 'Test Venue',
    venueId: 'venue-1',
    venueCapacity: 5000,
    city: 'Los Angeles',
    stateCode: 'CA',
    lat: 34.0522,
    lon: -118.2437,
    distance: null,
    priceRange: { min: 50, max: 150 },
    imageUrl: 'https://example.com/image.jpg',
    url: 'https://example.com/event',
    onsaleStartDate: '2026-06-01T10:00:00Z',
    attractions: [{ id: 'artist-1', name: 'Test Artist' }],
    ...overrides,
  });

  describe('Classification Scoring', () => {
    it('should give 50 points for matching classification', () => {
      const event = createMockEvent({ classification: 'Music' });
      const results = recommendCampaignWindow([event], 'restaurant');

      expect(results[0].score).toBeGreaterThanOrEqual(50);
      expect(results[0].rationale).toContain('Music aligns with restaurant');
    });

    it('should give 0 points for non-matching classification', () => {
      const event = createMockEvent({ classification: 'Unknown' });
      const results = recommendCampaignWindow([event], 'restaurant');

      // Score should not include classification points
      expect(results[0].rationale).not.toContain('aligns with restaurant');
    });
  });

  describe('Day of Week Scoring', () => {
    it('should give 30 points for weekend events (Friday)', () => {
      // August 15, 2026 is a Saturday
      const fridayEvent = createMockEvent({ date: '2026-08-14' }); // Friday
      const results = recommendCampaignWindow([fridayEvent], 'restaurant');

      expect(results[0].rationale).toContain('Fri timing captures weekend audience');
    });

    it('should give 30 points for weekend events (Saturday)', () => {
      const saturdayEvent = createMockEvent({ date: '2026-08-15' }); // Saturday
      const results = recommendCampaignWindow([saturdayEvent], 'restaurant');

      expect(results[0].rationale).toContain('Sat timing captures weekend audience');
    });

    it('should give 15 points for Thursday events', () => {
      const thursdayEvent = createMockEvent({ date: '2026-08-13' }); // Thursday
      const results = recommendCampaignWindow([thursdayEvent], 'restaurant');

      expect(results[0].rationale).toContain('Thu evening primes weekend engagement');
    });

    it('should give 0 points for weekday events (Monday-Wednesday)', () => {
      const mondayEvent = createMockEvent({ date: '2026-08-10' }); // Monday
      const results = recommendCampaignWindow([mondayEvent], 'restaurant');

      expect(results[0].rationale).not.toContain('timing captures weekend');
    });
  });

  describe('Time of Day Scoring', () => {
    it('should give 20 points for evening events (restaurant category)', () => {
      const eveningEvent = createMockEvent({ time: '20:00:00' });
      const results = recommendCampaignWindow([eveningEvent], 'restaurant');

      expect(results[0].rationale).toContain('evening timing syncs with dining');
    });

    it('should give 10 points for evening events (non-dining category)', () => {
      const eveningEvent = createMockEvent({ time: '20:00:00' });
      const results = recommendCampaignWindow([eveningEvent], 'retail');

      expect(results[0].rationale).toContain('prime-time slot');
    });

    it('should give 5 points for afternoon events', () => {
      const afternoonEvent = createMockEvent({ time: '14:00:00' });
      const results = recommendCampaignWindow([afternoonEvent], 'restaurant');

      expect(results[0].rationale).toContain('afternoon window');
    });

    it('should give 0 points for morning events', () => {
      const morningEvent = createMockEvent({ time: '10:00:00' });
      const results = recommendCampaignWindow([morningEvent], 'restaurant');

      expect(results[0].rationale).not.toContain('timing');
    });
  });

  describe('Price Range Scoring', () => {
    it('should give 10 points for premium pricing (>$50)', () => {
      const premiumEvent = createMockEvent({ priceRange: { min: 75, max: 200 } });
      const results = recommendCampaignWindow([premiumEvent], 'restaurant');

      expect(results[0].rationale).toContain('premium ticket pricing');
    });

    it('should give 0 points for budget pricing (<=$50)', () => {
      const budgetEvent = createMockEvent({ priceRange: { min: 20, max: 45 } });
      const results = recommendCampaignWindow([budgetEvent], 'restaurant');

      expect(results[0].rationale).not.toContain('premium');
    });

    it('should give 0 points when price range is null', () => {
      const freeEvent = createMockEvent({ priceRange: null });
      const results = recommendCampaignWindow([freeEvent], 'restaurant');

      expect(results[0].rationale).not.toContain('premium');
    });
  });

  describe('Venue Capacity Scoring', () => {
    it('should give 15 points for arena-scale venues (20,000+)', () => {
      const arenaEvent = createMockEvent({ venueCapacity: 25000 });
      const results = recommendCampaignWindow([arenaEvent], 'restaurant');

      expect(results[0].rationale).toContain('arena-scale venue');
      expect(results[0].rationale).toContain('25,000 capacity');
    });

    it('should give 10 points for large venues (5,000-20,000)', () => {
      const largeEvent = createMockEvent({ venueCapacity: 10000 });
      const results = recommendCampaignWindow([largeEvent], 'restaurant');

      expect(results[0].rationale).toContain('large venue');
      expect(results[0].rationale).toContain('10,000 capacity');
    });

    it('should give 5 points for medium venues (1,000-5,000)', () => {
      const mediumEvent = createMockEvent({ venueCapacity: 2500 });
      const results = recommendCampaignWindow([mediumEvent], 'restaurant');

      expect(results[0].rationale).toContain('medium venue');
      expect(results[0].rationale).toContain('2,500 capacity');
    });

    it('should give 0 points for small venues (<1,000)', () => {
      const smallEvent = createMockEvent({ venueCapacity: 500 });
      const results = recommendCampaignWindow([smallEvent], 'restaurant');

      expect(results[0].rationale).not.toContain('venue');
    });

    it('should give 0 points when capacity is null', () => {
      const unknownCapacityEvent = createMockEvent({ venueCapacity: null });
      const results = recommendCampaignWindow([unknownCapacityEvent], 'restaurant');

      expect(results[0].rationale).not.toContain('capacity');
    });
  });

  describe('Distance Proximity Scoring', () => {
    it('should give 10 points for hyper-local events (0-5 miles)', () => {
      const hyperLocalEvent = createMockEvent({ distance: 2.5 });
      const results = recommendCampaignWindow([hyperLocalEvent], 'restaurant');

      expect(results[0].rationale).toContain('hyper-local');
      expect(results[0].rationale).toContain('2.5mi away');
    });

    it('should give 7 points for nearby events (5-10 miles)', () => {
      const nearbyEvent = createMockEvent({ distance: 7.2 });
      const results = recommendCampaignWindow([nearbyEvent], 'restaurant');

      expect(results[0].rationale).toContain('nearby');
      expect(results[0].rationale).toContain('7.2mi away');
    });

    it('should give 4 points for metro area events (10-25 miles)', () => {
      const metroEvent = createMockEvent({ distance: 15.8 });
      const results = recommendCampaignWindow([metroEvent], 'restaurant');

      expect(results[0].rationale).toContain('metro area');
      expect(results[0].rationale).toContain('15.8mi away');
    });

    it('should give 0 points for distant events (>25 miles)', () => {
      const distantEvent = createMockEvent({ distance: 50 });
      const results = recommendCampaignWindow([distantEvent], 'restaurant');

      expect(results[0].rationale).not.toContain('mi away');
    });

    it('should give 0 points when distance is null', () => {
      const noDistanceEvent = createMockEvent({ distance: null });
      const results = recommendCampaignWindow([noDistanceEvent], 'restaurant');

      expect(results[0].rationale).not.toContain('mi away');
    });
  });

  describe('Sorting', () => {
    it('should sort events by score in descending order', () => {
      const lowScoreEvent = createMockEvent({
        id: 'low',
        classification: 'Unknown',
        time: '10:00:00',
        priceRange: { min: 10, max: 20 },
        venueCapacity: 100,
        distance: null,
      });

      const highScoreEvent = createMockEvent({
        id: 'high',
        classification: 'Music',
        time: '20:00:00',
        date: '2026-08-15', // Saturday
        priceRange: { min: 100, max: 300 },
        venueCapacity: 25000,
        distance: 2.0,
      });

      const results = recommendCampaignWindow([lowScoreEvent, highScoreEvent], 'restaurant');

      expect(results[0].id).toBe('high');
      expect(results[1].id).toBe('low');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  describe('Brand Category Mapping', () => {
    it('should handle known brand categories', () => {
      const musicEvent = createMockEvent({ classification: 'Music' });

      const restaurantResults = recommendCampaignWindow([musicEvent], 'restaurant');
      expect(restaurantResults[0].rationale).toContain('Music aligns with restaurant');

      const qsrResults = recommendCampaignWindow([musicEvent], 'qsr');
      expect(qsrResults[0].rationale).toContain('Music aligns with qsr');
    });

    it('should handle unknown brand categories with general fallback', () => {
      const musicEvent = createMockEvent({ classification: 'Music' });
      const results = recommendCampaignWindow([musicEvent], 'unknown-category');

      expect(results[0].rationale).toContain('Music aligns with unknown-category');
    });

    it('should be case-insensitive for brand categories', () => {
      const musicEvent = createMockEvent({ classification: 'Music' });

      const upperResults = recommendCampaignWindow([musicEvent], 'RESTAURANT');
      const lowerResults = recommendCampaignWindow([musicEvent], 'restaurant');
      const mixedResults = recommendCampaignWindow([musicEvent], 'Restaurant');

      expect(upperResults[0].score).toBe(lowerResults[0].score);
      expect(lowerResults[0].score).toBe(mixedResults[0].score);
    });
  });

  describe('Maximum Score', () => {
    it('should achieve maximum score (135) with perfect event', () => {
      const perfectEvent = createMockEvent({
        classification: 'Music', // +50
        date: '2026-08-15', // Saturday +30
        time: '20:00:00', // Evening +20
        priceRange: { min: 100, max: 300 }, // Premium +10
        venueCapacity: 25000, // Arena +15
        distance: 2.0, // Hyper-local +10
      });

      const results = recommendCampaignWindow([perfectEvent], 'restaurant');

      expect(results[0].score).toBe(135);
    });
  });
});
