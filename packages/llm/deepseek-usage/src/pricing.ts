/**
 * DeepSeek price table, peak/off-peak windows, and per-sample cost math.
 *
 * Prices are RMB per million tokens, taken from the official Chinese pricing
 * page: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/. DeepSeek
 * publishes and revises prices, so deployments should override them in
 * cordis.yml without code changes.
 *
 * @module @deepseek-ai/dsh-deepseek-usage/pricing
 */

import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { DeepSeekCostBreakdown, DeepSeekTierDetail } from './projection.ts'

/** Provider route the package bills. */
export const DEEPSEEK_OFFICIAL_PROVIDER = 'deepseek-official'

/** One model's per-million-token RMB prices. */
export interface DeepSeekPriceRmb {
  /** Uncached prompt input (cache miss), RMB per million tokens. */
  prompt: number
  /** Cached prompt input (cache read), RMB per million tokens. */
  cachedPrompt: number
  /** Output, RMB per million tokens. */
  output: number
  /**
   * Off-peak prices, replacing the peak prices outside the configured peak
   * windows. Required by the config schema so every composed row carries both
   * tiers.
   */
  offPeak: {
    /** Off-peak uncached prompt input price, RMB per million tokens. */
    prompt: number
    /** Off-peak cached prompt input price, RMB per million tokens. */
    cachedPrompt: number
    /** Off-peak output price, RMB per million tokens. */
    output: number
  }
}

/** One UTC peak window in minutes since UTC midnight. */
export interface UtcWindow {
  /** Window start, minutes since UTC midnight. */
  startMinutes: number
  /** Window end (exclusive), minutes since UTC midnight. */
  endMinutes: number
}

/** Plugin configuration; validated by the schemastery schema in index.ts. */
export interface DeepSeekUsageConfig {
  /** Per-model price table. Unknown model ids fall back to `defaultModel`. */
  models: Record<string, DeepSeekPriceRmb>
  /** Prices used for a model id not listed in `models`. */
  defaultModel: DeepSeekPriceRmb
  /**
   * DeepSeek peak windows in minutes since UTC midnight. The official
   * published peak hours are 01:00–04:00 and 06:00–10:00 UTC; every other
   * hour is off-peak and billed at half the peak rate.
   */
  peakWindowsUtc: UtcWindow[]
}

/** Official peak windows from the DeepSeek pricing page. */
const OFFICIAL_PEAK_WINDOWS_UTC: UtcWindow[] = [
  { startMinutes: 1 * 60, endMinutes: 4 * 60 },
  { startMinutes: 6 * 60, endMinutes: 10 * 60 },
]

/** Defaults: the official Chinese pricing page's RMB list prices. */
export const DEFAULT_DEEPSEEK_USAGE_CONFIG: DeepSeekUsageConfig = {
  models: {
    'deepseek-v4-flash': {
      prompt: 3.0,
      cachedPrompt: 0.10,
      output: 9.0,
      offPeak: { prompt: 1.5, cachedPrompt: 0.05, output: 4.5 },
    },
    'deepseek-v4-pro': {
      prompt: 9.0,
      cachedPrompt: 0.30,
      output: 27.0,
      offPeak: { prompt: 4.5, cachedPrompt: 0.15, output: 13.5 },
    },
  },
  defaultModel: {
    prompt: 3.0,
    cachedPrompt: 0.10,
    output: 9.0,
    offPeak: { prompt: 1.5, cachedPrompt: 0.05, output: 4.5 },
  },
  peakWindowsUtc: OFFICIAL_PEAK_WINDOWS_UTC,
}

/** Model id whose price is in force, or null when the current provider is not DeepSeek. */
export interface DeepSeekUsageModel {
  model: string
}

/**
 * Resolve the price table for one billed model id.
 * @param config - validated plugin config.
 * @param model - provider-owned model id.
 * @returns the price row, falling back to `defaultModel`.
 */
export function priceForModel(config: DeepSeekUsageConfig, model: string): DeepSeekPriceRmb {
  return config.models[model] ?? config.defaultModel
}

/**
 * Test whether a Unix-epoch millisecond timestamp falls inside any configured
 * peak window.
 * @param timeMs - event timestamp.
 * @param peakWindows - peak windows in minutes since UTC midnight.
 * @returns true inside a peak window.
 */
export function isPeak(timeMs: number, peakWindows: readonly UtcWindow[]): boolean {
  const date = new Date(timeMs)
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  return peakWindows.some(window =>
    minutes >= window.startMinutes && minutes < window.endMinutes)
}

/**
 * Price one provider usage sample in RMB, including token counts and unit
 * prices for the peak/off-peak tier the sample falls into.
 * @param config - validated plugin config.
 * @param model - model id to price with.
 * @param usage - provider-reported disjoint token buckets.
 * @param timeMs - event timestamp for the peak/off-peak decision.
 * @returns per-bucket RMB and the tiered calculation detail.
 */
export function costForUsage(
  config: DeepSeekUsageConfig,
  model: string,
  usage: TokenUsage,
  timeMs: number,
): { cost: DeepSeekCostBreakdown; tier: 'peak' | 'offPeak'; detail: DeepSeekTierDetail } {
  const table = priceForModel(config, model)
  const peak = isPeak(timeMs, config.peakWindowsUtc)
  const promptPrice = peak ? table.prompt : table.offPeak.prompt
  const cachedPromptPrice = peak ? table.cachedPrompt : table.offPeak.cachedPrompt
  const outputPrice = peak ? table.output : table.offPeak.output

  const uncachedInputTokens = usage.inputTokens
  const cacheReadTokens = usage.cacheReadTokens ?? 0
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0
  const outputTokens = usage.outputTokens

  const uncachedInputRmb = uncachedInputTokens / 1_000_000 * promptPrice
  const cacheReadRmb = cacheReadTokens / 1_000_000 * cachedPromptPrice
  const cacheWriteRmb = cacheWriteTokens / 1_000_000 * promptPrice
  const outputRmb = outputTokens / 1_000_000 * outputPrice

  const cost = {
    uncachedInputRmb,
    cacheReadRmb,
    cacheWriteRmb,
    outputRmb,
    totalRmb: uncachedInputRmb + cacheReadRmb + cacheWriteRmb + outputRmb,
  }
  const detail: DeepSeekTierDetail = {
    uncachedInputTokens,
    uncachedInputPricePerMillion: promptPrice,
    uncachedInputRmb,
    cacheReadTokens,
    cacheReadPricePerMillion: cachedPromptPrice,
    cacheReadRmb,
    cacheWriteTokens,
    cacheWritePricePerMillion: promptPrice,
    cacheWriteRmb,
    outputTokens,
    outputPricePerMillion: outputPrice,
    outputRmb,
  }
  return { cost, tier: peak ? 'peak' : 'offPeak', detail }
}
