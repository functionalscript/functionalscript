/**
 * Keep established invariant inputs outside canonical plain-loop helpers.
 * Source state selection remains unchanged. This narrow graph normalization
 * recovers the established scalar helper when at most one input changes.
 *
 * @module
 * @import { BindingId, Definition, Loop, Value } from '../../types.ts'
 * @import { InvariantState } from './types.ts'
 */

import { hasLoopTransfer } from '../../control/module.f.mjs'

/** @type {(value: Value, id: BindingId) => boolean} */
const names = (value, id) => value instanceof Array && value[0] === 'ref' && value[1] === id

/**
 * A forwarded input may become an external alias only when its entry value is
 * already established. Deferred references and computed initializers keep their
 * original eager entry order. Both signatures still contain at least one slot;
 * genuinely multiple changing inputs retain the aggregate helper.
 *
 * @type {(loop: Loop, deferred?: readonly BindingId[]) => InvariantState}
 */
export const invariantState = (loop, deferred = []) => {
    const unchanged = /** @type {InvariantState} */ ({ loop, aliases: [] })
    if (loop.parameters.length < 2 || loop.results.length !== loop.parameters.length || loop.body.statements.length !== 1
        || !loop.initial.every(value => !(value instanceof Array) || value[0] === 'ref' && !deferred.includes(value[1]))) { return unchanged }
    const statement = loop.body.statements[0]
    if (statement[0] !== 'if' || statement[1].length !== 0) { return unchanged }
    const [, , condition, step, otherwise] = statement
    const next = step.exit
    const done = otherwise.exit
    if (next[0] !== 'continue' || next[1] !== loop.target || done[0] !== 'break' || done[1] !== loop.target
        || otherwise.statements.length !== 0 || !step.statements.every(statement => statement[0] === 'define')
        || !done[2].every((value, index) => names(value, loop.parameters[index]))) { return unchanged }
    const candidates = loop.parameters.map((parameter, index) => names(next[2][index], parameter))
    const changing = candidates.flatMap((candidate, index) => candidate ? [] : [index])
    if (changing.length > 1) { return unchanged }
    const retained = changing.length === 0 ? 0 : changing[0]
    const aliases = loop.parameters.flatMap((parameter, index) => index === retained ? [] : [{ parameter, result: loop.results[index], value: loop.initial[index] }])
    /** @type {readonly Value[]} */
    const operands = [condition, .../** @type {readonly Definition[]} */ (step.statements).map(statement => statement[2]), ...next[2]]
    if (operands.some(value => hasLoopTransfer(value, loop.target))) { return unchanged }
    const exit = loop.body.exit
    return {
        aliases,
        loop: {
            ...loop,
            parameters: [loop.parameters[retained]], initial: [loop.initial[retained]], results: [loop.results[retained]],
            body: {
                statements: [['if', [], condition,
                    { ...step, exit: ['continue', loop.target, [next[2][retained]]] },
                    { ...otherwise, exit: ['break', loop.target, [done[2][retained]]] },
                ]],
                exit: (exit[0] === 'continue' || exit[0] === 'break') && exit[1] === loop.target ? [exit[0], exit[1], [exit[2][retained]]] : exit,
            },
        },
    }
}
