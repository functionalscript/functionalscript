/**
 * Expand resolved source patterns, defaults and control flow, then give every
 * assignment an immutable value. Source declaration identities and complete
 * write/capture facts reach this pass before generated boundaries exist.
 *
 * @module
 *
 * @import { BindingEvent, BindingId, BindingScope, Block, Function as FastFunction, Operator, Statement, Value } from '../types.ts'
 * @import { ResolvedModule } from '../../../compiler/parser/types.ts'
 * @import { ExpansionPlan, SourceBlock, SourceExit, SourceFunction, SourceOperator, SourceValue } from './source.ts'
 * @import { Module } from './types.ts'
 * @import { Context, Environment, Established, Normalized, NormalizedStatement, ReferenceTask, RegionExit, Results, Work } from './private.ts'
 */

import { assert, assertNotNullish } from '../../../asserts/module.f.js'
import { mapOperator, operatorOperands } from '../module.f.mjs'
import { logicalValue } from './logical/module.f.mjs'

/** Indices are diagnostic; each allocation establishes a distinct identity. @type {(index: number) => BindingId} */
const binding = index => ({ index })

/** @type {(id: BindingId) => Value} */
const reference = id => ['ref', id]

/** The latest immutable version of one original source declaration. @type {(environment: Environment, id: BindingId) => Value} */
const lookup = (environment, id) => assertNotNullish(environment.findLast(([source]) => source === id), 'uninitialized source binding')[1]

/** Source regions retain their function; only ordinary functions add scopes. @type {(root: BindingScope) => readonly BindingScope[]} */
const scopesOf = root => {
    /** @type {readonly BindingScope[]} */
    let scopes = []
    /** @type {readonly BindingEvent[]} */
    let pending = [['function', root]]
    while (pending.length !== 0) {
        const [event, ...rest] = pending
        if (event[0] === 'function') { scopes = [...scopes, event[1]]; pending = [...event[1].events, ...rest] }
        else { pending = event[0] === 'region' ? [...event[1], ...rest] : rest }
    }
    return scopes
}

/**
 * Shared facts choose external source declarations. The event order preserves
 * first reference order, including forwarding needed to construct a child.
 * No mutability or capture predicate is recomputed from executable values.
 *
 * @type {(context: Context, fn: SourceFunction) => readonly BindingId[]}
 */
const captureSources = (context, fn) => {
    const scope = assertNotNullish(context.scopes.find(scope => scope.target === fn.target), 'missing source function facts')
    const scopes = scopesOf(scope)
    const own = scopes.flatMap(scope => scope.bindings)
    const targets = scopes.map(scope => scope.target)
    const eligible = context.bindings.filter(fact => fact.id !== fn.self && !own.includes(fact.id) && fact.capturedBy.some(target => targets.includes(target))).map(fact => fact.id)
    /** @type {readonly BindingId[]} */
    let found = []
    let pending = scope.events
    while (pending.length !== 0) {
        const [event, ...rest] = pending
        if (event[0] === 'function') { pending = [...event[1].events, ...rest]; continue }
        if (event[0] === 'region') { pending = [...event[1], ...rest]; continue }
        if (event[0] !== 'initialize' && eligible.includes(event[1]) && !found.includes(event[1])) { found = [...found, event[1]] }
        pending = rest
    }
    return found
}

/** @type {(value: Value) => ReferenceTask} */
const valueTask = value => ({ kind: 'value', value })

/** @type {(block: Block) => ReferenceTask} */
const blockTask = block => ({ kind: 'block', block })

/**
 * Capture and rest pruning follows normalized uses after unused aliases have
 * disappeared. Nested functions expose their established capture values alone.
 *
 * @type {(root: Block) => readonly BindingId[]}
 */
const references = root => {
    /** @type {readonly ReferenceTask[]} */
    let pending = [blockTask(root)]
    /** @type {readonly BindingId[]} */
    let found = []
    while (pending.length !== 0) {
        const [task, ...rest] = pending
        if (task.kind === 'block') {
            const { block } = task
            const statements = /** @type {readonly NormalizedStatement[]} */ (block.statements).flatMap(statement => statement[0] === 'define' ? [valueTask(statement[2])]
                : statement[0] === 'if' ? [valueTask(statement[2]), blockTask(statement[3]), blockTask(statement[4])]
                : [...statement[1].initial.map(valueTask), blockTask(statement[1].body)])
            const exit = /** @type {RegionExit} */ (block.exit)
            const values = exit[0] === 'yield' ? exit[1] : exit[0] === 'continue' || exit[0] === 'break' ? exit[2] : [exit[1]]
            pending = [...statements, ...values.map(valueTask), ...rest]
            continue
        }
        const { value } = task
        if (value === null || typeof value !== 'object') { pending = rest; continue }
        if (value[0] === 'ref') { if (!found.includes(value[1])) { found = [...found, value[1]] }; pending = rest; continue }
        if (value[0] === 'function') { pending = [...value[1].captures.map(capture => valueTask(capture.value)), ...rest]; continue }
        if (value[0] === 'block') { pending = [blockTask(value[1]), ...rest]; continue }
        if (value[0] === 'if') { pending = [valueTask(value[1]), blockTask(value[2]), blockTask(value[3]), ...rest]; continue }
        pending = [...operatorOperands(value).map(valueTask), ...rest]
    }
    return found
}

/**
 * Alias declarations preserve the established value rather than minting a
 * second node. A real initializer remains required even when later overwritten.
 *
 * @type {(environment: Environment, id: BindingId, value: Value, alias: boolean) => Established}
 */
const establish = (environment, id, value, alias) => {
    if (alias) { return { environment: [...environment, [id, value]], statements: [] } }
    const version = binding(id.index)
    return { environment: [...environment, [id, reference(version)]], statements: [['define', version, value, 'required']] }
}

/** The single owner of checked pattern expansion. @type {(plan: ExpansionPlan, value: Value, environment: Environment, alias: boolean) => Established} */
const expanded = (plan, value, environment, alias) => {
    let inner = environment
    /** @type {readonly Statement[]} */
    let statements = []
    for (const [index, { source, spread }] of plan.reads.entries()) {
        const read = source === null ? value : source.length === 1 ? source : /** @type {Value} */ (['.', lookup(inner, plan.ids[source[0]]), source[1]])
        const made = establish(inner, plan.ids[index], spread ? ['array', [['...', read]]] : read, !spread && source === null && alias)
        inner = made.environment
        statements = [...statements, ...made.statements]
    }
    return { environment: inner, statements }
}

/** @type {(value: SourceValue) => boolean} */
const isAlias = value => value instanceof Array && value[0] === 'ref'

/**
 * Discarded source names and function values establish no computation. Flatten
 * only discarded commas; the last operand retains its value and lazy regions.
 *
 * @type {(values: readonly SourceValue[]) => readonly SourceValue[]}
 */
const commaValues = values => {
    let pending = values.slice(0, -1)
    /** @type {readonly SourceValue[]} */
    let kept = []
    while (pending.length !== 0) {
        const [value, ...rest] = pending
        if (value instanceof Array && value[0] === ',') { pending = [...value[1], ...rest]; continue }
        if (value !== null && typeof value === 'object' && value[0] !== 'ref' && value[0] !== 'function' && value.length !== 1) { kept = [...kept, value] }
        pending = rest
    }
    return [...kept, values[values.length - 1]]
}

/** Ordinary invocation bindings and source parameter expansion share one scope. @type {(source: SourceFunction, environment: Environment, context: Context) => FastFunction} */
const functionValue = (source, environment, context) => {
    const parameters = Array.from({ length: source.length }, (_, i) => binding(i))
    const rest = binding(source.length)
    const self = binding(source.length + 1)
    const sources = captureSources(context, source)
    const captures = sources.map((id, i) => ({ binding: binding(source.length + 2 + i), value: lookup(environment, id) }))
    /** @type {Environment} */
    let inner = sources.map((id, i) => [id, reference(captures[i].binding)])
    if (source.self !== null) { inner = [...inner, [source.self, reference(self)]] }
    /** @type {readonly Statement[]} */
    let prefix = []
    for (const [index, parameter] of source.parameters.entries()) {
        const read = index < source.length ? reference(parameters[index]) : /** @type {Value} */ (['.', reference(rest), index - source.length])
        const rawBinding = binding(index)
        const raw = index < source.length ? read : reference(rawBinding)
        if (index >= source.length) { prefix = [...prefix, ['define', rawBinding, read, 'required']] }
        const value = parameter.default === null ? raw : /** @type {Value} */ (['?:', ['===', raw, undefined], normalizedValue(inner, context)(parameter.default.value), raw])
        const made = expanded(parameter.plan, value, inner, parameter.default === null)
        inner = made.environment
        prefix = [...prefix, ...made.statements]
    }
    if (source.rest !== null) {
        const late = source.parameters.length - source.length
        const value = late === 0 ? reference(rest) : /** @type {Value} */ (['()', ['.', reference(rest), 'slice'], [late]])
        const made = expanded(source.rest, value, inner, late === 0)
        inner = made.environment
        prefix = [...prefix, ...made.statements]
    }
    const normalized = normalizedBlock(source.body, inner, context).block
    const body = { statements: [...prefix, ...normalized.statements], exit: normalized.exit }
    const used = references(body)
    return {
        target: source.target, parameters, rest: used.includes(rest) ? rest : null, self: used.includes(self) ? self : null,
        captures: captures.filter(capture => used.includes(capture.binding)),
        body: { ...body, exit: body.exit[0] === 'yield' ? ['return', source.target, body.exit[1][0]] : body.exit },
    }
}

/** @type {(environment: Environment, context: Context, value: SourceValue) => { readonly value: Value } | null} */
const leaf = (environment, context, value) => {
    if (value === null || typeof value !== 'object') { return { value } }
    if (value[0] === 'ref') { return { value: lookup(environment, value[1]) } }
    if (value[0] === 'function') { return { value: ['function', functionValue(value[1], environment, context)] } }
    if (value[0] === 'block') { return { value: ['block', normalizedBlock(value[1], environment, context).block] } }
    if (value[0] === '()' && value[2].length === 0 && value[1] instanceof Array && value[1][0] === 'function') {
        const source = value[1][1]
        const fn = functionValue(source, environment, context)
        if (fn.parameters.length === 0 && fn.rest === null) {
            const inner = source.rest === null ? environment : expanded(source.rest, undefined, environment, true).environment
            return { value: ['block', normalizedBlock(source.body, inner, context).block] }
        }
        return { value: ['()', ['function', fn], []] }
    }
    return null
}

/** Explicit work preserves unbounded source operator chains and occurrence order. @type {(environment: Environment, context: Context) => (root: SourceValue) => Value} */
const normalizedValue = (environment, context) => root => {
    /** @type {Work} */
    let work = { kind: 'expand', value: root, rest: null }
    /** @type {Results} */
    let results = null
    while (work !== null) {
        if (work.kind === 'expand') {
            const found = leaf(environment, context, work.value)
            if (found !== null) { results = { value: found.value, rest: results }; work = work.rest; continue }
            const source = /** @type {SourceOperator<SourceValue>} */ (work.value)
            if (source[0] === '&&' || source[0] === '||' || source[0] === '??') {
                const operands = [source[1], source[2]]
                work = operands.reduceRight((rest, value) => ({ kind: 'expand', value, rest }), /** @type {Work} */ ({ kind: 'logical', tag: source[0], operands, rest: work.rest }))
                continue
            }
            const operator = source[0] === ',' ? /** @type {Operator<SourceValue>} */ ([',', commaValues(source[1])]) : /** @type {Operator<SourceValue>} */ (source)
            const operands = operatorOperands(operator)
            work = operands.reduceRight((rest, value) => ({ kind: 'expand', value, rest }), /** @type {Work} */ ({ kind: 'operator', value: operator, operands, rest: work.rest }))
            continue
        }
        /** @type {readonly Value[]} */
        let values = []
        let remaining = results
        for (const _ of work.operands) {
            const result = assertNotNullish(remaining, 'missing normalized operand')
            values = [result.value, ...values]
            remaining = result.rest
        }
        results = { value: work.kind === 'logical' ? logicalValue(work.tag, values[0], values[1]) : mapOperator((_, index) => values[index])(work.value), rest: remaining }
        work = work.rest
    }
    return assertNotNullish(results, 'missing normalized value').value
}

/** Source terminal branches become result regions, never generated calls. @type {(exit: SourceExit, environment: Environment, context: Context) => Block} */
const normalizedExit = (exit, environment, context) => {
    const value = normalizedValue(environment, context)
    if (exit[0] === 'throw') { return { statements: [], exit: ['throw', value(exit[1])] } }
    if (exit[0] === 'yield' || exit[0] === 'return') { return { statements: [], exit: ['yield', [value(exit[0] === 'yield' ? exit[1] : exit[2])]] } }
    if (exit[0] === 'if') {
        return { statements: [], exit: ['yield', [['if', value(exit[1]), normalizedBlock(exit[2], environment, context).block, normalizedBlock(exit[3], environment, context).block]]] }
    }
    const discriminant = binding(0)
    let tail = normalizedBlock(exit[3], environment, context).block
    for (const arm of exit[2].toReversed()) {
        const tests = arm.labels.map(label => /** @type {Value} */ (['===', reference(discriminant), value(label)]))
        const first = assertNotNullish(tests[0], 'switch case without a label')
        const condition = tests.slice(1).reduce((left, right) => logicalValue('||', left, right), first)
        tail = { statements: [], exit: ['yield', [['if', condition, normalizedBlock(arm.body, environment, context).block, tail]]] }
    }
    return { statements: [['define', discriminant, value(exit[1]), 'required'], ...tail.statements], exit: tail.exit }
}

/**
 * Assignments retain their source identity until this complete scan. Scalar
 * loop inputs, iteration versions and results are chosen here, after analysis.
 *
 * @type {(source: SourceBlock, environment: Environment, context: Context) => Normalized}
 */
const normalizedBlock = (source, environment, context) => {
    let inner = environment
    /** @type {readonly Statement[]} */
    let statements = []
    for (const statement of source.statements) {
        if (statement[0] === 'initialize') {
            const made = expanded(statement[1], normalizedValue(inner, context)(statement[2]), inner, isAlias(statement[2]))
            inner = made.environment
            statements = [...statements, ...made.statements]
            continue
        }
        if (statement[0] === 'write') {
            assert(context.bindings.some(fact => fact.id === statement[1] && fact.isMutable), 'write without complete source analysis')
            const made = establish(inner, statement[1], normalizedValue(inner, context)(statement[2]), isAlias(statement[2]))
            inner = made.environment
            statements = [...statements, ...made.statements]
            continue
        }
        const loop = statement[1]
        const parameter = binding(loop.variable.index)
        const result = binding(loop.variable.index)
        const scope = [...inner, /** @type {const} */ ([loop.variable, reference(parameter)])]
        const step = normalizedBlock(loop.body, scope, context)
        const condition = normalizedValue(scope, context)(loop.condition)
        statements = [...statements, ['loop', {
            target: loop.target, parameters: [parameter], initial: [lookup(inner, loop.variable)], results: [result],
            body: {
                statements: [['if', [], condition,
                    { ...step.block, exit: ['continue', loop.target, [lookup(step.environment, loop.variable)]] },
                    { statements: [], exit: ['break', loop.target, [reference(parameter)]] },
                ]],
                exit: ['yield', []],
            },
        }]]
        inner = [...inner, [loop.variable, reference(result)]]
    }
    const terminal = normalizedExit(source.exit, inner, context)
    return { block: { statements: [...statements, ...terminal.statements], exit: terminal.exit }, environment: inner }
}

/**
 * Import aliases share supplied graph identities. Required input definitions
 * keep unused or lazy-only module loads eager; graph construction removes
 * anchors already reached through eager dependencies.
 *
 * @type {(resolved: ResolvedModule, imports: readonly unknown[]) => Module}
 */
export const normalize = (resolved, imports) => {
    const parameters = resolved.imports.map((_, i) => binding(i))
    const established = resolved.imports.map((_, i) => binding(i))
    const representatives = resolved.imports.map((_, i) => imports.findIndex(value => Object.is(value, imports[i])))
    /** @type {Environment} */
    const environment = resolved.imports.flatMap((imported, i) => imported.binding === null ? [] : [[imported.binding, reference(established[representatives[i]])]])
    const context = { bindings: resolved.bindings, scopes: scopesOf(resolved.scope) }
    const normalized = normalizedBlock(resolved.body, environment, context).block
    const prefix = parameters.flatMap((id, i) => representatives[i] === i ? [/** @type {Statement} */ (['define', established[i], reference(id), 'required'])] : [])
    return { parameters, body: { statements: [...prefix, ...normalized.statements], exit: normalized.exit } }
}
