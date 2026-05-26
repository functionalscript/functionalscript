/**
 * Shared Unicode code-point contract for the UTF-8 and UTF-16 decoders: the
 * error-tag mask used to flag invalid sequences, and a streaming `decoder`
 * factory that wraps a per-unit step and an end-of-input step into a single
 * `List`-to-`List` conversion.
 *
 * @module
 */
import { flat, type List, stateScan } from '../../types/list/module.f.ts'
import type { StateScan } from '../../types/function/operator/module.f.ts'

/**
 * Error mask used to tag invalid code points or encoding errors. A decoded
 * value with this bit set represents a malformed unit rather than a valid
 * code point.
 */
export const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

/**
 * Builds a streaming decoder from the two direction-specific steps.
 *
 * The input is processed unit by unit through `byteOp`, then a trailing
 * end-of-input marker drives `eofOp` to flush any leftover decoding state.
 *
 * @param byteOp - The per-unit decoding step.
 * @param eofOp - The end-of-input step that flushes the remaining state.
 * @param init - The initial decoding state.
 * @returns A function converting a list of code units into a list of code points.
 */
export const decoder = <Unit, S, Cp>(
    byteOp: StateScan<Unit, S, List<Cp>>,
    eofOp: (state: S) => readonly [List<Cp>, S],
    init: S,
): (input: List<Unit>) => List<Cp> => {
    const op: StateScan<Unit | null, S, List<Cp>> = (input, state) =>
        input === null ? eofOp(state) : byteOp(input, state)
    const run = stateScan(op)(init)
    return input => flat(run(flat<Unit | null>([input, [null]])))
}
