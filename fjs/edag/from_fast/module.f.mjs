/**
 * Construct an EDAG from immutable FAST values and explicit evaluations.
 * This pass knows no source declarations or mutable names. Value blocks do
 * not create functions; only ordinary functions establish invocation scopes.
 * Immutable summary and continuation worklists keep syntax depth off the host
 * stack, including the value blocks introduced by source logical lowering.
 *
 * @module
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { BindingId, Block, Definition, Exit, Function as FastFunction, Loop, Operator, Statement, Step, Value } from '../../js/ast/types.ts'
 * @import { Environment, Lowered, Transfer } from './types.ts'
 * @import { Binding, Context, ExitOwner, Link, Node, Ordered, OrderScope, Scope, Summaries, Summary, Visit, _Control } from './private.ts'
 * @import { Task } from '../../js/ast/task/types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { iterable } from '../../types/list/iterable/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.mjs'
import { isSpread, mapOperator, operatorOperands } from '../../js/ast/module.f.mjs'
import { scalarLoopOf } from '../../js/ast/loop/module.f.js'
import { invariantState } from '../../js/ast/loop/invariant/module.f.mjs'
import { exitValues, freeLoopBindings } from '../../js/ast/control/module.f.mjs'
import { aggregateHelper, rootLoopOf, scalarHelper } from './loop/module.f.mjs'
import { directInvocationRoot, invocationRootOf } from './loop/root/module.f.mjs'
import { completeBlockTransfers, completeTransfers } from './loop/completions/module.f.mjs'
import { normalizeMemo } from '../../js/ast/memo/module.f.mjs'
import { liftReturns, _forwardReturns } from '../../js/ast/returns/module.f.mjs'
import { bind, call, done, run } from '../../js/ast/task/module.f.js'
import { step } from '../../common/monoid/module.f.mjs'
import { maxLength } from '../../types/function/length/module.f.mjs'
import { demandsInOrder, requiredPrefixLength } from '../demand/module.f.mjs'

/** @type {<T>(items: readonly T[], tail: Link<T> | null) => Link<T> | null} */
const prepend = (items, tail) => items.reduceRight((tail, first) => ({ first, tail }), tail)

/** @type {(exp: Exp) => Lowered} */
const plain = exp => ({ exp, anchors: [] })

/** Retain the required prefix before the result's naturally demanded suffix. @type {(value: Lowered, established?: readonly Exp[], selected?: readonly (readonly [Exp, boolean])[]) => Exp} */
export const anchored = (value, established = [], selected = []) => {
    /** @type {readonly Exp[]} */
    let anchors = []
    for (const exp of value.anchors) {
        if (exp instanceof Array && exp[0] === 'undefined') { continue }
        // A following required root can own the preceding suffix before the
        // final result proves whether that root itself needs an anchor.
        while (anchors.length !== 0 && demandsInOrder(exp, [anchors[anchors.length - 1]], [...established, ...anchors.slice(0, -1)], selected)) {
            anchors = anchors.slice(0, -1)
        }
        anchors = [...anchors, exp]
    }
    const count = requiredPrefixLength(value.exp, anchors, established, selected)
    return count === 0 ? value.exp : [',', [...anchors.slice(0, count), value.exp]]
}

/** @type {(values: readonly Lowered[]) => readonly Exp[]} */
const floated = values => values.flatMap(value => value.anchors)

/** Keep child requirements local unless the actual parent proves safe floating.
 * @type {(values: readonly Lowered[], construct: (values: readonly Exp[]) => Exp) => { readonly values: readonly Exp[]; readonly anchors: readonly Exp[] }}
 */
const orderedOperands = (values, construct) => {
    const anchors = floated(values)
    const local = values.map(value => anchored(value))
    return demandsInOrder(construct(local), anchors)
        ? { values: values.map(value => value.exp), anchors }
        : { values: local, anchors: [] }
}

/** @type {(scope: Scope, binding: BindingId) => Binding | undefined} */
const bindingOf = (scope, binding) => {
    let index = scope.index
    while (index !== null) {
        const found = index.value.get(binding)
        if (found !== undefined) { return found }
        index = index.rest
    }
    return undefined
}

/** @type {(earlier: ReadonlyMap<BindingId, Binding>) => (later: ReadonlyMap<BindingId, Binding>) => ReadonlyMap<BindingId, Binding>} */
const mergeIndex = earlier => later => new Map([...earlier, ...later])

/** Immutable map runs avoid whole-scope copies; lookup examines logarithmically many runs. @type {(run: ReadonlyMap<BindingId, Binding>) => (index: Scope['index']) => Scope['index']} */
const appendIndex = step(mergeIndex)

/** @type {Scope} */
const emptyScope = { index: null, entries: null, lazy: null }

/** A new chunk overrides older chunks; its first duplicate remains its value. @type {(environment: Environment, parent?: Scope) => Scope} */
const scopeOf = (environment, parent = emptyScope) => {
    /** @type {readonly BindingId[]} */
    const lazy = environment.flatMap(([id, , mode]) => mode === 'lazy' ? [id] : [])
    return {
        index: appendIndex(new Map(environment.toReversed().map(entry => /** @type {const} */ ([entry[0], entry]))))(parent.index),
        entries: { head: parent.entries, tail: environment },
        lazy: lazy.length === 0 ? parent.lazy : { head: parent.lazy, tail: lazy },
    }
}

/** @type {(scope: Scope, binding: BindingId) => Exp} */
const lookup = (scope, binding) => assertNotNullish(bindingOf(scope, binding), 'unbound FAST value')[1]

/** @type {(scope: Scope) => Environment} */
const environmentOf = scope => toArray(scope.entries)

/** @type {(scope: Scope, binding: BindingId) => boolean} */
const lazyBinding = (scope, binding) => bindingOf(scope, binding)?.[2] === 'lazy'

/** Deferred values whose initializer recipes belong to an enclosing owner. @type {(scope: Scope) => readonly BindingId[]} */
const lazyBindings = scope => [...new Set(toArray(scope.lazy).filter(id => lazyBinding(scope, id)))]

/** @type {(m: ExpOp, n: ExpOp) => boolean} */
const sameCapture = (m, n) => m === n || (['arg', 'rest', 'frame', 'self'].includes(m[0]) && m.length === n.length && m.every((x, i) => x === n[i]))

/** Positions whose anchors remain in their conditional region. @type {(operator: Operator<Value>, index: number) => boolean} */
const isLazyOperand = (operator, index) => {
    if (operator[0] === '?:' || operator[0] === '?.' || operator[0] === '?.()') { return index !== 0 }
    if (operator[0] === '.') { return index >= (operator[2] instanceof Array ? 2 : 1) }
    return false
}

/** @type {(node: Node) => readonly Node[]} */
const children = node => {
    if (node[0] === 'block') {
        return [
            ...node[1].statements.flatMap(statement => statement[0] === 'define' ? [/** @type {Node} */ (['value', statement[2]])]
                : statement[0] === 'block' ? [/** @type {Node} */ (['block', statement[2]])]
                    : statement[0] === 'if' ? [/** @type {Node} */ (['value', statement[2]]), /** @type {Node} */ (['block', statement[3]]), /** @type {Node} */ (['block', statement[4]])]
                        : [...statement[1].initial.map(value => /** @type {Node} */ (['value', value])), /** @type {Node} */ (['block', statement[1].body])]),
            ...exitValues(node[1].exit).map(value => /** @type {Node} */ (['value', value])),
        ]
    }
    const value = node[1]
    if (!(value instanceof Array) || value[0] === 'ref') { return [] }
    if (value[0] === 'function') { return [...value[1].captures.map(capture => /** @type {Node} */ (['value', capture.value])), ['block', value[1].body]] }
    if (value[0] === 'block') { return [['block', value[1]]] }
    if (value[0] === 'if') { return [['value', value[1]], ['block', value[2]], ['block', value[3]]] }
    return operatorOperands(value).map(value => ['value', value])
}

/** @type {(relations: readonly (readonly [BindingId, readonly BindingId[]])[], roots: readonly BindingId[]) => readonly BindingId[]} */
const closure = (relations, roots) => {
    const dependencies = new Map(relations)
    let pending = prepend(roots, null)
    /** @type {readonly BindingId[]} */
    let found = []
    while (pending !== null) {
        const { first: id, tail } = pending
        pending = tail
        if (found.includes(id)) { continue }
        found = [...found, id]
        pending = prepend(dependencies.get(id) ?? [], pending)
    }
    return found
}

/** Reads of preceding operands stay before the selected execution barrier. @type {(parts: readonly Summary[], divergent?: boolean) => readonly BindingId[]} */
const prefixReads = (parts, divergent = false) => {
    /** @type {readonly BindingId[]} */
    let prefix = []
    for (const part of parts) {
        prefix = [...prefix, ...(divergent ? part.demand : part.prefix)]
        if (part.diverges || !divergent && part.fails) { break }
    }
    return prefix
}

/** Calls, coercions, and computed keys may invoke user functions. @type {(value: Operator<Value>) => boolean} */
const invokes = value => {
    if (value[0] === '()' || value[0] === '?.()') { return true }
    if ((value[0] === '.' || value[0] === '?.' || value[0] === 'memberPresent') && value[2] instanceof Array) { return true }
    if (value[0] === 'object' && value[1].some(entry => entry[0] === ':' && typeof entry[1] !== 'string')) { return true }
    if (value.length > 1 && !['array', 'object', '.', '?.', 'memberPresent', '?:', ',', '!', 'typeof', '===', '!==', 'instanceof', 'throw'].includes(value[0])
        && operatorOperands(value).some(operand => operand instanceof Array)) { return true }
    /** @type {Step<Value> | undefined} */
    let next = (value[0] === '.' || value[0] === '?.') && value.length === 4 ? /** @type {import('../../js/ast/types.ts')._ContinuedAccess<Value>} */ (value)[3] : undefined
    while (next !== undefined) {
        if (next[0] !== '|.' || next[1] instanceof Array) { return true }
        next = next[2]
    }
    return false
}

/** Expansion and key conversion execute before the following operand. @type {(value: Operator<Value>, divergent?: boolean) => number} */
const prefixEnd = (value, divergent = false) => {
    if (value[0] === 'array' || value[0] === '()') {
        const offset = value[0] === 'array' ? 0 : 1
        const items = value[0] === 'array' ? value[1] : value[2]
        const spread = items.findIndex(isSpread)
        return divergent || spread < 0 ? Infinity : offset + spread + 1
    }
    if (value[0] === 'object') {
        let offset = 0
        for (const entry of value[1]) {
            if (entry[0] === '...') {
                if (!divergent) { return offset + 1 }
                offset += 1
            } else {
                if (typeof entry[1] !== 'string') { return offset + 1 }
                offset += 2
            }
        }
    }
    return Infinity
}

/** A deferred or substituted graph read can execute work before later reads. @type {(relations: readonly (readonly [BindingId, readonly BindingId[]])[], opaque: readonly BindingId[], roots: readonly BindingId[]) => { readonly references: readonly BindingId[]; readonly work: boolean }} */
const firstDemands = (relations, opaque, roots) => {
    const dependencies = new Map(relations)
    /** @type {Link<BindingId | null> | null} */
    let pending = prepend(roots, null)
    /** @type {readonly BindingId[]} */
    let references = []
    while (pending !== null) {
        const { first: id, tail } = pending
        pending = tail
        if (id === null) { return { references, work: true } }
        if (references.includes(id)) { continue }
        references = [...references, id]
        pending = prepend(dependencies.get(id) ?? [], opaque.includes(id) ? { first: null, tail: pending } : pending)
    }
    return { references, work: false }
}

/** Keep failures ordered around divergence and distinct explicit thrown values. @type {(scope: OrderScope, pending: readonly Ordered[], value: Pick<Summary, 'prefix' | 'demand' | 'fails' | 'diverges'>) => { readonly pending: readonly Ordered[]; readonly required: readonly BindingId[]; readonly fails: boolean; readonly diverges: boolean }} */
const orderedStep = (scope, pending, value) => {
    const first = firstDemands(scope.reads, scope.opaque, value.prefix)
    const beforeDivergence = firstDemands(scope.demands, scope.deferred, value.demand)
    let { fails, diverges } = value
    fails = fails || first.work
    diverges = diverges || beforeDivergence.work
    const consumed = pending.filter(owner => owner.bindings.some(binding => (owner.diverges ? first.references : beforeDivergence.references).includes(binding)))
    const forced = pending.filter(owner => !consumed.includes(owner) && (diverges || owner.diverges && fails))
    return {
        pending: pending.filter(owner => !consumed.includes(owner) && !forced.includes(owner)),
        required: forced.flatMap(owner => owner.bindings),
        fails: fails || consumed.length !== 0,
        diverges: diverges || consumed.some(owner => owner.diverges),
    }
}

/** @type {(node: Node, parts: readonly Summary[], external: readonly BindingId[]) => Summary} */
const summary = (node, parts, external) => {
    /** @type {Summary} */
    const empty = { references: [], required: [], reached: [], entry: [], returns: false, normal: true, prefix: [], demand: [], fails: false, diverges: false }
    if (node[0] === 'value') {
        const value = node[1]
        if (!(value instanceof Array)) { return empty }
        if (value[0] === 'ref') { return { ...empty, references: [value[1]], prefix: [value[1]], demand: [value[1]], fails: external.includes(value[1]), diverges: external.includes(value[1]) } }
        if (value[0] === 'function') {
            const captures = parts.slice(0, -1)
            return { ...empty, references: captures.flatMap(part => part.references), prefix: prefixReads(captures), demand: prefixReads(captures, true), fails: captures.some(part => part.fails), diverges: captures.some(part => part.diverges) }
        }
        if (value[0] === 'block') { return { ...empty, references: parts[0].references, prefix: parts[0].prefix, demand: parts[0].demand, fails: parts[0].fails, diverges: parts[0].diverges } }
        if (value[0] === 'if') { return { ...empty, references: parts[0].references, prefix: parts[0].prefix, demand: parts[0].demand, fails: parts.some(part => part.fails), diverges: parts.some(part => part.diverges) } }
        const eager = parts.filter((_, index) => !isLazyOperand(value, index))
        const end = prefixEnd(value)
        const demandEnd = prefixEnd(value, true)
        const numeric = ['+', '-', '*', '/', '%', '**', '~', '&', '|', '^', '<<', '>>', '>>>', '<', '<=', '>', '>=', 'Number', 'String'].includes(value[0]) && operatorOperands(value).every(operand => typeof operand === 'number')
        const total = value.length === 1 || numeric || ['!', 'typeof', '===', '!==', 'instanceof', ',', '?:'].includes(value[0])
            || value[0] === 'array' && value[1].every(item => !(item instanceof Array) || item[0] !== '...')
            || value[0] === 'object' && value[1].every(entry => entry[0] === ':' && typeof entry[1] === 'string')
        return { ...empty, references: eager.flatMap(part => part.references), prefix: prefixReads(parts.filter((_, index) => index < end && !isLazyOperand(value, index))), demand: prefixReads(parts.filter((_, index) => index < demandEnd && !isLazyOperand(value, index)), true), fails: !total || parts.some(part => part.fails), diverges: invokes(value) || parts.some(part => part.diverges) }
    }
    /** @type {readonly (readonly [BindingId, readonly BindingId[]])[]} */
    let relations = []
    /** @type {OrderScope} */
    let orderScope = { reads: [], opaque: external, demands: [], deferred: external }
    /** @type {readonly BindingId[]} */
    let required = []
    /** @type {readonly BindingId[]} */
    let entry = []
    let entering = true
    let position = 0
    let active = 0
    let returns = false
    let normal = true
    /** @type {readonly Ordered[]} */
    let pending = []
    /** @type {readonly BindingId[]} */
    let ordered = []
    /** @type {readonly Summary[]} */
    let executions = []
    for (const statement of node[1].statements) {
        if (!normal) { break }
        ++active
        const part = parts[position]
        if (statement[0] === 'define') {
            relations = [...relations, [statement[1], part.references]]
            orderScope = { ...orderScope, reads: [...orderScope.reads, [statement[1], part.prefix]], demands: [...orderScope.demands, [statement[1], part.demand]] }
            if (statement[3] === 'required') {
                required = [...required, ...part.references]
                if (entering) { entry = [...entry, ...part.references] }
                const order = orderedStep(orderScope, pending, part)
                pending = [...order.pending, ...(order.fails || order.diverges ? [{ bindings: [statement[1]], diverges: order.diverges }] : [])]
                ordered = [...ordered, ...order.required]
                executions = [...executions, { ...part, fails: order.fails, diverges: order.diverges }]
            } else if (part.fails || part.diverges) {
                orderScope = { ...orderScope, opaque: [...orderScope.opaque, statement[1]], deferred: [...orderScope.deferred, ...(part.diverges ? [statement[1]] : [])] }
            }
            ++position
        } else if (statement[0] === 'block') {
            const order = orderedStep(orderScope, pending, part)
            pending = order.pending
            ordered = [...ordered, ...order.required]
            executions = [...executions, { ...part, fails: order.fails, diverges: order.diverges }]
            required = [...required, ...part.references]
            if (entering) { entry = [...entry, ...part.entry.filter(binding => part.references.includes(binding))] }
            entering = false
            returns = returns || part.returns
            normal = part.normal
            ++position
        } else if (statement[0] === 'if') {
            const arms = parts.slice(position + 1, position + 3)
            const execution = /** @type {Summary} */ ({ ...part, fails: part.fails || arms.some(part => part.fails), diverges: part.diverges || arms.some(part => part.diverges) })
            const order = orderedStep(orderScope, pending, execution)
            pending = order.pending
            ordered = [...ordered, ...order.required]
            executions = [...executions, execution]
            required = [...required, ...part.references]
            if (entering) { entry = [...entry, ...part.references] }
            entering = false
            returns = returns || parts[position + 1].returns || parts[position + 2].returns
            normal = parts[position + 1].normal || parts[position + 2].normal
            position += 3
        } else {
            const length = statement[1].initial.length
            /** @type {readonly BindingId[]} */
            const references = [...parts.slice(position, position + length).flatMap(part => part.references), ...freeLoopBindings(statement[1])]
            /** @type {readonly BindingId[]} */
            const prefix = [...freeLoopBindings(statement[1]), ...prefixReads(parts.slice(position, position + length))]
            /** @type {readonly BindingId[]} */
            const demand = [...freeLoopBindings(statement[1]), ...prefixReads(parts.slice(position, position + length), true)]
            const execution = { ...empty, prefix, demand, fails: true, diverges: true }
            const order = orderedStep(orderScope, pending, execution)
            pending = [...order.pending, { bindings: statement[1].results, diverges: true }]
            ordered = [...ordered, ...order.required]
            executions = [...executions, execution]
            required = [...required, ...references]
            if (entering) { entry = [...entry, ...references] }
            position += length + 1
        }
    }
    const exits = parts.slice(parts.length - exitValues(node[1].exit).length)
    const terminal = orderedStep(orderScope, pending, { prefix: prefixReads(exits), demand: prefixReads(exits, true), fails: node[1].exit[0] === 'throw' || exits.some(part => part.fails), diverges: node[1].exit[0] === 'throw' || exits.some(part => part.diverges) })
    const reached = closure(relations, [...(normal ? exits.flatMap(part => part.references) : []), ...required])
    const unused = node[1].statements.slice(0, active).flatMap(statement => statement[0] === 'define' && statement[3] === 'required' && !reached.includes(statement[1]) ? [statement[1]] : [])
    const local = new Set(relations.map(([binding]) => binding))
    return {
        references: reached.filter(id => !local.has(id)),
        required: [...ordered, ...terminal.required, ...unused],
        reached,
        entry: closure(relations, [...entry, ...(entering ? exits.flatMap(part => part.references) : [])]),
        returns: returns || (normal && node[1].exit[0] === 'return'),
        normal: normal && node[1].exit[0] === 'yield',
        prefix: firstDemands(orderScope.reads, orderScope.opaque, prefixReads([...executions, ...exits])).references.filter(id => !local.has(id)),
        demand: firstDemands(orderScope.demands, orderScope.deferred, prefixReads([...executions, ...exits], true)).references.filter(id => !local.has(id)),
        fails: executions.some(part => part.fails) || terminal.fails,
        diverges: executions.some(part => part.diverges) || terminal.diverges,
    }
}

/**
 * Immutable postorder dependency facts. Result blocks resolve local definition
 * chains once; enclosing values read their external dependencies directly.
 * The walk includes skipped regions so later lowering has their own facts.
 * @type {(root: Node, known?: Summaries, external?: readonly BindingId[]) => Summaries}
 */
const summaries = (root, known = new Map(), external = []) => {
    /** @type {Link<Visit> | null} */
    let work = { first: ['enter', root], tail: null }
    /** @type {Link<Summary> | null} */
    let results = null
    /** @type {List<readonly [Node[1], Summary]>} */
    let entries = null
    while (work !== null) {
        const visit = work.first
        work = work.tail
        if (visit[0] === 'enter') {
            const prior = known.get(visit[1][1])
            if (prior !== undefined) { results = { first: prior, tail: results }; continue }
            const nested = children(visit[1])
            work = prepend(nested.map(node => /** @type {Visit} */ (['enter', node])), { first: ['finish', visit[1], nested], tail: work })
            continue
        }
        /** @type {List<Summary>} */
        let parts = null
        for (const _ of visit[2]) {
            const result = assertNotNullish(results)
            results = result.tail
            parts = { first: result.first, tail: parts }
        }
        const value = summary(visit[1], toArray(parts), external)
        results = { first: value, tail: results }
        entries = { first: [visit[1][1], value], tail: entries }
    }
    return new Map(iterable(entries))
}

/** @type {(block: Block, context: Context) => Summary} */
const blockSummary = (block, context) => context.summaries.get(block) ?? assertNotNullish(summaries(['block', block], context.summaries, context.external).get(block))

/** @type {(input: readonly Value[], context: Context) => Task<readonly Lowered[]>} */
const lowerValues = (input, context) => {
    /** @type {(index: number, values: List<Lowered>) => Task<readonly Lowered[]>} */
    const each = (index, values) => call(() => index === input.length ? done(toArray(values).toReversed())
        : bind(valueTask(input[index], context), value => each(index + 1, { first: value, tail: values })))
    return each(0, null)
}

/** @type {(fn: FastFunction, context: Context) => Task<Lowered>} */
const functionValue = (source, context) => call(() => {
    if (source.parameters.length > maxLength) { throw 'a function exceeds the fixed-parameter limit' }
    const lifted = _forwardReturns(liftReturns(source.body, source.target), source.target)
    const memoized = normalizeMemo(lifted, [], source.target)
    /** @type {FastFunction} */
    const prepared = memoized === source.body ? source : { ...source, body: memoized }
    const originalScalar = rootLoopOf(prepared)
    const originalRoot = originalScalar !== null && scalarLoopOf(originalScalar) !== null ? originalScalar : invocationRootOf(prepared)
    const normalized = completeTransfers(prepared, originalRoot)
    const scalar = rootLoopOf(normalized)
    const matched = scalar !== null && scalarLoopOf(scalar) !== null ? null : invocationRootOf(normalized)
    const fn = matched !== null ? directInvocationRoot(normalized, matched) : normalized
    return bind(lowerValues(fn.captures.map(capture => capture.value), { ...context, transfer: { kind: 'default' } }), captures => {
        const placed = orderedOperands(captures, values => ['[]', values])
        const candidates = placed.values.filter(exp => exp instanceof Array)
        const slots = candidates.filter((node, i) => candidates.findIndex(other => sameCapture(other, node)) === i)
        const reads = slots.map((_, i) => /** @type {Exp} */ (['frame', i]))
        /** @type {Environment} */
        const inner = [
            ...fn.parameters.map((id, i) => /** @type {const} */ ([id, ['arg', i]])),
            ...(fn.rest === null ? [] : [/** @type {const} */ ([fn.rest, ['rest']])]),
            ...(fn.self === null ? [] : [/** @type {const} */ ([fn.self, ['self']])]),
            ...fn.captures.map((capture, i) => /** @type {const} */ ([capture.binding,
                placed.values[i] instanceof Array ? reads[slots.findIndex(node => sameCapture(node, /** @type {ExpOp} */ (placed.values[i])))] : placed.values[i],
            ])),
        ]
        const known = context.external.length === 0 ? context.summaries : new Map()
        /** @type {Context} */
        const local = { ...context, external: [], summaries: fn === source && context.external.length === 0 ? known : new Map([...known, ...summaries(['block', fn.body], known)]), scope: scopeOf(inner), transfer: { kind: 'default' }, functionTarget: fn.target, memoPrepared: true }
        const root = rootLoopOf(fn)
        return bind(root === null ? blockTask(fn.body, local) : scalarRoot(fn, root, local), body =>
            done({ exp: ['=>', fn.parameters.length, slots, anchored(body)], anchors: placed.anchors }))
    })
})

/** The canonical scalar invocation loop reuses its owning function. @type {(fn: FastFunction, loop: Loop, context: Context) => Task<Lowered>} */
const scalarRoot = (fn, loop, context) => call(() => {
    const parts = assertNotNullish(scalarLoopOf(loop))
    /** @type {(index: number, scope: Scope) => Task<Lowered>} */
    const aliases = (index, scope) => call(() => {
        if (index < fn.body.statements.length - 1) {
            const alias = /** @type {Definition} */ (fn.body.statements[index])
            return bind(valueTask(alias[2], { ...context, scope }), value => aliases(index + 1, scopeOf([[alias[1], value.exp]], scope)))
        }
        return bind(valueTask(loop.initial[0], { ...context, scope }), parameter => {
            const inner = { ...context, scope: scopeOf([[loop.parameters[0], parameter.exp]], scope) }
            const self = fn.self === null ? /** @type {Exp} */ (['self']) : lookup(context.scope, fn.self)
            return bind(valueTask(parts.condition, inner), condition =>
                bind(blockTask(parts.step, { ...inner, transfer: { kind: 'scalar', self } }), step =>
                    done({ exp: ['?:', condition.exp, anchored(step), parameter.exp], anchors: [...parameter.anchors, ...condition.anchors] })))
        })
    })
    return aliases(0, context.scope)
})

/** Memo admission leaves only established values to capture. @type {(loop: Loop, context: Context) => Task<{ readonly value: Lowered; readonly bindings: Environment; readonly results: readonly BindingId[] }>} */
const loopTask = (loop, context) => call(() => {
    const state = invariantState(loop, [...lazyBindings(context.scope), ...context.external])
    return bind(lowerValues(state.aliases.map(alias => alias.value), context), aliases => {
        const local = /** @type {Context} */ ({ ...context, scope: scopeOf(state.aliases.map((alias, index) => [alias.parameter, aliases[index].exp]), context.scope) })
        const scalar = scalarLoopOf(state.loop) !== null
        const helper = scalar ? scalarHelper(state.loop) : aggregateHelper(state.loop)
        return bind(functionValue(helper, local), fn =>
            bind(valueTask(scalar ? state.loop.initial[0] : ['array', state.loop.initial], local), initial => {
                // An optimized-away source read can leave an invariant entry
                // outside the helper's captures. Its required demand remains.
                const demanded = state.aliases.flatMap((alias, index) => {
                    const value = aliases[index].exp
                    return !(value instanceof Array) || value === initial.exp || helper.captures.some(capture => capture.binding === alias.parameter) ? [] : [value]
                })
                const placed = orderedOperands([fn, initial], values => ['()', values[0], [values[1]]])
                /** @type {Lowered} */
                const value = { exp: ['()', placed.values[0], [placed.values[1]]], anchors: [...demanded, ...placed.anchors] }
                return done({ value, results: state.loop.results, bindings: [
                    ...state.loop.results.map((binding, i) => /** @type {Environment[number]} */ ([binding, scalar ? value.exp : ['.', value.exp, i]])),
                    ...state.aliases.map((alias, index) => /** @type {Environment[number]} */ ([alias.result, aliases[index].exp])),
                ] })
            }))
    })
})
/** @type {(source: Operator<Value>, values: readonly Lowered[]) => Lowered} */
const combined = (source, values) => {
    if (source[0] === ',') {
        const before = values.slice(0, -1).flatMap(value => value.exp instanceof Array ? [...value.anchors, value.exp] : value.anchors)
        const last = values[values.length - 1]
        return { exp: last.exp, anchors: [...before, ...last.anchors] }
    }
    /** @type {(values: readonly Exp[]) => Exp} */
    const construct = values => {
        const mapped = mapOperator((_, index) => values[index])(source)
        if (mapped[0] === 'array') { return ['[]', mapped[1]] }
        if (mapped[0] === 'object') { return ['{}', mapped[1]] }
        if (mapped[0] === '-' && mapped.length === 2 && (typeof mapped[1] === 'number' || typeof mapped[1] === 'bigint')) { return -mapped[1] }
        return /** @type {Exp} */ (mapped)
    }
    const placed = orderedOperands(values.map((value, index) => isLazyOperand(source, index) ? plain(anchored(value)) : value), construct)
    return { exp: construct(placed.values), anchors: placed.anchors }
}

/** @type {(root: Value, context: Context) => Task<Lowered>} */
const valueTask = (root, context) => call(() => {
    if (root === undefined) { return done(plain(['undefined'])) }
    if (root === null || typeof root !== 'object') { return done(plain(root)) }
    if (root[0] === 'ref') { return done(plain(lookup(context.scope, root[1]))) }
    if (root[0] === 'function') { return functionValue(root[1], context) }
    if (root[0] === 'block') { return regionTask(root[1], context, true) }
    if (root[0] === 'if') { return conditional(root[1], root[2], root[3], context, true) }
    // A direct member callee retains its receiver and lookup boundary.
    // Wrapped member values remain detached ordinary calls.
    if (root[0] === '()' && root[1] instanceof Array && root[1][0] === '.' && root[1].length === 3) {
        return valueTask(['.', root[1][1], root[1][2], ['|()', root[2]]], context)
    }
    return bind(lowerValues(operatorOperands(root), context), values => done(combined(root, values)))
})

/** @type {(condition: Value, then: Block, otherwise: Block, context: Context, normalize?: boolean) => Task<Lowered>} */
const conditional = (condition, then, otherwise, context, normalize = false) => call(() => bind(valueTask(condition, context), test =>
    bind(regionTask(then, context, normalize), a => bind(regionTask(otherwise, context, normalize), b =>
        done({ exp: ['?:', test.exp, anchored(a), anchored(b)], anchors: test.anchors })))))

/** Operand owners retain completion boundaries; eager memo planning runs once. @type {(block: Block, context: Context, normalize?: boolean) => Task<Lowered>} */
const regionTask = (block, context, normalize = false) => call(() => {
    if (block.exit[0] !== 'yield' && block.exit[0] !== 'throw') { throw 'nonlocal transfers in value regions require structured completion lowering' }
    const memoized = normalize && !context.memoPrepared ? normalizeMemo(block, lazyBindings(context.scope)) : block
    if (memoized !== block && context.transfer.kind !== 'default') { throw 'memo normalization requires the default transfer owner' }
    const normalized = normalize ? completeBlockTransfers(memoized) : block
    const local = normalize ? { ...context,
        functionTarget: null,
        memoPrepared: true,
        summaries: normalized === block ? context.summaries : new Map([...context.summaries, ...summaries(['block', normalized], context.summaries, context.external)]),
    } : context
    return blockTask(normalized, local)
})

/** One result stays scalar; other signatures use their declared order. @type {(values: readonly Lowered[]) => Lowered} */
const resultsValue = values => {
    if (values.length === 1) { return values[0] }
    const placed = orderedOperands(values, values => ['[]', values])
    return { exp: ['[]', placed.values], anchors: placed.anchors }
}

/** @type {(exit: Exit, context: Context) => Task<Lowered>} */
const transferTask = (exit, context) => call(() => {
    const owner = context.transfer
    if (owner.kind === 'custom') { return done(owner.transfer(exit, environmentOf(context.scope))) }
    if (owner.kind === 'scalar' && exit[0] !== 'yield' && exit[0] !== 'throw') {
        // scalarLoopOf admits the owning continue here; no other nonlocal
        // transfer can reach a scalar step in this baseline domain.
        const continued = /** @type {Extract<Exit, readonly ['continue', ...unknown[]]>} */ (exit)
        return bind(valueTask(continued[2][0], context), next => done({ exp: ['()', owner.self, [next.exp]], anchors: next.anchors }))
    }
    const plainContext = { ...context, transfer: /** @type {ExitOwner} */ ({ kind: 'default' }) }
    if (exit[0] === 'yield') { return bind(lowerValues(exit[1], plainContext), values => done(resultsValue(values))) }
    if (exit[0] === 'return') { return valueTask(exit[2], plainContext) }
    if (exit[0] === 'throw') { return bind(valueTask(exit[1], plainContext), value => done({ exp: ['throw', value.exp], anchors: value.anchors })) }
    throw 'a loop transfer requires its owning loop'
})

/** Bind ordered results without changing their established identity. @type {(bindings: readonly BindingId[], exp: Exp) => Environment} */
const resultBindings = (bindings, exp) => bindings.map((binding, i) => [binding, bindings.length === 1 ? exp : ['.', exp, i]])

/** Deferred initializers plan their own regions; control paths anchor required work. @type {(statement: Definition, context: Context, required: readonly BindingId[], eager?: boolean) => Task<{ readonly scope: Scope; readonly anchors: readonly Exp[] }>} */
const definitionTask = (statement, context, required, eager = false) => bind(valueTask(statement[2], statement[3] === 'lazy' ? { ...context, memoPrepared: false } : context), value => {
    const initializer = statement[2]
    const deferred = statement[3] === 'lazy' && initializer !== null && typeof initializer === 'object'
        && (initializer[0] !== 'ref' || lazyBinding(context.scope, initializer[1]))
    const scope = scopeOf([deferred ? [statement[1], anchored(value), 'lazy'] : [statement[1], statement[3] === 'lazy' ? anchored(value) : value.exp]], context.scope)
    const anchors = statement[3] === 'required' ? [...value.anchors, ...(eager || required.includes(statement[1]) ? [value.exp] : [])] : []
    return done({ scope, anchors })
})

/** Established invariant result aliases do not demand the helper itself. @type {(results: readonly BindingId[], value: Lowered, reached: readonly BindingId[], eager?: boolean) => readonly Exp[]} */
const loopAnchors = (results, value, reached, eager = false) => [...value.anchors, ...(eager || !results.some(binding => reached.includes(binding)) ? [value.exp] : [])]

/** @type {(statement: Extract<Statement, readonly ['block' | 'if', ...unknown[]]>, context: Context) => boolean} */
const regionHasControl = (statement, context) => {
    if (statement[0] === 'block') {
        const part = blockSummary(statement[2], context)
        return part.returns || !part.normal
    }
    const then = blockSummary(statement[3], context)
    const otherwise = blockSummary(statement[4], context)
    return then.returns || otherwise.returns || !(then.normal || otherwise.normal)
}

/** Prefix nodes carry the original expression identities into both projections. @type {(anchors: readonly Exp[], next: _Control) => _Control} */
const controlPrefix = (anchors, next) => anchors.length === 0 ? next : { normal: next.normal, node: { kind: 'prefix', anchors, next } }

/**
 * Every normal path has completed its selected tests before entering a join.
 * Only common test identities cross that join; yielded values and prefixes
 * still acquire their evaluation from the emitted continuation itself.
 * @type {(flow: _Control) => Task<readonly Exp[] | null>}
 */
const normalTests = flow => call(() => {
    const node = flow.node
    if (node.kind === 'normal') { return done([]) }
    if (node.kind === 'terminal') { return done(null) }
    if (node.kind === 'prefix') { return normalTests(node.next) }
    if (node.kind === 'join') {
        return bind(normalTests(node.body), body => bind(normalTests(node.next), next =>
            done(next === null ? null : [...assertNotNullish(body), ...next])))
    }
    return bind(normalTests(node.then), a => bind(normalTests(node.otherwise), b => {
        const common = a === null ? b : b === null ? a : a.filter(value => b.includes(value))
        return done(common === null ? null : [...new Set([...node.test.anchors, node.test.exp, ...common])])
    }))
})

/**
 * Only normal predecessors supply a joined result. Terminal predecessors are
 * not a null-valued alternative, and prefixes retain their execution in the
 * enclosing control tree before the projected result is demanded.
 * @type {(flow: _Control) => Task<{ readonly exp: Exp } | null>}
 */
const normalResults = flow => call(() => {
    const node = flow.node
    if (node.kind === 'normal') { return done({ exp: anchored(resultsValue(node.values)) }) }
    if (node.kind === 'terminal') { return done(null) }
    if (node.kind === 'prefix' || node.kind === 'join') { return normalResults(node.next) }
    return bind(normalResults(node.then), a => bind(normalResults(node.otherwise), b =>
        done(a === null ? b : b === null ? a : { exp: ['?:', node.test.exp, a.exp, b.exp] })))
})

/**
 * A join lowers its following graph once, then supplies that exact expression
 * to every normal leaf. Terminal computations are selected directly, never
 * evaluated inside a completion product or a generated continuation function.
 * @type {(flow: _Control, normal: (values: readonly Lowered[], established: readonly Exp[], selected: readonly (readonly [Exp, boolean])[]) => Exp, terminal: (value: Lowered, established: readonly Exp[], selected: readonly (readonly [Exp, boolean])[]) => Exp, established?: readonly Exp[], selected?: readonly (readonly [Exp, boolean])[]) => Task<Exp>}
 */
const emitControl = (flow, normal, terminal, established = [], selected = []) => call(() => {
    const node = flow.node
    if (node.kind === 'normal') { return done(normal(node.values, established, selected)) }
    if (node.kind === 'terminal') { return done(terminal(node.value, established, selected)) }
    if (node.kind === 'prefix') { return bind(emitControl(node.next, normal, terminal, established, selected), exp => done(anchored({ exp, anchors: node.anchors }, established, selected))) }
    if (node.kind === 'join') {
        return bind(node.results ? normalTests(node.body) : done([]), tests => bind(emitControl(node.next, normal, terminal, [...new Set([...established, ...assertNotNullish(tests)])], selected), next =>
            emitControl(node.body, () => next, terminal, established, selected)))
    }
    const completed = [...new Set([...established, ...node.test.anchors, node.test.exp])]
    const preceding = selected.filter(([test]) => !Object.is(test, node.test.exp))
    return bind(emitControl(node.then, normal, terminal, completed, [...preceding, [node.test.exp, true]]), a => bind(emitControl(node.otherwise, normal, terminal, completed, [...preceding, [node.test.exp, false]]), b =>
        done(anchored({ exp: ['?:', node.test.exp, a, b], anchors: node.test.anchors }, established, selected))))
})

/** @type {(statement: Extract<Statement, readonly ['block' | 'if', ...unknown[]]>, context: Context) => Task<_Control>} */
const controlRegion = (statement, context) => statement[0] === 'block' ? controlTask(statement[2], context, statement[1].length)
    : bind(valueTask(statement[2], context), test => bind(controlTask(statement[3], context, statement[1].length), a =>
        bind(controlTask(statement[4], context, statement[1].length), b => done({ normal: a.normal || b.normal, node: { kind: 'if', test, then: a, otherwise: b } }))))

/**
 * Function statement regions retain lexical environments while normal results
 * converge on one following graph. Operand regions keep their separate owner.
 * @type {(block: Block, context: Context, expected: number | null) => Task<_Control>}
 */
const controlTask = (block, context, expected) => call(() => {
    const { required, reached, entry } = blockSummary(block, context)
    /** @type {(index: number, scope: Scope, anchors: List<Exp>) => Task<_Control>} */
    const each = (index, scope, anchors) => call(() => {
        /** @type {Context} */
        const current = { ...context, scope }
        if (index === block.statements.length) {
            const exit = block.exit
            if (exit[0] === 'yield') {
                if (expected !== null && exit[1].length !== expected) { throw 'invalid control region result signature' }
                return bind(lowerValues(exit[1], { ...current, transfer: { kind: 'default' } }), values =>
                    done(controlPrefix(toArray(anchors), { normal: true, node: { kind: 'normal', values } })))
            }
            if (exit[0] === 'return' && exit[1] !== context.functionTarget) { throw 'a control return must name its owning function' }
            return bind(transferTask(exit, current), value => done(controlPrefix(toArray(anchors), { normal: false, node: { kind: 'terminal', value } })))
        }
        const statement = block.statements[index]
        if (statement[0] === 'define') {
            return bind(definitionTask(statement, current, required, !entry.includes(statement[1])), value => each(index + 1, value.scope, { head: anchors, tail: value.anchors }))
        }
        if (statement[0] === 'loop') {
            return bind(loopTask(statement[1], current), ({ value, bindings, results }) => each(index + 1, scopeOf(bindings, scope),
                { head: anchors, tail: loopAnchors(results, value, reached, results.some(binding => required.includes(binding)) || !results.some(binding => entry.includes(binding))) }))
        }
        if (!regionHasControl(statement, current)) {
            const task = statement[0] === 'block' ? regionTask(statement[2], current)
                : conditional(statement[2], statement[3], statement[4], current)
            return bind(task, value => each(index + 1, scopeOf(resultBindings(statement[1], value.exp), scope),
                { head: anchors, tail: [...value.anchors, value.exp] }))
        }
        return bind(controlRegion(statement, current), region => {
            if (!region.normal) { return done(controlPrefix(toArray(anchors), region)) }
            const hasResults = statement[1].length !== 0
            const selected = hasResults ? bind(normalResults(region), result => done(assertNotNullish(result).exp)) : done(0)
            return bind(selected, exp => bind(each(index + 1, hasResults ? scopeOf(resultBindings(statement[1], exp), scope) : scope, null), following =>
                done(controlPrefix(toArray(anchors), {
                    normal: following.normal,
                    node: { kind: 'join', body: region, next: hasResults ? controlPrefix([exp], following) : following, results: hasResults },
                }))))
        })
    })
    return each(0, context.scope, null)
})

/** @type {(block: Block, context: Context) => Task<Lowered>} */
const blockTask = (block, context) => call(() => {
    const { required, reached, normal, returns } = blockSummary(block, context)
    const canControl = context.functionTarget !== null || context.transfer.kind === 'default' && !normal && !returns
    if (canControl && block.statements.some(statement => (statement[0] === 'block' || statement[0] === 'if') && regionHasControl(statement, context))) {
        return bind(controlTask(block, context, null), flow => bind(emitControl(flow, (values, established, selected) => anchored(resultsValue(values), established, selected), anchored), exp => done(plain(exp))))
    }
    /** @type {(index: number, scope: Scope, anchors: List<Exp>) => Task<Lowered>} */
    const each = (index, scope, anchors) => call(() => {
        const current = { ...context, scope }
        if (index === block.statements.length) {
            return bind(transferTask(block.exit, current), result => done({ exp: result.exp, anchors: [...toArray(anchors), ...result.anchors] }))
        }
        const statement = block.statements[index]
        if (statement[0] === 'define') {
            return bind(definitionTask(statement, current, required), value => each(index + 1, value.scope, { head: anchors, tail: value.anchors }))
        }
        if (statement[0] === 'loop') {
            return bind(loopTask(statement[1], current), ({ value, bindings, results }) => each(index + 1,
                scopeOf(bindings, scope),
                { head: anchors, tail: loopAnchors(results, value, reached, results.some(binding => required.includes(binding))) }))
        }
        const task = statement[0] === 'block' ? regionTask(statement[2], current)
            : conditional(statement[2], statement[3], statement[4], current)
        return bind(task, value => each(index + 1, scopeOf(resultBindings(statement[1], value.exp), scope),
            { head: anchors, tail: [...value.anchors, value.exp] }))
    })
    return each(0, context.scope, null)
})

/** @type {(node: Node, environment: Environment, transfer?: Transfer, memoPrepared?: boolean) => Context} */
const contextFor = (node, environment, transfer, memoPrepared = false) => {
    const external = environment.flatMap(([binding, value]) => value instanceof Array && value.length !== 1 && !['arg', 'frame'].includes(value[0]) ? [binding] : [])
    return {
        scope: scopeOf(environment),
        transfer: transfer === undefined ? { kind: 'default' } : { kind: 'custom', transfer },
        summaries: summaries(node, new Map(), external),
        functionTarget: null,
        memoPrepared,
        external,
    }
}

/**
 * Lower a normalized expression, retaining distinct equal operation nodes.
 * @type {(root: Value, environment: Environment, transfer?: Transfer) => Lowered}
 */
export const lowerValue = (root, environment, transfer) => run(valueTask(root, contextFor(['value', root], environment, transfer)))

/**
 * Required definitions retain eager anchors; lazy definitions provide node
 * identity without establishing an extra evaluation themselves.
 * @type {(block: Block, environment?: Environment, transfer?: Transfer) => Lowered}
 */
export const lowerBlock = (block, environment = [], transfer) => {
    const memoized = normalizeMemo(block, lazyBindings(scopeOf(environment)))
    if (memoized !== block && transfer !== undefined) { throw 'memo normalization requires the default transfer owner' }
    const normalized = completeBlockTransfers(memoized)
    return run(blockTask(normalized, contextFor(['block', normalized], environment, transfer, true)))
}

/** The graph at a normalized FAST block's result boundary. @type {(block: Block, environment?: Environment) => Exp} */
export const fromFast = (block, environment = []) => anchored(lowerBlock(block, environment))
