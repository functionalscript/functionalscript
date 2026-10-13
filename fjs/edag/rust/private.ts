/**
 * Types private to the EDAG→Rust printer, `module.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../types.ts'

/**
 * The parts of a loop read off its function node — `r => COND ? ARM : r`,
 * `ARM` the self-call `self(NEXT)` or a comma holding asserts before it —
 * the nodes the loop closure prints: the condition tested each round, the
 * arm whose block is the round's, and the next value assigned at its end.
 */
export type _LoopParts = {
    readonly condition: Exp
    readonly arm: Exp
    readonly next: Exp
}

/**
 * A call printed as the loop its callee is, where the call stands: the
 * call, whose temporary is the loop's variable; the function called, a
 * value nowhere, whose slots the scope binds by names of its own; and the
 * loop's parts.
 */
export type _LoopInPlace = readonly [call: Exp, callee: Exp, parts: _LoopParts]
