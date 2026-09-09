/**
 * Implementation-private types of the DataJS reader: the rule its container
 * reader takes apart, and the state of the resolution.
 *
 * @module
 */

import type { List } from '../../../types/list/types.ts'
import type { OrderedMap } from '../../../types/ordered_map/types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { Rule } from '../../../ebnf/types.ts'
import type { ws } from '../../../ebnf/lib/json/module.f.mjs'
import type { Unknown } from '../types.ts'
import type { Container, Node } from './types.ts'

/** The pair `cj` hands to `join`: an item, then its whitespace. */
export type _Item<R extends Rule> = readonly [R, typeof ws]

/**
 * A bound value, in a box: `at` answers `null` for a name the map does not
 * hold, and a `const` may be bound to `null` itself.
 */
export type _Binding = readonly [value: Unknown]

/** The names bound so far, each to its value. */
export type _Env = OrderedMap<_Binding>

/**
 * A container being built: `container[1][index]` is being evaluated, and
 * `done` holds the values of the items before it — a list, since appending
 * to an array per item would copy the whole prefix each time.
 */
export type _Frame = {
    readonly container: Container
    readonly index: number
    readonly done: List<Unknown>
}

/** The containers suspended around the node being evaluated, innermost on top. */
export type _Stack = { readonly top: _Frame, readonly rest: _Stack } | null

/** What to do next: evaluate a node, or hand a value — or the error — to the frame on top. */
export type _Step = readonly ['enter', Node] | Result<Unknown, string>

export type _State = readonly [stack: _Stack, step: _Step]
