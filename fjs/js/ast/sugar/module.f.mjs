/**
 * Expand resolved source patterns, defaults and control flow, then give every
 * assignment an immutable value. Source declaration identities and complete
 * write/capture facts reach this pass before generated boundaries exist.
 *
 * @module
 *
 * @import { BindingEvent, BindingId, BindingScope, Block, Function as FastFunction, Loop, Operator, Statement, Value } from '../types.ts'
 * @import { ResolvedModule } from '../../../compiler/parser/types.ts'
 * @import { ExpansionPlan, SourceBlock, SourceExit, SourceFunction, SourceLoop, SourceOperator, SourceStatement, SourceSwitch, SourceValue } from './source.ts'
 * @import { Module } from './types.ts'
 * @import { Task } from '../task/types.ts'
 * @import { Context, Environment, Established, _Evaluated, _EvaluatedValues, Normalized, _Recipes, ReferenceTask, Results, Work } from './private.ts'
 */

import { assert, assertNotNullish } from '../../../asserts/module.f.js'
import { mapOperator, operatorOperands } from '../module.f.mjs'
import { exitValues, hasLoopTransfer } from '../control/module.f.mjs'
import { _hasReturn } from '../memo/cells/module.f.mjs'
import { logicalCondition, logicalValue } from './logical/module.f.js'
import { _exposeOperands } from '../returns/module.f.mjs'
import { bind, call, done, run } from '../task/module.f.js'
import { writes as sourceWrites } from './effects/module.f.mjs'

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
 * Source references and writes in first-use order, including nested scopes.
 * @type {(events: readonly BindingEvent[]) => { readonly references: readonly BindingId[], readonly writes: readonly BindingId[] }}
 */
const eventFacts = events => {
    /** @type {readonly BindingId[]} */
    let found = []
    /** @type {readonly BindingId[]} */
    let writes = []
    let pending = events
    while (pending.length !== 0) {
        const [event, ...rest] = pending
        if (event[0] === 'function') { pending = [...event[1].events, ...rest]; continue }
        if (event[0] === 'region') { pending = [...event[1], ...rest]; continue }
        if (event[0] !== 'initialize' && !found.includes(event[1])) { found = [...found, event[1]] }
        if (event[0] === 'write' && !writes.includes(event[1])) { writes = [...writes, event[1]] }
        pending = rest
    }
    return { references: found, writes }
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
    return eventFacts(scope.events).references.filter(id => eligible.includes(id))
}

/**
 * Shared whole-scope write facts choose state; the preserved loop trace chooses
 * references. Outer declaration order fixes both signatures. Loop-local names
 * are absent from the entry environment and never become loop state.
 * @type {(used: readonly BindingId[], environment: Environment, context: Context) => readonly BindingId[]}
 */
const loopSources = (used, environment, context) => context.bindings.filter(fact => fact.isMutable && used.includes(fact.id) && environment.some(([id]) => id === fact.id)).map(fact => fact.id)

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
            const statements = block.statements.flatMap(statement => statement[0] === 'define' ? [valueTask(statement[2])]
                : statement[0] === 'if' ? [valueTask(statement[2]), blockTask(statement[3]), blockTask(statement[4])]
                : statement[0] === 'block' ? [blockTask(statement[2])]
                : [...statement[1].initial.map(valueTask), blockTask(statement[1].body)])
            const exit = block.exit
            pending = [...statements, ...(exit[0] === 'loop'
                ? [...exit[1].initial.map(valueTask), blockTask(exit[1].body)] : exitValues(exit).map(valueTask)), ...rest]
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
 * An established read carries no evaluation or identity of its own.
 * @param {Statement} statement
 * @returns {statement is readonly ['define', BindingId, readonly ['ref', BindingId], 'required' | 'lazy']}
 */
const readAlias = statement => statement[0] === 'define' && statement[2] instanceof Array && statement[2][0] === 'ref'

/**
 * Used source aliases retain their lexical order for helper capture signatures.
 * Discarding an unused established read must not introduce an unused capture.
 * Results include state values whose continue is installed by the enclosing loop.
 * @type {(block: Block, results: readonly Value[]) => Block}
 */
const pruneAliases = (block, results) => {
    if (!block.statements.some(readAlias)) { return block }
    let used = [
        ...references({ ...block, statements: block.statements.filter(statement => !readAlias(statement)) }),
        ...references({ statements: [], exit: ['yield', results] }),
    ]
    /** @type {readonly Statement[]} */
    let statements = []
    for (const statement of block.statements.toReversed()) {
        if (readAlias(statement)) {
            if (!used.includes(statement[1])) { continue }
            used = [...used, statement[2][1]]
        }
        statements = [statement, ...statements]
    }
    return { ...block, statements }
}

/**
 * Alias declarations preserve the established value rather than minting a
 * second node. Retained reads preserve lexical capture order without adding an
 * evaluation demand. A real initializer stays required even when overwritten.
 *
 * @type {(environment: Environment, id: BindingId, value: Value, alias: boolean) => Established}
 */
const establish = (environment, id, value, alias) => {
    if (alias) { return { environment: [...environment, [id, value]], statements: [] } }
    const version = binding(id.index)
    return { environment: [...environment, [id, reference(version)]], statements: [['define', version, value, value instanceof Array && value[0] === 'ref' ? 'lazy' : 'required']] }
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

/** Source writes that the current expression can execute, excluding held functions. @type {(root: SourceValue, environment: Environment, context: Context) => boolean} */
const writesOuter = (root, environment, context) => (context.writes.get(root) ?? []).some(id => environment.some(([outer]) => outer === id))

/** Updated outer identities, in declaration order, independently of their immutable versions. @type {(before: Environment, after: Environment, context: Context) => readonly BindingId[]} */
const changedSources = (before, after, context) => {
    const writes = after.slice(before.length).map(([id]) => id)
    return context.bindings.filter(fact => writes.includes(fact.id) && before.some(([id]) => id === fact.id)).map(fact => fact.id)
}

/** @type {(value: Value, environment: Environment) => _Evaluated} */
const unchangedValue = (value, environment) => ({ value, environment, statements: [], normal: true })

/** An expression already ended execution; keep its reached prefix in an abrupt region. @type {(value: _Evaluated) => Block} */
const evaluatedBlock = value => ({ statements: value.statements, exit: ['yield', []] })

/** Normal completion supplies its expression value and current outer versions together. @type {(value: _Evaluated, sources: readonly BindingId[]) => Block} */
const valueResults = (value, sources) => ({ statements: value.statements,
    exit: ['yield', value.normal ? [value.value, ...sources.map(source => lookup(value.environment, source))] : []] })

/** Lazy branches join both their value and any changed source bindings. @type {(test: _Evaluated, then: _Evaluated, otherwise: _Evaluated, context: Context) => _Evaluated} */
const conditionalValue = (test, then, otherwise, context) => {
    const sources = changedSources(test.environment, [...test.environment,
        ...(then.normal ? then.environment.slice(test.environment.length) : []),
        ...(otherwise.normal ? otherwise.environment.slice(test.environment.length) : [])], context)
    if (sources.length === 0 && then.statements.length === 0 && otherwise.statements.length === 0 && then.normal && otherwise.normal) {
        return { ...test, value: ['?:', test.value, then.value, otherwise.value] }
    }
    const result = binding(0)
    const results = sources.map(source => binding(source.index))
    return { statements: [...test.statements, ['if', [result, ...results], test.value, valueResults(then, sources), valueResults(otherwise, sources)]],
        value: reference(result), environment: [...test.environment, ...sources.map((source, index) => /** @type {const} */ ([source, reference(results[index])]))],
        normal: then.normal || otherwise.normal }
}

/** An inlined value region returns updated outer bindings instead of dropping them. @type {(source: SourceBlock, outer: Environment, inner: Environment, context: Context) => _Evaluated} */
const enclosedValue = (source, outer, inner, context) => {
    const retained = context.bindings.filter(fact => outer.some(([id]) => id === fact.id)).map(fact => fact.id)
    const made = normalizedBlock(source, inner, context, retained)
    const sources = made.normal ? changedSources(outer, made.environment, context) : []
    if (!made.normal) { return { value: undefined, environment: outer, statements: [['block', [], made.block]], normal: false } }
    if (sources.length === 0) { return unchangedValue(['block', made.block], outer) }
    const result = binding(0)
    const results = sources.map(source => binding(source.index))
    assert(made.block.exit[0] === 'yield', 'a normal value region does not yield')
    return { statements: [['block', [result, ...results], { ...made.block,
        exit: ['yield', [...made.block.exit[1], ...sources.map(source => lookup(made.environment, source))]] }]],
        value: reference(result), environment: [...outer, ...sources.map((source, index) => /** @type {const} */ ([source, reference(results[index])]))], normal: true }
}

/** Ordinary invocation bindings and source parameter expansion share one scope. @type {(source: SourceFunction, environment: Environment, context: Context) => FastFunction} */
const functionValue = (source, environment, context) => {
    context = { ...context, loop: null, breakRegion: null }
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
        const selected = parameter.default === null ? unchangedValue(raw, inner)
            : conditionalValue(unchangedValue(['===', raw, undefined], inner), normalizedState(inner, context)(parameter.default.value), unchangedValue(raw, inner), context)
        const made = expanded(parameter.plan, selected.value, selected.environment, parameter.default === null)
        inner = made.environment
        prefix = [...prefix, ...selected.statements, ...made.statements]
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

/**
 * The unchanged-value path keeps its established expression-block spelling.
 * Its source environment may be dropped only because normalizedState routes
 * outer writes through enclosedValue and explicit state results instead.
 * `inner` also includes this block's own invocation bindings where applicable.
 *
 * @type {(source: SourceBlock, outer: Environment, inner: Environment, context: Context) => Block}
 */
const enclosed = (source, outer, inner, context) => {
    const made = normalizedBlock(source, inner, context)
    assert(made.environment.slice(inner.length).every(([id]) => !outer.some(([established]) => established === id)), 'a write escapes its block')
    return made.block
}

/** @type {(environment: Environment, context: Context, value: SourceValue) => { readonly value: Value } | null} */
const leaf = (environment, context, value) => {
    if (value === null || typeof value !== 'object') { return { value } }
    if (value[0] === 'ref') { return { value: lookup(environment, value[1]) } }
    if (value[0] === 'function') { return { value: ['function', functionValue(value[1], environment, context)] } }
    if (value[0] === 'block') { return { value: ['block', enclosed(value[1], environment, environment, context)] } }
    if (value[0] === '()' && value[2].length === 0 && value[1] instanceof Array && value[1][0] === 'function') {
        const source = value[1][1]
        const fn = functionValue(source, environment, context)
        const scanned = fn.body.exit[0] === 'loop' ? fn.body : { ...fn.body, exit: /** @type {const} */ (['yield', exitValues(fn.body.exit)]) }
        if (fn.parameters.length === 0 && fn.rest === null && !_hasReturn(['block', scanned], fn.target)) {
            const inner = source.rest === null ? environment : expanded(source.rest, undefined, environment, true).environment
            return { value: ['block', enclosed(source.body, environment, inner, { ...context, loop: null, breakRegion: null })] }
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

/** Snapshot earlier operand computations before any later state-changing prefix. @type {<T>(inputs: readonly T[], environment: Environment, evaluate: (source: T, environment: Environment) => Task<_Evaluated>) => Task<_EvaluatedValues>} */
const evaluatedValues = (inputs, environment, evaluate) => {
    /** @type {(index: number, inner: Environment, parts: readonly _Evaluated[]) => Task<_EvaluatedValues>} */
    const each = (index, inner, parts) => call(() => {
        if (index !== inputs.length && (parts.length === 0 || parts[parts.length - 1].normal)) {
            return bind(evaluate(inputs[index], inner), part => each(index + 1, part.environment, [...parts, part]))
        }
        const lifted = parts.some(part => part.statements.length !== 0)
        /** @type {readonly Statement[]} */
        let statements = []
        /** @type {readonly Value[]} */
        let values = []
        for (const part of parts) {
            statements = [...statements, ...part.statements]
            if (!part.normal) { break }
            if (lifted) {
                const id = binding(0)
                statements = [...statements, ['define', id, part.value, 'required']]
                values = [...values, reference(id)]
            } else { values = [...values, part.value] }
        }
        return done({ statements, values, environment: inner, normal: parts.every(part => part.normal) })
    })
    return each(0, environment, [])
}

/** Append state results to an already explicit operand region. @type {(made: Normalized, sources: readonly BindingId[]) => Block} */
const skeletonResults = (made, sources) => made.normal && made.block.exit[0] === 'yield'
    ? { ...made.block, exit: ['yield', [...made.block.exit[1], ...sources.map(source => lookup(made.environment, source))]] } : made.block

/**
 * The shared operand sequencer owns lookup, spreads and optional regions.
 * Its generated bindings stay immutable; only recipe references revisit source.
 * @type {(source: Value, environment: Environment, context: Context, recipes: _Recipes) => Task<_Evaluated>}
 */
const skeletonValue = (source, environment, context, recipes) => call(() => {
    if (source === null || typeof source !== 'object') { return done(unchangedValue(source, environment)) }
    if (source[0] === 'ref') {
        const recipe = recipes.get(source[1])
        return recipes.has(source[1]) ? stateTask(/** @type {SourceValue} */ (recipe), environment, context) : done(unchangedValue(source, environment))
    }
    // Only operator shells and their generated immutable reads are here;
    // source regions and functions are evaluated through recipe references.
    assert(source[0] !== 'function' && source[0] !== 'block' && source[0] !== 'if', 'the operand skeleton contains a source region')
    const operands = operatorOperands(source)
    return bind(evaluatedValues(operands, environment, (value, inner) => skeletonValue(value, inner, context, recipes)), made =>
        done({ ...made, value: made.normal ? source[0] === 'String' && typeof made.values[0] === 'string'
            ? made.values[0] : mapOperator((_, index) => made.values[index])(source) : undefined }))
})

/** Normalize the sequencer's explicit statement and branch regions. @type {(source: Block, environment: Environment, context: Context, recipes: _Recipes) => Task<Normalized>} */
const skeletonBlock = (source, environment, context, recipes) => {
    /** @type {(statements: readonly Statement[], inner: Environment) => Task<Normalized>} */
    const abrupt = (statements, inner) => done({ block: { statements, exit: ['yield', []] }, environment: inner, normal: false, hasLoopExit: false, hasFunctionExit: false })
    /** @type {(index: number, inner: Environment, statements: readonly Statement[]) => Task<Normalized>} */
    const each = (index, inner, statements) => call(() => {
        if (index === source.statements.length) {
            assert(source.exit[0] === 'yield', 'the operand sequencer introduced an abrupt exit')
            // The kernel established every source operand in its definitions;
            // final operations contain generated immutable reads alone.
            return done({ block: { statements, exit: source.exit }, environment: inner, normal: true, hasLoopExit: false, hasFunctionExit: false })
        }
        const statement = source.statements[index]
        if (statement[0] === 'define') {
            return bind(skeletonValue(statement[2], inner, context, recipes), made => !made.normal ? abrupt([...statements, ...made.statements], made.environment)
                : each(index + 1, made.environment, [...statements, ...made.statements, ['define', statement[1], made.value, statement[3]]]))
        }
        assert(statement[0] !== 'loop', 'the operand sequencer introduced a loop')
        if (statement[0] === 'block') {
            return bind(skeletonBlock(statement[2], inner, context, recipes), made => {
                const sources = made.normal ? changedSources(inner, made.environment, context) : []
                const results = sources.map(source => binding(source.index))
                const next = /** @type {readonly Statement[]} */ ([...statements, ['block', [...statement[1], ...results], skeletonResults(made, sources)]])
                return !made.normal ? abrupt(next, inner) : each(index + 1,
                    [...inner, ...sources.map((source, index) => /** @type {const} */ ([source, reference(results[index])]))], next)
            })
        }
        return bind(skeletonValue(statement[2], inner, context, recipes), test => {
            assert(test.normal, 'a generated optional guard contains a source recipe')
            return bind(skeletonBlock(statement[3], test.environment, context, recipes), branch =>
                bind(skeletonBlock(statement[4], test.environment, context, recipes), otherwise => {
                    const current = test.environment
                    assert(otherwise.normal, 'a skipped optional region contains a source recipe')
                    const sources = changedSources(current, [...current, ...(branch.normal ? branch.environment.slice(current.length) : []), ...otherwise.environment.slice(current.length)], context)
                    const results = sources.map(source => binding(source.index))
                    const next = /** @type {readonly Statement[]} */ ([...statements, ...test.statements, ['if', [...statement[1], ...results], test.value, skeletonResults(branch, sources), skeletonResults(otherwise, sources)]])
                    return each(index + 1,
                        [...current, ...sources.map((source, index) => /** @type {const} */ ([source, reference(results[index])]))], next)
                }))
        })
    })
    return each(0, environment, [])
}

/** Expose one operator with placeholders, then evaluate its source recipes in the shared order. @type {(source: Operator<SourceValue>, environment: Environment, context: Context) => Task<_Evaluated>} */
const sequencedOperator = (source, environment, context) => {
    const member = source[0] === '()' && source[1] instanceof Array && source[1][0] === '.' && source[1].length === 3 ? source[1] : null
    const operator = member === null ? source : /** @type {Operator<SourceValue>} */ (['.', member[1], member[2], ['|()', source[2]]])
    const inputs = operatorOperands(operator)
    const placeholders = inputs.map(() => binding(0))
    const recipes = new Map(placeholders.map((id, index) => [id, inputs[index]]))
    const exposed = _exposeOperands(mapOperator((_, index) => reference(placeholders[index]))(operator), binding(0), null)
    assert(exposed.statement !== null && exposed.statement[0] === 'block', 'a stateful expression has no operand region')
    return bind(skeletonBlock(exposed.statement[2], environment, context, recipes), made => done(regionValue(made)))
}

/** Recipe re-entry shares the worklist with operand regions, including deep source chains. @type {(source: SourceValue, environment: Environment, context: Context) => Task<_Evaluated>} */
const stateTask = (source, environment, context) => call(() => {
    if (!writesOuter(source, environment, context)) { return done(unchangedValue(normalizedValue(environment, context)(source), environment)) }
    assert(source instanceof Array, 'a stateful value is no source expression')
    if (source[0] === 'block') { return done(enclosedValue(source[1], environment, environment, context)) }
    // A literal callee has no observable construction work. Snapshot its
    // captures after argument evaluation, when JavaScript's direct call reads
    // the enclosing variables, rather than retaining versions an argument
    // block can replace. Materializing the argument list preserves spread
    // order and lets the ordinary sequencer own any following chain steps.
    if ((source[0] === '()' || source[0] === '?.()') && source[1] instanceof Array && source[1][0] === 'function'
        && source[2].some(argument => writesOuter(argument instanceof Array && argument[0] === '...' ? argument[1] : argument, environment, context))) {
        return bind(sequencedOperator(['array', source[2]], environment, context), argumentsValue => {
            if (!argumentsValue.normal) { return done(argumentsValue) }
            const id = binding(0)
            const inner = [...argumentsValue.environment, /** @type {const} */ ([id, reference(id)])]
            const invocation = /** @type {Operator<SourceValue>} */ ([source[0], source[1], [['...', ['ref', id]]], ...source.length === 4 ? [source[3]] : []])
            return bind(sequencedOperator(invocation, inner, context), result => done({ ...result,
                statements: [...argumentsValue.statements, ['define', id, argumentsValue.value, 'required'], ...result.statements],
                environment: result.environment.filter(([source]) => source !== id),
            }))
        })
    }
    if (source[0] === '()' && source[2].length === 0 && source[1] instanceof Array && source[1][0] === 'function') {
        const fn = source[1][1]
        assert(fn.parameters.length === 0 && fn.rest === null, 'a stateful immediate call has invocation bindings')
        return done(enclosedValue(fn.body, environment, environment, { ...context, loop: null, breakRegion: null }))
    }
    if (source[0] === '?:' || source[0] === '&&' || source[0] === '||' || source[0] === '??') {
        return bind(stateTask(source[1], environment, context), left => {
            if (!left.normal) { return done(left) }
            if (source[0] === '?:') {
                return bind(stateTask(source[2], left.environment, context), a =>
                    bind(stateTask(source[3], left.environment, context), b => done(conditionalValue(left, a, b, context))))
            }
            const id = binding(0)
            const value = reference(id)
            const prefix = { ...left, statements: [...left.statements, /** @type {Statement} */ (['define', id, left.value, 'required'])], value }
            return bind(stateTask(source[2], left.environment, context), right => {
                const same = unchangedValue(value, left.environment)
                if (source[0] === '&&') { return done(conditionalValue(prefix, right, same, context)) }
                if (source[0] === '||') { return done(conditionalValue(prefix, same, right, context)) }
                return done(conditionalValue({ ...prefix, value: ['?:', ['===', value, null], true, ['===', value, undefined]] }, right, same, context))
            })
        })
    }
    return sequencedOperator(/** @type {Operator<SourceValue>} */ (source), environment, context)
})

/** Source expressions thread changed immutable versions through their evaluation regions. @type {(environment: Environment, context: Context) => (source: SourceValue) => _Evaluated} */
const normalizedState = (environment, context) => source => run(stateTask(source, environment, context))

/** Ordered labels share one discriminant and short-circuit before the next label. @type {(discriminant: BindingId, labels: readonly SourceValue[], value: (source: SourceValue) => Value) => Value} */
const caseCondition = (discriminant, labels, value) => {
    const tests = labels.map(label => /** @type {Value} */ (['===', reference(discriminant), value(label)]))
    const first = assertNotNullish(tests[0], 'switch case without a label')
    return tests.slice(1).reduce((left, right) => logicalValue('||', left, right), first)
}

/** A normalized source region as one expression result, retaining abrupt work. @type {(made: Normalized) => _Evaluated} */
const regionValue = made => {
    if (!made.normal) { return { value: undefined, environment: made.environment, statements: [['block', [], made.block]], normal: false } }
    assert(made.block.exit[0] === 'yield' && made.block.exit[1].length === 1, 'a source value region does not yield one value')
    return { statements: made.block.statements, value: made.block.exit[1][0], environment: made.environment, normal: true }
}

/** Terminal branches retain their established value spelling when no retained state escapes. @type {(test: _Evaluated, branch: Normalized, otherwise: Normalized, context: Context, retained: readonly BindingId[]) => Normalized} */
const terminalConditional = (test, branch, otherwise, context, retained) => {
    const join = { ...context, bindings: context.bindings.filter(fact => retained.includes(fact.id)) }
    const sources = changedSources(test.environment, [...test.environment,
        ...(branch.normal ? branch.environment.slice(test.environment.length) : []), ...(otherwise.normal ? otherwise.environment.slice(test.environment.length) : [])], join)
    const selected = sources.length === 0 ? { statements: test.statements, value: /** @type {Value} */ (['if', test.value, branch.block, otherwise.block]),
        environment: test.environment, normal: branch.normal || otherwise.normal }
        : conditionalValue(test, regionValue(branch), regionValue(otherwise), join)
    return { block: { statements: selected.statements, exit: ['yield', [selected.value]] }, environment: selected.environment,
        normal: selected.normal, hasLoopExit: branch.hasLoopExit || otherwise.hasLoopExit, hasFunctionExit: branch.hasFunctionExit || otherwise.hasFunctionExit }
}

/** Stacked labels evaluate lazily and keep the versions established by reached labels. @type {(discriminant: BindingId, labels: readonly SourceValue[], environment: Environment, context: Context) => _Evaluated} */
const caseState = (discriminant, labels, environment, context) => {
    /** @type {(remaining: readonly SourceValue[], inner: Environment) => Task<_Evaluated>} */
    const each = (remaining, inner) => call(() => {
        if (!remaining.some(label => writesOuter(label, inner, context))) { return done(unchangedValue(caseCondition(discriminant, remaining, normalizedValue(inner, context)), inner)) }
        const label = assertNotNullish(remaining[0], 'switch case without a label')
        const made = normalizedState(inner, context)(label)
        const test = { ...made, value: /** @type {Value} */ (['===', reference(discriminant), made.value]) }
        if (!made.normal || remaining.length === 1) { return done(test) }
        return bind(each(remaining.slice(1), made.environment), following =>
            done(conditionalValue(test, unchangedValue(true, made.environment), following, context)))
    })
    return run(each(labels, environment))
}

/** Source terminal branches yield their value and retain their final source versions. @type {(exit: Exclude<SourceExit, readonly ['terminal-loop', SourceLoop]>, environment: Environment, context: Context, retained: readonly BindingId[]) => Normalized} */
const normalizedExit = (exit, environment, context, retained) => {
    if (exit[0] === 'throw' || exit[0] === 'yield' || exit[0] === 'return') {
        const made = normalizedState(environment, context)(exit[0] === 'return' ? exit[2] : exit[1])
        return { block: { statements: made.statements, exit: exit[0] === 'throw' ? ['throw', made.value] : ['yield', [made.value]] }, environment: made.environment,
            normal: made.normal && exit[0] !== 'throw', hasLoopExit: false, hasFunctionExit: false }
    }
    const test = normalizedState(environment, context)(exit[1])
    if (!test.normal) { return { block: evaluatedBlock(test), environment: test.environment, normal: false, hasLoopExit: false, hasFunctionExit: false } }
    const keep = retained
    if (exit[0] === 'if') {
        return terminalConditional(test, normalizedBlock(exit[2], test.environment, context, keep), normalizedBlock(exit[3], test.environment, context, keep), context, keep)
    }
    const discriminant = binding(0)
    /** @type {(index: number, inner: Environment) => Task<Normalized>} */
    const each = (index, inner) => call(() => {
        if (index === exit[2].length) { return done(normalizedBlock(exit[3], inner, context, keep)) }
        const arm = exit[2][index]
        const condition = caseState(discriminant, arm.labels, inner, context)
        if (!condition.normal) { return done({ block: evaluatedBlock(condition), environment: condition.environment, normal: false, hasLoopExit: false, hasFunctionExit: false }) }
        const branch = normalizedBlock(arm.body, condition.environment, context, keep)
        return bind(each(index + 1, condition.environment), following => done(terminalConditional(condition, branch, following, context, keep)))
    })
    const tail = run(each(0, test.environment))
    return { ...tail, block: { statements: [...test.statements, ['define', discriminant, test.value, 'required'], ...tail.block.statements], exit: tail.block.exit } }
}

/**
 * A switch is a one-pass transfer region. Its breaks supply normal state;
 * continues retain the enclosing loop and returns retain their function.
 * @type {(source: SourceSwitch, environment: Environment, context: Context) => Normalized}
 */
const normalizedSwitch = (source, environment, context) => {
    if (writesOuter(source.discriminant, environment, context)
        || source.cases.some(arm => arm.labels.some(label => writesOuter(label, environment, context)))) {
        return statefulSwitch(source, environment, context)
    }
    const sources = loopSources(eventFacts(source.events).writes, environment, context)
    const results = sources.map(source => binding(source.index))
    /** @type {Context} */
    const inner = { ...context, breakRegion: { target: source.target, sources } }
    /** @type {readonly Normalized[]} */
    const alternatives = [...source.cases.map(arm => normalizedBlock(arm.body, environment, inner, sources)),
        normalizedBlock(source.otherwise, environment, inner, sources)]
    /** @type {(made: Normalized) => Block} */
    const completed = made => made.normal ? { ...made.block, exit: ['break', source.target, sources.map(source => lookup(made.environment, source))] } : made.block
    const discriminant = binding(0)
    const value = normalizedValue(environment, context)
    let body = completed(alternatives[alternatives.length - 1])
    for (let index = source.cases.length - 1; index >= 0; index = index - 1) {
        body = { statements: [['if', [], caseCondition(discriminant, source.cases[index].labels, value), completed(alternatives[index]), body]], exit: ['yield', []] }
    }
    // Every case transfers, including the unmatched arm. Keep the unreachable
    // root terminal without inventing state reads or helper captures.
    body = { ...body, exit: ['throw', 'a normalized switch case fell through'] }
    return {
        block: { statements: [['define', discriminant, value(source.discriminant), 'required'],
            ['loop', { target: source.target, parameters: [], initial: [], results, body }]], exit: ['yield', []] },
        environment: [...environment, ...sources.map((source, index) => /** @type {const} */ ([source, reference(results[index])]))],
        normal: alternatives.some(made => made.normal || hasLoopTransfer(made.block, source.target)),
        hasLoopExit: alternatives.some(made => made.hasLoopExit),
        hasFunctionExit: alternatives.some(made => made.hasFunctionExit),
    }
}

/** Reached switch labels pass their state to the chosen case or the following label. @type {(source: SourceSwitch, environment: Environment, context: Context) => Normalized} */
const statefulSwitch = (source, environment, context) => {
    const selected = normalizedState(environment, context)(source.discriminant)
    if (!selected.normal) { return { block: evaluatedBlock(selected), environment: selected.environment, normal: false, hasLoopExit: false, hasFunctionExit: false } }
    const sources = loopSources(eventFacts(source.events).writes, selected.environment, context)
    const results = sources.map(source => binding(source.index))
    const discriminant = binding(0)
    const local = { ...context, breakRegion: { target: source.target, sources } }
    /** @type {(made: Normalized) => Block} */
    const completed = made => made.normal ? { ...made.block, exit: ['break', source.target, sources.map(source => lookup(made.environment, source))] } : made.block
    /** @type {(index: number, inner: Environment) => Task<{ readonly block: Block, readonly alternatives: readonly Normalized[] }>} */
    const each = (index, inner) => call(() => {
        if (index === source.cases.length) {
            const made = normalizedBlock(source.otherwise, inner, local, sources)
            return done({ block: completed(made), alternatives: [made] })
        }
        const arm = source.cases[index]
        const condition = caseState(discriminant, arm.labels, inner, context)
        if (!condition.normal) { return done({ block: evaluatedBlock(condition), alternatives: [] }) }
        const made = normalizedBlock(arm.body, condition.environment, local, sources)
        return bind(each(index + 1, condition.environment), following => done({
            block: { statements: [...condition.statements, ['if', [], condition.value, completed(made), following.block]], exit: ['yield', []] },
            alternatives: [made, ...following.alternatives],
        }))
    })
    const { block: body, alternatives } = run(each(0, selected.environment))
    return {
        block: { statements: [...selected.statements, ['define', discriminant, selected.value, 'required'],
            ['loop', { target: source.target, parameters: [], initial: [], results,
                body: { ...body, exit: ['throw', 'a normalized switch case fell through'] } }]], exit: ['yield', []] },
        environment: [...selected.environment, ...sources.map((source, index) => /** @type {const} */ ([source, reference(results[index])]))],
        normal: alternatives.some(made => made.normal || hasLoopTransfer(made.block, source.target)),
        hasLoopExit: alternatives.some(made => made.hasLoopExit), hasFunctionExit: alternatives.some(made => made.hasFunctionExit),
    }
}

/**
 * Run a for's resolved update before its continues. Inner loops and functions
 * own their transfers; resolved header identities survive body shadowing.
 * @type {(block: SourceBlock, step: SourceBlock) => SourceBlock}
 */
const continuedSteps = (block, step) => ({
    ...block,
    statements: block.statements.flatMap(/** @type {(statement: SourceStatement) => readonly SourceStatement[]} */ (statement => {
        if (statement[0] === 'continue') { return [...step.statements, statement] }
        if (statement[0] === 'if') {
            return [['if', statement[1], continuedSteps(statement[2], step), continuedSteps(statement[3], step)]]
        }
        if (statement[0] === 'switch') {
            const region = statement[1]
            return [['switch', { ...region,
                cases: region.cases.map(arm => ({ ...arm, body: continuedSteps(arm.body, step) })),
                otherwise: continuedSteps(region.otherwise, step),
            }]]
        }
        return [statement]
    })),
})

/**
 * Ordinary and terminal loops share state and transfer normalization. Admission
 * has proved a terminal loop's literal condition and absence of an owning
 * break, so it has no normal results or condition-false continuation.
 * @type {(loop: SourceLoop, environment: Environment, context: Context, terminal: boolean) => Normalized}
 */
const normalizedLoop = (loop, environment, context, terminal) => {
    const events = eventFacts(loop.events)
    const sources = loopSources(events.references, environment, context)
    const parameters = sources.map(source => binding(source.index))
    const results = terminal ? [] : sources.map(source => binding(source.index))
    const scope = /** @type {Environment} */ ([...environment, ...sources.map((source, index) => /** @type {const} */ ([source, reference(parameters[index])]))])
    /** @type {NonNullable<Context['loop']>} */
    const transfer = { target: loop.target, sources }
    const condition = normalizedState(scope, context)(loop.condition)
    let sourceBody = loop.body
    if (loop.step !== undefined) {
        const continued = continuedSteps(loop.body, loop.step)
        sourceBody = { ...continued, statements: [...continued.statements, ...loop.step.statements] }
    }
    const step = normalizedBlock(sourceBody, condition.environment, { ...context, loop: transfer, breakRegion: transfer }, sources)
    /** @type {Block} */
    const continuing = step.block.exit[0] === 'yield'
        ? { ...step.block, exit: ['continue', loop.target, step.normal ? sources.map(source => lookup(step.environment, source)) : parameters.map(reference)] }
        : step.block
    /** @type {Block} */
    const body = terminal || condition.value === true && condition.statements.length === 0 && step.hasLoopExit ? continuing : {
        statements: [...condition.statements, ['if', [], condition.value,
            continuing,
            { statements: [], exit: ['break', loop.target, sources.map(source => lookup(condition.environment, source))] },
        ]],
        exit: ['yield', []],
    }
    /** @type {Loop} */
    const normalized = { target: loop.target, parameters, initial: sources.map(source => lookup(environment, source)), results, body }
    return {
        block: terminal ? { statements: [], exit: ['loop', normalized] }
            : { statements: [['loop', normalized]], exit: ['yield', []] },
        environment: terminal ? environment : [...environment, ...sources.flatMap((source, index) => events.writes.includes(source) ? [/** @type {const} */ ([source, reference(results[index])])] : [])],
        normal: !terminal,
        hasLoopExit: step.hasFunctionExit,
        hasFunctionExit: step.hasFunctionExit,
    }
}

/**
 * Assignments retain their source identity until this complete scan. Source
 * loop inputs, iteration versions and results are chosen here, after analysis.
 *
 * @type {(source: SourceBlock, environment: Environment, context: Context, retained?: readonly BindingId[]) => Normalized}
 */
const normalizedBlock = (source, environment, context, retained = []) => {
    let inner = environment
    /** @type {readonly Statement[]} */
    let statements = []
    let hasLoopExit = false
    let hasFunctionExit = false
    for (const statement of source.statements) {
        if (statement[0] === 'return' || statement[0] === 'throw') {
            const made = normalizedState(inner, context)(statement[0] === 'return' ? statement[2] : statement[1])
            const exit = statement[0] === 'return' ? /** @type {const} */ (['return', statement[1], made.value]) : /** @type {const} */ (['throw', made.value])
            return { block: pruneAliases({ statements: [...statements, ...made.statements], exit }, []), environment: made.environment, normal: false, hasLoopExit: true, hasFunctionExit: true }
        }
        if (statement[0] === 'break' || statement[0] === 'continue') {
            const loop = assertNotNullish(statement[0] === 'break' ? context.breakRegion : context.loop, 'a source transfer has no target')
            assert(loop.target === statement[1], 'a source loop exit targets another loop')
            const values = loop.sources.map(source => lookup(inner, source))
            return { block: pruneAliases({ statements, exit: [statement[0], loop.target, values] }, []), environment: inner, normal: false,
                hasLoopExit: hasLoopExit || loop === context.loop, hasFunctionExit }
        }
        if (statement[0] === 'initialize') {
            const value = normalizedState(inner, context)(statement[2])
            statements = [...statements, ...value.statements]
            if (!value.normal) { return { block: pruneAliases({ statements, exit: ['yield', []] }, []), environment: value.environment, normal: false, hasLoopExit, hasFunctionExit } }
            const made = expanded(statement[1], value.value, value.environment, false)
            inner = made.environment
            statements = [...statements, ...made.statements]
            continue
        }
        if (statement[0] === 'write') {
            assert(context.bindings.some(fact => fact.id === statement[1] && fact.isMutable), 'write without complete source analysis')
            const value = normalizedState(inner, context)(statement[2])
            statements = [...statements, ...value.statements]
            if (!value.normal) { return { block: pruneAliases({ statements, exit: ['yield', []] }, []), environment: value.environment, normal: false, hasLoopExit, hasFunctionExit } }
            const made = establish(value.environment, statement[1], value.value, false)
            inner = made.environment
            statements = [...statements, ...made.statements]
            continue
        }
        if (statement[0] === 'compound-write') {
            const [, id, tag, operand] = statement
            assert(context.bindings.some(fact => fact.id === id && fact.isMutable), 'compound write without complete source analysis')
            const current = lookup(inner, id)
            const right = normalizedState(inner, context)(operand)
            if (tag !== '&&' && tag !== '||' && tag !== '??') {
                statements = [...statements, ...right.statements]
                if (!right.normal) { return { block: pruneAliases({ statements, exit: ['yield', []] }, []), environment: right.environment, normal: false, hasLoopExit, hasFunctionExit } }
                const made = establish(right.environment, id, [tag, current, right.value], false)
                inner = made.environment
                statements = [...statements, ...made.statements]
                continue
            }
            const made = right.normal ? establish(right.environment, id, right.value, false) : null
            const selected = made === null ? right : { ...right, statements: [...right.statements, ...made.statements],
                environment: made.environment, value: lookup(made.environment, id) }
            const skipped = unchangedValue(current, inner)
            const test = unchangedValue(logicalCondition(tag, current), inner)
            const joined = conditionalValue(test, tag === '||' ? skipped : selected, tag === '||' ? selected : skipped, context)
            statements = [...statements, ...joined.statements]
            inner = joined.environment
            continue
        }
        if (statement[0] === 'if') {
            const test = normalizedState(inner, context)(statement[1])
            statements = [...statements, ...test.statements]
            inner = test.environment
            if (!test.normal) { return { block: pruneAliases({ statements, exit: ['yield', []] }, []), environment: inner, normal: false, hasLoopExit, hasFunctionExit } }
            // Both arms' final versions must survive alias pruning before
            // the changed outer names become its explicit result signature.
            const outer = context.bindings.filter(fact => inner.some(([id]) => id === fact.id)).map(fact => fact.id)
            const branch = normalizedBlock(statement[2], inner, context, outer)
            const otherwise = normalizedBlock(statement[3], inner, context, outer)
            hasLoopExit = hasLoopExit || branch.hasLoopExit || otherwise.hasLoopExit
            hasFunctionExit = hasFunctionExit || branch.hasFunctionExit || otherwise.hasFunctionExit
            const writes = [...(branch.normal ? branch.environment.slice(inner.length) : []), ...(otherwise.normal ? otherwise.environment.slice(inner.length) : [])].map(([id]) => id)
            const sources = outer.filter(id => writes.includes(id))
            const results = sources.map(source => binding(source.index))
            statements = [...statements, ['if', results, test.value,
                branch.normal ? { ...branch.block, exit: ['yield', sources.map(source => lookup(branch.environment, source))] } : branch.block,
                otherwise.normal ? { ...otherwise.block, exit: ['yield', sources.map(source => lookup(otherwise.environment, source))] } : otherwise.block,
            ]]
            if (!branch.normal && !otherwise.normal) { return { block: pruneAliases({ statements, exit: ['yield', []] }, []), environment: inner, normal: false, hasLoopExit, hasFunctionExit } }
            inner = [...inner, ...sources.map((source, index) => /** @type {const} */ ([source, reference(results[index])]))]
            continue
        }
        if (statement[0] === 'switch') {
            const made = normalizedSwitch(statement[1], inner, context)
            statements = [...statements, ...made.block.statements]
            hasLoopExit = hasLoopExit || made.hasLoopExit
            hasFunctionExit = hasFunctionExit || made.hasFunctionExit
            if (!made.normal) { return { block: pruneAliases({ statements, exit: ['yield', []] }, []), environment: inner, normal: false, hasLoopExit, hasFunctionExit } }
            inner = made.environment
            continue
        }
        const made = normalizedLoop(statement[1], inner, context, false)
        statements = [...statements, ...made.block.statements]
        hasLoopExit = hasLoopExit || made.hasLoopExit
        hasFunctionExit = hasFunctionExit || made.hasFunctionExit
        inner = made.environment
    }
    if (source.exit[0] === 'terminal-loop') {
        const terminal = normalizedLoop(source.exit[1], inner, context, true)
        return {
            block: pruneAliases({ statements: [...statements, ...terminal.block.statements], exit: terminal.block.exit }, []),
            environment: inner,
            normal: false,
            hasLoopExit: hasLoopExit || terminal.hasLoopExit,
            hasFunctionExit: hasFunctionExit || terminal.hasFunctionExit,
        }
    }
    const terminal = normalizedExit(source.exit, inner, context, retained)
    return { block: pruneAliases({ statements: [...statements, ...terminal.block.statements], exit: terminal.block.exit }, retained.map(id => lookup(terminal.environment, id))),
        environment: terminal.environment, normal: terminal.normal, hasLoopExit: hasLoopExit || terminal.hasLoopExit, hasFunctionExit: hasFunctionExit || terminal.hasFunctionExit }
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
    const scopes = scopesOf(resolved.scope)
    /** @type {Context} */
    const context = { bindings: resolved.bindings, scopes, loop: null, breakRegion: null,
        writes: sourceWrites(resolved.body, new Map(scopes.map(scope => [scope.target, eventFacts(scope.events).writes]))) }
    const normalized = normalizedBlock(resolved.body, environment, context).block
    const prefix = parameters.flatMap((id, i) => representatives[i] === i ? [/** @type {Statement} */ (['define', established[i], reference(id), 'required'])] : [])
    return { parameters, body: { statements: [...prefix, ...normalized.statements], exit: normalized.exit } }
}
