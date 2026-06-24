import { logger } from './logger.js';

/**
 * Recommendation structure from present_recommendation tool
 */
export interface Recommendation {
  eventId: string;
  adjustedScore: number;
  rationale: string;
}

export interface PresentRecommendationOutput {
  recommendations: Recommendation[];
  clarifyingQuestion?: string;
  validationPassed: boolean;
}

/**
 * Baseline scored event structure (fallback format)
 */
export interface BaselineScoredEvent {
  id: string;
  name: string;
  score: number;
  rationale: string;
  [key: string]: any; // Other event fields
}

/**
 * Validation result - either validated recommendations or fallback to baseline
 */
export interface ValidationResult {
  valid: boolean;
  output: PresentRecommendationOutput | { fallbackToBaseline: true; baselineResults: any };
  errors?: string[];
}

/**
 * validateRecommendations - The single most important reliability mechanism
 *
 * This guardrail runs IMMEDIATELY after the agent calls present_recommendation.
 * It validates that every eventId in the LLM's response exists in the original
 * candidate list from search_events.
 *
 * WHY THIS MATTERS:
 * - LLMs can hallucinate event names or IDs, especially in free-text responses
 * - By routing all answers through present_recommendation (schema-enforced),
 *   we get structured output that can be programmatically validated
 * - If validation fails, we gracefully degrade to deterministic baseline scoring
 *   instead of showing hallucinated recommendations to the user
 *
 * FLOW:
 * 1. Agent calls search_events → saves candidate eventIds
 * 2. Agent calls recommend_campaign_window → gets baseline scores
 * 3. Agent reasons and calls present_recommendation
 * 4. THIS FUNCTION validates eventIds against candidate list
 * 5a. If valid: return LLM recommendations
 * 5b. If invalid: discard LLM output, fall back to baseline scoring
 *
 * This is production-grade reliability: graceful degradation over silent failure.
 *
 * @param recommendations - The LLM's recommendations from present_recommendation
 * @param candidateEventIds - Valid event IDs from the original search_events call
 * @param baselineResults - Fallback data if validation fails (from recommend_campaign_window)
 * @returns ValidationResult with either validated recommendations or fallback
 */
export function validateRecommendations(
  recommendations: Recommendation[],
  candidateEventIds: string[],
  baselineResults?: any
): ValidationResult {
  const errors: string[] = [];
  const invalidEventIds: string[] = [];

  logger.info('Guardrail: Validating recommendations', {
    recommendationCount: recommendations.length,
    candidateCount: candidateEventIds.length,
  });

  // Create a Set for O(1) lookup
  const validIdSet = new Set(candidateEventIds);

  // Validate each recommendation
  for (const rec of recommendations) {
    if (!validIdSet.has(rec.eventId)) {
      invalidEventIds.push(rec.eventId);
      errors.push(`Invalid eventId: ${rec.eventId} not found in candidate list`);
      logger.warn('Guardrail: Hallucinated event detected', {
        invalidEventId: rec.eventId,
        validCandidates: candidateEventIds,
      });
    }
  }

  // If ANY eventId is invalid, fail validation and fall back to baseline
  if (invalidEventIds.length > 0) {
    logger.error('Guardrail: Validation FAILED - falling back to baseline', {
      invalidCount: invalidEventIds.length,
      invalidEventIds,
      totalRecommendations: recommendations.length,
    });

    // Graceful degradation: return deterministic baseline instead of hallucinated LLM output
    return {
      valid: false,
      output: {
        fallbackToBaseline: true,
        baselineResults: baselineResults || {
          error: 'No baseline results available',
          message: 'Validation failed but no fallback data provided',
        },
      },
      errors,
    };
  }

  // All eventIds are valid - return LLM recommendations
  logger.info('Guardrail: Validation PASSED - returning LLM recommendations', {
    validatedCount: recommendations.length,
  });

  return {
    valid: true,
    output: {
      recommendations,
      validationPassed: true,
    },
  };
}

/**
 * extractEventIds - Helper to extract event IDs from search results
 *
 * @param searchResults - Raw results from search_events tool call
 * @returns Array of valid event IDs
 */
export function extractEventIds(searchResults: any): string[] {
  try {
    // Handle different possible result structures
    if (Array.isArray(searchResults)) {
      return searchResults.map((event) => event.id).filter(Boolean);
    }

    if (searchResults.events && Array.isArray(searchResults.events)) {
      return searchResults.events.map((event: any) => event.id).filter(Boolean);
    }

    // If search results are JSON string, parse first
    if (typeof searchResults === 'string') {
      const parsed = JSON.parse(searchResults);
      if (Array.isArray(parsed)) {
        return parsed.map((event) => event.id).filter(Boolean);
      }
      if (parsed.events) {
        return parsed.events.map((event: any) => event.id).filter(Boolean);
      }
    }

    logger.warn('Guardrail: Unable to extract event IDs from search results', {
      searchResultsType: typeof searchResults,
    });
    return [];
  } catch (error) {
    logger.error('Guardrail: Error extracting event IDs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}
