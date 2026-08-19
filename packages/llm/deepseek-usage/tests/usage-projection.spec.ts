import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import { deepSeekUsageProjectionDefinition } from '../src/usage-projection.ts'
import { DEFAULT_DEEPSEEK_USAGE_CONFIG, isPeak } from '../src/pricing.ts'

function headerEvent(seq: number, time: number, model: string, provider = 'deepseek-official'): SessionEvent {
  return {
    type: 'request/header',
    seq,
    time,
    data: {
      header: {
        config: { provider, model },
      },
      reason: 'initial',
    },
  } as unknown as SessionEvent
}

function usageEvent(
  seq: number,
  time: number,
  turn: number,
  step: number,
  usage: TokenUsage,
): SessionEvent {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: { turn, step, usage, message: { role: 'assistant', content: [] } },
  } as unknown as SessionEvent
}

function fold(events: SessionEvent[]) {
  const def = deepSeekUsageProjectionDefinition(DEFAULT_DEEPSEEK_USAGE_CONFIG)
  let state = def.init()
  for (const event of events) state = def.apply(state, event)
  return def.view(state)
}

describe('isPeak', () => {
  const windows = DEFAULT_DEEPSEEK_USAGE_CONFIG.peakWindowsUtc

  it('recognizes the official peak windows', () => {
    expect(isPeak(Date.UTC(2026, 0, 1, 1, 0), windows)).toBe(true)
    expect(isPeak(Date.UTC(2026, 0, 1, 3, 59), windows)).toBe(true)
    expect(isPeak(Date.UTC(2026, 0, 1, 4, 0), windows)).toBe(false)
    expect(isPeak(Date.UTC(2026, 0, 1, 6, 0), windows)).toBe(true)
    expect(isPeak(Date.UTC(2026, 0, 1, 9, 59), windows)).toBe(true)
    expect(isPeak(Date.UTC(2026, 0, 1, 10, 0), windows)).toBe(false)
    expect(isPeak(Date.UTC(2026, 0, 1, 0, 30), windows)).toBe(false)
    expect(isPeak(Date.UTC(2026, 0, 1, 5, 0), windows)).toBe(false)
    expect(isPeak(Date.UTC(2026, 0, 1, 16, 30), windows)).toBe(false)
  })
})

describe('deepseek usage projection', () => {
  it('prices cache-miss, cache-read, and output buckets separately at peak rates', () => {
    const value = fold([
      headerEvent(0, Date.UTC(2026, 0, 1, 2, 0), 'deepseek-v4-flash'),
      usageEvent(1, Date.UTC(2026, 0, 1, 2, 1), 0, 0, {
        inputTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ])
    expect(value.uncachedInputRmb).toBe(3.0)
    expect(value.cacheReadRmb).toBe(0.10)
    expect(value.outputRmb).toBe(9.0)
    expect(value.totalRmb).toBeCloseTo(3.0 + 0.10 + 9.0, 6)
    expect(value.turns[0]).toMatchObject({
      turn: 0,
      uncachedInputRmb: 3.0,
      cacheReadRmb: 0.10,
      cacheWriteRmb: 0,
      outputRmb: 9.0,
      totalRmb: 3.0 + 0.10 + 9.0,
    })
    expect(value.details).toHaveLength(1)
    expect(value.details[0]?.model).toBe('deepseek-v4-flash')
    expect(value.details[0]?.peak.uncachedInputTokens).toBe(1_000_000)
    expect(value.details[0]?.peak.uncachedInputPricePerMillion).toBe(3.0)
  })

  it('applies off-peak prices outside the official peak windows', () => {
    const value = fold([
      headerEvent(0, Date.UTC(2026, 0, 1, 20, 0), 'deepseek-v4-flash'),
      usageEvent(1, Date.UTC(2026, 0, 1, 20, 1), 0, 0, {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ])
    expect(value.uncachedInputRmb).toBe(1.5)
    expect(value.outputRmb).toBe(4.5)
  })

  it('replaces an earlier chunk sample with the finalized assistant sample', () => {
    const def = deepSeekUsageProjectionDefinition(DEFAULT_DEEPSEEK_USAGE_CONFIG)
    let state = def.init()
    state = def.apply(state, headerEvent(0, Date.UTC(2026, 0, 1, 2, 0), 'deepseek-v4-flash'))
    state = def.apply(state, {
      type: 'assistant/chunk',
      seq: 1,
      time: Date.UTC(2026, 0, 1, 2, 1),
      data: {
        turn: 0,
        step: 0,
        chunk: {
          type: 'usage',
          usage: { inputTokens: 100, outputTokens: 10 },
        },
      },
    } as unknown as SessionEvent)
    state = def.apply(state, usageEvent(2, Date.UTC(2026, 0, 1, 2, 2), 0, 0, {
      inputTokens: 200,
      outputTokens: 20,
    }))
    const value = def.view(state)
    expect(value.totalRmb).toBe(200 / 1_000_000 * 3.0 + 20 / 1_000_000 * 9.0)
    expect(value.turns).toHaveLength(1)
  })

  it('does not bill usage when the current provider is not DeepSeek', () => {
    const value = fold([
      headerEvent(0, Date.UTC(2026, 0, 1, 2, 0), 'gpt-5', 'other'),
      usageEvent(1, Date.UTC(2026, 0, 1, 2, 1), 0, 0, {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ])
    expect(value.totalRmb).toBe(0)
  })

  it('falls back to the default price for an unknown DeepSeek model', () => {
    const value = fold([
      headerEvent(0, Date.UTC(2026, 0, 1, 2, 0), 'deepseek-v4-turbo'),
      usageEvent(1, Date.UTC(2026, 0, 1, 2, 1), 0, 0, {
        inputTokens: 1_000_000,
        outputTokens: 0,
      }),
    ])
    expect(value.uncachedInputRmb).toBe(3.0)
    expect(value.byModel).toEqual([expect.objectContaining({ model: 'deepseek-v4-turbo' })])
  })
})
