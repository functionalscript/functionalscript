/**
 * EDAG to normalized Foundation AST. Identity analysis runs once at admission;
 * this conversion owns value placement and reconstruction of structured loops.
 * A serializer receives prepared instructions, never a graph to analyze.
 *
 * @module
 * @import { Analysis, Node, Operand, Step as GraphStep } from '../analysis/types.ts'
 * @import { Exp } from '../types.ts'
 * @import { Context, Done, Work, _FunctionBody } from './private.ts'
 * @import { Invocation } from './types.ts'
 * @import { List, Result as ListResult } from '../../types/list/types.ts'
 * @import { PersistentSet } from '../../types/set/types.ts'
 * @import { BindingId, Block, Function as FastFunction, FunctionTarget, Key, LoopTarget, Operator, Statement, Step, Value } from '../../js/ast/types.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { checked, identityAnalysis, itemOperand, mergeable, ownOperandsOf, scopeHolds, stepOperands } from '../analysis/module.f.mjs'
import { keepsRecursion, loopOf } from '../loop/module.f.mjs'
import { isSpread, mapOperator, operatorOperands } from '../../js/ast/module.f.mjs'
import { mapOk, okThen } from '../../types/result/module.f.js'
import { next } from '../../types/list/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.mjs'
import { add, empty, has } from '../../types/set/module.f.mjs'
import { at, setReplace } from '../../types/ordered_map/module.f.mjs'
import { freeBindings } from '../../js/ast/control/module.f.mjs'
import { demandsInOrder } from '../demand/module.f.mjs'
import { _tailCalls } from './tail/module.f.mjs'
import { _joinResults } from './join/module.f.mjs'

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
        case 'memberPresent': { return ['memberPresent', node[1], graphKey(a, node[2])] }
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
        if (context.regions.includes(i)) {
            return region(context, bound, [value], block => deliver(done, block.statements.length === 0 && block.exit[0] === 'yield'
                ? block.exit[1][0] : ['block', block]))
        }
        const node = a.nodes[i]
        switch (node[0]) {
            case 'undefined': { return deliver(done, undefined) }
            case 'arg': { return deliver(done, ['ref', context.parameters[node[1]]]) }
            case 'rest': { return deliver(done, ['ref', context.rest]) }
            case 'args': { return deliver(done, ['ref', invocation.args ?? rootContext.rest]) }
            case 'self': { return deliver(done, ['ref', context.self]) }
            case 'frame': { return deliver(done, ['ref', context.captures[node[1]]]) }
            case '=>': {
                const captures = node[2].flatMap(value => value instanceof Array && !bound.includes(value[1]) && !isRead(a.nodes[value[1]]) ? [value[1]] : [])
                return gather(captures, (capture, _, next) => valueOf(context, bound, ['#', capture], value => deliver(next, /** @type {Statement} */ (['define', ids[capture], value, 'required']))), statements =>
                    functionOf(context, [...bound, ...captures], i, fn => deliver(done, statements.length === 0 ? ['function', fn]
                        : ['block', { statements, exit: ['yield', [['function', fn]]] }])))
            }
            case ',': { return region(context, bound, node[1], block => deliver(done, ['block', block])) }
            case 'throw': { return valueOf(context, bound, node[1], value => deliver(done, ['block', { statements: [], exit: ['throw', value] }])) }
            case '?:': {
                return valueOf(context, bound, node[1], condition => region(context, bound, [node[2]], then => region(context, bound, [node[3]], otherwise => deliver(done, ['if', condition, then, otherwise]))))
            }
            default: {
                const operator = graphOperator(a, node)
                const operands = operatorOperands(operator)
                const eagerCount = eagerOperands(node).length - (node[0] === '.' && !(node[2] instanceof Array) ? 1 : 0)
                /** @type {(available: readonly number[], statements: readonly Statement[]) => Work} */
                const construct = (available, statements) => gather(operands, (operand, position, next) => position >= eagerCount
                    ? region(context, available, [operand], block => deliver(next, /** @type {Value} */ (['block', block])))
                    : valueOf(context, available, operand, next), values => {
                    const value = mapOperator((_, index) => values[index])(operator)
                    return deliver(done, statements.length === 0 ? value : ['block', { statements, exit: ['yield', [value]] }])
                })
                const callee = node[0] === '()' || node[0] === '?.()' ? node[1] : null
                return callee instanceof Array && !bound.includes(callee[1]) && !isRead(a.nodes[callee[1]])
                    ? valueOf(context, bound, callee, value => construct([...bound, callee[1]], [['define', ids[callee[1]], value, 'required']]))
                    : construct(bound, [])
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
        const repeatedHere = all.filter(i => has(i)(repeated) && !isRead(a.nodes[i]))
        // A value used only within one operand belongs to that operand's
        // region, after the preceding operands and their implicit work.
        const operands = node === null ? [] : node[0] === '=>' ? node[2] : operatorOperands(graphOperator(a, node))
        const uses = repeatedHere.map(i => operands.filter(operand => reachable(a, ownOperandsOf, bound)([operand]).includes(i)))
        const local = uses.flatMap(values => values.length === 1 && values[0] instanceof Array ? [values[0][1]] : [])
        const sharedHere = repeatedHere.filter((_, index) => uses[index].length !== 1)
        const localContext = { ...context, regions: [...context.regions.filter(i => !roots.some(root => root instanceof Array && root[1] === i)), ...local] }
        const crosses = sharedHere.filter(i => !eager.includes(i) && children.filter(child => child.includes(i)).length !== 1)
        const splits = crosses.filter(i => reachable(a, ownOperandsOf, [...bound, ...eager])([['#', i]]).every(j => mergeable(a.nodes[j]) && a.nodes[j][0] !== ','))
        const shared = sharedHere.filter(i => !splits.includes(i))
        const cross = crosses.filter(i => !splits.includes(i))
        const promoted = reachable(a, ownOperandsOf, bound)(cross.map(i => /** @type {const} */ (['#', i])))
        // Region roots and established owners can name their callees and
        // captures immediately. A name needed only inside a later operand
        // stays in that operand's value block.
        const recursive = eager.filter(i => a.nodes[i][0] === '=>' && assertNotNullish(at(String(i))(context.functions)).named)
        const owners = [...shared.filter(i => eager.includes(i)), ...recursive]
        const prefix = reachable(a, node => node[0] === '=>' ? node[2]
            : node[0] === '()' || node[0] === '?.()' ? [node[1]] : [], bound)([...roots, ...owners.map(i => /** @type {const} */ (['#', i]))])
        const named = eager.flatMap(i => a.nodes[i][0] === '=>'
            ? /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])[2]
                .flatMap(value => value instanceof Array && !isRead(a.nodes[value[1]]) ? [value[1]] : [])
            : (a.nodes[i][0] === '()' || a.nodes[i][0] === '?.()') && a.nodes[i][1] instanceof Array && !isRead(a.nodes[a.nodes[i][1][1]])
                ? [a.nodes[i][1][1]] : [])
        const movable = (/** @type {number} */ i, /** @type {readonly number[]} */ established = owners) => {
            const node = a.nodes[i]
            const stable = (/** @type {Operand} */ value) => !(value instanceof Array) || bound.includes(value[1]) || established.includes(value[1]) || isRead(a.nodes[value[1]])
            if (node[0] === '[]') { return node[1].every(item => !isSpread(item) && stable(item)) }
            if (node[0] === '{}') { return node[1].every(entry => entry[0] === ':' && !(entry[1] instanceof Array) && stable(entry[2])) }
            return node.length === 1 || node[0] === '=>' && node[2].every(value => !(value instanceof Array) || bound.includes(value[1]) || established.includes(value[1]) || isRead(a.nodes[value[1]]))
        }
        const candidates = [...new Set([...owners, ...named.filter(i => prefix.includes(i) || movable(i))])].filter(i => !bound.includes(i)).toSorted((x, y) => x - y)
        let owned = [...new Set([...candidates, ...shared.filter(i => promoted.includes(i))])].toSorted((x, y) => x - y)
        /** @type {readonly number[]} */
        let required = []
        /** @type {readonly number[]} */
        let reached = []
        /** @type {readonly { binding: BindingId, value: Operand, own: number | null }[]} */
        let ordered = []
        for (const [position, root] of roots.entries()) {
            const exp = root instanceof Array ? a.exps[root[1]] : root
            const eagerHere = reachable(a, eagerOperands, bound)([root])
            const allHere = reachable(a, ownOperandsOf, bound)([root])
            let earlier = [...bound, ...required].map(i => a.exps[i])
            for (const i of candidates) {
                if (required.includes(i) || reached.includes(i) || !allHere.includes(i)) { continue }
                const stable = movable(i, required)
                if (!stable && !eagerHere.includes(i)) { continue }
                if (!stable && !demandsInOrder(exp, [a.exps[i]], earlier)) {
                    // Establish complete earlier computations before this owner.
                    // Implicit lookup, key conversion and spread barriers have
                    // no separate graph node and retain first-demand storage.
                    // Earlier initializers may already have demanded these
                    // dependencies. A new snapshot must not rebind them to a
                    // declaration that follows their first demand.
                    const prior = reachable(a, ownOperandsOf, bound)(ordered.map(plan => plan.value))
                    for (const j of eagerHere.filter(j => j < i && !owned.includes(j) && !bound.includes(j) && !prior.includes(j) && !isRead(a.nodes[j])).toSorted((x, y) => x - y)) {
                        if (!demandsInOrder(exp, [a.exps[j]], earlier)) { continue }
                        owned = [...owned, j]
                        required = [...required, j]
                        ordered = [...ordered, { binding: ids[j], value: ['#', j], own: j }]
                        earlier = [...earlier, a.exps[j]]
                        if (demandsInOrder(exp, [a.exps[i]], earlier)) { break }
                    }
                    if (!demandsInOrder(exp, [a.exps[i]], earlier)) { continue }
                }
                required = [...required, i]
                ordered = [...ordered, { binding: ids[i], value: ['#', i], own: i }]
                earlier = [...earlier, a.exps[i]]
            }
            if (position < roots.length - 1 && !(root instanceof Array && required.includes(root[1]))) {
                ordered = [...ordered, { binding: { index: count + contexts.length * width + position }, value: root, own: null }]
            }
            reached = [...reached, ...allHere]
        }
        const lazy = owned.filter(i => !required.includes(i))
        const available = [...bound, ...owned]
        // Declarations precede their first use and follow their dependencies.
        // Initializers stay deferred; required work follows the actual roots.
        /** @type {readonly { binding: BindingId, value: Operand, own: number | null, mode: 'lazy' | 'required' }[]} */
        let plans = []
        let placed = bound
        for (const plan of [...ordered, { binding: null, value: roots[roots.length - 1], own: null }]) {
            const needed = reachable(a, ownOperandsOf, placed)([plan.value]).filter(i => lazy.includes(i)).toSorted((x, y) => x - y)
            plans = [...plans, ...needed.map(i => ({ binding: ids[i], value: /** @type {Operand} */ (['#', i]), own: i, mode: /** @type {const} */ ('lazy') })),
                ...plan.binding === null ? [] : [{ ...plan, binding: plan.binding, mode: /** @type {const} */ ('required') }]]
            placed = [...placed, ...needed, ...plan.own === null ? [] : [plan.own]]
        }
        return gather(plans, (plan, _, next) => valueOf(localContext, [...bound, ...owned.filter(i => i !== plan.own)], plan.value, value => deliver(next, /** @type {Statement} */ (['define', plan.binding, value, plan.mode]))), statements => roots.length === 0
            ? deliver(done, { statements, exit: ['yield', [undefined]] })
            : valueOf(localContext, available, roots[roots.length - 1], value => deliver(done, { statements, exit: ['yield', [value]] })))
    }

    /** Placement and terminal eligibility are shared by naming and emission. @type {(i: number, functions: Context['functions'], done: Done<_FunctionBody>) => Work} */
    const functionBody = (i, functions, done) => () => {
        const node = /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])
        const context = /** @type {Context} */ ({ ...contexts[i], functions, regions: [] })
        const parts = loopOf(a, i)
        const loop = parts !== null && !keepsRecursion(a, i, parts) ? parts : null
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
                    parameters: context.parameters, rest: null, self: null, named: false,
                    body: { statements: [['loop', { target, parameters: [context.loop], initial: [['ref', context.parameters[0]]], results: [context.result], body }]], exit: ['return', context.target, ['ref', context.result]] },
                })
            }))
        }
        return region(context, [], [node[3]], raw => {
            const body = terminal(raw)
            const rest = scopeHolds(a, i, 'rest') ? context.rest : null
            const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: i })
            const rawTail = _tailCalls(body, context.parameters, context.self, target, rest)
            const tail = rawTail === null ? null : _joinResults(rawTail)
            if (tail !== null) {
                // Entry parameters and current iteration values have different
                // identities, even where their presentation indices agree.
                const parameters = context.parameters.map(binding => ({ ...binding }))
                const entryRest = rest === null ? null : { ...rest }
                const iteration = /** @type {readonly BindingId[]} */ ([...context.parameters, ...(rest === null ? [] : [rest])])
                const inputs = /** @type {readonly BindingId[]} */ ([...parameters, ...(entryRest === null ? [] : [entryRest])])
                return deliver(done, {
                    parameters, rest: entryRest, named: true,
                    self: freeBindings(tail, iteration).includes(context.self) ? context.self : null,
                    body: {
                        statements: [['loop', { target, parameters: iteration, initial: inputs.map(binding => /** @type {const} */ (['ref', binding])), results: [context.result], body: tail }]],
                        exit: ['return', context.target, ['ref', context.result]],
                    },
                })
            }
            const exit = /** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (body.exit)
            return deliver(done, {
                parameters: context.parameters, rest, named: scopeHolds(a, i, 'self'),
                self: scopeHolds(a, i, 'self') ? context.self : null,
                body: body.exit[0] === 'throw' ? body : { statements: body.statements, exit: ['return', context.target, exit[1][0]] },
            })
        })
    }
    /** @type {(outer: Context, bound: readonly number[], i: number, done: Done<FastFunction>) => Work} */
    const functionOf = (outer, bound, i, done) => () => {
        const node = /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])
        const context = contexts[i]
        const body = assertNotNullish(at(String(i))(outer.functions))
        return gather(node[2], (value, k, next) => valueOf(outer, bound, value, value => deliver(next, { binding: context.captures[k], value })), captures =>
            deliver(done, { parameters: body.parameters, rest: body.rest, self: body.self, body: body.body, target: context.target, captures }))
    }
    /** Graph entries are in operand postorder, including nested function bodies. @type {(index: number, functions: Context['functions']) => Work} */
    const prepareFunctions = (index, functions) => () => {
        if (index === count) {
            return region({ ...rootContext, functions, regions: [] }, external.map(([index]) => index), [a.root], block => {
                result = terminal(block)
                return null
            })
        }
        return a.nodes[index][0] === '=>'
            ? functionBody(index, functions, body => prepareFunctions(index + 1, setReplace(String(index))(body)(functions)))
            : prepareFunctions(index + 1, functions)
    }
    /** @type {Block | null} */
    let result = null
    /** @type {Work | null} */
    let work = prepareFunctions(0, null)
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
