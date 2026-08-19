# @deepseek-ai/dsh-deepseek-usage

[English](README.md) | 中文

DeepSeek 人民币消耗的 session-projection 投影插件。它把持久化的 provider 用量事件（`assistant/chunk` usage 与 `assistant/message` usage）折叠为可回放的 `deepseekUsage` 投影，按计费桶、模型和轮次记录成本。插件不发起任何模型调用，也不注册工具；浏览器端展示为 `@deepseek-ai/dsh-client-ui-conversation` 会话统计中的 `deepseekUsage` 组，以及轮末统计中的本轮成本。

## 配置

所有价格均为**人民币/百万 tokens**。插件默认附带 DeepSeek 中文官网公示的人民币价格与官方高峰时段；DeepSeek 调价时在 `cordis.yml` 覆盖即可。

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
    offPeakWindowUtc:
      startMinutes: 990   # 16:30 UTC
      endMinutes: 30      # 00:30 UTC，跨 UTC 午夜
```

- `prompt` 为未命中缓存输入（`inputTokens`）价格。
- `cachedPrompt` 为命中缓存输入（`cacheReadTokens`）价格。
- `output` 为生成 token 价格。
- `cacheWriteTokens` 按 `prompt` 计费；DeepSeek 当前不返回 cache-write 指标。
- `models` 中缺失的模型 id 回退到 `defaultModel`。

## 投影

当组合中存在 projection registry 时，`ctx.sessionProjections` 会注册 `deepseekUsage`：

```ts
{
  uncachedInputRmb, cacheReadRmb, cacheWriteRmb, outputRmb, totalRmb,
  byModel: [{ model, ...buckets }],
  details: [{ model, peak: { tokens, pricePerMillion, rmb, ... }, offPeak: { ... } }],
  turns: [{ turn, ...buckets, details: [{ model, peak: {...}, offPeak: {...} }] }],
}
```

折叠过程纯函数、可回放。每个 step 只计一次用量 chunk；同一 `(turn, step)` 的最终 `assistant/message` 样本会替换先前的 chunk 样本，而不会重复计费。

## Model Experience

无，该插件只从已记录的 provider 用量计算客户端展示用的读模型，不增加任何 prompt、消息、schema、流或工具结果。

#### KV Cache effect

无；该投影不会组装或发送 provider 请求。

## Known Limitations and Deferred Work

- **默认价格只是部署起点**——请以中文官网价格页为准，DeepSeek 调价时更新 `config.models` / `config.defaultModel`，而不是改源码。
- **错峰判定使用事件时间戳**——跨窗口边界的用量事件按自身时间戳计价，这也是日志中可用的持久化事实。
- **未知 DeepSeek 模型按 `defaultModel` 计费**——精确按模型计价需要在配置中补一条。
