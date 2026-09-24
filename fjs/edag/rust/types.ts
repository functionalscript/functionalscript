/**
 * Type-level API of the EDAG→Rust printer.
 *
 * @module
 */

import type { Exp } from '../types.ts'
import type { Result } from '../../types/result/types.ts'

/**
 * The printer of one EDAG in [`module.f.mjs`](./module.f.mjs), in one mode
 * over one set of bindings: `f` prints a node's text where it is referenced
 * — a primitive's literal, a bound node's name, any other node's own
 * construction — and `block` prints the lines of a node's block, a `let`
 * per temporary the node binds and the node as the `Result` the block
 * answers. Both answer the refusal instead where a node has no `nanvm-lib`
 * spelling.
 */
export type Printer = {
    readonly f: (e: Exp) => Result<string, readonly unknown[]>
    readonly block: (e: Exp) => Result<readonly string[], readonly unknown[]>
}
