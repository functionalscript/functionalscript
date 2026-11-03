/**
 * Source scope bookkeeping types reached by the parser's internal helpers.
 * These shapes belong to the published declaration closure; parser worklist
 * frames remain implementation-private.
 *
 * @module
 */

import type { List } from '../../../types/list/types.ts'
import type { OrderedMap } from '../../../types/ordered_map/types.ts'
import type { BindingEvent, BindingId, FunctionTarget } from '../../../js/ast/types.ts'
import type { SourceParameter } from '../../../js/ast/sugar/source.ts'
import type { PatternPlan } from '../../../js/ast/sugar/pattern/types.ts'
import type { BindingOrigin, ParseError } from '../types.ts'

/** Remembering reads through a scope preserves the existing shadowing admission. `assignable` is a variable's, a `let`'s or a parameter's. */
export type _Ref = { readonly id: BindingId; readonly kind: 'own' | 'capture' | 'self'; readonly assignable: boolean }
export type _Env = OrderedMap<_Ref>
export type _Plan = PatternPlan

/** Open source events append without copying; closing materializes their array. */
export type _Trace = {
    readonly target: FunctionTarget
    readonly bindings: readonly BindingId[]
    readonly events: List<BindingEvent>
    /** Top-level event count keeps source target indices deterministic. */
    readonly count: number
}

export type _Scope = {
    readonly names: _Env
    readonly origins: OrderedMap<BindingId>
    readonly trace: _Trace
    readonly sourceOrigins: readonly BindingOrigin[]
    readonly region: boolean
    /** Regions retain whether their owner is an ordinary function, not a module. */
    readonly inFunction: boolean
    /** A direct, argumentless call with no parameter or rest setup. */
    readonly blockCall: boolean
    readonly count: number
    readonly parameters: readonly SourceParameter[]
    readonly rest: _Plan | null
    readonly enclosing: List<_Env>
    readonly outer: _Scope | null
    readonly self: string | null
    readonly selfBinding: BindingId | null
    /** Whether the function's own name is a variable's, a `let`'s: a reference to it is then a capture, refused once the variable is reassigned. */
    readonly selfVariable: boolean
    /** Each reference from a nested function to a binding outside it, in document order, with the refusal a write to the binding earns it once `escaped`: once a function between the two closed held as a value, rather than called where it is written. */
    readonly captures: readonly _Capture[]
}
export type _Capture = { readonly id: BindingId; readonly refusal: ParseError; readonly escaped: boolean; readonly written: boolean }
/** What declares a name: a `const`, a `let` or a parameter list — the two variables' kinds, and the one an assignment refuses. */
export type _DeclarationKind = 'const' | 'let' | 'parameter'
