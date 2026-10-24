/**
 * EDAG to normalized Foundation AST. Identity analysis runs once at admission;
 * this conversion owns value placement and reconstruction of structured loops.
 * A serializer receives prepared instructions, never a graph to analyze.
 *
 * @module
 * @import { Analysis, Node, Operand, Step as GraphStep } from '../analysis/types.ts'
 * @import { Exp } from '../types.ts'
 * @import { Context, Done, Work } from './private.ts'
 * @import { Invocation } from './types.ts'
 * @import { List, Result as ListResult } from '../../types/list/types.ts'
 * @import { PersistentSet } from '../../types/set/types.ts'
 * @import { BindingId, Block, Function as FastFunction, FunctionTarget, Key, LoopTarget, Operator, Statement, Step, Value } from '../../js/ast/types.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { checked, identityAnalysis, itemOperand, mergeable, ownOperandsOf, scopeHolds, stepOperands } from '../analysis/module.f.mjs'
import { keepsRecursion, loopOf } from '../loop/module.f.mjs'
import { mapOperator, operatorOperands } from '../../js/ast/module.f.mjs'
import { mapOk, okThen } from '../../types/result/module.f.js'
import { next, toArray } from '../../types/list/module.f.mjs'
import { add, empty, has } from '../../types/set/module.f.mjs'

/** Conditionally evaluated operands, including optional-chain regions. @type {(node: Node) => readonly Operand[]} */
const lazyOperands = node => {
    switch (node[0]) {
        case '?:': { return [node[2], node[3]] }
        case '.': { return node.length === 4 && node[3][0] === '|?.()' ? stepOperands(node[3]) : [] }
        case '?.': { return [node[2], ...stepOperands(node[3])] }
        case '?.()': { return [...node[2].map(itemOperand), ...stepOperands(node[3])] }
        default: { return [] }
    }
}

/** @type {(node: Node) => readonly Operand[]} */
const eagerOperands = node => {
    switch (node[0]) {
        case '?:': case '?.': case '?.()': { return [node[1]] }
        case '.': { return [node[1], node[2], ...node.length === 4 && node[3][0] === '|()' ? node[3][1].map(itemOperand) : []] }
        default: { return ownOperandsOf(node) }
    }
}

/** Stable, invocation-local reachability; a binding stops traversal. @type {(a: Analysis, children: (node: Node) => readonly Operand[], bound: readonly number[]) => (roots: readonly Operand[]) => readonly number[]} */
const reachable = (a, children, bound) => roots => {
    const stops = new Set(bound)
    /** @type {PersistentSet<number>} */
    let seen = empty
    /** @type {List<number>} */
    let order = null
    /** @type {List<Operand>} */
    let pending = roots
    while (true) {
        /** @type {ListResult<Operand>} */
        const item = next(pending)
        if (item === null) { return toArray(order).toReversed() }
        const value = item.first
        pending = item.tail
        if (!(value instanceof Array) || stops.has(value[1]) || has(value[1])(seen)) { continue }
        seen = add(value[1])(seen)
        order = { first: value[1], tail: order }
        pending = { head: children(a.nodes[value[1]]), tail: pending }
    }
}

/** Reads already have a stable invocation value. @type {(node: Node) => boolean} */
const isRead = node => ['arg', 'rest', 'frame', 'self', 'undefined'].includes(node[0])

/** A graph key's conversion is metadata, not a second Number operation. @type {(a: Analysis, key: Operand) => Key<Operand>} */
const graphKey = (a, key) => key instanceof Array
    ? ['Number', /** @type {Extract<Node, readonly ['Number', Operand]>} */ (a.nodes[key[1]])[1]]
    : /** @type {string | number} */ (key)

/** @type {(a: Analysis, step: GraphStep) => Step<Operand>} */
const graphStep = (a, step) => {
    /** @type {readonly Extract<GraphStep, readonly [unknown, unknown, unknown]>[]} */
    let before = []
    let current = step
    while (current.length === 3) {
        before = [current, ...before]
        current = current[2]
    }
    /** @type {Step<Operand>} */
    let result = current[0] === '|.' ? ['|.', graphKey(a, current[1])] : current
    for (const previous of before) {
        result = previous[0] === '|.' ? ['|.', graphKey(a, previous[1]), result]
            : [previous[0], previous[1], result]
    }
    return result
}

/** Preserve ordinary operation spelling while changing operand vocabulary. @type {(a: Analysis, node: Node) => Operator<Operand>} */
const graphOperator = (a, node) => {
    switch (node[0]) {
        case '[]': { return ['array', node[1]] }
        case '{}': { return ['object', node[1]] }
        case '.': case '?.': {
            const key = graphKey(a, node[2])
            return node.length === 3 ? [node[0], node[1], key] : [node[0], node[1], key, graphStep(a, node[3])]
        }
        case '?.()': { return node.length === 3 ? node : ['?.()', node[1], node[2], graphStep(a, node[3])] }
        default: { return /** @type {Operator<Operand>} */ (node) }
    }
}


/** A final result block has no invocation boundary to retain. @type {(block: Block) => Block} */
const terminal = block => {
    let current = block
    while (current.exit[0] === 'yield' && current.exit[1].length === 1) {
        const value = current.exit[1][0]
        if (!(value instanceof Array) || value[0] !== 'block') { return current }
        current = { statements: [...current.statements, ...value[1].statements], exit: value[1].exit }
    }
    return current
}

/** Deliver a result through the worklist, never through the host call stack. @type {<T>(done: Done<T>, value: T) => Work} */
const deliver = (done, value) => () => done(value)

/** @type {<T, U>(items: readonly T[], visit: (item: T, index: number, done: Done<U>) => Work, done: Done<readonly U[]>, index?: number, values?: readonly U[]) => Work} */
const gather = (items, visit, done, index = 0, values = []) => () => index === items.length
    ? done(values)
    : visit(items[index], index, value => gather(items, visit, done, index + 1, [...values, value]))

/**
 * Convert a trusted identity table. Binding indices are presentation only;
 * every reference reuses its binding object. Required definitions remain in
 * their execution region. A value shared between lazy regions has one lazy
 * definition in their common region, including its shared dependencies.
 *
 * @type {(a: Analysis, external?: readonly (readonly [number, BindingId])[], invocation?: Invocation) => Block}
 */
export const fromAnalysis = (a, external = [], invocation = {}) => {
    const count = a.nodes.length
    const ids = a.nodes.map((_, index) => external.find(([node]) => node === index)?.[1] ?? ({ index }))
    const width = count + 32
    const contexts = a.nodes.map((node, index) => {
        const base = count + index * width
        return {
            target: /** @type {FunctionTarget} */ ({ kind: 'function', index }),
            parameters: Array.from({ length: node[0] === '=>' ? node[1] : 0 }, (_, k) => ({ index: base + k })),
            rest: { index: base + 16 },
            self: { index: base + 17 },
            captures: Array.from({ length: node[0] === '=>' ? node[2].length : 0 }, (_, k) => ({ index: base + 32 + k })),
            loop: { index: base + 18 },
            result: { index: base + 19 },
        }
    })
    const rootContext = { target: /** @type {FunctionTarget} */ ({ kind: 'function', index: -1 }), parameters: invocation.parameters ?? Array.from({ length: Math.max(0, ...a.nodes.map(node => node[0] === 'arg' ? node[1] + 1 : 0)) }, (_, index) => ({ index: -32 - index })), rest: invocation.rest ?? { index: -1 }, self: invocation.self ?? { index: -2 }, captures: invocation.captures ?? Array.from({ length: Math.max(0, ...a.nodes.map(node => node[0] === 'frame' ? node[1] + 1 : 0)) }, (_, index) => ({ index: -64 - index })), loop: { index: -3 }, result: { index: -4 } }
    /** @type {(context: Context, bound: readonly number[], value: Operand, done: Done<Value>) => Work} */
    const valueOf = (context, bound, value, done) => () => {
        if (!(value instanceof Array)) { return deliver(done, value) }
        const i = value[1]
        if (bound.includes(i)) { return deliver(done, ['ref', ids[i]]) }
        const node = a.nodes[i]
        switch (node[0]) {
            case 'undefined': { return deliver(done, undefined) }
            case 'arg': { return deliver(done, ['ref', context.parameters[node[1]]]) }
            case 'rest': { return deliver(done, ['ref', context.rest]) }
            case 'args': { return deliver(done, ['ref', invocation.args ?? rootContext.rest]) }
            case 'self': { return deliver(done, ['ref', context.self]) }
            case 'frame': { return deliver(done, ['ref', context.captures[node[1]]]) }
            case '=>': { return functionOf(context, bound, i, fn => deliver(done, ['function', fn])) }
            case ',': { return region(context, bound, node[1], block => deliver(done, ['block', block])) }
            case 'throw': { return valueOf(context, bound, node[1], value => deliver(done, ['block', { statements: [], exit: ['throw', value] }])) }
            case '?:': {
                return valueOf(context, bound, node[1], condition => region(context, bound, [node[2]], then => region(context, bound, [node[3]], otherwise => deliver(done, ['if', condition, then, otherwise]))))
            }
            default: {
                const operator = graphOperator(a, node)
                const operands = operatorOperands(operator)
                const eagerCount = eagerOperands(node).length - (node[0] === '.' && !(node[2] instanceof Array) ? 1 : 0)
                return gather(operands, (operand, position, next) => position >= eagerCount
                    ? region(context, bound, [operand], block => deliver(next, /** @type {Value} */ (['block', block])))
                    : valueOf(context, bound, operand, next), values => deliver(done, mapOperator((_, index) => values[index])(operator)))
            }
        }
    }

    /** @type {(context: Context, bound: readonly number[], roots: readonly Operand[], done: Done<Block>) => Work} */
    const region = (context, bound, roots, done) => () => {
        const only = roots.length === 1 ? roots[0] : undefined
        const node = only instanceof Array && !bound.includes(only[1]) ? a.nodes[only[1]] : null
        if (node !== null && node[0] === ',') { return region(context, bound, node[1], done) }
        const all = reachable(a, ownOperandsOf, bound)(roots)
        const eager = reachable(a, eagerOperands, bound)(roots)
        const lazyRoots = eager.flatMap(i => lazyOperands(a.nodes[i]))
        const children = lazyRoots.map(root => reachable(a, ownOperandsOf, bound)([root]))
        const places = [...roots, ...all.flatMap(i => ownOperandsOf(a.nodes[i]))].flatMap(value => value instanceof Array ? [value[1]] : [])
        /** @type {PersistentSet<number>} */
        let once = empty
        /** @type {PersistentSet<number>} */
        let repeated = empty
        for (const place of places) {
            if (has(place)(once)) { repeated = add(place)(repeated) }
            else { once = add(place)(once) }
        }
        const sharedHere = all.filter(i => has(i)(repeated) && !isRead(a.nodes[i]))
        const crosses = sharedHere.filter(i => !eager.includes(i) && children.filter(child => child.includes(i)).length !== 1)
        const splits = crosses.filter(i => reachable(a, ownOperandsOf, [...bound, ...eager])([['#', i]]).every(j => mergeable(a.nodes[j]) && a.nodes[j][0] !== ','))
        const shared = sharedHere.filter(i => !splits.includes(i))
        const cross = crosses.filter(i => !splits.includes(i))
        const promoted = reachable(a, ownOperandsOf, bound)(cross.map(i => /** @type {const} */ (['#', i])))
        // Captured values and recursive functions require names even where
        // unshared. This preserves explicit value captures and source arity.
        const captured = eager.flatMap(i => a.nodes[i][0] === '=>'
            ? /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])[2]
                .flatMap(value => value instanceof Array && !isRead(a.nodes[value[1]]) ? [value[1]] : [])
            : [])
        const recursive = eager.filter(i => a.nodes[i][0] === '=>' && scopeHolds(a, i, 'self') && (loopOf(a, i) === null || keepsRecursion(a, i, /** @type {import('../loop/types.ts').Loop} */ (loopOf(a, i)))))
        const called = eager.flatMap(i => {
            const node = a.nodes[i]
            if (node[0] !== '()' && node[0] !== '?.()') { return [] }
            const callee = node[1]
            return callee instanceof Array && !isRead(a.nodes[callee[1]]) ? [callee[1]] : []
        })
        // A callee or capture can already be established in an enclosing scope.
        const required = [...new Set([...shared.filter(i => eager.includes(i)), ...captured, ...recursive, ...called])].filter(i => !bound.includes(i))
        const lazy = shared.filter(i => promoted.includes(i) && !required.includes(i))
        const owned = [...required, ...lazy].toSorted((x, y) => x - y)
        const available = [...bound, ...owned]
        const definitions = owned.map(i => ({ order: i, binding: ids[i], value: /** @type {Operand} */ (['#', i]), bound: [...bound, ...owned.filter(j => j !== i)], mode: /** @type {'lazy' | 'required'} */ (lazy.includes(i) ? 'lazy' : 'required') }))
        const anchors = roots.slice(0, -1).flatMap((root, k) => {
            // A local required definition already establishes this anchor.
            // An enclosing lazy definition must still be demanded here.
            if (root instanceof Array && required.includes(root[1])) { return [] }
            return [{ order: root instanceof Array ? root[1] : -1, binding: { index: count + contexts.length * width + k }, value: root, bound: available, mode: /** @type {const} */ ('required') }]
        })
        // Canonical tables are in operand postorder. Interleave explicit comma
        // anchors with required owners, rather than moving all owners ahead of
        // an earlier anchor. Reordering failures needs no additional barriers.
        const plans = [...definitions, ...anchors].toSorted((x, y) => x.order - y.order)
        return gather(plans, (plan, _, next) => valueOf(context, plan.bound, plan.value, value => deliver(next, /** @type {Statement} */ (['define', plan.binding, value, plan.mode]))), statements => roots.length === 0
            ? deliver(done, { statements, exit: ['yield', [undefined]] })
            : valueOf(context, available, roots[roots.length - 1], value => deliver(done, { statements, exit: ['yield', [value]] })))
    }

    /** @type {(outer: Context, bound: readonly number[], i: number, done: Done<FastFunction>) => Work} */
    const functionOf = (outer, bound, i, done) => () => {
        const node = /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])
        const context = contexts[i]
        const parts = loopOf(a, i)
        const loop = parts !== null && !keepsRecursion(a, i, parts) ? parts : null
        return gather(node[2], (value, k, next) => valueOf(outer, bound, value, value => deliver(next, { binding: context.captures[k], value })), captures => {
            if (loop !== null) {
                const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: i })
                const iteration = { ...context, parameters: [context.loop] }
                return region(iteration, [], [loop.condition], condition => region(iteration, [], [...loop.asserts, loop.next], arm => {
                    /** @type {Block} */
                    const body = {
                        statements: [['if', [], ['block', condition], { statements: arm.statements, exit: ['continue', target, /** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (arm.exit)[1]] }, { statements: [], exit: ['break', target, [['ref', context.loop]]] }]],
                        exit: ['continue', target, [['ref', context.loop]]],
                    }
                    return deliver(done, {
                        target: context.target, parameters: context.parameters, rest: null, self: null, captures,
                        body: { statements: [['loop', { target, parameters: [context.loop], initial: [['ref', context.parameters[0]]], results: [context.result], body }]], exit: ['return', context.target, ['ref', context.result]] },
                    })
                }))
            }
            return region(context, [], [node[3]], raw => {
                const body = terminal(raw)
                const exit = /** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (body.exit)
                return deliver(done, {
                    target: context.target, parameters: context.parameters,
                    rest: scopeHolds(a, i, 'rest') ? context.rest : null,
                    self: scopeHolds(a, i, 'self') ? context.self : null,
                    captures, body: body.exit[0] === 'throw' ? body : { statements: body.statements, exit: ['return', context.target, exit[1][0]] },
                })
            })
        })
    }
    /** @type {Block | null} */
    let result = null
    /** @type {Work | null} */
    let work = region(rootContext, external.map(([index]) => index), [a.root], block => {
        result = terminal(block)
        return null
    })
    while (work !== null) { work = work() }
    return assertNotNullish(/** @type {Block | null} */ (result), 'missing FAST conversion result')
}

/** Validate separately supplied graph data once, then construct normalized FAST. @type {(root: Exp) => import('../../types/result/types.ts').Result<Block, string>} */
export const toFast = root => mapOk(fromAnalysis)(okThen(checked)(identityAnalysis(root)))

/**
 * Select an already admitted function for code-only text. Its captures are
 * external values to that text, so no surrounding invocation is evaluated.
 *
 * @type {(a: Analysis, index: number) => FastFunction}
 */
export const functionFromAnalysis = (a, index) => {
    const block = fromAnalysis({ ...a, root: ['#', index] })
    const found = block.statements.find(statement => statement[0] === 'define' && statement[2] instanceof Array && statement[2][0] === 'function' && statement[2][1].target.index === index)
    return found !== undefined
        ? /** @type {readonly ['function', FastFunction]} */ (/** @type {Extract<Statement, readonly ['define', unknown, unknown, unknown]>} */ (found)[2])[1]
        : /** @type {readonly ['function', FastFunction]} */ (/** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (block.exit)[1][0])[1]
}
