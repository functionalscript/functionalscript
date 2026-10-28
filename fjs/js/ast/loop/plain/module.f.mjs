/**
 * Plan a loop that the admitted plain while grammar can express.
 * Condition-only work retains its iteration lifetime; copied body and result
 * dependencies are restricted to established, identity-free projections.
 *
 * @module
 * @import { Block, Definition, Loop, LoopTarget, Value } from '../../types.ts'
 * @import { ScalarLoop } from '../types.ts'
 * @import { PlainLoop } from './types.ts'
 * @import { Task } from '../../task/types.ts'
 */

import { freeBindings } from '../../control/module.f.mjs'
import { bind, call, done, run } from '../../task/module.f.mjs'

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
 * Independent copies follow the body's first reads, while each read keeps its
 * transitive prerequisites in dependency order. The condition has already
 * established these projections; its own required prefix stays unchanged.
 * @type {(prefix: readonly Definition[], block: Block) => readonly Definition[]}
 */
const prefixForUses = (prefix, block) => {
    /** @type {readonly Definition[]} */
    let selected = []
    for (const id of freeBindings(block)) {
        const remaining = prefix.filter(definition => !selected.some(previous => previous[1] === definition[1]))
        selected = [...selected, ...prefixFor(remaining, { statements: [], exit: ['yield', [['ref', id]]] })]
    }
    return selected
}

/**
 * Copies read values already established by the condition. Keep them beside
 * their first body use so they do not acquire required anchors ahead of
 * unrelated initializers or selected branch results during a source parse.
 * @type {(prefix: readonly Definition[], step: ScalarLoop['step']) => ScalarLoop['step']}
 */
const withPrefix = (prefix, step) => {
    let remaining = prefix
    /** @type {readonly Definition[]} */
    let statements = []
    for (const statement of step.statements) {
        const needed = prefixForUses(remaining, { statements: [statement], exit: ['yield', []] })
        statements = [...statements, ...needed, statement]
        remaining = remaining.filter(definition => !needed.some(required => required[1] === definition[1]))
    }
    return { statements: [...statements, ...remaining], exit: step.exit }
}

/**
 * The terminal conditional continues one exact target or supplies its computed
 * normal result. Only projection dependencies may cross from the condition's
 * prefix into the continuing body or final-result region.
 * @type {(loop: Loop) => PlainLoop | null}
 */
export const plainLoopOf = loop => {
    if (loop.results.length !== 1 || loop.body.statements.length === 0) { return null }
    const statement = loop.body.statements[loop.body.statements.length - 1]
    const before = loop.body.statements.slice(0, -1)
    if (statement[0] !== 'if' || statement[1].length !== 0
        || !before.every(statement => statement[0] === 'define' && statement[3] === 'required')) { return null }
    const [, , test, then, alternative] = statement
    const reversed = loop.parameters.length !== 1 && then.exit[0] === 'break'
    const step = reversed ? alternative : then
    const otherwise = reversed ? then : alternative
    /** @type {Value} */
    const condition = reversed ? ['!', test] : test
    const next = step.exit
    const done = otherwise.exit
    if (next[0] !== 'continue' || next[1] !== loop.target || done[0] !== 'break' || done[1] !== loop.target
        || otherwise.statements.length !== 0 || !step.statements.every(statement => statement[0] === 'define')) { return null }
    const prefix = /** @type {readonly Definition[]} */ (before)
    const stepPrefix = prefixFor(prefix, step)
    const resultPrefix = prefixFor(prefix, { statements: [], exit: ['yield', done[2]] })
    if (![...stepPrefix, ...resultPrefix].every(statement => projection(statement[2]))) { return null }
    return {
        prefix, resultPrefix,
        iteration: {
            condition,
            step: withPrefix(stepPrefix, { statements: /** @type {readonly Definition[]} */ (step.statements), exit: step.exit }),
            next: loop.parameters.length > 1 ? ['array', next[2]] : next[2][0],
        },
        result: done[2][0],
    }
}

/**
 * Reorient a base-first single-input plain loop for source preparation.
 * The existing planner validates the candidate without changing its default
 * orientation domain. Prefixes, targets and selected regions keep their owners.
 * @type {(loop: Loop) => Loop | null}
 */
export const continueFirstPlainLoopOf = loop => {
    const last = loop.body.statements.at(-1)
    if (loop.parameters.length !== 1 || last === undefined || last[0] !== 'if'
        || last[3].exit[0] !== 'break') { return null }
    const oriented = /** @type {Loop} */ ({ ...loop, body: { ...loop.body,
        statements: [...loop.body.statements.slice(0, -1), ['if', last[1], ['!', last[2]], last[4], last[3]]],
    } })
    return plainLoopOf(oriented) === null ? null : oriented
}

/**
 * Turn an all-normal terminal decision tree into one value region. Required
 * prefixes stay before their decision; each selected leaf keeps its result.
 * @type {(block: Block, target: LoopTarget) => Task<Block | null>}
 */
const normalResult = (block, target) => call(() => {
    const last = block.statements.at(-1)
    const conditional = last !== undefined && last[0] === 'if'
    const prefix = conditional ? block.statements.slice(0, -1) : block.statements
    if (!prefix.every(statement => statement[0] === 'define' && statement[3] === 'required')) { return done(null) }
    const exit = block.exit
    if (conditional) {
        if (last[1].length !== 0 || exit[0] !== 'yield' || exit[1].length !== 0) { return done(null) }
        return bind(normalResult(last[3], target), then => then === null ? done(null)
            : bind(normalResult(last[4], target), otherwise => done(otherwise === null ? null : {
                statements: prefix, exit: ['yield', [['if', last[2], then, otherwise]]],
            })))
    }
    return done(exit[0] === 'break' && exit[1] === target && exit[2].length === 1
        ? { statements: block.statements, exit: ['yield', exit[2]] } : null)
})

/**
 * Keep required normal-arm definitions and terminal decisions in its result.
 * The value block runs once after the final test, with the same bindings and
 * reached order. Single-input base-first candidates use the existing orientation
 * helper; the unchanged planner validates every other plain restriction.
 * @type {(loop: Loop) => Loop | null}
 */
export const resultBlockPlainLoopOf = loop => {
    const last = loop.body.statements.at(-1)
    if (last === undefined || last[0] !== 'if') { return null }
    const baseFirst = last[4].exit[0] === 'continue'
    const normal = baseFirst ? last[3] : last[4]
    if (normal.statements.length === 0) { return null }
    const value = run(normalResult(normal, loop.target))
    if (value === null) { return null }
    const result = /** @type {Block} */ ({ statements: [], exit: ['break', loop.target, [['block', value]]] })
    const retained = /** @type {Loop} */ ({ ...loop, body: { ...loop.body,
        statements: [...loop.body.statements.slice(0, -1), ['if', last[1], last[2], baseFirst ? result : last[3], baseFirst ? last[4] : result]],
    } })
    return loop.parameters.length === 1 && baseFirst ? continueFirstPlainLoopOf(retained)
        : plainLoopOf(retained) === null ? null : retained
}
