# @deepseek-ai/dsh-deepseek-usage

English | [中文](README.zh.md)

DeepSeek RMB cost projection for the harness session-projection seam. The plugin folds durable provider usage events (`assistant/chunk` usage and `assistant/message` usage) into a replayable `deepseekUsage` projection that records cost per billing bucket, per model, and per turn. It makes no model calls and registers no tools; the browser surfaces are the `deepseekUsage` group in the conversation stats line and the per-turn cost in the turn-tail metrics of `@deepseek-ai/dsh-client-ui-conversation`.

## Config

All prices are **RMB per million tokens**. The defaults are the official Chinese pricing page's RMB list prices, using the official peak hours; override them in `cordis.yml` when DeepSeek revises pricing.

```yaml
- id: deepseek-usage
  name: '@deepseek-ai/dsh-deepseek-usage'
  config:
    models:
      deepseek-v4-flash:
        prompt: 3.0
        cachedPrompt: 0.10
        output: 9.0
        offPeak:
          prompt: 1.5
          cachedPrompt: 0.05
          output: 4.5
    defaultModel:
      prompt: 3.0
      cachedPrompt: 0.10
      output: 9.0
      offPeak:
        prompt: 1.5
        cachedPrompt: 0.05
        output: 4.5
    peakWindowsUtc:
      - startMinutes: 60     # 01:00 UTC
        endMinutes: 240      # 04:00 UTC
      - startMinutes: 360    # 06:00 UTC
        endMinutes: 600      # 10:00 UTC
```

- `prompt` prices uncached input (`inputTokens`).
- `cachedPrompt` prices cache-read input (`cacheReadTokens`).
- `output` prices generated tokens.
- `offPeak` prices apply outside the official peak windows and are half of the peak rates.
- `cacheWriteTokens` are billed at `prompt`; DeepSeek currently reports no cache-write metric.
- A model id absent from `models` falls back to `defaultModel`.

## Projection

`ctx.sessionProjections` registers `deepseekUsage` when the composition carries the projection registry. The value is:

```ts
{
  uncachedInputRmb, cacheReadRmb, cacheWriteRmb, outputRmb, totalRmb,
  byModel: [{ model, ...buckets }],
  details: [{ model, peak: { tokens, pricePerMillion, rmb, ... }, offPeak: { ... } }],
  turns: [{ turn, ...buckets, details: [{ model, peak: {...}, offPeak: {...} }] }],
}
```

The fold is pure and replayable. Usage chunks are counted once per step; a later finalized `assistant/message` sample for the same `(turn, step)` replaces the earlier chunk sample rather than double-counting it.

## Model Experience

None, as the plugin only computes a client-facing read model from already-logged provider usage and adds no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the projection never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Default prices are deployment-owned starting points** — DeepSeek publishes and revises prices independently of this package; update the `config.models` and `config.defaultModel` rows rather than editing source.
- **Off-peak is evaluated by the event timestamp** — a usage event spanning a peak-window boundary is priced at its own timestamp, which is the durable fact available in the log.
- **Unknown DeepSeek models bill at `defaultModel`** — exact per-model pricing requires a config entry.
- **Prices follow the official Chinese pricing page** — update `config.models` / `config.defaultModel` when DeepSeek revises the RMB list prices.
