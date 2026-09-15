/**
 * Implementation-private types for the delta chain walked in `./module.f.mjs`.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { Nullable } from '../../types/nullable/types.ts'
import type { Envelope } from '../object/types.ts'
import type { Entry } from '../pack/types.ts'

/**
 * What the walk down a delta chain has collected: the deltas to apply, how many
 * links it has read, and the object once the chain ends at one.
 *
 * `deltas` is in the order they apply and so in the reverse of the order they
 * were read — the walk starts at the entry the caller asked for and steps to its
 * base, so the last delta read is the one nearest the base and the first to be
 * applied. Each link puts its own delta in front of the ones already there,
 * which `concat` does without copying either side; an array per link would copy
 * the chain so far, and Git's own `--depth` runs to 50 by default and is not
 * bounded above.
 *
 * `links` is what makes a cycle an answer rather than a hang. An `ofsDelta`
 * names its base by a distance *back* and so cannot take part in one, but a
 * `refDelta` names an id, and an id may name the entry it came from or one that
 * points back to it. Nothing in the format forbids it and nothing in a file
 * reveals it up front, so the walk counts. The bound is the pack's own object
 * count, not a number of this reader's choosing: a chain that has read more
 * deltas than the pack holds objects has read one twice.
 *
 * `found` is the walk's answer, filled in by the one link that reaches a
 * non-delta entry. The walk ends there — that link produces no further item —
 * so the state the walk returns carries it.
 */
export type _Chain = {
    readonly deltas: List<readonly number[]>
    readonly links: number
    readonly found: Nullable<Envelope>
}

/**
 * An entry that names a base: the two delta kinds of `Entry` and not the third.
 *
 * A name for the pair, because the walk asks two questions only a delta answers
 * — where its base is and what to say when the pack does not hold it — and a
 * function taking the whole union would need a case for an entry read whole that
 * no caller could reach.
 */
export type _Delta = Exclude<Entry, { readonly kind: 'object' }>
