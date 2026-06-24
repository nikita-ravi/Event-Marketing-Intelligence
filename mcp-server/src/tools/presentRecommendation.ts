import { TrimmedEvent, ScoredEvent } from '../types.js';

/**
 * Final recommendation structure that MUST be used by the agent
 * to present results to the user. This schema-enforced approach
 * prevents hallucination and ensures all eventIds are valid.
 */
export interface Recommendation {
  eventId: string;
  adjustedScore: number; // Agent can adjust baseline score based on context
  rationale: string;     // LLM-generated explanation
}

export interface PresentRecommendationInput {
  recommendations: Recommendation[];
  clarifyingQuestion?: string; // Optional follow-up question
}

export interface PresentRecommendationOutput {
  recommendations: Recommendation[];
  clarifyingQuestion?: string;
  validationPassed: boolean; // Will be set by guardrail
}

/**
 * present_recommendation - Schema-enforced final answer tool
 *
 * This tool forces the agent to structure its final recommendations
 * rather than producing free-text responses. This is critical because:
 *
 * 1. Schema validation: Ensures every recommendation has required fields
 * 2. Enables validation: eventIds can be checked against original search results
 * 3. Prevents hallucination: No invented event names/details in free text
 * 4. Graceful degradation: If validation fails, system can fall back to baseline
 *
 * The agent MUST use this tool for final recommendations - never free-text.
 *
 * Flow:
 * 1. Agent calls search_events → gets candidate list
 * 2. Agent calls recommend_campaign_window → gets baseline scores
 * 3. Agent reasons about user context (location, brand, timing, etc.)
 * 4. Agent calls THIS tool with adjusted scores + rationale
 * 5. Guardrail validates eventIds against candidate list
 * 6. If valid: return to user. If invalid: fall back to baseline.
 */
export function presentRecommendation(
  input: PresentRecommendationInput
): PresentRecommendationOutput {
  // This is a passthrough - actual validation happens in guardrails.ts
  // The tool exists primarily to:
  // 1. Enforce schema via Zod/JSON Schema in MCP registration
  // 2. Signal to LLM: "This is how you MUST format your final answer"

  const { recommendations, clarifyingQuestion } = input;

  // Basic input validation (schema should catch this, but double-check)
  if (!Array.isArray(recommendations)) {
    throw new Error('recommendations must be an array');
  }

  for (const rec of recommendations) {
    if (!rec.eventId || typeof rec.eventId !== 'string') {
      throw new Error('Each recommendation must have a valid eventId string');
    }
    if (typeof rec.adjustedScore !== 'number') {
      throw new Error('Each recommendation must have a numeric adjustedScore');
    }
    if (!rec.rationale || typeof rec.rationale !== 'string') {
      throw new Error('Each recommendation must have a rationale string');
    }
  }

  // Return structured output - guardrail will validate eventIds
  return {
    recommendations,
    clarifyingQuestion,
    validationPassed: true, // Default to true, guardrail will override if needed
  };
}
