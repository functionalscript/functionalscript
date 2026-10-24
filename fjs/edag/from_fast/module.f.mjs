/**
 * Construct an EDAG from immutable FAST values and explicit evaluations.
 * This pass knows no source declarations or mutable names. Value blocks do
 * not create functions; only ordinary functions establish invocation scopes.
 * Immutable summary and continuation worklists keep syntax depth off the host
 * stack, including the value blocks introduced by source logical lowering.
 *
 * @module
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { BindingId, Block, Definition, Exit, Function as FastFunction, Loop, Operator, Value } from '../../js/ast/types.ts'
 * @import { Environment, Lowered, Transfer } from './types.ts'
 * @import { Binding, Context, ExitOwner, Link, Node, Scope, Summaries, Summary, Task, Visit } from './private.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { iterable, toArray } from '../../types/list/module.f.mjs'
import { mapOperator, operatorOperands } from '../../js/ast/module.f.mjs'
import { scalarLoopOf } from '../../js/ast/loop/module.f.js'
import { freeLoopBindings } from './control/module.f.mjs'
import { aggregateHelper, rootLoopOf, scalarHelper } from './loop/module.f.mjs'
import { directInvocationRoot, invocationRootOf, terminalFunction } from './loop/root/module.f.mjs'
import { completeReturns } from './loop/returns/module.f.mjs'
import { step } from '../../common/monoid/module.f.mjs'
import { maxLength } from '../../types/function/length/module.f.mjs'

/** @type {<T>(value: T) => Task<T>} */
const done = value => ({ kind: 'done', value })

/** @type {<T>(run: () => Task<T>) => Task<T>} */
const call = run => ({ kind: 'call', run })

/**
 * @template T, U
 * @param {Task<T>} first
 * @param {(value: T) => Task<U>} next
 * @returns {Task<U>}
 */
const bind = (first, next) => ({ kind: 'bind', first, next: value => next(/** @type {T} */ (value)) })

/**
 * @template T
 * @param {Task<T>} input
 * @returns {T}
 */
const run = input => {
    /** @type {Task<unknown>} */
    let task = input
    /** @type {Link<(value: unknown) => Task<unknown>> | null} */
    let stack = null
    while (true) {
        if (task.kind === 'call') { task = task.run(); continue }
        if (task.kind === 'bind') { stack = { first: task.next, tail: stack }; task = task.first; continue }
        if (stack === null) { return /** @type {T} */ (task.value) }
        /** @type {Link<(value: unknown) => Task<unknown>>} */
        const frame = stack
        stack = frame.tail
        task = frame.first(task.value)
    }
}

/** @type {<T>(items: readonly T[], tail: Link<T> | null) => Link<T> | null} */
const prepend = (items, tail) => items.reduceRight((tail, first) => ({ first, tail }), tail)

/** @type {(exp: Exp) => Lowered} */
const plain = exp => ({ exp, anchors: [] })

/** Establish a region's required evaluations before its result. @type {(value: Lowered) => Exp} */
export const anchored = ({ exp, anchors }) => anchors.length === 0 ? exp : [',', [...anchors, exp]]

/** @type {(values: readonly Lowered[]) => readonly Exp[]} */
const floated = values => values.flatMap(value => value.anchors)

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
const emptyScope = { index: null, entries: null }

/** A new chunk overrides older chunks; its first duplicate remains its value. @type {(environment: Environment, parent?: Scope) => Scope} */
const scopeOf = (environment, parent = emptyScope) => ({
    index: appendIndex(new Map(environment.toReversed().map(entry => /** @type {const} */ ([entry[0], entry]))))(parent.index),
    entries: { head: parent.entries, tail: environment },
})

/** @type {(scope: Scope, binding: BindingId) => Exp} */
const lookup = (scope, binding) => assertNotNullish(bindingOf(scope, binding), 'unbound FAST value')[1]

/** @type {(scope: Scope) => Environment} */
const environmentOf = scope => toArray(scope.entries)

/** @type {(scope: Scope, binding: BindingId) => boolean} */
const lazyBinding = (scope, binding) => bindingOf(scope, binding)?.[2] === 'lazy'

/** @type {(m: ExpOp, n: ExpOp) => boolean} */
const sameCapture = (m, n) => m === n || (['arg', 'rest', 'frame', 'self'].includes(m[0]) && m.length === n.length && m.every((x, i) => x === n[i]))

/** Positions whose anchors remain in their conditional region. @type {(operator: Operator<Value>, index: number) => boolean} */
const isLazyOperand = (operator, index) => {
    if (operator[0] === '?:' || operator[0] === '?.' || operator[0] === '?.()') { return index !== 0 }
    if (operator[0] === '.') { return index >= (operator[2] instanceof Array ? 2 : 1) }
    return false
}

/** @type {(exit: Exit) => readonly Value[]} */
const exitValues = exit => exit[0] === 'yield' ? exit[1]
    : exit[0] === 'break' || exit[0] === 'continue' ? exit[2]
        : [exit[0] === 'throw' ? exit[1] : exit[2]]

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

/** @type {(node: Node, parts: readonly Summary[]) => Summary} */
const summary = (node, parts) => {
    /** @type {Summary} */
    const empty = { references: [], required: [], reached: [] }
    if (node[0] === 'value') {
        const value = node[1]
        if (!(value instanceof Array)) { return empty }
        if (value[0] === 'ref') { return { ...empty, references: [value[1]] } }
        if (value[0] === 'function') { return { ...empty, references: parts.slice(0, -1).flatMap(part => part.references) } }
        if (value[0] === 'block' || value[0] === 'if') { return { ...empty, references: parts[0].references } }
        return { ...empty, references: parts.flatMap((part, index) => isLazyOperand(value, index) ? [] : part.references) }
    }
    /** @type {readonly (readonly [BindingId, readonly BindingId[]])[]} */
    let relations = []
    /** @type {readonly BindingId[]} */
    let required = []
    let position = 0
    for (const statement of node[1].statements) {
        const part = parts[position]
        if (statement[0] === 'define') {
            relations = [...relations, [statement[1], part.references]]
            if (statement[3] === 'required') { required = [...required, ...part.references] }
            ++position
        } else if (statement[0] === 'block') {
            required = [...required, ...part.references]
            ++position
        } else if (statement[0] === 'if') {
            required = [...required, ...part.references]
            position += 3
        } else {
            const length = statement[1].initial.length
            required = [...required, ...parts.slice(position, position + length).flatMap(part => part.references), ...freeLoopBindings(statement[1])]
            position += length + 1
        }
    }
    const reached = closure(relations, [...parts.slice(position).flatMap(part => part.references), ...required])
    const local = new Set(relations.map(([binding]) => binding))
    return {
        references: reached.filter(id => !local.has(id)),
        required: node[1].statements.flatMap(statement => statement[0] === 'define' && statement[3] === 'required' && !reached.includes(statement[1]) ? [statement[1]] : []),
        reached,
    }
}

/**
 * Immutable postorder dependency facts. Result blocks resolve local definition
 * chains once; enclosing values read their external dependencies directly.
 * The walk includes skipped regions so later lowering has their own facts.
 * @type {(root: Node, known?: Summaries) => Summaries}
 */
const summaries = (root, known = new Map()) => {
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
        const value = summary(visit[1], toArray(parts))
        results = { first: value, tail: results }
        entries = { first: [visit[1][1], value], tail: entries }
    }
    return new Map(iterable(entries))
}

/** @type {(block: Block, context: Context) => Summary} */
const blockSummary = (block, context) => context.summaries.get(block) ?? assertNotNullish(summaries(['block', block], context.summaries).get(block))

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
    const originalScalar = rootLoopOf(source)
    const originalRoot = originalScalar !== null && scalarLoopOf(originalScalar) !== null ? originalScalar : invocationRootOf(source)
    const normalized = completeReturns(source, originalRoot)
    const scalar = rootLoopOf(normalized)
    const matched = scalar !== null && scalarLoopOf(scalar) !== null ? null : invocationRootOf(normalized)
    const fn = matched !== null ? directInvocationRoot(normalized, matched)
        : normalized === source ? source : terminalFunction(normalized)
    return bind(lowerValues(fn.captures.map(capture => capture.value), { ...context, transfer: { kind: 'default' } }), captures => {
        const candidates = captures.map(capture => capture.exp).filter(exp => exp instanceof Array)
        const slots = candidates.filter((node, i) => candidates.findIndex(other => sameCapture(other, node)) === i)
        const reads = slots.map((_, i) => /** @type {Exp} */ (['frame', i]))
        /** @type {Environment} */
        const inner = [
            ...fn.parameters.map((id, i) => /** @type {const} */ ([id, ['arg', i]])),
            ...(fn.rest === null ? [] : [/** @type {const} */ ([fn.rest, ['rest']])]),
            ...(fn.self === null ? [] : [/** @type {const} */ ([fn.self, ['self']])]),
            ...fn.captures.map((capture, i) => /** @type {const} */ ([capture.binding,
                captures[i].exp instanceof Array ? reads[slots.findIndex(node => sameCapture(node, /** @type {ExpOp} */ (captures[i].exp)))] : captures[i].exp,
            ])),
        ]
        /** @type {Context} */
        const local = { ...context, summaries: fn === source ? context.summaries : new Map([...context.summaries, ...summaries(['block', fn.body], context.summaries)]), scope: scopeOf(inner), transfer: { kind: 'default' } }
        const root = rootLoopOf(fn)
        return bind(root === null ? blockTask(fn.body, local) : scalarRoot(fn, root, local), body =>
            done({ exp: ['=>', fn.parameters.length, slots, anchored(body)], anchors: floated(captures) }))
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

/** Helpers capture established values; lazy demand transport remains separate. @type {(loop: Loop, context: Context) => Task<{ readonly value: Lowered; readonly bindings: Environment }>} */
const loopTask = (loop, context) => call(() => {
    const scalar = scalarLoopOf(loop) !== null
    const free = freeLoopBindings(loop)
    if (free.some(binding => lazyBinding(context.scope, binding))) { throw 'lazy free loop bindings require shared demand-state lowering' }
    return bind(functionValue(scalar ? scalarHelper(loop) : aggregateHelper(loop), context), fn =>
        bind(valueTask(scalar ? loop.initial[0] : ['array', loop.initial], context), initial => {
            /** @type {Lowered} */
            const value = { exp: ['()', fn.exp, [initial.exp]], anchors: [...fn.anchors, ...initial.anchors] }
            return done({ value, bindings: loop.results.map((binding, i) => [binding, scalar ? value.exp : ['.', value.exp, i]]) })
        }))
})
/** @type {(source: Operator<Value>, values: readonly Lowered[]) => Lowered} */
const combined = (source, values) => {
    const mapped = mapOperator((_, index) => {
        const value = values[index]
        return isLazyOperand(source, index) ? anchored(value) : value.exp
    })(source)
    const anchors = floated(values.filter((_, i) => !isLazyOperand(source, i)))
    if (mapped[0] === 'array') { return { exp: ['[]', mapped[1]], anchors } }
    if (mapped[0] === 'object') { return { exp: ['{}', mapped[1]], anchors } }
    if (mapped[0] === ',') {
        const before = values.slice(0, -1).flatMap(value => value.exp instanceof Array ? [...value.anchors, value.exp] : value.anchors)
        const last = values[values.length - 1]
        return { exp: last.exp, anchors: [...before, ...last.anchors] }
    }
    if (mapped[0] === '-' && mapped.length === 2 && (typeof mapped[1] === 'number' || typeof mapped[1] === 'bigint')) {
        return { exp: -mapped[1], anchors }
    }
    if (mapped[0] === '()' && source[0] === '()') {
        const callee = source[1]
        const f = mapped[1]
        if (callee instanceof Array && callee[0] === '.' && callee.length === 3 && f instanceof Array && f[0] === '.' && f.length === 3) {
            return { exp: ['.', f[1], f[2], ['|()', mapped[2]]], anchors }
        }
    }
    return { exp: /** @type {Exp} */ (mapped), anchors }
}

/** @type {(root: Value, context: Context) => Task<Lowered>} */
const valueTask = (root, context) => call(() => {
    if (root === undefined) { return done(plain(['undefined'])) }
    if (root === null || typeof root !== 'object') { return done(plain(root)) }
    if (root[0] === 'ref') { return done(plain(lookup(context.scope, root[1]))) }
    if (root[0] === 'function') { return functionValue(root[1], context) }
    if (root[0] === 'block') { return regionTask(root[1], context) }
    if (root[0] === 'if') { return conditional(root[1], root[2], root[3], context) }
    return bind(lowerValues(operatorOperands(root), context), values => done(combined(root, values)))
})

/** @type {(condition: Value, then: Block, otherwise: Block, context: Context) => Task<Lowered>} */
const conditional = (condition, then, otherwise, context) => call(() => bind(valueTask(condition, context), test =>
    bind(regionTask(then, context), a => bind(regionTask(otherwise, context), b =>
        done({ exp: ['?:', test.exp, anchored(a), anchored(b)], anchors: test.anchors })))))

/** Baseline value regions have normal results or fail; nonlocal exits follow in E. @type {(block: Block, context: Context) => Task<Lowered>} */
const regionTask = (block, context) => call(() => {
    if (block.exit[0] !== 'yield' && block.exit[0] !== 'throw') { throw 'nonlocal transfers in value regions require structured completion lowering' }
    return blockTask(block, context)
})

/** One result stays scalar; other signatures use their declared order. @type {(values: readonly Lowered[]) => Lowered} */
const resultsValue = values => ({ exp: values.length === 1 ? values[0].exp : ['[]', values.map(value => value.exp)], anchors: floated(values) })

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

/** @type {(block: Block, context: Context) => Task<Lowered>} */
const blockTask = (block, context) => call(() => {
    const { required, reached } = blockSummary(block, context)
    /** @type {(index: number, scope: Scope, anchors: List<Exp>) => Task<Lowered>} */
    const each = (index, scope, anchors) => call(() => {
        const current = { ...context, scope }
        if (index === block.statements.length) {
            return bind(transferTask(block.exit, current), result => done({ exp: result.exp, anchors: [...toArray(anchors), ...result.anchors] }))
        }
        const statement = block.statements[index]
        if (statement[0] === 'define') {
            return bind(valueTask(statement[2], current), value => {
                const initializer = statement[2]
                const deferred = statement[3] === 'lazy' && initializer !== null && typeof initializer === 'object'
                    && (initializer[0] !== 'ref' || lazyBinding(scope, initializer[1]))
                const next = scopeOf([deferred ? [statement[1], anchored(value), 'lazy'] : [statement[1], statement[3] === 'lazy' ? anchored(value) : value.exp]], scope)
                const added = statement[3] === 'required' ? [...value.anchors, ...(required.includes(statement[1]) ? [value.exp] : [])] : []
                return each(index + 1, next, { head: anchors, tail: added })
            })
        }
        if (statement[0] === 'loop') {
            return bind(loopTask(statement[1], current), ({ value, bindings }) => each(index + 1,
                scopeOf(bindings, scope),
                { head: anchors, tail: [...value.anchors, ...(!statement[1].results.some(binding => reached.includes(binding)) ? [value.exp] : [])] }))
        }
        const task = statement[0] === 'block' ? regionTask(statement[2], current)
            : conditional(statement[2], statement[3], statement[4], current)
        return bind(task, value => each(index + 1, scopeOf(resultBindings(statement[1], value.exp), scope),
            { head: anchors, tail: [...value.anchors, value.exp] }))
    })
    return each(0, context.scope, null)
})

/** @type {(node: Node, environment: Environment, transfer?: Transfer) => Context} */
const contextFor = (node, environment, transfer) => ({
    scope: scopeOf(environment),
    transfer: transfer === undefined ? { kind: 'default' } : { kind: 'custom', transfer },
    summaries: summaries(node),
})

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
export const lowerBlock = (block, environment = [], transfer) => run(blockTask(block, contextFor(['block', block], environment, transfer)))

/** The graph at a normalized FAST block's result boundary. @type {(block: Block, environment?: Environment) => Exp} */
export const fromFast = (block, environment = []) => anchored(lowerBlock(block, environment))
