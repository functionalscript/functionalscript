/**
 * Construct an EDAG from immutable FAST values and explicit evaluations.
 * This pass knows no source declarations or mutable names. Value blocks do
 * not create functions; only ordinary functions establish invocation scopes.
 * Immutable summary and continuation worklists keep syntax depth off the host
 * stack, including the value blocks introduced by source logical lowering.
 *
 * @module
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { BindingId, Block, Definition, Exit, Function as FastFunction, Loop, Operator, Statement, Value } from '../../js/ast/types.ts'
 * @import { Environment, Lowered, Transfer } from './types.ts'
 * @import { Binding, Context, ExitOwner, Link, Node, Scope, Summaries, Summary, Visit, _Control } from './private.ts'
 * @import { Task } from './task/types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { iterable, toArray } from '../../types/list/module.f.mjs'
import { mapOperator, operatorOperands } from '../../js/ast/module.f.mjs'
import { scalarLoopOf } from '../../js/ast/loop/module.f.js'
import { freeLoopBindings } from './control/module.f.mjs'
import { aggregateHelper, rootLoopOf, scalarHelper } from './loop/module.f.mjs'
import { directInvocationRoot, invocationRootOf } from './loop/root/module.f.mjs'
import { completeBlockTransfers, completeTransfers } from './loop/completions/module.f.mjs'
import { normalizeMemo } from './loop/memo/module.f.mjs'
import { bind, call, done, run } from './task/module.f.mjs'
import { step } from '../../common/monoid/module.f.mjs'
import { maxLength } from '../../types/function/length/module.f.mjs'

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
    const empty = { references: [], required: [], reached: [], entry: [], returns: false, normal: true }
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
    /** @type {readonly BindingId[]} */
    let entry = []
    let entering = true
    let position = 0
    let active = 0
    let returns = false
    let normal = true
    for (const statement of node[1].statements) {
        if (!normal) { break }
        ++active
        const part = parts[position]
        if (statement[0] === 'define') {
            relations = [...relations, [statement[1], part.references]]
            if (statement[3] === 'required') {
                required = [...required, ...part.references]
                if (entering) { entry = [...entry, ...part.references] }
            }
            ++position
        } else if (statement[0] === 'block') {
            required = [...required, ...part.references]
            if (entering) { entry = [...entry, ...part.entry.filter(binding => part.references.includes(binding))] }
            entering = false
            returns = returns || part.returns
            normal = part.normal
            ++position
        } else if (statement[0] === 'if') {
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
            required = [...required, ...references]
            if (entering) { entry = [...entry, ...references] }
            position += length + 1
        }
    }
    const exits = parts.slice(parts.length - exitValues(node[1].exit).length)
    const reached = closure(relations, [...(normal ? exits.flatMap(part => part.references) : []), ...required])
    const local = new Set(relations.map(([binding]) => binding))
    return {
        references: reached.filter(id => !local.has(id)),
        required: node[1].statements.slice(0, active).flatMap(statement => statement[0] === 'define' && statement[3] === 'required' && !reached.includes(statement[1]) ? [statement[1]] : []),
        reached,
        entry: closure(relations, [...entry, ...(entering ? exits.flatMap(part => part.references) : [])]),
        returns: returns || (normal && node[1].exit[0] === 'return'),
        normal: normal && node[1].exit[0] === 'yield',
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
    const memoized = normalizeMemo(source.body)
    /** @type {FastFunction} */
    const prepared = memoized === source.body ? source : { ...source, body: memoized }
    const originalScalar = rootLoopOf(prepared)
    const originalRoot = originalScalar !== null && scalarLoopOf(originalScalar) !== null ? originalScalar : invocationRootOf(prepared)
    const normalized = completeTransfers(prepared, originalRoot)
    const scalar = rootLoopOf(normalized)
    const matched = scalar !== null && scalarLoopOf(scalar) !== null ? null : invocationRootOf(normalized)
    const fn = matched !== null ? directInvocationRoot(normalized, matched) : normalized
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
        const local = { ...context, summaries: fn === source ? context.summaries : new Map([...context.summaries, ...summaries(['block', fn.body], context.summaries)]), scope: scopeOf(inner), transfer: { kind: 'default' }, functionTarget: fn.target }
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

/** Memo admission leaves only established values to capture. @type {(loop: Loop, context: Context) => Task<{ readonly value: Lowered; readonly bindings: Environment }>} */
const loopTask = (loop, context) => call(() => {
    const scalar = scalarLoopOf(loop) !== null
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
    if (root[0] === 'block') { return regionTask(root[1], context, true) }
    if (root[0] === 'if') { return conditional(root[1], root[2], root[3], context, true) }
    return bind(lowerValues(operatorOperands(root), context), values => done(combined(root, values)))
})

/** @type {(condition: Value, then: Block, otherwise: Block, context: Context, normalize?: boolean) => Task<Lowered>} */
const conditional = (condition, then, otherwise, context, normalize = false) => call(() => bind(valueTask(condition, context), test =>
    bind(regionTask(then, context, normalize), a => bind(regionTask(otherwise, context, normalize), b =>
        done({ exp: ['?:', test.exp, anchored(a), anchored(b)], anchors: test.anchors })))))

/** Operand regions normalize local memo state and loops; statement regions are already complete. @type {(block: Block, context: Context, normalize?: boolean) => Task<Lowered>} */
const regionTask = (block, context, normalize = false) => call(() => {
    if (block.exit[0] !== 'yield' && block.exit[0] !== 'throw') { throw 'nonlocal transfers in value regions require structured completion lowering' }
    const memoized = normalize ? normalizeMemo(block, lazyBindings(context.scope)) : block
    if (memoized !== block && context.transfer.kind !== 'default') { throw 'memo normalization requires the default transfer owner' }
    const normalized = normalize ? completeBlockTransfers(memoized) : block
    const local = normalize ? { ...context,
        functionTarget: null,
        summaries: normalized === block ? context.summaries : new Map([...context.summaries, ...summaries(['block', normalized], context.summaries)]),
    } : context
    return blockTask(normalized, local)
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

/** Shared definition establishment; control paths anchor initializers outside their eager entry dependencies. @type {(statement: Definition, context: Context, required: readonly BindingId[], eager?: boolean) => Task<{ readonly scope: Scope; readonly anchors: readonly Exp[] }>} */
const definitionTask = (statement, context, required, eager = false) => bind(valueTask(statement[2], context), value => {
    const initializer = statement[2]
    const deferred = statement[3] === 'lazy' && initializer !== null && typeof initializer === 'object'
        && (initializer[0] !== 'ref' || lazyBinding(context.scope, initializer[1]))
    const scope = scopeOf([deferred ? [statement[1], anchored(value), 'lazy'] : [statement[1], statement[3] === 'lazy' ? anchored(value) : value.exp]], context.scope)
    const anchors = statement[3] === 'required' ? [...value.anchors, ...(eager || required.includes(statement[1]) ? [value.exp] : [])] : []
    return done({ scope, anchors })
})

/** @type {(loop: Loop, value: Lowered, reached: readonly BindingId[], eager?: boolean) => readonly Exp[]} */
const loopAnchors = (loop, value, reached, eager = false) => [...value.anchors, ...(eager || !loop.results.some(binding => reached.includes(binding)) ? [value.exp] : [])]

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
 * A join lowers its following graph once, then supplies that exact expression
 * to every normal leaf. Terminal computations are selected directly, never
 * evaluated inside a completion product or a generated continuation function.
 * @type {(flow: _Control, normal: (values: readonly Lowered[]) => Exp, terminal: (value: Lowered) => Exp) => Task<Exp>}
 */
const emitControl = (flow, normal, terminal) => call(() => {
    const node = flow.node
    if (node.kind === 'normal') { return done(normal(node.values)) }
    if (node.kind === 'terminal') { return done(terminal(node.value)) }
    if (node.kind === 'prefix') { return bind(emitControl(node.next, normal, terminal), exp => done(anchored({ exp, anchors: node.anchors }))) }
    if (node.kind === 'join') {
        return bind(emitControl(node.next, normal, terminal), next => emitControl(node.body, () => next, terminal))
    }
    return bind(emitControl(node.then, normal, terminal), a => bind(emitControl(node.otherwise, normal, terminal), b =>
        done(anchored({ exp: ['?:', node.test.exp, a, b], anchors: node.test.anchors }))))
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
            return bind(loopTask(statement[1], current), ({ value, bindings }) => each(index + 1, scopeOf(bindings, scope),
                { head: anchors, tail: loopAnchors(statement[1], value, reached, !statement[1].results.some(binding => entry.includes(binding))) }))
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
            const selected = hasResults ? emitControl(region, values => anchored(resultsValue(values)), () => null) : done(0)
            return bind(selected, exp => bind(each(index + 1, hasResults ? scopeOf(resultBindings(statement[1], exp), scope) : scope, null), following =>
                done(controlPrefix(toArray(anchors), {
                    normal: following.normal,
                    node: { kind: 'join', body: region, next: hasResults ? controlPrefix([exp], following) : following },
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
        return bind(controlTask(block, context, null), flow => bind(emitControl(flow, values => anchored(resultsValue(values)), anchored), exp => done(plain(exp))))
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
            return bind(loopTask(statement[1], current), ({ value, bindings }) => each(index + 1,
                scopeOf(bindings, scope),
                { head: anchors, tail: loopAnchors(statement[1], value, reached) }))
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
    functionTarget: null,
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
export const lowerBlock = (block, environment = [], transfer) => {
    const memoized = normalizeMemo(block, lazyBindings(scopeOf(environment)))
    if (memoized !== block && transfer !== undefined) { throw 'memo normalization requires the default transfer owner' }
    const normalized = completeBlockTransfers(memoized)
    return run(blockTask(normalized, contextFor(['block', normalized], environment, transfer)))
}

/** The graph at a normalized FAST block's result boundary. @type {(block: Block, environment?: Environment) => Exp} */
export const fromFast = (block, environment = []) => anchored(lowerBlock(block, environment))
