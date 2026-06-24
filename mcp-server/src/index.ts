#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { TicketmasterClient } from './ticketmasterClient.js';
import { searchEvents } from './tools/searchEvents.js';
import { getEventDetails } from './tools/getEventDetails.js';
import { scoreEventsBaseline } from './tools/scoreEventsBaseline.js';
import { searchAttractions } from './tools/searchAttractions.js';
import { getAttractionTour } from './tools/getAttractionTour.js';
import { presentRecommendation, PresentRecommendationInput } from './tools/presentRecommendation.js';
import { TrimmedEvent } from './types.js';

// Load environment variables
dotenv.config();

// Initialize Ticketmaster client
const apiKey = process.env.TICKETMASTER_API_KEY;
if (!apiKey) {
  console.error('ERROR: TICKETMASTER_API_KEY not found in environment');
  console.error('Please create a .env file with your API key');
  process.exit(1);
}

const tmClient = new TicketmasterClient({ apiKey });

// Create MCP server
const server = new Server(
  {
    name: 'event-campaign-advisor',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_events',
        description:
          'Search for upcoming events in a region. Supports geographic radius search, genre/attraction filters, and on-sale date filtering. Returns trimmed event data with venue, classification, pricing, images, and attractions. Use this BEFORE making recommendations.',
        inputSchema: {
          type: 'object',
          properties: {
            // Location filters (priority: geoPoint > latlong > dmaId > city)
            geoPoint: {
              type: 'string',
              description: 'GeoHash for precise location targeting',
            },
            latlong: {
              type: 'string',
              description: 'Latitude,longitude (e.g., "34.0522,-118.2437") for radius search',
            },
            radius: {
              type: 'number',
              description: 'Search radius (use with latlong)',
            },
            unit: {
              type: 'string',
              description: 'Radius unit: "miles" or "km" (default: miles)',
              enum: ['miles', 'km'],
            },
            dmaId: {
              type: 'string',
              description: 'DMA (Designated Market Area) ID - preferred over city for regional targeting',
            },
            city: {
              type: 'string',
              description: 'City name (if dmaId/latlong not available)',
            },
            stateCode: {
              type: 'string',
              description: 'Two-letter state code (used with city)',
            },
            // Classification filters
            classificationName: {
              type: 'string',
              description: 'Event classification filter (Music, Sports, Arts & Theatre, Family, etc.)',
            },
            genreId: {
              type: 'string',
              description: 'Genre ID for precision targeting (get from attractions or API docs)',
            },
            subGenreId: {
              type: 'string',
              description: 'Sub-genre ID for ultra-precise audience targeting',
            },
            segmentId: {
              type: 'string',
              description: 'Segment ID (top-level classification)',
            },
            // Attraction/venue filters
            attractionId: {
              type: 'string',
              description: 'Filter by specific attraction (artist/team) - use search_attractions first',
            },
            venueId: {
              type: 'string',
              description: 'Filter by specific venue',
            },
            // Date/time filters
            startDateTime: {
              type: 'string',
              description: 'Start date/time in ISO 8601 format (e.g., 2024-06-01T00:00:00Z)',
            },
            endDateTime: {
              type: 'string',
              description: 'End date/time in ISO 8601 format',
            },
            onsaleStartDateTime: {
              type: 'string',
              description: 'Filter events going on sale after this date (ticket sales timing intelligence)',
            },
            onsaleEndDateTime: {
              type: 'string',
              description: 'Filter events going on sale before this date',
            },
            // Other filters
            size: {
              type: 'number',
              description: 'Maximum number of results (default: 20)',
            },
            includeFamily: {
              type: 'string',
              description: 'Family-friendly filter: "yes", "no", or "only"',
              enum: ['yes', 'no', 'only'],
            },
            keyword: {
              type: 'string',
              description: 'Keyword search (event name, venue, attractions)',
            },
          },
          required: ['startDateTime', 'endDateTime'],
        },
      },
      {
        name: 'get_event_details',
        description:
          'Get detailed information about a specific event, including venue accessibility, parking, and pricing.',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'Ticketmaster event ID',
            },
          },
          required: ['eventId'],
        },
      },
      {
        name: 'score_events_baseline',
        description:
          'Get deterministic baseline scores for events based on brand category. This is the auditable scoring layer (0-135 points) that provides the foundation for LLM reasoning. Uses deterministic rules, NOT an LLM. Call this after search_events to get baseline scores before applying context-aware adjustments.',
        inputSchema: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              description: 'Array of TrimmedEvent objects from search_events',
              items: {
                type: 'object',
              },
            },
            brandCategory: {
              type: 'string',
              description:
                'Brand category (e.g., restaurant, qsr, retail, entertainment, automotive, travel, etc.)',
            },
          },
          required: ['events', 'brandCategory'],
        },
      },
      {
        name: 'search_attractions',
        description:
          'Search for attractions (artists, teams, performers) by keyword. Use this to find attraction IDs before getting tour details or filtering events.',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Search keyword (artist name, team name, performer)',
            },
          },
          required: ['keyword'],
        },
      },
      {
        name: 'get_attraction_tour',
        description:
          'Get all upcoming events for a specific attraction (artist/team). Enables tour tracking - marketers can follow artists across all tour dates for campaign planning. Returns attraction details + all upcoming events in next year.',
        inputSchema: {
          type: 'object',
          properties: {
            attractionId: {
              type: 'string',
              description: 'Ticketmaster attraction ID (get from search_attractions)',
            },
          },
          required: ['attractionId'],
        },
      },
      {
        name: 'present_recommendation',
        description:
          'FINAL ANSWER TOOL - Use this to present your recommendations to the user. This is REQUIRED for all final recommendations - never give free-text responses. Ensures structured, validated output with adjusted scores and LLM-generated rationale.',
        inputSchema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              description: 'Array of recommended events with adjusted scores and rationale',
              items: {
                type: 'object',
                properties: {
                  eventId: {
                    type: 'string',
                    description: 'Event ID from search_events results - MUST exist in candidate list',
                  },
                  adjustedScore: {
                    type: 'number',
                    description: 'Your adjusted score based on user context (can differ from baseline)',
                  },
                  rationale: {
                    type: 'string',
                    description: 'Your explanation of why this event is recommended for this campaign',
                  },
                },
                required: ['eventId', 'adjustedScore', 'rationale'],
              },
            },
            clarifyingQuestion: {
              type: 'string',
              description: 'Optional follow-up question if you need more context',
            },
          },
          required: ['recommendations'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_events': {
        const results = await searchEvents(tmClient, args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_event_details': {
        const { eventId } = args as { eventId: string };
        const details = await getEventDetails(tmClient, eventId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(details, null, 2),
            },
          ],
        };
      }

      case 'score_events_baseline': {
        const { events, brandCategory } = args as {
          events: TrimmedEvent[];
          brandCategory: string;
        };
        const baselineScores = scoreEventsBaseline(events, brandCategory);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(baselineScores, null, 2),
            },
          ],
        };
      }

      case 'search_attractions': {
        const { keyword } = args as { keyword: string };
        const attractions = await searchAttractions(tmClient, keyword);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(attractions, null, 2),
            },
          ],
        };
      }

      case 'get_attraction_tour': {
        const { attractionId } = args as { attractionId: string };
        const tour = await getAttractionTour(tmClient, attractionId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tour, null, 2),
            },
          ],
        };
      }

      case 'present_recommendation': {
        const input = args as PresentRecommendationInput;
        const result = presentRecommendation(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Event Campaign Advisor MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
