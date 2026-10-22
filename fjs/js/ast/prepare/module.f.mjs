/**
 * Common physical preparation of normalized FAST.
 *
 * Loop state and result slots are private. Every transfer first establishes
 * all of its values, then writes slots, so a swapped state and captures of an
 * iteration use the old values. A new immutable parameter snapshot is bound
 * inside the loop each round. Memo storage is declared where its normalized
 * lazy definition occurs, keeping first-demand evaluation and invocation life.
 *
 * The pass trusts normalized producer invariants. It performs neither source
 * admission nor graph analysis, and it introduces no function boundaries for
 * result blocks. Expression-valued conditionals remain expression-valued.
 * The baseline output domain has no nonlocal transfer in a chain operand.
 * Such a transfer is refused explicitly until physical receiver/chain
 * continuations are added; moving it outside the chain would make it eager.
 *
 * @module
 * @import { BindingId, Block as NormalBlock, Exit as NormalExit, Function as NormalFunction, LoopTarget, Statement as NormalStatement, Value as NormalValue } from '../types.ts'
 * @import { Block, Exit, Function as PreparedFunction, Statement, Value } from './types.ts'
 * @import { _Block, _Context, _Facts, _Flow, _Flows, _Link, _Node, _Prepared, _Statements, _Task, _Value, _Values, _Visit } from './private.ts'
 */

import { mapOperator, operatorOperands } from '../module.f.mjs'
import { scalarLoopOf } from '../loop/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.js'
import { iterable, toArray } from '../../../types/list/module.f.mjs'

/** @type {<T>(value: T) => _Task<T>} */
const done = value => ({ tag: 'done', value })

/** @type {<T>(run: () => _Task<T>) => _Task<T>} */
const call = run => ({ tag: 'call', run })

/**
 * @template T, U
 * @param {_Task<T>} first
 * @param {(value: T) => _Task<U>} next
 * @returns {_Task<U>}
 */
const bind = (first, next) => ({ tag: 'bind', first, next: value => next(/** @type {T} */ (value)) })

/**
 * @template T
 * @param {_Task<T>} input
 * @returns {T}
 */
const run = input => {
    /** @type {_Task<unknown>} */
    let task = input
    /** @type {_Link<(value: unknown) => _Task<unknown>> | null} */
    let stack = null
    while (true) {
        if (task.tag === 'call') { task = task.run(); continue }
        if (task.tag === 'bind') {
            stack = { first: task.next, tail: stack }
            task = task.first
            continue
        }
        if (stack === null) { return /** @type {T} */ (task.value) }
        /** @type {_Link<(value: unknown) => _Task<unknown>>} */
        const frame = stack
        stack = frame.tail
        task = frame.first(task.value)
    }
}

/** @type {<T>(items: readonly T[], tail: _Link<T> | null) => _Link<T> | null} */
const prepend = (items, tail) => items.reduceRight((tail, first) => ({ first, tail }), tail)

/** @type {(node: _Node) => _Facts} */
const facts = node => {
    /** @type {_Facts} */
    const empty = { children: [], ids: [], returns: false, loops: [] }
    switch (node[0]) {
        case 'value': {
            const value = node[1]
            if (!(value instanceof Array)) { return empty }
            if (value[0] === 'ref') { return { ...empty, ids: [value[1]] } }
            if (value[0] === 'function') { return { ...empty, children: [['function', value[1]]] } }
            if (value[0] === 'block') { return { ...empty, children: [['block', value[1]]] } }
            if (value[0] === 'if') { return { ...empty, children: [['value', value[1]], ['block', value[2]], ['block', value[3]]] } }
            return { ...empty, children: operatorOperands(value).map(value => ['value', value]) }
        }
        case 'function': {
            const fn = node[1]
            return {
                ...empty,
                ids: [...fn.parameters, ...fn.captures.map(capture => capture.binding), ...fn.rest === null ? [] : [fn.rest], ...fn.self === null ? [] : [fn.self]],
                children: [...fn.captures.map(capture => /** @type {_Node} */ (['value', capture.value])), ['block', fn.body]],
            }
        }
        case 'block': { return { ...empty, children: [...node[1].statements.map(statement => /** @type {_Node} */ (['statement', statement])), ['exit', node[1].exit]] } }
        case 'loop': { return { ...empty, ids: [...node[1].parameters, ...node[1].results], children: [...node[1].initial.map(value => /** @type {_Node} */ (['value', value])), ['block', node[1].body]] } }
        case 'statement': {
            const statement = node[1]
            switch (statement[0]) {
                case 'define': { return { ...empty, ids: [statement[1]], children: [['value', statement[2]]] } }
                case 'block': { return { ...empty, ids: statement[1], children: [['block', statement[2]]] } }
                case 'if': { return { ...empty, ids: statement[1], children: [['value', statement[2]], ['block', statement[3]], ['block', statement[4]]] } }
                case 'loop': { return { ...empty, children: [['loop', statement[1]]] } }
            }
        }
        case 'exit': {
            const exit = node[1]
            return exit[0] === 'yield' ? { ...empty, children: exit[1].map(value => ['value', value]) }
                : exit[0] === 'break' || exit[0] === 'continue' ? { ...empty, loops: [exit[1]], children: exit[2].map(value => ['value', value]) }
                    : { ...empty, returns: exit[0] === 'return', children: [['value', exit[0] === 'return' ? exit[2] : exit[1]]] }
        }
    }
}

/**
 * One postorder scan records outward transfers and the highest diagnostic
 * index. Constructor-built maps are immutable; repeated block queries do not
 * rescan their descendants. Function bodies own returns, and loops own their
 * transfer targets, while construction captures and initial values stay out.
 *
 * @type {(root: _Node, known?: _Flows) => _Flows}
 */
const flows = (root, known = new Map()) => {
    /** @type {_Link<_Visit> | null} */
    let work = { first: ['enter', root], tail: null }
    /** @type {_Link<_Flow> | null} */
    let results = null
    /** @type {import('../../../types/list/types.ts').List<readonly [_Node[1], _Flow]>} */
    let entries = null
    while (work !== null) {
        const visit = work.first
        work = work.tail
        if (visit[0] === 'enter') {
            const previous = known.get(visit[1][1])
            if (previous !== undefined) { results = { first: previous, tail: results }; continue }
            const own = facts(visit[1])
            work = prepend(own.children.map(node => /** @type {_Visit} */ (['enter', node])), { first: ['finish', visit[1], own], tail: work })
            continue
        }
        const [, node, own] = visit
        let next = own.ids.reduce((next, id) => Math.max(next, id.index + 1), 0)
        let returns = own.returns
        let loops = own.loops
        for (let index = 0; index < own.children.length; ++index) {
            const child = assertNotNullish(results)
            results = child.tail
            next = Math.max(next, child.first.next)
            // The last child is the function body or loop body. Only that
            // region owns the boundary; capture and initial expressions do not.
            if (node[0] !== 'function' || index !== 0) {
                returns ||= child.first.returns
                loops = [...new Set([...loops, ...node[0] === 'loop' && index === 0 ? child.first.loops.filter(target => target !== node[1].target) : child.first.loops])]
            }
        }
        const flow = { next, returns, loops }
        results = { first: flow, tail: results }
        entries = { first: [node[1], flow], tail: entries }
    }
    return new Map(iterable(entries))
}

/** @type {(next: number, count: number) => readonly BindingId[]} */
const fresh = (next, count) => Array.from({ length: count }, (_, index) => ({ index: next + index }))

/** Whether statements in this region physically write one of its slots. @type {(block: Block, id: BindingId) => boolean} */
const writes = (block, id) => {
    /** @type {_Link<Block> | null} */
    let work = { first: block, tail: null }
    while (work !== null) {
        const current = work.first
        work = work.tail
        for (const statement of current.statements) {
            switch (statement[0]) {
                case 'write': { if (statement[1] === id) { return true }; break }
                case 'block': { work = { first: statement[1], tail: work }; break }
                case 'if': { work = prepend([statement[2], statement[3]], work); break }
                case 'loop': { work = { first: statement[2], tail: work }; break }
                case 'while': { work = { first: statement[1].body, tail: work }; break }
            }
        }
    }
    return false
}

/** Slot mutability is a common preparation fact, including zero-transition loops. @type {(block: Block) => Block} */
const withSlots = block => ({
    ...block,
    statements: block.statements.map(statement => statement[0] === 'slot'
        ? ['slot', statement[1], statement[2], writes(block, statement[1])]
        : statement),
})

/** @type {(node: _Node, context: _Context) => boolean} */
const nonlocal = (node, context) => {
    const flow = context.flows.get(node[1]) ?? assertNotNullish(flows(node, context.flows).get(node[1]))
    return flow.returns || flow.loops.length !== 0
}

/** @type {(value: NormalValue, context: _Context) => boolean} */
const nonlocalValue = (value, context) => nonlocal(['value', value], context)

/** @type {(block: NormalBlock, context: _Context) => boolean} */
const nonlocalBlock = (block, context) => nonlocal(['block', block], context)

/** @type {(input: readonly NormalValue[], context: _Context) => _Task<_Values & { readonly statements: readonly Statement[] }>} */
const values = (input, context) => {
    /** @type {(index: number, next: number, previous: import('../../../types/list/types.ts').List<_Value>) => _Task<_Values & { readonly statements: readonly Statement[] }>} */
    const each = (index, next, previous) => call(() => {
        if (index < input.length) {
            return bind(prepareValue(input[index], { ...context, next }), result => each(index + 1, result.next, { first: result, tail: previous }))
        }
        const prepared = toArray(previous).toReversed()
        const lastPrelude = prepared.findLastIndex(result => result.statements.length !== 0)
        if (lastPrelude === -1) { return done({ value: prepared.map(result => result.value), statements: [], next }) }
        const temporaries = fresh(next, lastPrelude)
        return done({
            value: prepared.map((result, index) => index < lastPrelude ? ['ref', temporaries[index]] : result.value),
            statements: prepared.flatMap((result, index) => [...result.statements, ...index < lastPrelude ? [/** @type {Statement} */ (['define', temporaries[index], result.value])] : []]),
            next: next + temporaries.length,
        })
    })
    return each(0, context.next, null)
}

/** @type {(value: NormalFunction, context: _Context) => _Task<_Prepared<PreparedFunction> & { readonly statements: readonly Statement[] }>} */
const functionValue = (value, context) => call(() => bind(values(value.captures.map(capture => capture.value), context), prepared => {
    const captures = value.captures.map((capture, index) => ({ binding: capture.binding, value: prepared.value[index] }))
    return bind(prepareBlock(value.body, { ...context, next: prepared.next, memos: [], loops: [], yields: null, reads: [] }), body =>
        done({ value: { ...value, captures, body: body.value }, statements: prepared.statements, next: body.next }))
}))

/** @type {(value: NormalValue, context: _Context) => _Task<_Value>} */
const prepareValue = (value, context) => call(() => {
    if (!(value instanceof Array)) { return done({ value, statements: [], next: context.next }) }
    switch (value[0]) {
        case 'ref': {
            const id = context.reads.find(([from]) => from === value[1])?.[1] ?? value[1]
            return done({ value: [context.memos.includes(id) ? 'demand' : 'ref', id], statements: [], next: context.next })
        }
        case 'function': {
            return bind(functionValue(value[1], context), result => done({ value: ['function', result.value], statements: result.statements, next: result.next }))
        }
        case 'block': {
            if (nonlocalBlock(value[1], context)) {
                const [slot] = fresh(context.next, 1)
                return bind(prepareBlock(value[1], { ...context, next: context.next + 1, yields: [slot] }), result =>
                    done({ value: ['ref', slot], statements: [['slot', slot, undefined, false], ['block', result.value]], next: result.next }))
            }
            return bind(prepareBlock(value[1], { ...context, yields: null }), result => done({ value: ['block', result.value], statements: [], next: result.next }))
        }
        case 'if': {
            return bind(prepareValue(value[1], context), condition => {
                const lifted = nonlocalBlock(value[2], context) || nonlocalBlock(value[3], context)
                const slots = lifted ? fresh(condition.next, 1) : null
                return bind(prepareBlock(value[2], { ...context, next: condition.next + (slots?.length ?? 0), yields: slots }), then =>
                    bind(prepareBlock(value[3], { ...context, next: then.next, yields: slots }), otherwise =>
                        done(slots === null
                            ? { value: ['if', condition.value, then.value, otherwise.value], statements: condition.statements, next: otherwise.next }
                            : { value: ['ref', slots[0]], statements: [...condition.statements, ['slot', slots[0], undefined, false], ['if', condition.value, then.value, otherwise.value]], next: otherwise.next })))
            })
        }
        case '?:': { return prepareValue(['if', value[1], { statements: [], exit: ['yield', [value[2]]] }, { statements: [], exit: ['yield', [value[3]]] }], context) }
        default: {
            const input = operatorOperands(value)
            if ((value[0] === '?.' || value[0] === '?.()' || (value[0] === '.' && value.length === 4))
                && input.slice(1).some(child => nonlocalValue(child, context))) {
                throw ['unsupported FAST preparation', 'a nonlocal transfer in a chain operand']
            }
            return bind(values(input, context), prepared => done({ value: mapOperator((_, index) => prepared.value[index])(value), statements: prepared.statements, next: prepared.next }))
        }
    }
})

/**
 * Establish every transfer value before writing the first destination slot.
 * The temporaries also retain failures and allocations of values overwritten
 * by the same transition.
 * @type {(input: readonly NormalValue[], slots: readonly BindingId[], context: _Context) => _Task<_Statements>}
 */
const transfer = (input, slots, context) => call(() => bind(values(input, context), prepared => {
    const temporaries = fresh(prepared.next, prepared.value.length)
    return done({
        value: [
            ...prepared.statements,
            ...prepared.value.map((value, index) => /** @type {Statement} */ (['define', temporaries[index], value])),
            ...slots.map((slot, index) => /** @type {Statement} */ (['write', slot, ['ref', temporaries[index]]])),
        ],
        next: prepared.next + temporaries.length,
    })
}))

/** @type {(exit: NormalExit, context: _Context) => _Task<_Prepared<{ readonly statements: readonly Statement[], readonly exit: Exit }>>} */
const exitValue = (exit, context) => call(/** @returns {_Task<_Prepared<{ readonly statements: readonly Statement[], readonly exit: Exit }>>} */ () => {
    if (exit[0] === 'yield') {
        if (context.yields !== null) {
            return bind(transfer(exit[1], context.yields, context), result => done({ value: { statements: result.value, exit: ['yield', []] }, next: result.next }))
        }
        return bind(values(exit[1], context), result => done({ value: { statements: result.statements, exit: ['yield', result.value] }, next: result.next }))
    }
    if (exit[0] === 'continue' || exit[0] === 'break') {
        const loop = assertNotNullish(context.loops.find(loop => loop.target === exit[1]), ['FAST transfer outside its loop', exit[1]])
        return bind(transfer(exit[2], exit[0] === 'continue' ? loop.parameters : loop.results, context), result => done({ value: { statements: result.value, exit: [exit[0], exit[1]] }, next: result.next }))
    }
    return bind(prepareValue(exit[0] === 'return' ? exit[2] : exit[1], context), result =>
        done({ value: { statements: result.statements, exit: exit[0] === 'return' ? ['return', exit[1], result.value] : ['throw', result.value] }, next: result.next }))
})

/** @type {(statement: NormalStatement, context: _Context) => _Task<_Statements>} */
const statementValue = (statement, context) => call(() => {
    if (statement[0] === 'define') {
        if (statement[3] === 'lazy' && nonlocalValue(statement[2], context)) { throw ['unsupported FAST preparation', 'a nonlocal transfer in a lazy definition'] }
        return bind(prepareValue(statement[2], context), result => {
            if (statement[3] === 'required') { return done({ value: [...result.statements, ['define', statement[1], result.value]], next: result.next }) }
            const [valueSlot, doneSlot] = fresh(result.next, 2)
            return done({
                value: [['memo', { binding: statement[1], valueSlot, doneSlot, initializer: withSlots({ statements: result.statements, exit: ['yield', [result.value]] }) }]],
                next: result.next + 2,
            })
        })
    }
    if (statement[0] === 'loop') {
        const loop = statement[1]
        const scalar = scalarLoopOf(loop)
        if (scalar !== null && !nonlocalValue(scalar.condition, context) && !nonlocalValue(scalar.next, context)
            && scalar.step.statements.every(statement => !nonlocalValue(statement[2], context))) {
            return bind(prepareValue(loop.initial[0], context), initial => {
                const [slot, conditionParameter] = fresh(initial.next, 2)
                return bind(prepareValue(scalar.condition, {
                    ...context,
                    next: initial.next + 2,
                    reads: [...context.reads, [loop.parameters[0], conditionParameter]],
                }), condition => {
                    const mutable = !(scalar.next instanceof Array && scalar.next[0] === 'ref' && scalar.next[1] === loop.parameters[0])
                    return bind(prepareBlock({ statements: scalar.step.statements, exit: ['yield', mutable ? [scalar.next] : []] }, {
                        ...context,
                        next: condition.next,
                        yields: mutable ? [slot] : null,
                    }), body => done({
                        value: [...initial.statements, ['while', {
                            target: loop.target,
                            slot,
                            initial: initial.value,
                            condition: ['block', { statements: [['define', conditionParameter, ['ref', slot]], ...condition.statements], exit: ['yield', [condition.value]] }],
                            body: { statements: [['define', loop.parameters[0], ['ref', slot]], ...body.value.statements], exit: body.value.exit },
                            result: loop.results[0],
                            mutable,
                        }]],
                        next: body.next,
                    }))
                })
            })
        }
        return bind(values(loop.initial, context), initial => {
            const temporaries = fresh(initial.next, initial.value.length)
            const parameters = fresh(initial.next + temporaries.length, loop.parameters.length)
            const results = fresh(initial.next + temporaries.length + parameters.length, loop.results.length)
            return bind(prepareBlock(loop.body, {
                ...context,
                next: initial.next + temporaries.length + parameters.length + results.length,
                loops: [...context.loops, { target: loop.target, parameters, results }],
                yields: null,
            }), body => done({
                value: [
                    ...initial.statements,
                    ...initial.value.map((value, index) => /** @type {Statement} */ (['define', temporaries[index], value])),
                    ...parameters.map((id, index) => /** @type {Statement} */ (['slot', id, ['ref', temporaries[index]], false])),
                    ...results.map(id => /** @type {Statement} */ (['slot', id, undefined, false])),
                    ['loop', loop.target, {
                        statements: [...loop.parameters.map((id, index) => /** @type {Statement} */ (['define', id, ['ref', parameters[index]]])), ...body.value.statements],
                        exit: body.value.exit,
                    }],
                    ...loop.results.map((id, index) => /** @type {Statement} */ (['define', id, ['ref', results[index]]])),
                ],
                next: body.next,
            }))
        })
    }
    const slots = fresh(context.next, statement[1].length)
    const inner = { ...context, next: context.next + slots.length, yields: slots }
    /** @type {_Task<_Statements>} */
    const prepared = statement[0] === 'block'
        ? bind(prepareBlock(statement[2], inner), result => done({ value: [['block', result.value]], next: result.next }))
        : bind(prepareValue(statement[2], inner), condition =>
            bind(prepareBlock(statement[3], { ...inner, next: condition.next }), then =>
                bind(prepareBlock(statement[4], { ...inner, next: then.next }), otherwise =>
                    done({ value: [...condition.statements, ['if', condition.value, then.value, otherwise.value]], next: otherwise.next }))))
    return bind(prepared, prepared => done({
        value: [
            ...slots.map(id => /** @type {Statement} */ (['slot', id, undefined, false])),
            ...prepared.value,
            ...statement[1].map((id, index) => /** @type {Statement} */ (['define', id, ['ref', slots[index]]])),
        ],
        next: prepared.next,
    }))
})

/** @type {(block: NormalBlock, context: _Context) => _Task<_Block>} */
const prepareBlock = (block, context) => {
    /** @type {(index: number, current: _Context, previous: import('../../../types/list/types.ts').List<Statement>) => _Task<_Block>} */
    const each = (index, current, previous) => call(() => {
        if (index === block.statements.length) {
            return bind(exitValue(block.exit, current), result => done({
                value: withSlots({ statements: [...toArray(previous), ...result.value.statements], exit: result.value.exit }),
                next: result.next,
            }))
        }
        const statement = block.statements[index]
        return bind(statementValue(statement, current), result => each(index + 1, {
            ...current,
            next: result.next,
            memos: statement[0] === 'define' && statement[3] === 'lazy' ? [...current.memos, statement[1]] : current.memos,
        }, { head: previous, tail: result.value }))
    })
    return each(0, context, null)
}

/** Prepare one normalized region, retaining its ordinary result signature. @type {(block: NormalBlock) => Block} */
export const prepare = block => {
    const summary = flows(['block', block])
    return run(prepareBlock(block, { flows: summary, next: assertNotNullish(summary.get(block)).next, memos: [], loops: [], yields: null, reads: [] })).value
}

/**
 * Prepare one standalone function with normally completing captures. A
 * construction whose capture evaluation can transfer to an enclosing scope
 * is prepared as a value in that containing region via {@link prepare}.
 * @type {(value: NormalFunction) => PreparedFunction}
 */
export const prepareFunction = value => {
    const summary = flows(['function', value])
    return run(functionValue(value, { flows: summary, next: assertNotNullish(summary.get(value)).next, memos: [], loops: [], yields: null, reads: [] })).value
}
