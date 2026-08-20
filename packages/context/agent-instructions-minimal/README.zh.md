# @deepseek-ai/dsh-agent-instructions-minimal

[English](README.md) | 中文

为“不加工具、不改 prompt 段落”的 agent preset 提供极简工作区提示。每个会话在第一条用户消息之后，插件追加一条简短用户消息，提醒模型：如果存在 `AGENTS.md` 就读取；附近如果有 `skills` 目录可以看看；`~/.agents` 下也可能有值得关注的内容。

插件不注册任何 tool、prompt 段落或 service。

## Model Experience

### 工作区提示

#### What the model sees

第一条用户消息后注入的一条用户消息：

##### Verbatim injected reminder

```markdown
Before starting, check whether an AGENTS.md file exists in the workspace or project root and read it if present. If a skills directory exists (for example .agents/skills or .dsh/skills), look inside; a relevant SKILL.md may be useful. Also check ~/.agents for AGENTS.md and skills that may apply.
```

#### Token effect

每个 agent 固定一次：首次请求约几十 token，之后不再增加。

#### KV Cache effect

仅追加一次：提示内容固定，后续请求前缀保持稳定。

## Known Limitations and Deferred Work

- **只是提醒**——插件不负责读取 AGENTS.md 或 skill 正文，模型需要用已有工具自行查看。
- **在 `next()` 之后注入**——如果同一 step 被其他监听器拒绝，该 step 不会注入这条提醒。
