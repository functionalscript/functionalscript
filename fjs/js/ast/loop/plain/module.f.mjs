/**
 * Plan a one-state loop that the admitted plain while grammar can express.
 * Condition-only work retains its iteration lifetime; copied body and result
 * dependencies are restricted to established, identity-free projections.
 *
 * @module
 * @import { Block, Definition, Loop, Value } from '../../types.ts'
 * @import { PlainLoop } from './types.ts'
 */

import { freeBindings } from '../../control/module.f.mjs'

/**
 * Fixed numeric reads preserve established values. Named properties can mint
 * bound native methods, and continued accesses can execute calls.
 * @type {(value: Value) => boolean}
 */
const projection = value => {
    let current = value
    while (current instanceof Array && current[0] === '.' && current.length === 3 && typeof current[2] === 'number') {
        current = current[1]
    }
    return !(current instanceof Array) || current[0] === 'ref'
}

/**
 * The condition already executes every required prefix definition. Copy only
 * dependencies another region reads, including their earlier prefix inputs.
 * @type {(prefix: readonly Definition[], block: Block) => readonly Definition[]}
 */
const prefixFor = (prefix, block) => {
    let needed = freeBindings(block)
    /** @type {readonly Definition[]} */
    let selected = []
    for (const definition of prefix.toReversed()) {
        if (!needed.includes(definition[1])) { continue }
        selected = [definition, ...selected]
        needed = [...needed, ...freeBindings({ statements: [], exit: ['yield', [definition[2]]] })]
    }
    return selected
}

/**
 * The terminal conditional continues one exact target or supplies its computed
 * normal result. Only projection dependencies may cross from the condition's
 * prefix into the continuing body or final-result region.
 * @type {(loop: Loop) => PlainLoop | null}
 */
export const plainLoopOf = loop => {
    if (loop.parameters.length !== 1 || loop.results.length !== 1 || loop.body.statements.length === 0) { return null }
    const statement = loop.body.statements[loop.body.statements.length - 1]
    const before = loop.body.statements.slice(0, -1)
    if (statement[0] !== 'if' || statement[1].length !== 0
        || !before.every(statement => statement[0] === 'define' && statement[3] === 'required')) { return null }
    const [, , condition, step, otherwise] = statement
    const next = step.exit
    const done = otherwise.exit
    if (next[0] !== 'continue' || next[1] !== loop.target || done[0] !== 'break' || done[1] !== loop.target
        || otherwise.statements.length !== 0 || !step.statements.every(statement => statement[0] === 'define')) { return null }
    const prefix = /** @type {readonly Definition[]} */ (before)
    const stepPrefix = prefixFor(prefix, step)
    const resultPrefix = prefixFor(prefix, { statements: [], exit: ['yield', done[2]] })
    if (![...stepPrefix, ...resultPrefix].every(statement => projection(statement[2]))) { return null }
    return {
        prefix, stepPrefix, resultPrefix,
        iteration: {
            condition,
            step: { statements: /** @type {readonly Definition[]} */ (step.statements), exit: step.exit },
            next: next[2][0],
        },
        result: done[2][0],
    }
}
