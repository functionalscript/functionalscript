/**
 * Give one ordinary statement join an immutable, parameterized continuation.
 * This normalized-FAST profile runs before physical result slots are chosen.
 * Unsupported functions retain their original identity and lowering.
 *
 * @module
 * @import { BindingId, Block, Function as FastFunction, FunctionTarget, Statement, Value } from '../../types.ts'
 * @import { Task } from '../../task/types.ts'
 * @import { List, NonEmpty } from '../../../../types/list/types.ts'
 */

import { operatorOperands } from '../../module.f.mjs'
import { exitValues, freeBindings } from '../../control/module.f.mjs'
import { bind, call, done, run } from '../../task/module.f.js'
import { next } from '../../../../types/list/module.f.js'
import { toArray } from '../../../../types/list/alt/module.f.js'

/** Value regions with control keep the existing physical plan. @type {(root: Value) => boolean} */
const plainValue = root => {
    /** @type {List<Value>} */
    let pending = [root]
    while (true) {
        /** @type {NonEmpty<Value> | null} */
        const item = next(pending)
        if (item === null) { return true }
        pending = item.tail
        const value = item.first
        if (!(value instanceof Array)) { continue }
        if (value[0] === 'block' || value[0] === 'if') { return false }
        const children = value[0] === 'function' ? value[1].captures.map(capture => capture.value)
            : value[0] === 'ref' ? [] : operatorOperands(value)
        pending = { head: children, tail: pending }
    }
}

/** No definition or control boundary is moved across the chosen join. @type {(statements: readonly Statement[]) => boolean} */
const requiredDefinitions = statements => statements.every(statement => statement[0] === 'define'
    && statement[3] === 'required' && plainValue(statement[2]))

/**
 * Normal outer-arm results invoke the shared continuation. Inner zero-result
 * decisions keep their normal continuation and every existing abrupt owner.
 * Producer-established owners and normal result arities are trusted.
 * @type {(source: Block, result: boolean, owner: FunctionTarget, continuation: BindingId) => Task<Block | null>}
 */
const branchTask = (source, result, owner, continuation) => {
    /** @type {(index: number, previous: List<Statement>) => Task<Block | null>} */
    const each = (index, previous) => call(() => {
        if (index === source.statements.length) {
            const exit = source.exit
            if (exit[0] === 'yield') {
                if (!exit[1].every(plainValue)) { return done(null) }
                return done({ statements: toArray(previous).toReversed(), exit: result
                    ? ['return', owner, ['()', ['ref', continuation], exit[1]]] : exit })
            }
            if (exit[0] === 'loop' || !exitValues(exit).every(plainValue)) { return done(null) }
            return done({ statements: toArray(previous).toReversed(), exit })
        }
        const statement = source.statements[Number(index)]
        if (statement[0] === 'define') {
            return statement[3] === 'required' && plainValue(statement[2])
                ? each(index + 1, { first: statement, tail: previous }) : done(null)
        }
        if (statement[0] !== 'if' || statement[1].length !== 0 || !plainValue(statement[2])) { return done(null) }
        return bind(branchTask(statement[3], false, owner, continuation), then => {
            if (then === null) { return done(null) }
            return bind(branchTask(statement[4], false, owner, continuation), otherwise => otherwise === null ? done(null)
                : each(index + 1, { first: ['if', [], statement[2], then, otherwise], tail: previous }))
        })
    })
    return each(0, null)
}

/**
 * Extract one required, single-result join and its normally returned suffix.
 * Explicit self functions keep the existing plan: extracting their suffix
 * could hide an owning self tail call, including one through a local alias.
 * Ordinary nested function bodies retain their independent owners.
 * @type {(fn: FastFunction) => FastFunction}
 */
export const _immutableJoin = fn => {
    const exit = fn.body.exit
    if (fn.self !== null || exit[0] !== 'return' || !plainValue(exit[2])) { return fn }
    const index = fn.body.statements.findIndex(statement => statement[0] !== 'define')
    const join = fn.body.statements[Number(index)]
    if (join === undefined || join[0] !== 'if' || join[1].length !== 1 || !plainValue(join[2])) { return fn }
    const prefix = fn.body.statements.slice(0, index)
    const suffix = fn.body.statements.slice(index + 1)
    if (!requiredDefinitions(prefix) || !requiredDefinitions(suffix)) { return fn }
    const continuation = /** @type {const} */ ({ index: join[1][0].index })
    const target = /** @type {const} */ ({ kind: 'function', index: fn.target.index })
    const then = run(branchTask(join[3], true, fn.target, continuation))
    if (then === null) { return fn }
    const otherwise = run(branchTask(join[4], true, fn.target, continuation))
    if (otherwise === null) { return fn }
    /** @type {Block} */
    const body = { statements: suffix, exit: ['return', target, exit[2]] }
    /** @type {FastFunction} */
    const helper = { target, parameters: join[1], rest: null, self: null,
        captures: freeBindings(body, join[1]).map(binding => ({ binding, value: ['ref', binding] })), body }
    return { ...fn, body: { statements: [...prefix, ['define', continuation, ['function', helper], 'required'],
        ['if', [], join[2], then, { statements: [], exit: ['yield', []] }], ...otherwise.statements], exit: otherwise.exit } }
}
