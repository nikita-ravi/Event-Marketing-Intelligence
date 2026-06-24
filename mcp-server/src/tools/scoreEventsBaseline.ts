import { TrimmedEvent, ScoredEvent } from '../types.js';

/**
 * Brand category → relevant event classifications mapping
 * This is a lookup table, not an LLM call - explainable and inspectable
 */
const CATEGORY_CLASSIFICATION_MAP: Record<string, string[]> = {
  // Food & Beverage
  'restaurant': ['Music', 'Sports', 'Arts & Theatre', 'Family'],
  'qsr': ['Music', 'Sports', 'Family'],
  'fast-food': ['Music', 'Sports', 'Family'],
  'dining': ['Music', 'Arts & Theatre', 'Miscellaneous'],
  'cafe': ['Music', 'Arts & Theatre', 'Miscellaneous'],
  'bar': ['Music', 'Sports', 'Miscellaneous'],

  // Retail
  'retail': ['Music', 'Sports', 'Arts & Theatre', 'Family'],
  'fashion': ['Music', 'Arts & Theatre', 'Miscellaneous'],
  'apparel': ['Music', 'Sports', 'Miscellaneous'],
  'electronics': ['Sports', 'Music', 'Miscellaneous'],

  // Entertainment
  'entertainment': ['Music', 'Sports', 'Arts & Theatre', 'Family', 'Miscellaneous'],
  'streaming': ['Music', 'Sports', 'Arts & Theatre'],
  'gaming': ['Sports', 'Music', 'Miscellaneous'],

  // Automotive
  'automotive': ['Sports', 'Music', 'Miscellaneous'],
  'auto': ['Sports', 'Music', 'Miscellaneous'],

  // Travel & Hospitality
  'travel': ['Music', 'Sports', 'Arts & Theatre', 'Family'],
  'hotel': ['Music', 'Sports', 'Arts & Theatre', 'Family'],
  'airline': ['Music', 'Sports', 'Arts & Theatre'],

  // Health & Wellness
  'fitness': ['Sports', 'Music', 'Miscellaneous'],
  'healthcare': ['Family', 'Miscellaneous'],
  'wellness': ['Music', 'Miscellaneous'],

  // Finance
  'finance': ['Sports', 'Music', 'Arts & Theatre'],
  'banking': ['Sports', 'Music', 'Arts & Theatre'],
  'insurance': ['Sports', 'Family', 'Miscellaneous'],

  // Technology
  'tech': ['Music', 'Sports', 'Miscellaneous'],
  'software': ['Music', 'Sports', 'Miscellaneous'],

  // Default fallback
  'general': ['Music', 'Sports', 'Arts & Theatre', 'Family', 'Miscellaneous']
};

/**
 * Score an event based on deterministic rules
 * Returns score and rationale explaining which weights fired
 */
function scoreEvent(
  event: TrimmedEvent,
  brandCategory: string
): { score: number; rationale: string } {
  let score = 0;
  const reasons: string[] = [];

  // Normalize brand category
  const normalizedCategory = brandCategory.toLowerCase().trim();
  const relevantClassifications =
    CATEGORY_CLASSIFICATION_MAP[normalizedCategory] ||
    CATEGORY_CLASSIFICATION_MAP['general'];

  // 1. Classification match (0-50 points)
  const classificationMatch = relevantClassifications.some(
    (c) => event.classification.toLowerCase().includes(c.toLowerCase())
  );
  if (classificationMatch) {
    score += 50;
    reasons.push(`${event.classification} aligns with ${brandCategory}`);
  }

  // 2. Day of week (0-30 points) - weekend events get boost
  if (event.date && event.date !== 'TBD') {
    try {
      const eventDate = new Date(event.date);
      const dayOfWeek = eventDate.getDay();

      // Friday (5), Saturday (6), Sunday (0)
      if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
        score += 30;
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
        reasons.push(`${dayName} timing captures weekend audience`);
      } else if (dayOfWeek === 4) {
        // Thursday gets partial boost
        score += 15;
        reasons.push('Thu evening primes weekend engagement');
      }
    } catch (e) {
      // Invalid date, skip day-of-week scoring
    }
  }

  // 3. Time of day (0-20 points) - evening events for dining/entertainment
  if (event.time) {
    try {
      const hour = parseInt(event.time.split(':')[0], 10);

      // Evening events (18:00-23:00) get boost for relevant categories
      const eveningCategories = [
        'restaurant', 'qsr', 'fast-food', 'dining', 'bar',
        'entertainment', 'streaming'
      ];

      if (hour >= 18 && hour <= 23) {
        if (eveningCategories.includes(normalizedCategory)) {
          score += 20;
          reasons.push('evening timing syncs with dining/leisure');
        } else {
          score += 10;
          reasons.push('prime-time slot');
        }
      } else if (hour >= 12 && hour < 18) {
        // Afternoon events get smaller boost
        score += 5;
        reasons.push('afternoon window');
      }
    } catch (e) {
      // Invalid time, skip time-of-day scoring
    }
  }

  // 4. Price range bonus - higher ticket prices suggest higher-value audience
  if (event.priceRange && event.priceRange.min > 50) {
    score += 10;
    reasons.push('premium ticket pricing indicates engaged audience');
  }

  // 5. Venue capacity (0-15 points) - larger venues = more potential reach
  if (event.venueCapacity) {
    if (event.venueCapacity >= 20000) {
      score += 15;
      reasons.push(`arena-scale venue (${event.venueCapacity.toLocaleString()} capacity)`);
    } else if (event.venueCapacity >= 5000) {
      score += 10;
      reasons.push(`large venue (${event.venueCapacity.toLocaleString()} capacity)`);
    } else if (event.venueCapacity >= 1000) {
      score += 5;
      reasons.push(`medium venue (${event.venueCapacity.toLocaleString()} capacity)`);
    }
  }

  // 6. Distance proximity (0-10 points) - closer events for hyper-local campaigns
  // Only applies when distance is available (geo-based search)
  if (event.distance !== null && event.distance !== undefined) {
    if (event.distance <= 5) {
      score += 10;
      reasons.push(`hyper-local (${event.distance.toFixed(1)}mi away)`);
    } else if (event.distance <= 10) {
      score += 7;
      reasons.push(`nearby (${event.distance.toFixed(1)}mi away)`);
    } else if (event.distance <= 25) {
      score += 4;
      reasons.push(`metro area (${event.distance.toFixed(1)}mi away)`);
    }
  }

  // Build rationale string
  const rationale = reasons.length > 0
    ? reasons.join('; ')
    : 'baseline relevance';

  return { score, rationale };
}

/**
 * Score events baseline - deterministic scoring algorithm
 *
 * This provides the auditable baseline scores (0-135 points) that the LLM
 * reasoning layer can then adjust based on user context. The scoring is:
 * - Deterministic (same inputs = same outputs)
 * - Explainable (rationale shows which weights fired)
 * - Auditable (no black-box AI)
 *
 * The LLM applies reasoning on top of these baseline scores via present_recommendation.
 */
export function scoreEventsBaseline(
  events: TrimmedEvent[],
  brandCategory: string
): ScoredEvent[] {
  console.log(
    `[Scoring ${events.length} events for brand category: ${brandCategory}]`
  );

  // Score all events
  const scoredEvents: ScoredEvent[] = events.map((event) => {
    const { score, rationale } = scoreEvent(event, brandCategory);
    return {
      ...event,
      score,
      rationale
    };
  });

  // Sort by score descending
  scoredEvents.sort((a, b) => b.score - a.score);

  console.log(
    `[Top 3 scores: ${scoredEvents.slice(0, 3).map((e) => e.score).join(', ')}]`
  );

  return scoredEvents;
}
