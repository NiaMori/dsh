// Shared time-label helpers for user/assistant IconActions rows.

import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'

/** The date-template share of the conversation dictionary the clock consumes. */
export type ClockTranslate = Translate<'clock.md' | 'clock.ymd'>

/** The cost-formula template share of the conversation dictionary. */
export type CostFormulaTranslate = Translate<
  'stats.deepseekFormulaModel'
  | 'stats.deepseekFormulaPeak'
  | 'stats.deepseekFormulaOffPeak'
  | 'stats.deepseekFormulaLabelUncached'
  | 'stats.deepseekFormulaLabelCacheRead'
  | 'stats.deepseekFormulaLabelCacheWrite'
  | 'stats.deepseekFormulaLabelOutput'
>

/** The elapsed-duration share of the conversation dictionary. */
export type RunDurationTranslate = Translate<'duration.seconds' | 'duration.minutes'>
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Local calendar-day epoch (ms at local midnight) for an instant.
 * @param ms - Unix epoch ms.
 * @returns Midnight of that local calendar day.
 */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Delay until the next local midnight after `ms` (at least 1ms).
 * @param ms - Unix epoch ms.
 * @returns Milliseconds until the following local midnight.
 */
export function msUntilNextLocalMidnight(ms: number): number {
  const next = new Date(ms)
  next.setHours(24, 0, 0, 0)
  return Math.max(next.getTime() - ms, 1)
}

/**
 * Localized elapsed-time label shared by running and settled turn chrome.
 * @param ms - Elapsed duration in milliseconds (negatives clamp to zero).
 * @param t - Translate seat supplying the duration templates.
 * @returns Display string in whole seconds.
 */
export function formatRunDuration(ms: number, t: RunDurationTranslate): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes > 0
    ? t('duration.minutes', { minutes, seconds: String(seconds).padStart(2, '0') })
    : t('duration.seconds', { seconds })
}

/**
 * Sub-turn latency figure: one decimal under ten seconds, whole seconds
 * beyond. Unit-less so the locale template owns the second suffix.
 * @param ms - Latency in milliseconds (negatives clamp to zero).
 * @returns Display number in seconds without unit.
 */
export function formatLatencySeconds(ms: number): string {
  const s = Math.max(0, ms) / 1000
  return s < 10 ? String(Math.round(s * 10) / 10) : String(Math.round(s))
}

/**
 * Decode-throughput figure: whole tokens from ten up, one decimal below.
 * @param tps - Tokens per second.
 * @returns Display number without unit.
 */
export function formatTokensPerSecond(tps: number): string {
  const clamped = Math.max(0, tps)
  return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10)
}

/**
 * Compact local timestamp for message IconActions. Same calendar day →
 * `HH:mm`; earlier this year → the `clock.md` date template + clock; other
 * years → the `clock.ymd` template + clock. Pure: the date templates arrive
 * through the caller's locale seat.
 * @param time - Unix epoch ms from the source session event.
 * @param t - translate seat supplying the `clock.md` / `clock.ymd` templates.
 * @param now - Reference instant for the day/year cut (defaults to wall clock).
 * @returns Date-aware clock string (24-hour, zero-padded time).
 */
/**
 * Compact RMB cost figure: whole-yuan amounts show two decimals; sub-yuan
 * amounts keep enough digits to stay meaningful for token-level billing.
 * @param rmb - RMB amount.
 * @returns Display string with the yen sign.
 */
export function formatRmb(rmb: number): string {
  if (rmb >= 1) return `¥${rmb.toFixed(2)}`
  if (rmb >= 0.01) return `¥${rmb.toFixed(4)}`
  return `¥${rmb.toFixed(6)}`
}

/** The tiered token/price details that make up one DeepSeek cost figure. */
export interface DeepSeekTierDetailLike {
  uncachedInputTokens: number
  uncachedInputPricePerMillion: number
  uncachedInputRmb: number
  cacheReadTokens: number
  cacheReadPricePerMillion: number
  cacheReadRmb: number
  cacheWriteTokens: number
  cacheWritePricePerMillion: number
  cacheWriteRmb: number
  outputTokens: number
  outputPricePerMillion: number
  outputRmb: number
}

/** Per-model peak/off-peak calculation details for one cost figure. */
export interface DeepSeekModelDetailLike {
  model: string
  peak: DeepSeekTierDetailLike
  offPeak: DeepSeekTierDetailLike
}

/**
 * Compact token count for display columns: 517 / 12.2K / 517K / 1.2M.
 * @param n - token count.
 * @returns compact display string.
 */
export function formatTokens(n: number): string {
  const scaled = (v: number): string =>
    v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${scaled(n / 1_000)}K`
  return `${scaled(n / 1_000_000)}M`
}

/** Token count with thousands separators for tooltip formulas. */
export function formatTokenCount(tokens: number): string {
  return String(Math.round(tokens)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Unit price in the tooltip's per-million-token form. */
export function formatUnitPrice(price: number): string {
  return `¥${price.toFixed(2)}/1M`
}


export function formatMessageClock(time: number, t: ClockTranslate, now: number = Date.now()): string {
  const d = new Date(time)
  const n = new Date(now)
  const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  if (
    d.getFullYear() === n.getFullYear()
    && d.getMonth() === n.getMonth()
    && d.getDate() === n.getDate()
  ) {
    return clock
  }
  const params = { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
  const md = d.getFullYear() === n.getFullYear() ? t('clock.md', params) : t('clock.ymd', params)
  return `${md} ${clock}`
}
