/**
 * Canonical invocation loops reuse the ordinary function and its public result.
 * Only aliases precede the loop; each loop input is one current invocation input.
 * The loop's internal array values remain opaque, including helper protocols.
 * This owner resolves tail statement transfers without changing value lowering.
 * Nonroot helpers and nonlocal value operands have separate construction owners.
 *
 * @module
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../../../js/ast/types.ts'
 * @import { Frame, Link, Normal, Owner, Task, TerminalBlock, Visit } from './private.ts'
 */

import { iterable } from '../../../../types/list/module.f.mjs'
import { invocationAliases } from '../module.f.mjs'

/** @type {(value: Value, binding: BindingId) => boolean} */
const names = (value, binding) => value instanceof Array && value[0] === 'ref' && value[1] === binding

/**
 * A fixed invocation layout with its whole public result returned directly.
 * Established capture/self aliases are harmless prefix reads. Only parameter
 * lineages retain an input position; equal debug indices never merge slots.
 * Rest invocation transitions belong to the shared argument recipe owner.
 * @type {(fn: FastFunction) => Loop | null}
 */
export const invocationRootOf = fn => {
    const { body } = fn
    const exit = body.exit
    if (fn.rest !== null || exit[0] !== 'return' || exit[1] !== fn.target) { return null }
    const last = body.statements.at(-1)
    if (last === undefined || last[0] !== 'loop') { return null }
    const loop = last[1]
    if (loop.parameters.length !== fn.parameters.length || loop.initial.length !== fn.parameters.length
        || loop.results.length !== 1 || !names(exit[2], loop.results[0])) { return null }
    const aliases = invocationAliases(fn, body.statements.slice(0, -1))
    return aliases !== null && loop.initial.every((value, position) => aliases[position].some(binding => names(value, binding))) ? loop : null
}

/**
 * Regions containing only normal yields or graph failures keep their original
 * statements. A suffix after normal ifs is constructed once, not once per arm.
 * One immutable postorder worklist also bounds deeply nested region analysis.
 * @type {(root: Block) => ReadonlyMap<Block, boolean>}
 */
const ordinaryBlocks = root => {
    /** @type {Link<Visit> | null} */
    let work = { first: ['enter', root], tail: null }
    /** @type {Link<boolean> | null} */
    let results = null
    /** @type {Link<readonly [Block, boolean]> | null} */
    let entries = null
    while (work !== null) {
        const visit = /** @type {Visit} */ (work.first)
        work = work.tail
        if (visit[0] === 'enter') {
            const children = /** @type {readonly Block[]} */ (visit[1].statements.flatMap(statement => statement[0] === 'block' ? [statement[2]] : statement[0] === 'if' ? [statement[3], statement[4]] : []))
            work = children.reduceRight((tail, block) => ({ first: /** @type {Visit} */ (['enter', block]), tail }), /** @type {Link<Visit>} */ ({ first: ['finish', visit[1], children], tail: work }))
            continue
        }
        let ordinary = (visit[1].exit[0] === 'yield' || visit[1].exit[0] === 'throw') && !visit[1].statements.some(statement => statement[0] === 'loop')
        for (const _ of visit[2]) {
            const child = /** @type {Link<boolean>} */ (results)
            ordinary = child.first && ordinary
            results = child.tail
        }
        results = { first: ordinary, tail: results }
        entries = { first: [visit[1], ordinary], tail: entries }
    }
    return new Map(iterable(entries))
}

/** @type {(statement: Statement, owner: Owner) => boolean} */
const ordinaryStatement = (statement, owner) => statement[0] === 'define' || (statement[0] === 'block' ? owner.ordinary.get(statement[2]) === true
    : statement[0] === 'if' && owner.ordinary.get(statement[3]) === true && owner.ordinary.get(statement[4]) === true)

/** @type {(block: TerminalBlock) => Task} */
const done = block => ({ kind: 'done', block })
/** @type {(run: () => Task) => Task} */
const call = run => ({ kind: 'call', run })
/** @type {(first: Task, next: (block: TerminalBlock) => Task) => Task} */
const bind = (first, next) => ({ kind: 'bind', first, next })
/** @type {(input: Task) => TerminalBlock} */
const run = input => {
    let task = input
    /** @type {Frame | null} */
    let frames = null
    while (true) {
        if (task.kind === 'call') { task = task.run(); continue }
        if (task.kind === 'bind') { frames = { next: task.next, rest: frames }; task = task.first; continue }
        if (frames === null) { return task.block }
        const frame = /** @type {Frame} */ (frames)
        frames = frame.rest
        task = frame.next(task.block)
    }
}

/** @type {(statements: readonly Statement[], result: Task) => Task} */
const before = (statements, result) => bind(result, block => done({ ...block, statements: [...statements, ...block.statements] }))

/** The owning public return becomes a conditional arm's normal value. @type {(block: TerminalBlock) => Block} */
const arm = block => {
    const exit = block.exit
    if (exit[0] === 'throw') { return block }
    return { ...block, exit: ['yield', [exit[2]]] }
}

/** @type {(values: readonly Value[], owner: Owner) => Task} */
const returned = (values, owner) => {
    if (values.length !== 1) { throw 'an invocation loop has one whole public result' }
    return done({ statements: [], exit: ['return', owner.fn.target, values[0]] })
}

/**
 * Continue has the actual invocation signature. It becomes the direct ordinary
 * self call; no private completion or memo product is added around its result.
 * @type {(block: Block, owner: Owner, normal: Normal) => Task}
 */
const blockTask = (block, owner, normal) => {
    /** @type {(index: number) => Task} */
    const each = index => call(() => {
        let position = index
        while (position !== block.statements.length && ordinaryStatement(block.statements[position], owner)) { ++position }
        if (position !== index) { return before(block.statements.slice(index, position), each(position)) }
        if (index !== block.statements.length) {
            const statement = block.statements[index]
            if (statement[0] === 'loop') { throw 'nested loop construction requires the structured helper owner' }
            const region = /** @type {Extract<Statement, readonly ['block' | 'if', ...unknown[]]>} */ (statement)
            /** @type {Normal} */
            const resume = values => {
                if (values.length !== region[1].length) { throw 'invalid canonical region result signature' }
                return before(region[1].map((binding, i) => ['define', binding, values[i], 'required']), each(index + 1))
            }
            if (region[0] === 'block') { return blockTask(region[2], owner, resume) }
            return bind(blockTask(region[3], owner, resume), then => bind(blockTask(region[4], owner, resume), otherwise =>
                returned([['if', region[2], arm(then), arm(otherwise)]], owner)))
        }
        const exit = block.exit
        if (exit[0] === 'yield') { return normal(exit[1]) }
        if (exit[0] === 'return') {
            if (exit[1] !== owner.fn.target) { throw 'a root return must name its owning function' }
            return done({ statements: [], exit })
        }
        if (exit[0] === 'throw') { return done({ statements: [], exit }) }
        if (exit[1] !== owner.loop.target) { throw 'a root loop transfer must name its owning loop' }
        if (exit[0] === 'break') { return returned(exit[2], owner) }
        if (exit[2].length !== owner.fn.parameters.length) { throw 'invalid canonical invocation transition signature' }
        return returned([['()', owner.self, exit[2]]], owner)
    })
    return each(0)
}

/**
 * Resolve a matched root to the ordinary function constructor's own value body.
 * A synthesized self binding is lexical only; existing self/captures are kept.
 * A reached normal yield violates the normalized loop-body transfer contract.
 * @type {(fn: FastFunction, loop: Loop) => FastFunction}
 */
export const directInvocationRoot = (fn, loop) => {
    const self = fn.self ?? { index: fn.target.index }
    const owner = { fn, loop, ordinary: ordinaryBlocks(loop.body), self: /** @type {Value} */ (['ref', self]) }
    const aliases = loop.parameters.map((binding, i) => /** @type {Statement} */ (['define', binding, loop.initial[i], 'lazy']))
    const prefix = fn.body.statements.slice(0, -1).map(statement => {
        const alias = /** @type {Extract<Statement, readonly ['define', ...unknown[]]>} */ (statement)
        return /** @type {Statement} */ (['define', alias[1], alias[2], 'lazy'])
    })
    const body = run(before([...prefix, ...aliases], blockTask(loop.body, owner, () => { throw 'a normalized loop body requires an explicit transfer' })))
    return { ...fn, self, body }
}
