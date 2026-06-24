/**
 * Trimmed event structure - never return raw Ticketmaster JSON
 */
export interface TrimmedEvent {
  id: string;
  name: string;
  date: string;
  time: string | null;
  classification: string;
  genre: string | null;
  subGenre: string | null;
  venueName: string;
  venueId: string | null;
  venueCapacity: number | null;
  city: string;
  stateCode: string | null;
  lat: number | null;
  lon: number | null;
  distance: number | null; // Distance from search point in miles/km
  priceRange: { min: number; max: number } | null;
  imageUrl: string | null;
  url: string | null;
  onsaleStartDate: string | null; // When tickets go on sale
  attractions: Array<{ id: string; name: string }> | null; // Artists/teams
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
    id: string;
    name: string;
    address: string | null;
    city: string;
    stateCode: string | null;
    lat: number | null;
    lon: number | null;
    parkingDetail: string | null;
    accessibleSeatingDetail: string | null;
    capacity: number | null;
  };
  classification: string;
  genre: string | null;
  subGenre: string | null;
  attractions: Array<{ id: string; name: string; url: string | null }>;
  priceRanges: { min: number; max: number } | null;
  images: Array<{ url: string; width: number; height: number }>;
  url: string;
  onsaleStartDate: string | null;
  onsaleEndDate: string | null;
  presaleStartDate: string | null;
}

/**
 * Scored event with campaign recommendation rationale
 */
export interface ScoredEvent extends TrimmedEvent {
  score: number;
  rationale: string;
}

/**
 * Attraction (artist, team, performer) information
 */
export interface Attraction {
  id: string;
  name: string;
  classification: string;
  genre: string | null;
  subGenre: string | null;
  url: string | null;
  imageUrl: string | null;
  upcomingEventCount: number;
}

/**
 * Attraction tour details with all upcoming events
 */
export interface AttractionTour {
  attraction: Attraction;
  events: TrimmedEvent[];
}
