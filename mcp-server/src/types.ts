/**
 * Trimmed event structure - never return raw Ticketmaster JSON
 */
export interface TrimmedEvent {
  id: string;
  name: string;
  date: string;
  time: string | null;
  classification: string;
  venueName: string;
  city: string;
  lat: number | null;
  lon: number | null;
  priceRange: { min: number; max: number } | null;
}

/**
 * Event details - extended information for a single event
 */
export interface EventDetails {
  id: string;
  name: string;
  date: string;
  time: string | null;
  venue: {
    name: string;
    address: string | null;
    city: string;
    parkingDetail: string | null;
    accessibleSeatingDetail: string | null;
    capacity: number | null;
  };
  classification: string;
  priceRanges: { min: number; max: number } | null;
  url: string;
}

/**
 * Scored event with campaign recommendation rationale
 */
export interface ScoredEvent extends TrimmedEvent {
  score: number;
  rationale: string;
}
