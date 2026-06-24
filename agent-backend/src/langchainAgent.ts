import { ChatAnthropic } from '@langchain/anthropic';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MCPClient } from './mcpClient.js';
import { validateRecommendations, extractEventIds } from './guardrails.js';
import { logger } from './logger.js';

/**
 * LangChain-based agent implementation with hybrid reasoning
 *
 * This implementation demonstrates a production-ready hybrid architecture:
 * - Deterministic baseline scoring (auditable, consistent)
 * - LLM reasoning layer (context-aware adjustments)
 * - Schema-enforced output (prevents hallucination)
 * - Validation guardrails (graceful degradation)
 *
 * The agent operates at low temperature (0.2) for business decisions,
 * tracks search results for validation, and enforces structured output
 * through the present_recommendation tool.
 */
export type PipelineEvent = {
  step: 'search' | 'baseline' | 'reasoning' | 'guardrail' | 'result';
  status: 'running' | 'done' | 'failed';
  details?: string;
};

export class LangChainEventAgent {
  private mcpClient: MCPClient;
  private tools: DynamicStructuredTool[] = [];
  private model: ChatAnthropic;
  private agent: any = null; // LangGraph CompiledStateGraph type

  // State tracking for validation guardrails
  private lastSearchResults: string[] = []; // Valid eventIds from search_events
  private lastBaselineResults: any = null;  // Fallback data from score_events_baseline
  private lastSearchEventsData: any[] = []; // Full event objects from search_events
  private lastRecommendations: any = null;  // Recommendations from present_recommendation

  // Event callback for SSE streaming
  private onEvent?: (event: PipelineEvent) => void;

  constructor(mcpClient: MCPClient, apiKey: string, onEvent?: (event: PipelineEvent) => void) {
    this.onEvent = onEvent;
    this.mcpClient = mcpClient;

    // Initialize Claude with low temperature for business reasoning
    // Temperature 0.2: This is a business decision tool, not creative writing
    // Low temperature ensures consistency and reduces hallucination risk
    //
    // Note: Older versions of @langchain/anthropic have a bug where they set top_p=-1
    // which is invalid for Anthropic models. We work around this by using temperature only.
    this.model = new ChatAnthropic({
      modelName: 'claude-sonnet-4-5-20250929',
      anthropicApiKey: apiKey,
      temperature: 0.2, // Changed from 0.7 - plan requires 0-0.2 for reliability
      maxTokens: 4096,
      // Anthropic models don't allow both temperature and top_p
      // LangChain v0.1.x has a bug setting top_p=-1, so we avoid it
      streaming: false, // Disable streaming to potentially avoid the bug
    });

    this.initializeTools();
  }

  /**
   * Convert MCP tools to LangChain DynamicStructuredTools
   * This creates a bridge between MCP protocol and LangChain framework
   */
  private initializeTools() {

    // Tool 1: Search Events (with result tracking for validation)
    this.tools.push(
      new DynamicStructuredTool({
        name: 'search_events',
        description:
          'Search for upcoming events in a region. Supports geographic radius search, genre/attraction filters, and on-sale date filtering. Returns event data with venue, classification, pricing, images, and attractions. ALWAYS call this FIRST before making recommendations.',
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
          this.onEvent?.({ step: 'search', status: 'running', details: 'Ticketmaster API • Searching...' });

          const mcpResult = await this.mcpClient.callTool('search_events', input);

          // Extract actual data from MCP protocol wrapper
          const actualData = mcpResult.content[0].text;
          const parsedData = JSON.parse(actualData);

          // Track event IDs for validation guardrail
          // Accumulate across multiple search calls instead of overwriting
          const newEventIds = extractEventIds(actualData);
          this.lastSearchResults = [...new Set([...this.lastSearchResults, ...newEventIds])];

          // Also track full event objects for enrichment later
          if (Array.isArray(parsedData)) {
            this.lastSearchEventsData = [...this.lastSearchEventsData, ...parsedData];
          }

          this.onEvent?.({ step: 'search', status: 'done', details: `Ticketmaster API • ${this.lastSearchResults.length} results` });

          logger.info('Search events: Tracked candidate eventIds', {
            count: this.lastSearchResults.length,
            eventIds: this.lastSearchResults,
          });

          return actualData;
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
          const mcpResult = await this.mcpClient.callTool('get_event_details', input);
          return mcpResult.content[0].text;
        },
      })
    );

    // Tool 3: Score Events Baseline (deterministic scoring - track for fallback)
    this.tools.push(
      new DynamicStructuredTool({
        name: 'score_events_baseline',
        description:
          'Get deterministic baseline scores for events based on brand category. Uses auditable scoring rules (0-135 points max). This is the foundation layer - you will apply LLM reasoning on top via present_recommendation. Scoring factors: classification match (50pts), weekend timing (30pts), evening hours (20pts), premium pricing (10pts), venue capacity (15pts), distance proximity (10pts).',
        schema: z.object({
          events: z.array(z.any()).describe('Array of TrimmedEvent objects from search_events'),
          brandCategory: z.string().describe('Brand category (e.g., restaurant, qsr, retail, etc.)'),
        }),
        func: async (input) => {
          this.onEvent?.({ step: 'baseline', status: 'running', details: 'Deterministic • Calculating...' });

          logger.info('Tool called: score_events_baseline', {
            eventsCount: input.events?.length || 0,
            brandCategory: input.brandCategory,
          });

          const mcpResult = await this.mcpClient.callTool('score_events_baseline', input);

          // Extract actual data from MCP protocol wrapper
          const actualData = mcpResult.content[0].text;
          const parsedData = JSON.parse(actualData);

          // Track baseline results for fallback if validation fails
          this.lastBaselineResults = parsedData;
          logger.info('Baseline scoring: Tracked results for fallback', {
            resultType: typeof parsedData,
            scoredEventsCount: Array.isArray(parsedData) ? parsedData.length : 0,
          });

          this.onEvent?.({ step: 'baseline', status: 'done', details: 'Deterministic • 135pt max' });

          return actualData;
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
          const mcpResult = await this.mcpClient.callTool('search_attractions', input);
          return mcpResult.content[0].text;
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
          const mcpResult = await this.mcpClient.callTool('get_attraction_tour', input);
          return mcpResult.content[0].text;
        },
      })
    );

    // Tool 6: Present Recommendation (REQUIRED FINAL ANSWER - with validation)
    this.tools.push(
      new DynamicStructuredTool({
        name: 'present_recommendation',
        description:
          'REQUIRED FINAL ANSWER TOOL - Use this to present your recommendations to the user. This is MANDATORY for all final recommendations - never give free-text responses. Every eventId will be validated against the original search results. If validation fails, the system falls back to baseline scoring.',
        schema: z.object({
          recommendations: z.array(
            z.object({
              eventId: z.string().describe('Event ID from search_events - MUST be valid'),
              adjustedScore: z.number().describe('Your adjusted score based on user context'),
              rationale: z.string().describe('Explain baseline factors + your reasoning for adjustments'),
            })
          ).describe('Your top 3-5 recommended events with adjusted scores'),
          clarifyingQuestion: z.string().optional().describe('Optional follow-up question if you need more context'),
        }),
        func: async (input) => {
          this.onEvent?.({ step: 'reasoning', status: 'running', details: 'Context-aware adjustment' });

          // Call the MCP tool first to get schema validation
          const mcpResult = await this.mcpClient.callTool('present_recommendation', input);

          this.onEvent?.({ step: 'reasoning', status: 'done', details: 'Context-aware adjustment' });
          this.onEvent?.({ step: 'guardrail', status: 'running', details: 'Validate event IDs' });

          logger.info('Present recommendation: Calling validation guardrail', {
            recommendationCount: input.recommendations.length,
            candidateCount: this.lastSearchResults.length,
          });

          // Run validation guardrail - THE most important reliability mechanism
          const validationResult = validateRecommendations(
            input.recommendations,
            this.lastSearchResults,
            this.lastBaselineResults
          );

          if (!validationResult.valid) {
            // Validation FAILED - graceful degradation to baseline
            logger.warn('Validation FAILED - returning baseline fallback', {
              errors: validationResult.errors,
            });

            // Return fallback baseline results instead of hallucinated LLM output
            return JSON.stringify({
              validationFailed: true,
              message: 'One or more recommended events were invalid. Falling back to baseline scoring.',
              errors: validationResult.errors,
              baselineResults: validationResult.output,
            });
          }

          // Validation PASSED - return LLM recommendations
          logger.info('Validation PASSED - returning LLM recommendations');

          this.onEvent?.({ step: 'guardrail', status: 'done', details: 'Validate event IDs' });
          this.onEvent?.({ step: 'result', status: 'running', details: 'Schema-enforced output' });

          // Store recommendations for /chat endpoint to return
          this.lastRecommendations = validationResult.output.recommendations;

          this.onEvent?.({ step: 'result', status: 'done', details: 'Schema-enforced output' });

          return JSON.stringify({
            validationPassed: true,
            ...validationResult.output,
          });
        },
      })
    );
  }

  /**
   * Initialize the LangChain agent with system prompt
   */
  async initializeAgent(systemPrompt: string) {
    // Latest LangChain uses createReactAgent from @langchain/langgraph/prebuilt
    // Pass system prompt via messageModifier which prepends it to every conversation
    this.agent = createReactAgent({
      llm: this.model,
      tools: this.tools,
      messageModifier: systemPrompt,
    });

    logger.info('LangChain agent initialized', {
      toolCount: this.tools.length,
      temperature: 0.2,
      hybridReasoning: true,
      validationEnabled: true,
    });
  }

  /**
   * Send a message to the LangChain agent
   */
  async sendMessage(message: string, chatHistory: any[] = []) {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initializeAgent() first.');
    }

    // Reset search results for this new user message
    // Prevents event IDs from bleeding between conversations
    this.lastSearchResults = [];
    this.lastSearchEventsData = [];
    this.lastRecommendations = null;

    logger.info('Agent invoke starting', { message });

    try {
      // Latest LangGraph API uses 'messages' instead of 'input' and 'chat_history'
      // Set a reasonable timeout to prevent hanging indefinitely
      const result = await Promise.race([
        this.agent.invoke({
          messages: [{ role: 'user', content: message }],
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Agent invoke timeout after 120s')), 120000)
        ),
      ]);

      logger.info('Agent invoke completed', {
        messageCount: result.messages?.length || 0,
      });

      // Extract the final message from the response
      const messages = result.messages || [];
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage?.content || 'No response generated';

      logger.info('Returning agent response', {
        responseLength: content.length,
      });

      return content;
    } catch (error) {
      logger.error('Agent invoke failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get enriched recommendations with full event details
   * Returns null if no recommendations were made
   */
  getEnrichedRecommendations() {
    if (!this.lastRecommendations || this.lastRecommendations.length === 0) {
      return null;
    }

    // Create a map of eventId -> event for quick lookup
    const eventMap = new Map();
    for (const event of this.lastSearchEventsData) {
      eventMap.set(event.id, event);
    }

    // Enrich recommendations with full event data
    const enriched = this.lastRecommendations.map((rec: any) => {
      const event = eventMap.get(rec.eventId);
      if (!event) {
        logger.warn('Event not found for recommendation', { eventId: rec.eventId });
        return {
          eventId: rec.eventId,
          score: rec.adjustedScore,
          rationale: rec.rationale,
        };
      }

      return {
        eventId: event.id,
        name: event.name,
        venue: event.venueName,
        city: event.city,
        date: event.date,
        time: event.time,
        score: rec.adjustedScore,
        rationale: rec.rationale,
        classification: event.classification,
        priceRange: event.priceRange,
      };
    });

    return enriched;
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
