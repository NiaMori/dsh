/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-deepseek-usage`.
 * @module @deepseek-ai/dsh-deepseek-usage/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-deepseek-usage'

/** Cordis companion plugin name. */
export const name = 'deepseek-usage-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the projection is a pure fold over durable usage
 * events; its zod schema fixes the wire payload and the projection registry
 * already rejects an async or malformed view at the boundary.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns The installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
