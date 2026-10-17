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
 * A built-in the `runtime` export names: its name, JavaScript's own spelling
 * — `Object.is` for the `static` section, `String.prototype.startsWith` for
 * the `member` section, with the receiver type and the key the member is
 * dispatched by — and the function node the name resolves to.
 */
export type _BuiltIn = {
    readonly name: string
    readonly node: readonly unknown[]
    readonly member: readonly [type: string, key: string] | null
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
