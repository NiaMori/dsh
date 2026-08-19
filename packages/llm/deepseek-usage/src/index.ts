/**
 * DeepSeek RMB usage projection: folds provider-reported token usage into
 * cache-hit / cache-miss / output cost per model and per turn.
 *
 * @module @deepseek-ai/dsh-deepseek-usage
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: resolves the optional projection registry Context declaration.
import type {} from '@deepseek-ai/dsh-session-projection'
import {
  DEFAULT_DEEPSEEK_USAGE_CONFIG,
  type DeepSeekUsageConfig,
} from './pricing.ts'
import { deepSeekUsageProjectionDefinition } from './usage-projection.ts'

export type { DeepSeekUsageProjection } from './projection.ts'
export type { DeepSeekUsageConfig } from './pricing.ts'

/** Cordis plugin name. */
export const name = 'deepseek-usage'

const priceSchema = z.object({
  prompt: z.number().min(0).required(),
  cachedPrompt: z.number().min(0).required(),
  output: z.number().min(0).required(),
  offPeak: z.object({
    prompt: z.number().min(0).required(),
    cachedPrompt: z.number().min(0).required(),
    output: z.number().min(0).required(),
  }).required(),
})

/** Validated plugin config; every field defaults so cordis.yml may be empty. */
export const Config: z<DeepSeekUsageConfig> = z.object({
  models: z.dict(priceSchema).default(DEFAULT_DEEPSEEK_USAGE_CONFIG.models),
  defaultModel: priceSchema.default(DEFAULT_DEEPSEEK_USAGE_CONFIG.defaultModel),
  peakWindowsUtc: z.array(z.object({
    startMinutes: z.number().step(1).min(0).max(1439).required(),
    endMinutes: z.number().step(1).min(0).max(1439).required(),
  })).default(DEFAULT_DEEPSEEK_USAGE_CONFIG.peakWindowsUtc),
})

/**
 * Register the `deepseekUsage` session projection when the composition
 * carries the projection registry; headless assemblies without it keep the
 * rest of the tree unaffected.
 * @param ctx - Cordis context.
 * @param config - validated price table and off-peak window.
 */
export function apply(ctx: Context, config: DeepSeekUsageConfig): void {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register(deepSeekUsageProjectionDefinition(config))
  })
}
