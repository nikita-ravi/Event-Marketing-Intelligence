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
import { recommendCampaignWindow } from './tools/recommendCampaignWindow.js';
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
          'Search for upcoming events in a region. Returns trimmed event data with venue, classification, pricing. Use this BEFORE making recommendations.',
        inputSchema: {
          type: 'object',
          properties: {
            dmaId: {
              type: 'string',
              description: 'DMA (Designated Market Area) ID - preferred over city',
            },
            city: {
              type: 'string',
              description: 'City name (if dmaId not available)',
            },
            stateCode: {
              type: 'string',
              description: 'Two-letter state code (used with city)',
            },
            classificationName: {
              type: 'string',
              description: 'Event classification filter (Music, Sports, Arts & Theatre, Family, etc.)',
            },
            startDateTime: {
              type: 'string',
              description: 'Start date/time in ISO 8601 format (e.g., 2024-06-01T00:00:00Z)',
            },
            endDateTime: {
              type: 'string',
              description: 'End date/time in ISO 8601 format',
            },
            size: {
              type: 'number',
              description: 'Maximum number of results (default: 20)',
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
        name: 'recommend_campaign_window',
        description:
          'Recommend which events are best for ad spend based on brand category. Uses deterministic scoring (NOT LLM) with explainable rationale. Call this after search_events.',
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

      case 'recommend_campaign_window': {
        const { events, brandCategory } = args as {
          events: TrimmedEvent[];
          brandCategory: string;
        };
        const recommendations = recommendCampaignWindow(events, brandCategory);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(recommendations, null, 2),
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
