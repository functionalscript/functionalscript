import type { Exp } from '../types.ts'

/**
 * Which condition a walker node violates. The four are the three conditions
 * of `canonical` in `module.f.mjs`, with minimality contributing three of
 * them because it cuts a walk in three places.
 *
 * - `too few steps` — the cardinality condition: `_` needs two steps, `_()`
 *   one. Without it a walker respells a pure node.
 * - `a dead prefix before the region` — nothing is guarded before the region
 *   opens, so every step ahead of the first optional one leaves through the
 *   front into the base; the single exception is a `|.` supplying the
 *   receiver a `|?.()` consumes.
 * - `a cut inside the region` — an optional step that takes no receiver from
 *   the step before it. Closing the region there is unobservable, so the
 *   walk is two nodes.
 * - `a trailing call step` — `_()` only: a call step has already cleared the
 *   receiver, leaving the node's own call nothing to consume, which is what
 *   `()` over the region spells.
 */
export type ChainMessage =
    | 'too few steps'
    | 'a dead prefix before the region'
    | 'a cut inside the region'
    | 'a trailing call step'

/**
 * One violated condition: the `_`/`_()` node that violates it, and which
 * condition it is. The node rather than a path, because an EDAG is a graph —
 * a shared node has as many paths as incoming edges, and none of them names
 * it better than the node itself does.
 */
export type ChainError = {
    readonly node: Exp,
    readonly message: ChainMessage,
}
