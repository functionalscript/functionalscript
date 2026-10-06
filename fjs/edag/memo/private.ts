/** Immutable state within one EDAG invocation. @module */
import type { Array, EdagValue, Values } from '../value/types.ts'
import type { ValueResult } from '../value/control/types.ts'

export type _Context = {
    readonly args: Values
    readonly frame: Values
    readonly fixed?: Values
    readonly rest?: Array
}
export type _Cache = readonly (readonly [number, EdagValue])[]
export type _Evaluation = readonly [_Cache, ValueResult]
