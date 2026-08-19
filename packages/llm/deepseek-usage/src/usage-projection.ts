/**
 * Pure projection fold for DeepSeek RMB usage.
 *
 * @module @deepseek-ai/dsh-deepseek-usage/usage-projection
 */

import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { DEEPSEEK_OFFICIAL_PROVIDER, costForUsage, type DeepSeekUsageConfig } from './pricing.ts'
import type {
  DeepSeekCostBreakdown, DeepSeekModelCost, DeepSeekModelDetail, DeepSeekTierDetail, DeepSeekTurnCost,
} from './projection.ts'
import { deepSeekUsageProjectionSchema } from './projection.ts'

interface UsageSample {
  turn: number
  step: number
  usage: TokenUsage
}

interface LastSample {
  turn: number
  step: number
  model: string
  cost: DeepSeekCostBreakdown
  tier: 'peak' | 'offPeak'
  detail: DeepSeekTierDetail
}

interface UsageState {
  /** Billing model from the latest `request/header`, or null when the provider is not DeepSeek. */
  model: string | null
  totals: DeepSeekCostBreakdown
  byModel: DeepSeekModelCost[]
  details: DeepSeekModelDetail[]
  turns: DeepSeekTurnCost[]
  /** Latest billed sample per turn/step, so a later final sample replaces the earlier chunk sample. */
  last: LastSample | null
}

const ZERO_COST: DeepSeekCostBreakdown = {
  uncachedInputRmb: 0,
  cacheReadRmb: 0,
  cacheWriteRmb: 0,
  outputRmb: 0,
  totalRmb: 0,
}

const ZERO_TIER_DETAIL: DeepSeekTierDetail = {
  uncachedInputTokens: 0,
  uncachedInputPricePerMillion: 0,
  uncachedInputRmb: 0,
  cacheReadTokens: 0,
  cacheReadPricePerMillion: 0,
  cacheReadRmb: 0,
  cacheWriteTokens: 0,
  cacheWritePricePerMillion: 0,
  cacheWriteRmb: 0,
  outputTokens: 0,
  outputPricePerMillion: 0,
  outputRmb: 0,
}

const addCost = (left: DeepSeekCostBreakdown, right: DeepSeekCostBreakdown): DeepSeekCostBreakdown => ({
  uncachedInputRmb: left.uncachedInputRmb + right.uncachedInputRmb,
  cacheReadRmb: left.cacheReadRmb + right.cacheReadRmb,
  cacheWriteRmb: left.cacheWriteRmb + right.cacheWriteRmb,
  outputRmb: left.outputRmb + right.outputRmb,
  totalRmb: left.totalRmb + right.totalRmb,
})

const subtractCost = (left: DeepSeekCostBreakdown, right: DeepSeekCostBreakdown): DeepSeekCostBreakdown => ({
  uncachedInputRmb: left.uncachedInputRmb - right.uncachedInputRmb,
  cacheReadRmb: left.cacheReadRmb - right.cacheReadRmb,
  cacheWriteRmb: left.cacheWriteRmb - right.cacheWriteRmb,
  outputRmb: left.outputRmb - right.outputRmb,
  totalRmb: left.totalRmb - right.totalRmb,
})

const isZeroCost = (cost: DeepSeekCostBreakdown): boolean =>
  cost.uncachedInputRmb === 0
  && cost.cacheReadRmb === 0
  && cost.cacheWriteRmb === 0
  && cost.outputRmb === 0
  && cost.totalRmb === 0

const sameCost = (left: DeepSeekCostBreakdown, right: DeepSeekCostBreakdown): boolean =>
  left.uncachedInputRmb === right.uncachedInputRmb
  && left.cacheReadRmb === right.cacheReadRmb
  && left.cacheWriteRmb === right.cacheWriteRmb
  && left.outputRmb === right.outputRmb
  && left.totalRmb === right.totalRmb

const addTierDetail = (left: DeepSeekTierDetail, right: DeepSeekTierDetail): DeepSeekTierDetail => ({
  uncachedInputTokens: left.uncachedInputTokens + right.uncachedInputTokens,
  uncachedInputPricePerMillion: right.uncachedInputPricePerMillion,
  uncachedInputRmb: left.uncachedInputRmb + right.uncachedInputRmb,
  cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
  cacheReadPricePerMillion: right.cacheReadPricePerMillion,
  cacheReadRmb: left.cacheReadRmb + right.cacheReadRmb,
  cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
  cacheWritePricePerMillion: right.cacheWritePricePerMillion,
  cacheWriteRmb: left.cacheWriteRmb + right.cacheWriteRmb,
  outputTokens: left.outputTokens + right.outputTokens,
  outputPricePerMillion: right.outputPricePerMillion,
  outputRmb: left.outputRmb + right.outputRmb,
})

const subtractTierDetail = (left: DeepSeekTierDetail, right: DeepSeekTierDetail): DeepSeekTierDetail => ({
  uncachedInputTokens: left.uncachedInputTokens - right.uncachedInputTokens,
  uncachedInputPricePerMillion: left.uncachedInputPricePerMillion,
  uncachedInputRmb: left.uncachedInputRmb - right.uncachedInputRmb,
  cacheReadTokens: left.cacheReadTokens - right.cacheReadTokens,
  cacheReadPricePerMillion: left.cacheReadPricePerMillion,
  cacheReadRmb: left.cacheReadRmb - right.cacheReadRmb,
  cacheWriteTokens: left.cacheWriteTokens - right.cacheWriteTokens,
  cacheWritePricePerMillion: left.cacheWritePricePerMillion,
  cacheWriteRmb: left.cacheWriteRmb - right.cacheWriteRmb,
  outputTokens: left.outputTokens - right.outputTokens,
  outputPricePerMillion: left.outputPricePerMillion,
  outputRmb: left.outputRmb - right.outputRmb,
})

const isZeroTierDetail = (detail: DeepSeekTierDetail): boolean =>
  detail.uncachedInputTokens === 0
  && detail.cacheReadTokens === 0
  && detail.cacheWriteTokens === 0
  && detail.outputTokens === 0

const modelDetail = (model: string): DeepSeekModelDetail => ({
  model,
  peak: { ...ZERO_TIER_DETAIL },
  offPeak: { ...ZERO_TIER_DETAIL },
})

function withModelDetail(
  details: DeepSeekModelDetail[],
  model: string,
  tier: 'peak' | 'offPeak',
  detail: DeepSeekTierDetail,
  sign: 1 | -1,
): DeepSeekModelDetail[] {
  const index = details.findIndex(entry => entry.model === model)
  if (index === -1) {
    if (sign === -1) return details
    const next = modelDetail(model)
    next[tier] = detail
    return [...details, next]
  }
  const previous = details[index]
  if (previous === undefined) return details
  const base = sign === 1
    ? addTierDetail(previous[tier], detail)
    : subtractTierDetail(previous[tier], detail)
  const updated: DeepSeekModelDetail = {
    ...previous,
    [tier]: base,
  }
  const nextDetails = details.map(entry => entry.model === model ? updated : entry)
  if (isZeroTierDetail(updated.peak) && isZeroTierDetail(updated.offPeak)) {
    return nextDetails.filter(entry => entry.model !== model)
  }
  return nextDetails
}

function withModelCost(
  byModel: DeepSeekModelCost[],
  model: string,
  cost: DeepSeekCostBreakdown,
  sign: 1 | -1,
): DeepSeekModelCost[] {
  const index = byModel.findIndex(entry => entry.model === model)
  if (index === -1) {
    return sign === 1
      ? [...byModel, { model, ...cost }]
      : byModel
  }
  const previous = byModel[index]
  if (previous === undefined) return byModel
  const next = sign === 1
    ? addCost(previous, cost)
    : subtractCost(previous, cost)
  if (isZeroCost(next)) return byModel.filter(entry => entry.model !== model)
  const updated: DeepSeekModelCost = { model, ...next }
  return byModel.map(entry => entry.model === model ? updated : entry)
}

function withTurnCost(
  turns: DeepSeekTurnCost[],
  turn: number,
  cost: DeepSeekCostBreakdown,
  model: string,
  tier: 'peak' | 'offPeak',
  detail: DeepSeekTierDetail,
  sign: 1 | -1,
): DeepSeekTurnCost[] {
  const index = turns.findIndex(entry => entry.turn === turn)
  if (index === -1) {
    if (sign === -1) return turns
    const next: DeepSeekTurnCost = {
      turn,
      ...cost,
      details: withModelDetail([], model, tier, detail, 1),
    }
    return [...turns, next].sort((left, right) => left.turn - right.turn)
  }
  const previous = turns[index]
  if (previous === undefined) return turns
  const nextCost = sign === 1
    ? addCost(previous, cost)
    : subtractCost(previous, cost)
  const nextDetails = withModelDetail(previous.details, model, tier, detail, sign)
  if (isZeroCost(nextCost)) return turns.filter(entry => entry.turn !== turn)
  const updated: DeepSeekTurnCost = {
    turn,
    ...nextCost,
    details: nextDetails,
  }
  return turns.map(entry => entry.turn === turn ? updated : entry).sort((left, right) => left.turn - right.turn)
}

const usageSampleOf = (event: SessionEvent): UsageSample | undefined => {
  if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
    return { turn: event.data.turn, step: event.data.step, usage: event.data.chunk.usage }
  }
  if (event.type === 'assistant/message' && event.data.usage !== undefined) {
    return { turn: event.data.turn, step: event.data.step, usage: event.data.usage }
  }
  return undefined
}

/** Build the session-projection unit for one validated config. */
export function deepSeekUsageProjectionDefinition(
  config: DeepSeekUsageConfig,
): ProjectionDefinition<'deepseekUsage', UsageState> {
  return {
    key: 'deepseekUsage',
    schema: deepSeekUsageProjectionSchema,
    init: () => ({
      model: null,
      totals: ZERO_COST,
      byModel: [],
      details: [],
      turns: [],
      last: null,
    }),
    apply: (state, event) => {
      let next = state
      if (event.type === 'request/header') {
        const { provider, model } = event.data.header.config
        const nextModel = provider === DEEPSEEK_OFFICIAL_PROVIDER ? model : null
        if (nextModel !== state.model) next = { ...next, model: nextModel }
      }

      const sample = usageSampleOf(event)
      if (sample === undefined) return next

      if (next.model === null) return next
      const model = next.model

      const priced = costForUsage(config, model, sample.usage, event.time)
      const previous = next.last !== null
        && next.last.turn === sample.turn
        && next.last.step === sample.step
        ? next.last
        : null
      if (previous !== null && previous.model === model && sameCost(previous.cost, priced.cost)) {
        return next
      }

      let totals = next.totals
      let byModel = next.byModel
      let details = next.details
      let turns = next.turns
      if (previous !== null) {
        totals = subtractCost(totals, previous.cost)
        byModel = withModelCost(byModel, previous.model, previous.cost, -1)
        details = withModelDetail(details, previous.model, previous.tier, previous.detail, -1)
        turns = withTurnCost(turns, previous.turn, previous.cost, previous.model, previous.tier, previous.detail, -1)
      }
      return {
        model,
        totals: addCost(totals, priced.cost),
        byModel: withModelCost(byModel, model, priced.cost, 1),
        details: withModelDetail(details, model, priced.tier, priced.detail, 1),
        turns: withTurnCost(turns, sample.turn, priced.cost, model, priced.tier, priced.detail, 1),
        last: {
          turn: sample.turn,
          step: sample.step,
          model,
          cost: priced.cost,
          tier: priced.tier,
          detail: priced.detail,
        },
      }
    },
    view: state => ({
      ...state.totals,
      byModel: state.byModel,
      details: state.details,
      turns: state.turns,
    }),
    stateVersion: 2,
  }
}

export type { UsageState }

// Re-export for callers that only import the fold.
export type { DeepSeekUsageProjection } from './projection.ts'
