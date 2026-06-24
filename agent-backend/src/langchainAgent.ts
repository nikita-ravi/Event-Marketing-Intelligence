import { ChatAnthropic } from '@langchain/anthropic';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { MCPClient } from './mcpClient.js';

/**
 * LangChain-based agent implementation
 *
 * This demonstrates knowledge of multiple frameworks and provides
 * an alternative implementation path using LangChain instead of
 * the Anthropic SDK directly.
 *
 * Benefits of LangChain approach:
 * - Framework-agnostic tool definitions
 * - Built-in agent memory and conversation management
 * - Extensive ecosystem of integrations
 * - Observable agent execution traces
 */
export class LangChainEventAgent {
  private mcpClient: MCPClient;
  private tools: DynamicStructuredTool[] = [];
  private model: ChatAnthropic;
  private agent: AgentExecutor | null = null;

  constructor(mcpClient: MCPClient, apiKey: string) {
    this.mcpClient = mcpClient;

    // Initialize Claude with LangChain
    this.model = new ChatAnthropic({
      modelName: 'claude-sonnet-4-5-20250929',
      anthropicApiKey: apiKey,
      temperature: 0.7,
    });

    this.initializeTools();
  }

  /**
   * Convert MCP tools to LangChain DynamicStructuredTools
   * This creates a bridge between MCP protocol and LangChain framework
   */
  private initializeTools() {
    const mcpTools = this.mcpClient.getAvailableTools();

    // Tool 1: Search Events
    this.tools.push(
      new DynamicStructuredTool({
        name: 'search_events',
        description:
          'Search for upcoming events in a region. Supports geographic radius search, genre/attraction filters, and on-sale date filtering. Returns event data with venue, classification, pricing, images, and attractions.',
        schema: z.object({
          geoPoint: z.string().optional().describe('GeoHash for precise location'),
          latlong: z.string().optional().describe('Latitude,longitude (e.g., "34.0522,-118.2437")'),
          radius: z.number().optional().describe('Search radius in miles/km'),
          unit: z.enum(['miles', 'km']).optional().describe('Radius unit'),
          dmaId: z.string().optional().describe('DMA ID for regional targeting'),
          city: z.string().optional().describe('City name'),
          stateCode: z.string().optional().describe('Two-letter state code'),
          classificationName: z.string().optional().describe('Event classification (Music, Sports, etc.)'),
          genreId: z.string().optional().describe('Genre ID for precision targeting'),
          subGenreId: z.string().optional().describe('Sub-genre ID'),
          segmentId: z.string().optional().describe('Segment ID'),
          attractionId: z.string().optional().describe('Filter by specific attraction ID'),
          venueId: z.string().optional().describe('Filter by specific venue'),
          startDateTime: z.string().describe('Start date/time in ISO 8601 format'),
          endDateTime: z.string().describe('End date/time in ISO 8601 format'),
          onsaleStartDateTime: z.string().optional().describe('Filter events going on sale after this date'),
          onsaleEndDateTime: z.string().optional().describe('Filter events going on sale before this date'),
          size: z.number().optional().describe('Maximum number of results'),
          includeFamily: z.enum(['yes', 'no', 'only']).optional().describe('Family-friendly filter'),
          keyword: z.string().optional().describe('Keyword search'),
        }),
        func: async (input) => {
          const result = await this.mcpClient.callTool('search_events', input);
          return JSON.stringify(result);
        },
      })
    );

    // Tool 2: Get Event Details
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_event_details',
        description:
          'Get detailed information about a specific event, including venue accessibility, parking, capacity, full pricing info, images, and on-sale dates.',
        schema: z.object({
          eventId: z.string().describe('Ticketmaster event ID'),
        }),
        func: async (input) => {
          const result = await this.mcpClient.callTool('get_event_details', input);
          return JSON.stringify(result);
        },
      })
    );

    // Tool 3: Recommend Campaign Window
    this.tools.push(
      new DynamicStructuredTool({
        name: 'recommend_campaign_window',
        description:
          'Recommend which events are best for ad spend based on brand category. Uses deterministic scoring with explainable rationale. Includes venue capacity and distance proximity weights.',
        schema: z.object({
          events: z.array(z.any()).describe('Array of TrimmedEvent objects from search_events'),
          brandCategory: z.string().describe('Brand category (e.g., restaurant, qsr, retail, etc.)'),
        }),
        func: async (input) => {
          const result = await this.mcpClient.callTool('recommend_campaign_window', input);
          return JSON.stringify(result);
        },
      })
    );

    // Tool 4: Search Attractions
    this.tools.push(
      new DynamicStructuredTool({
        name: 'search_attractions',
        description:
          'Search for attractions (artists, teams, performers) by keyword. Returns attraction info including genre, upcoming event count, and images.',
        schema: z.object({
          keyword: z.string().describe('Search keyword (artist name, team name, performer)'),
        }),
        func: async (input) => {
          const result = await this.mcpClient.callTool('search_attractions', input);
          return JSON.stringify(result);
        },
      })
    );

    // Tool 5: Get Attraction Tour
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_attraction_tour',
        description:
          'Get all upcoming events for a specific attraction (artist/team). Enables tour tracking across all tour dates for campaign planning.',
        schema: z.object({
          attractionId: z.string().describe('Ticketmaster attraction ID'),
        }),
        func: async (input) => {
          const result = await this.mcpClient.callTool('get_attraction_tour', input);
          return JSON.stringify(result);
        },
      })
    );
  }

  /**
   * Initialize the LangChain agent with system prompt
   */
  async initializeAgent(systemPrompt: string) {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    const agent = await createToolCallingAgent({
      llm: this.model,
      tools: this.tools,
      prompt,
    });

    this.agent = new AgentExecutor({
      agent,
      tools: this.tools,
      verbose: true, // Enable for debugging
      maxIterations: 10,
    });

    console.log('LangChain agent initialized with', this.tools.length, 'tools');
  }

  /**
   * Send a message to the LangChain agent
   */
  async sendMessage(message: string, chatHistory: any[] = []) {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initializeAgent() first.');
    }

    const result = await this.agent.invoke({
      input: message,
      chat_history: chatHistory,
    });

    return result.output;
  }

  /**
   * Get conversation history in LangChain format
   */
  formatChatHistory(history: Array<{ role: string; content: string }>) {
    return history.map((msg) => {
      if (msg.role === 'user') {
        return ['human', msg.content];
      } else {
        return ['ai', msg.content];
      }
    });
  }
}
