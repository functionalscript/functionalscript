/** Boundaries and state for represented module interpretation. @module */

import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { EdagValue, Object as ValueObject } from '../../edag/value/types.ts'
import type { ParseError } from '../parser/types.ts'

/** A module initialization failure retains its language value and source. */
export type InitializationError = {
    readonly message: string
    readonly metadata: null
    readonly path: string
    readonly thrown: EdagValue
}

export type SourceError = ParseError | InitializationError

/** Initialized export objects, plus the current import chain. */
export type ParseContext = {
    readonly complete: OrderedMap<ValueObject>
    readonly stack: List<string>
}
