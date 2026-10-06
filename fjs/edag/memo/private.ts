/** Immutable state within one memo invocation. @module */
import type { EdagValue } from '../value/types.ts'

export type _Cache = readonly (readonly [number, EdagValue])[]
