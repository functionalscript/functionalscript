/** Errors of represented module interpretation. @module */

import type { EdagValue } from '../../edag/value/types.ts'
import type { ParseError } from '../parser/types.ts'

/** A module initialization failure retains its language value and source. */
export type InitializationError = {
    readonly message: string
    readonly metadata: null
    readonly path: string
    readonly thrown: EdagValue
}

export type SourceError = ParseError | InitializationError
