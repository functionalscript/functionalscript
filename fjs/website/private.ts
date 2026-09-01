/**
 * Types for the browser proof manifest's dependency scan.
 *
 * A `private.ts` and not a `types.ts`: nothing outside this directory names
 * them — the manifest is a *file* the generator writes, not an API a consumer
 * imports — and they are here rather than inline because
 * [`../AGENTS.md`](../AGENTS.md) §3 keeps named types out of authored `.mjs`.
 *
 * @module
 */

import type { OrderedMap } from '../types/ordered_map/types.ts'

/**
 * What one module's source says about linking it in a browser: the specifiers
 * that would stop it, and the sibling modules it reaches.
 *
 * The two are the same list read twice, split by {@link local}: a relative
 * specifier names a file this scan can follow, and anything else — a bare
 * package, a `node:` builtin — is a blocker, because a browser has nowhere to
 * resolve it from.
 *
 * @internal
 */
export type _Imports = {
    readonly blockers: readonly string[]
    readonly local: readonly string[]
}

/**
 * Every module the scan has read, by path. A module is read once however many
 * others import it, which is the whole reason the graph is built before it is
 * asked any questions.
 *
 * @internal
 */
export type _Graph = OrderedMap<_Imports>
