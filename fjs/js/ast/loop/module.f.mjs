/**
 * The normalized one-state loop form shared by graph construction and output
 * preparation. This module recognizes structure, independently of invocation
 * placement, completion handling or target syntax.
 *
 * @module
 *
 * @import { BindingId, Definition, Loop, Value } from '../types.ts'
 * @import { ScalarLoop } from './types.ts'
 */

/** @type {(value: Value, binding: BindingId) => boolean} */
const names = (value, binding) => value instanceof Array && value[0] === 'ref' && value[1] === binding

/**
 * Parts of the established one-state loop form. Every condition runs in the
 * iteration, the selected step continues the same target, and the alternative
 * returns the unchanged state as the scalar normal result.
 *
 * @type {(loop: Loop) => ScalarLoop | null}
 */
export const scalarLoopOf = loop => {
    if (loop.parameters.length !== 1 || loop.results.length !== 1 || loop.body.statements.length !== 1) { return null }
    const statement = loop.body.statements[0]
    if (statement[0] !== 'if' || statement[1].length !== 0) { return null }
    const [, , condition, step, otherwise] = statement
    const next = step.exit
    const done = otherwise.exit
    if (next[0] !== 'continue' || next[1] !== loop.target || done[0] !== 'break' || done[1] !== loop.target || otherwise.statements.length !== 0 || !names(done[2][0], loop.parameters[0]) || !step.statements.every(statement => statement[0] === 'define')) { return null }
    return { condition, step: { statements: /** @type {readonly Definition[]} */ (step.statements), exit: step.exit }, next: next[2][0] }
}
