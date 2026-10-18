/**
 * Types private to the static runtime's printer, `module.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../../../edag/types.ts'

/**
 * A module-level node resolved at compile time: a function, which becomes
 * an item, or a literal, inlined where a body reads it.
 */
export type _Resolved = readonly ['function', readonly unknown[]] | readonly ['literal', Exp]

/**
 * A built-in the `runtime` export names: its name — `Object.is` for the
 * `static` section, `startsWith` for the `member` section, the key a call
 * step dispatches by — the function node the name resolves to, and
 * whether it is the `member` section's.
 */
export type _BuiltIn = {
    readonly name: string
    readonly node: readonly unknown[]
    readonly member: boolean
}

/**
 * A module-level function as an item: the node, the built-in's name, which
 * a helper no section names gets as `f0`, `f1`, …, the identifier, and the
 * kind — a static, with an accessor compiled code reads; a member, the
 * code alone, which a call step calls; or a helper, with an accessor the
 * module's own.
 */
export type _Item = {
    readonly node: readonly unknown[]
    readonly name: string
    readonly ident: string
    readonly kind: 'static' | 'member' | 'helper'
}

/** The sections of a runtime module: its built-ins, and its `dot` dispatcher's node, which is not printed, or `undefined` for none. */
export type _Table = {
    readonly builtIns: readonly _BuiltIn[]
    readonly dot: unknown
}
