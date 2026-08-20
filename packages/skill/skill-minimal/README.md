# @deepseek-ai/dsh-skill-minimal

English | [中文](README.zh.md)

Minimal skill slash-command handler. The web UI skill picker keeps its current interaction; when a user submits a `/name` gesture naming a user-invocable skill, this plugin appends only the skill's file address to the prompt instead of loading the full skill body. No model-facing tool is registered.

## Model Experience

### The skill address hint

#### What the model sees

For each valid `/name` gesture, one injected user message such as:

##### Example injected address

```markdown
Skill "my-skill" is available at: /absolute/path/to/my-skill/SKILL.md
```

#### Token effect

One short line per invoked skill, only for the step that carries the gesture.

#### KV Cache effect

Append-only: the injected address depends on the user gesture and the resolved skill path, so it does not invalidate earlier request prefixes.

## Known Limitations and Deferred Work

- **Address only** — the model must read the skill file itself using its existing tools.
- **Unknown or user-disabled skills stay plain prose** — the plugin does not interfere with `/name` tokens that are not valid user-invocable skills.
