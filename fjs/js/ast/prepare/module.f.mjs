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
 * result blocks. Eligible single-result statement joins use a private
 * parameterized continuation; expression conditionals retain their value shape.
 * Owning returns in member and optional-chain operands use the same logical
 * return normalizer as graph construction. Physical lowering preserves its
 * receiver snapshots and selected regions. Other outward chain transfers
 * retain an explicit refusal.
 *
 * @module
 * @import { BindingId, Block as NormalBlock, Exit as NormalExit, Function as NormalFunction, LoopTarget, Operator, Statement as NormalStatement, Value as NormalValue } from '../types.ts'
 * @import { Block, Exit, Function as PreparedFunction, Statement, Value } from './types.ts'
 * @import { _Block, _Completion, _Context, _Facts, _Flow, _Flows, _Link, _Node, _Prepared, _Snapshot, _Statement, _Statements, _Task, _Value, _Values, _Visit } from './private.ts'
 */

import { isSpread, mapOperator, operatorOperands } from '../module.f.mjs'
import { scalarLoopOf } from '../loop/module.f.js'
import { branchingPlainLoopOf, plainLoopOf } from '../loop/plain/module.f.mjs'
import { _expandObjectSpread, _expandSpread, liftValueReturns } from '../returns/module.f.mjs'
import { bind, call, done, run } from '../task/module.f.js'
import { assert, assertNotNullish } from '../../../asserts/module.f.js'
import { iterable } from '../../../types/list/iterable/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.js'
import { _freshSelf, normalizeLazyReturns } from '../memo/module.f.mjs'
import { _immutableJoin } from './joins/module.f.mjs'
import { _recoverOnePassJoin } from './one_pass/module.f.mjs'

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
                default: { throw ['not a statement', statement] }
            }
        }
        // `'exit'`, the one tag left: every `_Node` is built in this function
        default: {
            const exit = node[1]
            if (exit[0] === 'loop') { return { ...empty, children: [['loop', exit[1]]] } }
            return exit[0] === 'yield' ? { ...empty, children: exit[1].map(value => ['value', value]) }
                : exit[0] === 'break' || exit[0] === 'continue' ? { ...empty, loops: [exit[1]], children: exit[2].map(value => ['value', value]) }
                    : { ...empty, returns: exit[0] === 'return', children: [['value', exit[0] === 'return' ? exit[2] : exit[1]]] }
        }
    }
}

/** Only reached sequential children contribute an outward break. @type {(children: readonly _Completion[]) => _Completion} */
const sequential = children => {
    let normal = true
    /** @type {readonly LoopTarget[]} */
    let breaks = []
    for (const child of children) {
        if (!normal) { break }
        breaks = [...new Set([...breaks, ...child.breaks])]
        normal = child.normal
    }
    return { normal, breaks }
}

/**
 * Structural completion is independent of outward-transfer refusal facts.
 * Ordinary operations remain conservative about whether they can complete;
 * explicit regions, branches and loops retain their reached transfer owners.
 * @type {(node: _Node, children: readonly _Flow[]) => _Completion}
 */
const completion = (node, children) => {
    if (node[0] === 'function') { return { normal: true, breaks: children.slice(0, -1).flatMap(child => child.breaks) } }
    if (node[0] === 'loop') {
        const initial = sequential(children.slice(0, -1))
        const body = children[children.length - 1]
        return {
            normal: body.breaks.includes(node[1].target),
            breaks: [...new Set([...initial.breaks, ...body.breaks.filter(target => target !== node[1].target)])],
        }
    }
    if (node[0] === 'value' || node[0] === 'statement' && node[1][0] === 'define') {
        return { normal: true, breaks: node[0] === 'statement' && node[1][3] === 'lazy' ? [] : [...new Set(children.flatMap(child => child.breaks))] }
    }
    if (node[0] === 'statement' && node[1][0] === 'if') {
        const [condition, then, otherwise] = children
        return {
            normal: then.normal || otherwise.normal,
            breaks: [...new Set([...condition.breaks, ...then.breaks, ...otherwise.breaks])],
        }
    }
    const reached = sequential(children)
    if (node[0] !== 'exit' || node[1][0] === 'yield') { return reached }
    return {
        normal: false,
        breaks: node[1][0] === 'break' ? [...new Set([...reached.breaks, node[1][1]])] : reached.breaks,
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
        /** @type {_Link<_Flow> | null} */
        let children = null
        for (let index = 0; index < own.children.length; index += 1) {
            const child = assertNotNullish(results)
            results = child.tail
            children = { first: child.first, tail: children }
            next = Math.max(next, child.first.next)
            // The last child is the function body or loop body. Only that
            // region owns the boundary; capture and initial expressions do not.
            if (node[0] !== 'function' || index !== 0) {
                returns ||= child.first.returns
                loops = [...new Set([...loops, ...node[0] === 'loop' && index === 0 ? child.first.loops.filter(target => target !== node[1].target) : child.first.loops])]
            }
        }
        const flow = /** @type {_Flow} */ ({ next, returns, loops, ...completion(node, toArray(children)) })
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
        /** @type {Block} */
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
        if (current.exit[0] === 'loop') { work = { first: current.exit[2], tail: work } }
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

/** A snapshot completes its key coercion or spread copy before later statements. @type {(value: Value, kind: _Snapshot | undefined) => Value} */
const snapshot = (value, kind) => kind === 'array' ? _expandSpread(value)
    : kind === 'object' ? _expandObjectSpread(value) : kind === 'key' ? ['String', value] : value

/** A prepared reference reads an established value; memo reads remain demands. @type {(value: Value) => boolean} */
const established = value => !(value instanceof Array) || value[0] === 'ref'

/** @param {Value} value @returns {value is readonly ['ref' | 'demand', BindingId]} */
const preparedRead = value => value instanceof Array && (value[0] === 'ref' || value[0] === 'demand')

/** Total construction can precede earlier operands without running their work. @type {(value: Value) => boolean} */
const totalConstructor = value => {
    if (!(value instanceof Array) || value[0] === 'ref') { return true }
    if (value[0] === 'array') { return value[1].every(item => !isSpread(item) && established(item)) }
    if (value[0] === 'object') { return value[1].every(entry => entry[0] === ':' && typeof entry[1] === 'string' && established(entry[2])) }
    return value[0] === 'function' && value[1].captures.every(capture => established(capture.value))
}

/**
 * Expose only leading total constructor recipes in reached eager operands.
 * Retained definitions form a lexical barrier; demands and effects stay put.
 * Bare calls retain their detached value semantics; explicit member-call
 * chains keep their receiver, with later chain operands left in their region.
 * @type {(value: Value) => _Task<{ readonly value: Value, readonly statements: readonly Statement[] }>}
 */
const constructorTask = value => call(() => {
    if (!(value instanceof Array) || preparedRead(value)) {
        return done({ value, statements: [] })
    }
    if (value[0] === 'function' || value[0] === 'if' || value[0] === '?:' || value[0] === '?.()') {
        return done({ value, statements: [] })
    }
    if (value[0] === 'block') {
        const block = value[1]
        if (block.exit[0] !== 'yield' || block.exit[1].length !== 1) { return done({ value, statements: [] }) }
        const barrier = block.statements.findIndex(statement => statement[0] !== 'define' || !totalConstructor(statement[2]))
        const count = barrier === -1 ? block.statements.length : barrier
        const remaining = block.statements.slice(count)
        const prefix = block.statements.slice(0, count)
        if (remaining.length === 0) {
            return bind(constructorTask(block.exit[1][0]), result => done({ value: result.value, statements: [...prefix, ...result.statements] }))
        }
        const first = remaining[0]
        if (first[0] !== 'define') { return done({ value: count === 0 ? value : ['block', { ...block, statements: remaining }], statements: prefix }) }
        // The first retained initializer is reached before this block's work.
        // Its total recipes may cross the boundary; the initializer stays put.
        return bind(constructorTask(first[2]), result => done({
            value: count === 0 && result.value === first[2] ? value : ['block', { ...block, statements: [
                ['define', first[1], result.value], ...remaining.slice(1),
            ] }],
            statements: [...prefix, ...result.statements],
        }))
    }
    const input = operatorOperands(value)
    /** @type {(index: number, values: readonly Value[], statements: readonly Statement[]) => _Task<{ readonly value: Value, readonly statements: readonly Statement[] }>} */
    const each = (index, values, statements) => call(() => index === input.length
        ? done({ value: values.every((item, index) => item === input[index]) ? value : mapOperator((_, index) => values[index])(value), statements })
        : bind(value[0] === '?.' && index !== 0 || value[0] === '.' && value.length === 4 && index >= 1 + (value[2] instanceof Array ? 1 : 0)
            ? done({ value: input[index], statements: [] }) : constructorTask(input[index]), result =>
            each(index + 1, [...values, result.value], [...statements, ...result.statements])))
    return each(0, [], [])
})

/** Source-packed steps expose total recipes before projection placement can drift. @type {(statements: readonly Statement[]) => _Task<readonly Statement[]>} */
const packedStatements = statements => {
    /** @type {(index: number, output: readonly Statement[]) => _Task<readonly Statement[]>} */
    const each = (index, output) => call(() => {
        if (index === statements.length) { return done(output) }
        const statement = statements[index]
        return statement[0] === 'define'
            ? bind(constructorTask(statement[2]), value => each(index + 1, [...output, ...value.statements,
                value.value === statement[2] ? statement : ['define', statement[1], value.value]]))
            : each(index + 1, [...output, statement])
    })
    return each(0, [])
}

/** @type {(input: readonly NormalValue[], context: _Context, snapshots?: readonly _Snapshot[]) => _Task<_Values & { readonly statements: readonly Statement[] }>} */
const values = (input, context, snapshots = []) => {
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
            statements: prepared.flatMap((result, index) => [...result.statements, ...index < lastPrelude ? [/** @type {Statement} */ (['define', temporaries[index], snapshot(result.value, snapshots[index])])] : []]),
            next: next + temporaries.length,
        })
    })
    return each(0, context.next, null)
}

/** @type {(input: NormalFunction, context: _Context) => _Task<_Prepared<PreparedFunction> & { readonly statements: readonly Statement[] }>} */
const functionValue = (input, context) => call(() => {
    const fresh = _freshSelf(input)
    /** @type {NormalFunction} */
    const logical = { ...fresh, body: normalizeLazyReturns(fresh.body, fresh.target, fresh.self) }
    const joined = _immutableJoin(logical)
    const value = context.sourceLoops ? joined : _recoverOnePassJoin(joined)
    const normalized = value.body
    const root = normalized.statements.at(-1)
    const sourceBranchTarget = context.sourceLoops && value.parameters.length === 0 && value.rest !== null
        && root !== undefined && root[0] === 'loop' ? root[1].target : null
    const summary = normalized === input.body ? context.flows : new Map([...context.flows, ...flows(['block', normalized], context.flows)])
    /** @type {_Context} */
    const local = { ...context, flows: summary, next: Math.max(context.next, assertNotNullish(summary.get(normalized)).next) }
    return bind(values(value.captures.map(capture => capture.value), local), prepared => {
    const captures = value.captures.map((capture, index) => ({ binding: capture.binding, value: prepared.value[index] }))
    return bind(prepareBlock(normalized, { ...local, sourceBranchTarget, owner: value.target, next: prepared.next, memos: [], loops: [], yields: null, reads: [] }), body => {
        // Source functions require a terminal return even after a loop that
        // cannot complete. Retaining its result keeps invocation roots exact.
        const last = body.value.statements.at(-1)
        const result = /** @type {Value} */ (last !== undefined && last[0] === 'while' ? ['ref', last[1].result] : undefined)
        const completed = context.sourceLoops && !assertNotNullish(summary.get(normalized)).normal
            && body.value.exit[0] === 'yield'
            ? { ...body.value, exit: /** @type {Exit} */ (['return', value.target, result]) } : body.value
        return done({ value: { ...value, captures, body: completed }, statements: prepared.statements, next: body.next })
    })
    })
})

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
            const memberCall = value[0] === '()' && value[1] instanceof Array && value[1][0] === '.' && value[1].length === 3
            // A direct property callee retains its receiver, just as graph
            // construction combines that shape into a member-call step.
            const operation = memberCall ? /** @type {Operator<NormalValue>} */ (['.', value[1][1], value[1][2], ['|()', value[2]]]) : value
            const input = operatorOperands(operation)
            /** @type {readonly _Snapshot[]} */
            const snapshots = operation[0] === 'object'
                ? operation[1].flatMap(/** @returns {readonly _Snapshot[]} */ entry => entry[0] === '...' ? ['object'] : ['key', null])
                : operation[0] === 'array' ? operation[1].map(item => isSpread(item) ? 'array' : null)
                    : operation[0] === '()' ? [null, ...operation[2].map(/** @returns {_Snapshot} */ item => isSpread(item) ? 'array' : null)] : []
            if ((memberCall || value[0] === '?.' || value[0] === '?.()' || (value[0] === '.' && value.length === 4))
                && (memberCall ? input : input.slice(1)).some(child => nonlocalValue(child, context))) {
                if (context.owner !== null || memberCall) {
                    const [destination] = fresh(context.next, 1)
                    const lifted = liftValueReturns(operation, destination, context.owner, memberCall ? context.loops.map(loop => loop.target) : [])
                    if (lifted.statement !== null) {
                        const summary = new Map([...context.flows, ...flows(['statement', lifted.statement], context.flows)])
                        return bind(statementValue(lifted.statement, {
                            ...context, flows: summary, next: Math.max(context.next + 1, assertNotNullish(summary.get(lifted.statement)).next),
                        }), prepared => done({ value: ['ref', destination], statements: prepared.value, next: prepared.next }))
                    }
                }
                throw ['unsupported FAST preparation', 'a nonlocal transfer in a chain operand']
            }
            return bind(values(input, context, snapshots), prepared => done({ value: mapOperator((_, index) => prepared.value[index])(operation), statements: prepared.statements, next: prepared.next }))
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
            // An abrupt-only normalized region can retain an unreachable
            // empty yield. There are no normal values to distribute there.
            ...slots.slice(0, temporaries.length).map((slot, index) => /** @type {Statement} */ (['write', slot, ['ref', temporaries[index]]])),
        ],
        next: prepared.next + temporaries.length,
    })
}))

/** @type {(exit: NormalExit, context: _Context) => _Task<_Prepared<{ readonly statements: readonly Statement[], readonly exit: Exit }>>} */
const exitValue = (exit, context) => call(/** @returns {_Task<_Prepared<{ readonly statements: readonly Statement[], readonly exit: Exit }>>} */ () => {
    if (exit[0] === 'loop') {
        return bind(statementTask(['loop', exit[1]], context), result => {
            const terminal = assertNotNullish(result.value.at(-1))
            assert(terminal[0] === 'loop', 'a terminal loop has no result continuation')
            return done({ value: { statements: result.value.slice(0, -1), exit: terminal }, next: result.next })
        })
    }
    if (exit[0] === 'yield') {
        if (context.yields !== null) {
            return bind(transfer(exit[1], context.yields, context), result => done({ value: { statements: result.value, exit: ['yield', []] }, next: result.next }))
        }
        return bind(values(exit[1], context), result => done({ value: { statements: result.statements, exit: ['yield', result.value] }, next: result.next }))
    }
    if (exit[0] === 'continue' || exit[0] === 'break') {
        const loop = assertNotNullish(context.loops.find(loop => loop.target === exit[1]), ['FAST transfer outside its loop', exit[1]])
        const input = exit[0] === 'continue' && loop.packed ? /** @type {readonly NormalValue[]} */ ([['array', exit[2]]]) : exit[2]
        return bind(transfer(input, exit[0] === 'continue' ? loop.parameters : loop.results, context), result => done({ value: { statements: result.value, exit: [exit[0], exit[1]] }, next: result.next }))
    }
    return bind(prepareValue(exit[0] === 'return' ? exit[2] : exit[1], context), result =>
        done({ value: { statements: result.statements, exit: exit[0] === 'return' ? ['return', exit[1], result.value] : ['throw', result.value] }, next: result.next }))
})

/** @type {(statement: NormalStatement, context: _Context) => _Task<_Statements>} */
const statementTask = (statement, context) => call(() => {
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
        const plain = plainLoopOf(loop) ?? (context.sourceLoops
            && (loop.parameters.length !== 1 || loop.target === context.sourceBranchTarget) ? branchingPlainLoopOf(loop) : null)
        if (plain !== null && (loop.parameters.length <= 1 || context.sourceLoops)
            && !nonlocalValue(plain.iteration.condition, context) && !nonlocalValue(plain.iteration.next, context)
            && !nonlocalValue(plain.result, context) && plain.prefix.every(statement => !nonlocalValue(statement[2], context))
            && plain.iteration.step.statements.every(statement => !nonlocalValue(statement[2], context))) {
            const { iteration } = plain
            // Source packs several semantic inputs into one private slot;
            // empty input uses that scalar while's unchanged undefined slot.
            const hasState = loop.parameters.length !== 0
            const packed = loop.parameters.length > 1
            const width = Math.max(1, loop.parameters.length)
            /** @param {BindingId} binding @param {number} index */
            const snapshot = (binding, index) => packed
                ? /** @type {const} */ (['.', ['ref', binding], index])
                : /** @type {const} */ (['ref', binding])
            return bind(prepareValue(packed ? ['array', loop.initial] : loop.initial[0], context), initial => {
                const computed = packed || !hasState || !(plain.result instanceof Array && plain.result[0] === 'ref' && plain.result[1] === loop.parameters[0])
                const bindings = fresh(initial.next, computed ? 2 * width + 2 : 2)
                const slot = bindings[0]
                const conditionParameters = bindings.slice(1, width + 1)
                const finalState = bindings[width + 1]
                const finalParameters = bindings.slice(width + 2)
                const conditionBlock = /** @type {NormalValue} */ (['block', { statements: plain.prefix, exit: ['yield', [iteration.condition]] }])
                return bind(prepareValue(conditionBlock, {
                    ...context,
                    next: initial.next + bindings.length,
                    reads: [...context.reads, ...loop.parameters.map((parameter, index) => /** @type {const} */ ([parameter, conditionParameters[index]]))],
                }), condition => {
                    const mutable = hasState ? packed || !(iteration.next instanceof Array && iteration.next[0] === 'ref' && iteration.next[1] === loop.parameters[0]) : iteration.next !== undefined
                    const step = /** @type {NormalBlock} */ ({ statements: iteration.step.statements, exit: ['yield', mutable ? [iteration.next] : []] })
                    return bind(prepareBlock(step, {
                        ...context,
                        next: condition.next,
                        yields: mutable ? [slot] : null,
                    }), body => bind(packed ? packedStatements(body.value.statements) : done(body.value.statements), statements => {
                        const physical = /** @type {Statement} */ (['while', {
                            target: loop.target,
                            slot,
                            initial: initial.value,
                            condition: ['block', { statements: [...loop.parameters.map((_, index) => /** @type {Statement} */ (['define', conditionParameters[index], snapshot(slot, index)])), ...condition.statements], exit: ['yield', [condition.value]] }],
                            body: { statements: [...loop.parameters.map((parameter, index) => /** @type {Statement} */ (['define', parameter, snapshot(slot, index)])), ...statements], exit: body.value.exit },
                            result: computed ? finalState : loop.results[0],
                            mutable,
                        }])
                        if (!computed) { return done({ value: [...initial.statements, physical], next: body.next }) }
                        const normal = /** @type {NormalBlock} */ ({ statements: [], exit: ['yield', [plain.result]] })
                        const resultBlock = /** @type {NormalValue} */ (['block', {
                            statements: [...loop.parameters.map((_, index) => /** @type {NormalStatement} */ (['define', finalParameters[index], snapshot(finalState, index), 'required'])), ...plain.resultPrefix],
                            exit: normal.exit,
                        }])
                        // Expose a scalar source result's leading total recipes
                        // before reparsing introduces its ordinary loop helper.
                        // Calls and lookups retain their existing lexical barrier.
                        return bind(prepareValue(resultBlock, {
                            ...context,
                            next: body.next,
                            reads: [...context.reads, ...loop.parameters.map((parameter, index) => /** @type {const} */ ([parameter, finalParameters[index]]))],
                        }), result => bind(context.sourceLoops && loop.parameters.length === 1
                            && plain.result instanceof Array && plain.result[0] === 'block'
                            ? constructorTask(result.value) : done({ value: result.value, statements: [] }), exposed => done({
                            value: [...initial.statements, physical, ...result.statements, ...exposed.statements, ['define', loop.results[0], exposed.value]],
                            next: result.next,
                        })))
                    }))
                })
            })
        }
        // Structured one-result source loops use the existing private state
        // and result slot. This lowers transfers, without reusing source locals.
        const normal = assertNotNullish(context.flows.get(loop.body)).breaks.includes(loop.target)
        const packed = context.sourceLoops && loop.parameters.length > 1 && loop.results.length === 1
        const empty = context.sourceLoops && loop.parameters.length === 0 && loop.results.length === 1 && normal
        return bind(values(packed ? [['array', loop.initial]] : loop.initial, context), initial => {
            const temporaries = fresh(initial.next, initial.value.length)
            const parameters = fresh(initial.next + temporaries.length, packed || empty ? 1 : loop.parameters.length)
            // Source loop re-entry preserves one private state/result slot.
            // Empty semantic state uses it only for completion; continue has
            // no input destinations and a break writes immediately before exit.
            const shared = context.sourceLoops && parameters.length === 1 && loop.results.length === 1
            const resultCount = shared ? 0 : normal ? loop.results.length : 0
            const results = shared ? parameters : fresh(initial.next + temporaries.length + parameters.length, resultCount)
            return bind(prepareBlock(loop.body, {
                ...context,
                next: initial.next + temporaries.length + parameters.length + resultCount,
                loops: [...context.loops, { target: loop.target, parameters: empty ? [] : parameters, results, packed }],
                yields: null,
            }), body => {
                const block = /** @type {Block} */ ({
                    statements: [...loop.parameters.map((id, index) => /** @type {Statement} */ (['define', id, packed
                        ? ['.', ['ref', parameters[0]], index] : ['ref', parameters[index]]])), ...body.value.statements],
                    exit: body.value.exit,
                })
                const physical = /** @type {Statement} */ (shared ? ['while', {
                    target: loop.target, slot: parameters[0], initial: empty ? undefined : ['ref', temporaries[0]], condition: true,
                    body: block, result: loop.results[0], mutable: true,
                }] : ['loop', loop.target, block])
                return done({
                    value: [
                        ...initial.statements,
                        ...initial.value.map((value, index) => /** @type {Statement} */ (['define', temporaries[index], value])),
                        ...shared ? [] : parameters.map((id, index) => /** @type {Statement} */ (['slot', id, ['ref', temporaries[index]], false])),
                        ...shared ? [] : results.map(id => /** @type {Statement} */ (['slot', id, undefined, false])),
                        physical,
                        ...shared ? [] : loop.results.slice(0, results.length).map((id, index) => /** @type {Statement} */ (['define', id, ['ref', results[index]]])),
                    ],
                    next: body.next,
                })
            })
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

/** Result-bearing regions retain the destination layout used by expression lifting. @type {(statement: NormalStatement, context: _Context) => _Task<_Statement>} */
const statementValue = (statement, context) => bind(statementTask(statement, context), result => done({
    ...result, normal: statement[0] === 'define' || statement[0] !== 'loop' && statement[1].length !== 0
        || assertNotNullish(context.flows.get(statement)).normal,
}))

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
        return bind(statementValue(statement, current), result => result.normal ? each(index + 1, {
            ...current,
            next: result.next,
            memos: statement[0] === 'define' && statement[3] === 'lazy' ? [...current.memos, statement[1]] : current.memos,
        }, { head: previous, tail: result.value }) : done({
            value: withSlots({ statements: [...toArray(previous), ...result.value], exit: ['yield', []] }), next: result.next,
        }))
    })
    return each(0, context, null)
}

/**
 * Prepare one normalized region, retaining its ordinary result signature.
 * Source loop spelling shares single-input/result storage so parsing does not
 * introduce another state component. Other consumers keep independent slots.
 * @type {(block: NormalBlock, options?: { readonly sourceLoops?: boolean }) => Block}
 */
export const prepare = (block, { sourceLoops = false } = {}) => {
    const summary = flows(['block', block])
    return run(prepareBlock(block, { sourceLoops, sourceBranchTarget: null, flows: summary, owner: null, next: assertNotNullish(summary.get(block)).next, memos: [], loops: [], yields: null, reads: [] })).value
}

/**
 * Prepare one standalone function with normally completing captures. A
 * construction whose capture evaluation can transfer to an enclosing scope
 * is prepared as a value in that containing region via {@link prepare}.
 * @type {(value: NormalFunction) => PreparedFunction}
 */
export const prepareFunction = value => {
    const summary = flows(['function', value])
    return run(functionValue(value, { sourceLoops: false, sourceBranchTarget: null, flows: summary, owner: null, next: assertNotNullish(summary.get(value)).next, memos: [], loops: [], yields: null, reads: [] })).value
}
