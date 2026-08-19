/**
 * Client-safe DeepSeek RMB usage projection vocabulary.
 *
 * @module @deepseek-ai/dsh-deepseek-usage/projection
 */

import { z } from 'zod'

/** Cost contribution of one usage sample, always in RMB. */
export interface DeepSeekCostBreakdown {
  /** Uncached prompt input cost. */
  uncachedInputRmb: number
  /** Cached prompt input cost (cache-read tokens). */
  cacheReadRmb: number
  /** Cache-write input cost, billed at the uncached prompt price. */
  cacheWriteRmb: number
  /** Output cost. */
  outputRmb: number
  /** Sum of the four buckets. */
  totalRmb: number
}

/** Whole-session cost accumulated per billed model id. */
export interface DeepSeekModelCost extends DeepSeekCostBreakdown {
  model: string
}

/** Token counts, unit prices, and cost for one peak or off-peak tier. */
export interface DeepSeekTierDetail {
  /** Uncached input tokens billed in this tier. */
  uncachedInputTokens: number
  /** Uncached input unit price, RMB per million tokens. */
  uncachedInputPricePerMillion: number
  /** Uncached input cost in this tier. */
  uncachedInputRmb: number
  /** Cache-read tokens billed in this tier. */
  cacheReadTokens: number
  /** Cache-read unit price, RMB per million tokens. */
  cacheReadPricePerMillion: number
  /** Cache-read cost in this tier. */
  cacheReadRmb: number
  /** Cache-write tokens billed in this tier. */
  cacheWriteTokens: number
  /** Cache-write unit price, RMB per million tokens. */
  cacheWritePricePerMillion: number
  /** Cache-write cost in this tier. */
  cacheWriteRmb: number
  /** Output tokens billed in this tier. */
  outputTokens: number
  /** Output unit price, RMB per million tokens. */
  outputPricePerMillion: number
  /** Output cost in this tier. */
  outputRmb: number
}

/** Per-model peak and off-peak calculation details for tooltip display. */
export interface DeepSeekModelDetail {
  model: string
  peak: DeepSeekTierDetail
  offPeak: DeepSeekTierDetail
}

/** Whole-session cost accumulated per turn (durable turn number). */
export interface DeepSeekTurnCost extends DeepSeekCostBreakdown {
  turn: number
  /** Per-model peak/off-peak calculation details for this turn. */
  details: DeepSeekModelDetail[]
}

/**
 * Whole-log DeepSeek cost, split by billing bucket, model, and turn.
 *
 * The value is replayable: it folds only durable session events
 * (`request/header`, `assistant/chunk` usage, and `assistant/message`
 * usage), so the browser renders the same number after a reload.
 */
export interface DeepSeekUsageProjection extends DeepSeekCostBreakdown {
  /** Cost by model id, ascending by first billed occurrence. */
  byModel: DeepSeekModelCost[]
  /** Per-model peak/off-peak calculation details for tooltip display. */
  details: DeepSeekModelDetail[]
  /** Cost by turn, ascending. */
  turns: DeepSeekTurnCost[]
}

const costSchema = z.object({
  uncachedInputRmb: z.number().nonnegative(),
  cacheReadRmb: z.number().nonnegative(),
  cacheWriteRmb: z.number().nonnegative(),
  outputRmb: z.number().nonnegative(),
  totalRmb: z.number().nonnegative(),
}).strict()

const tierDetailSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  uncachedInputPricePerMillion: z.number().nonnegative(),
  uncachedInputRmb: z.number().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheReadPricePerMillion: z.number().nonnegative(),
  cacheReadRmb: z.number().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  cacheWritePricePerMillion: z.number().nonnegative(),
  cacheWriteRmb: z.number().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  outputPricePerMillion: z.number().nonnegative(),
  outputRmb: z.number().nonnegative(),
}).strict()

const modelDetailSchema = z.object({
  model: z.string(),
  peak: tierDetailSchema,
  offPeak: tierDetailSchema,
}).strict()

/** Zod schema for the wire payload produced by the projection unit. */
export const deepSeekUsageProjectionSchema = costSchema.extend({
  byModel: z.array(costSchema.extend({
    model: z.string(),
  }).strict()),
  details: z.array(modelDetailSchema),
  turns: z.array(costSchema.extend({
    turn: z.number().int().nonnegative(),
    details: z.array(modelDetailSchema),
  }).strict()),
}).strict() as unknown as z.ZodType<DeepSeekUsageProjection>

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** DeepSeek cost in RMB, accumulated across the complete durable log. */
    deepseekUsage: DeepSeekUsageProjection
  }
}
