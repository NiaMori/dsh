/**
 * Minimal workspace-orientation reminder: inject one short user message after
 * the first direct user prompt, pointing the model at AGENTS.md and skills
 * locations without registering any tool or prompt section.
 *
 * @module @deepseek-ai/dsh-agent-instructions-minimal
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

/** Cordis plugin name. */
export const name = 'agent-instructions-minimal'

const REMINDER = [
  'Before starting, check whether an AGENTS.md file exists in the workspace or project root and read it if present.',
  'If a skills directory exists (for example .agents/skills or .dsh/skills), look inside; a relevant SKILL.md may be useful.',
  'Also check ~/.agents for AGENTS.md and skills that may apply.',
].join(' ')

/**
 * Inject the orientation reminder once per agent, after the first direct user
 * message is claimed for a step.
 * @param ctx - Cordis context.
 */
export function apply(ctx: Context): void {
  const reminded = new WeakSet<Agent>()

  ctx.on('agent/pre-step', async ({ agent, messages }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    if (reminded.has(agent)) return decision
    const hasDirectUserInput = messages.some(message => message.source.kind === 'user')
    if (!hasDirectUserInput) return decision
    reminded.add(agent)

    return {
      kind: 'enter',
      messages: [
        ...decision.messages,
        createUserMessage({
          content: [{ type: 'text', text: REMINDER }],
          source: { kind: 'plugin', plugin: name },
        }),
      ],
    }
  })
}
