/**
 * Types for the DJS transpiler.
 *
 * @module
 */

import type { Denotation } from '../ast/types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'

/**
 * State threaded through the recursive transpilation of a DJS module graph.
 *
 * - `complete`: modules that have been fully parsed and evaluated, keyed by identity.
 * - `stack`: module identities currently being resolved (used to detect circular dependencies).
 *
 * There is no `error` field. It used to hold "the first parse error
 * encountered, or `null` while everything is clean" — a hand-rolled error
 * channel that every step had to set, and that three separate places had to
 * test before doing any work. It is the effect's channel now
 * (`Effect<ReadFile | ResolveFileModule, ParseContext, ParseError>`), so `step` short-circuits and
 * a context that exists is a context that is still good.
 */
export type ParseContext = {
    readonly complete: OrderedMap<ModuleDenotation>
    readonly stack: List<string>
}

/**
 * A resolved import or root. Identity governs reuse and cycles; path governs
 * loading and source diagnostics. The host supplies both: Node uses canonical
 * file URLs and real filesystem paths; the virtual host uses lexical identities.
 */
export type _Source = {
    readonly id: string
    readonly path: string
    readonly json: boolean
}

/** A resolved import retains the selected export separately from module identity. */
export type _ImportSource = _Source & { readonly name: string | null }

/** A module result and its selected exports, each with its own sharing facts. */
export type ModuleDenotation = {
    readonly exports: Denotation
    readonly bindings: readonly (readonly [string, Denotation])[]
}
