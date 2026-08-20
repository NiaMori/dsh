# @deepseek-ai/dsh-agent-instructions-minimal

English | [中文](README.zh.md)

Minimal orientation reminder for agent presets that want no extra tools and no prompt-section changes. After the first direct user message of a session, the plugin appends one short user message reminding the model to read `AGENTS.md` when present, look inside nearby `skills` directories, and check `~/.agents` for both.

The plugin registers no tool, no prompt section, and no service.

## Model Experience

### The orientation reminder

#### What the model sees

One injected user message after the first direct user prompt:

##### Verbatim injected reminder

```markdown
Before starting, check whether an AGENTS.md file exists in the workspace or project root and read it if present. If a skills directory exists (for example .agents/skills or .dsh/skills), look inside; a relevant SKILL.md may be useful. Also check ~/.agents for AGENTS.md and skills that may apply.
```

#### Token effect

Fixed once per agent: roughly forty tokens on the first request, and none thereafter.

#### KV Cache effect

Append-only: the reminder is injected once after the first prompt and never changes, so later request prefixes stay stable.

## Known Limitations and Deferred Work

- **Reminder only** — the plugin does not load AGENTS.md or skill bodies; the model must read them with the tools it already has.
- **Injected after `next()`** — a listener that rejects the step suppresses the reminder for that step only.
