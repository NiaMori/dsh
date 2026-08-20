/**
 * Minimal skill slash-command handler: keep the web UI skill gesture but
 * inject only the skill's file address instead of its full instructions.
 * No model-facing tool is registered.
 *
 * @module @deepseek-ai/dsh-skill-minimal
 */

import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import { isUserInvocable, type SkillDefinition } from '@deepseek-ai/dsh-skill'

/** Cordis plugin name. */
export const name = 'skill-minimal'
export const inject = ['skills']

const SKILL_GESTURE = /(^|\s)\/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/g

/** `/name` gesture tokens from direct user input, deduplicated in first-seen order. */
function invokedSkillNames(messages: readonly UserMessage[]): string[] {
  const names: string[] = []
  for (const message of messages) {
    if (message.source.kind !== 'user') continue
    for (const block of message.content) {
      if (block.type !== 'text') continue
      for (const match of block.text.matchAll(SKILL_GESTURE)) {
        const name = match[2]
        if (name !== undefined && !names.includes(name)) names.push(name)
      }
    }
  }
  return names
}

/** One-line address hint for an invoked skill, or undefined when it has no local address. */
function skillAddress(skill: SkillDefinition): string | undefined {
  if (skill.path !== undefined) return skill.path
  const base = skill.resourceBase
  if (base === undefined) return undefined
  switch (base.kind) {
    case 'directory': return `${base.path}/SKILL.md`
    case 'url': return base.url
    case 'opaque': return base.description
  }
}

/**
 * Intercept direct `/name` skill gestures and append only the skill address.
 * @param ctx - Cordis context carrying the skill registry.
 */
export function apply(ctx: Context): void {
  ctx.on('agent/pre-step', async ({ agent, messages, signal }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject') return decision

    const names = invokedSkillNames(messages)
    if (names.length === 0) return decision

    signal.throwIfAborted()
    const lookup = { cwd: agent.session.header.cwd, signal, scope: agent }
    const injections: UserMessage[] = []
    for (const name of names) {
      const skill = await ctx.skills.get(name, lookup)
      signal.throwIfAborted()
      if (skill === undefined || !isUserInvocable(skill)) continue
      const address = skillAddress(skill)
      if (address === undefined) continue
      injections.push(createUserMessage({
        content: [{ type: 'text', text: `Skill "${skill.name}" is available at: ${address}` }],
        source: { kind: 'plugin', plugin: name },
      }))
    }
    if (injections.length === 0) return decision
    return { kind: 'enter', messages: [...decision.messages, ...injections] }
  })
}
