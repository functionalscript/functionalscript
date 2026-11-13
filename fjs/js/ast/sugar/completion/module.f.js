/**
 * Complete invocation value regions during FAST lowering, without changing syntax ASTs.
 * @module
 * @import { SourceBlock, SourceCase, SourceStatement } from '../source.ts'
 * @import { Task } from '../../task/types.ts'
 */

import { bind, call, done, run } from '../../task/module.f.js'

/** Whether a completed source region retains a normal path. @type {(body: SourceBlock) => boolean} */
const normal = body => {
    /** @type {readonly SourceBlock[]} */
    let pending = [body]
    while (pending.length !== 0) {
        const block = pending[0]
        pending = pending.slice(1)
        const exit = block.exit
        if (exit[0] === 'yield') { return true }
        if (exit[0] === 'if') { pending = [...pending, exit[2], exit[3]] }
        if (exit[0] === 'switch') { pending = [...pending, ...exit[2].map(arm => arm.body), exit[3]] }
    }
    return false
}

/** An absent arm has no work and continues normally. @type {(body: SourceBlock) => boolean} */
const empty = body => body.statements.length === 0 && body.exit[0] === 'yield' && body.exit[1] === undefined

/** @type {(body: SourceBlock) => Task<SourceBlock>} */
const completed = body => {
    /** @type {(index: number, prefix: readonly SourceStatement[]) => Task<SourceBlock>} */
    const each = (index, prefix) => call(() => {
        if (index === body.statements.length) { return done({ statements: prefix, exit: body.exit }) }
        const statement = body.statements[Number(index)]
        if (statement[0] === 'return' || statement[0] === 'throw') { return done({ statements: prefix, exit: statement }) }
        if (statement[0] === 'if') {
            return bind(completed(statement[2]), then => bind(completed(statement[3]), otherwise => {
                if (!normal(then) && !normal(otherwise)) { return done({ statements: prefix, exit: ['if', statement[1], then, otherwise] }) }
                if (!normal(then) && empty(otherwise)) {
                    return bind(each(index + 1, []), tail => done({ statements: prefix, exit: ['if', statement[1], then, tail] }))
                }
                return each(index + 1, [...prefix, statement])
            }))
        }
        if (statement[0] === 'switch') {
            const source = statement[1]
            /** @type {(index: number, cases: readonly SourceCase[]) => Task<SourceBlock>} */
            const arms = (arm, cases) => arm < source.cases.length
                ? bind(completed(source.cases[Number(arm)].body), block => arms(arm + 1, [...cases, { ...source.cases[Number(arm)], body: block }]))
                : bind(completed(source.otherwise), otherwise => {
                    if (cases.every(entry => !normal(entry.body))) {
                        if (!normal(otherwise)) { return done({ statements: prefix, exit: ['switch', source.discriminant, cases, otherwise] }) }
                        if (empty(otherwise)) { return bind(each(index + 1, []), tail => done({ statements: prefix, exit: ['switch', source.discriminant, cases, tail] })) }
                    }
                    return each(index + 1, [...prefix, statement])
                })
            return arms(0, [])
        }
        return each(index + 1, [...prefix, statement])
    })
    return each(0, [])
}

/** Direct terminal returns become value-region exits; following source work is unreachable. @type {(body: SourceBlock) => SourceBlock} */
export const returnedBlock = body => run(completed(body))

/** Owning returns still nested in statements require an invocation boundary. @type {(body: SourceBlock) => boolean} */
export const hasRetainedReturn = body => {
    /** @type {readonly SourceBlock[]} */
    let pending = [body]
    while (pending.length !== 0) {
        const block = pending[0]
        pending = pending.slice(1)
        for (const statement of block.statements) {
            if (statement[0] === 'return') { return true }
            if (statement[0] === 'if') { pending = [...pending, statement[2], statement[3]] }
            if (statement[0] === 'while' || statement[0] === 'for-of') { pending = [...pending, statement[1].body] }
            if (statement[0] === 'switch') { pending = [...pending, ...statement[1].cases.map(arm => arm.body), statement[1].otherwise] }
        }
        const exit = block.exit
        if (exit[0] === 'if') { pending = [...pending, exit[2], exit[3]] }
        if (exit[0] === 'switch') { pending = [...pending, ...exit[2].map(arm => arm.body), exit[3]] }
        if (exit[0] === 'terminal-loop') { pending = [...pending, exit[1].body] }
    }
    return false
}
