/**
 * Type-level API of the EDAG→Rust printer.
 *
 * @module
 */

import type { Exp } from '../types.ts'
import type { Result } from '../../types/result/types.ts'

/**
 * One mode of the printer in [`module.f.mjs`](./module.f.mjs), over one set
 * of shared bindings: `f` prints a node as an `Any<A>` expression, and
 * `bare` prints an operation — a `.` read or an operator node — as the
 * `Result<Any<A>, Any<A>>` its `nanvm-lib` call answers, before `f` follows
 * it with the mode's `?`. Both answer the refusal instead where the node
 * has no `nanvm-lib` spelling. The pair exists so a thunk in the bare mode
 * can borrow the propagating mode's printers for its body.
 */
export type Printer = {
    readonly f: (e: Exp) => Result<string, readonly unknown[]>
    readonly bare: (e: readonly any[]) => Result<string, readonly unknown[]>
}
