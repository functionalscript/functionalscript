/**
 * Types private to the runtime's printer, `module.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../../../edag/types.ts'

/**
 * A module-level node a section names, resolved: a function, a built-in;
 * a native static the section lists as itself, no built-in of the
 * module's; or anything else, no built-in.
 */
export type _Resolved = readonly ['function', readonly unknown[]] | readonly ['native', Exp] | readonly ['other', Exp]

/**
 * A built-in the `runtime` export names: its name — `Object.is` for the
 * `static` section, `startsWith` for the `member` section — and the
 * function node the name resolves to, which carries the NativeFunction
 * text of the name.
 */
export type _BuiltIn = {
    readonly name: string
    readonly node: readonly unknown[]
}

/** The runtime module: its built-ins, and the `runtime` export object itself, the value the ordinary backend prints. */
export type _Table = {
    readonly builtIns: readonly _BuiltIn[]
    readonly value: Exp
}
