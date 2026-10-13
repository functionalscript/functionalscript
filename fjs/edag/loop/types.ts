/**
 * Type-level API of `fjs/edag/loop/module.f.mjs`: the parts of a function
 * that is a loop.
 *
 * @module
 */

import type { Operand } from '../analysis/types.ts'

/**
 * The parts of a loop, `r => COND ? self(NEXT) : r`, by the operands of its
 * body: the asserts established before the condition each round, the
 * condition, the asserts established once the condition holds, and the
 * state of the next round. Each assert is an operand of a comma whose
 * value is discarded — a `const` the next value does not reach. `arm` is
 * the consequent as the `?:` holds it, the call or the comma around it:
 * the block root a writer scopes the asserts and the next value under.
 */
export type Loop = {
    readonly before: readonly Operand[]
    readonly condition: Operand
    readonly arm: Operand
    readonly asserts: readonly Operand[]
    readonly next: Operand
}
