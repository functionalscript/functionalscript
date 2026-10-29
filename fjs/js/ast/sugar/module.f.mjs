/**
 * Expand resolved source patterns, defaults and control flow, then give every
 * assignment an immutable value. Source declaration identities and complete
 * write/capture facts reach this pass before generated boundaries exist.
 *
 * @module
 *
 * @import { BindingEvent, BindingId, BindingScope, Block, Function as FastFunction, Operator, Statement, Value } from '../types.ts'
 * @import { ResolvedModule } from '../../../compiler/parser/types.ts'
 * @import { ExpansionPlan, SourceBlock, SourceExit, SourceFunction, SourceOperator, SourceSwitch, SourceValue } from './source.ts'
 * @import { Module } from './types.ts'
 * @import { Context, Environment, Established, Normalized, NormalizedStatement, ReferenceTask, Results, Work } from './private.ts'
 */

import { assert, assertNotNullish } from '../../../asserts/module.f.js'
import { mapOperator, operatorOperands } from '../module.f.mjs'
import { exitValues, hasLoopTransfer } from '../control/module.f.mjs'
import { _hasReturn } from '../memo/cells/module.f.mjs'
import { logicalCondition, logicalValue } from './logical/module.f.js'

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
            const statements = /** @type {readonly NormalizedStatement[]} */ (block.statements).flatMap(statement => statement[0] === 'define' ? [valueTask(statement[2])]
                : statement[0] === 'if' ? [valueTask(statement[2]), blockTask(statement[3]), blockTask(statement[4])]
                : [...statement[1].initial.map(valueTask), blockTask(statement[1].body)])
            pending = [...statements, ...exitValues(block.exit).map(valueTask), ...rest]
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

/**
 * A block normalized as a value, in the scope `outer` that goes on after it:
 * its environment is dropped, so a write in it to a binding established
 * before it would be lost, the scope reading the old value where JavaScript
 * reads the new. The parser refuses every such program — an assignment from
 * a function called where it is written is `reassigned variable captured`,
 * and a loop in one over an outer variable assigns it the same way. Statement
 * conditionals merge outer writes through explicit branch results instead;
 * they do not introduce this value boundary. `inner`
 * is `outer` with the block's own bindings before its statements, a rest
 * parameter's, which the block may assign.
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
        if (fn.parameters.length === 0 && fn.rest === null && !_hasReturn(['block', { ...fn.body, exit: ['yield', exitValues(fn.body.exit)] }], fn.target)) {
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

/** Ordered labels share one discriminant and short-circuit before the next label. @type {(discriminant: BindingId, labels: readonly SourceValue[], value: (source: SourceValue) => Value) => Value} */
const caseCondition = (discriminant, labels, value) => {
    const tests = labels.map(label => /** @type {Value} */ (['===', reference(discriminant), value(label)]))
    const first = assertNotNullish(tests[0], 'switch case without a label')
    return tests.slice(1).reduce((left, right) => logicalValue('||', left, right), first)
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
        const condition = caseCondition(discriminant, arm.labels, value)
        tail = { statements: [], exit: ['yield', [['if', condition, normalizedBlock(arm.body, environment, context).block, tail]]] }
    }
    return { statements: [['define', discriminant, value(exit[1]), 'required'], ...tail.statements], exit: tail.exit }
}

/**
 * A switch is a one-pass transfer region. Its breaks supply normal state;
 * continues retain the enclosing loop and returns retain their function.
 * @type {(source: SourceSwitch, environment: Environment, context: Context) => Normalized}
 */
const normalizedSwitch = (source, environment, context) => {
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
            const value = normalizedValue(inner, context)(statement[0] === 'return' ? statement[2] : statement[1])
            const exit = statement[0] === 'return' ? /** @type {const} */ (['return', statement[1], value]) : /** @type {const} */ (['throw', value])
            return { block: pruneAliases({ statements, exit }, []), environment: inner, normal: false, hasLoopExit: true, hasFunctionExit: true }
        }
        if (statement[0] === 'break' || statement[0] === 'continue') {
            const loop = assertNotNullish(statement[0] === 'break' ? context.breakRegion : context.loop, 'a source transfer has no target')
            assert(loop.target === statement[1], 'a source loop exit targets another loop')
            const values = loop.sources.map(source => lookup(inner, source))
            return { block: pruneAliases({ statements, exit: [statement[0], loop.target, values] }, []), environment: inner, normal: false,
                hasLoopExit: hasLoopExit || loop === context.loop, hasFunctionExit }
        }
        if (statement[0] === 'initialize') {
            const made = expanded(statement[1], normalizedValue(inner, context)(statement[2]), inner, false)
            inner = made.environment
            statements = [...statements, ...made.statements]
            continue
        }
        if (statement[0] === 'write') {
            assert(context.bindings.some(fact => fact.id === statement[1] && fact.isMutable), 'write without complete source analysis')
            const made = establish(inner, statement[1], normalizedValue(inner, context)(statement[2]), false)
            inner = made.environment
            statements = [...statements, ...made.statements]
            continue
        }
        if (statement[0] === 'compound-write') {
            const [, id, tag, operand] = statement
            assert(context.bindings.some(fact => fact.id === id && fact.isMutable), 'compound write without complete source analysis')
            const current = lookup(inner, id)
            const right = normalizedValue(inner, context)(operand)
            if (tag !== '&&' && tag !== '||' && tag !== '??') {
                const made = establish(inner, id, [tag, current, right], false)
                inner = made.environment
                statements = [...statements, ...made.statements]
                continue
            }
            const made = establish(inner, id, right, false)
            /** @type {Block} */
            const selected = { statements: made.statements, exit: ['yield', [lookup(made.environment, id)]] }
            /** @type {Block} */
            const skipped = { statements: [], exit: ['yield', [current]] }
            const result = binding(id.index)
            statements = [...statements, ['if', [result], logicalCondition(tag, current),
                tag === '||' ? skipped : selected, tag === '||' ? selected : skipped]]
            inner = [...inner, [id, reference(result)]]
            continue
        }
        if (statement[0] === 'if') {
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
            statements = [...statements, ['if', results, normalizedValue(inner, context)(statement[1]),
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
        const loop = statement[1]
        const events = eventFacts(loop.events)
        const sources = loopSources(events.references, inner, context)
        const parameters = sources.map(source => binding(source.index))
        const results = sources.map(source => binding(source.index))
        const scope = /** @type {Environment} */ ([...inner, ...sources.map((source, index) => /** @type {const} */ ([source, reference(parameters[index])]))])
        /** @type {NonNullable<Context['loop']>} */
        const transfer = { target: loop.target, sources }
        const step = normalizedBlock(loop.body, scope, { ...context, loop: transfer, breakRegion: transfer }, sources)
        hasLoopExit = hasLoopExit || step.hasFunctionExit
        hasFunctionExit = hasFunctionExit || step.hasFunctionExit
        const condition = normalizedValue(scope, context)(loop.condition)
        /** @type {Block} */
        const continuing = step.block.exit[0] === 'yield'
            ? { ...step.block, exit: ['continue', loop.target, step.normal ? sources.map(source => lookup(step.environment, source)) : parameters.map(reference)] }
            : step.block
        statements = [...statements, ['loop', {
            target: loop.target, parameters, initial: sources.map(source => lookup(inner, source)), results,
            body: condition === true && step.hasLoopExit ? continuing : {
                statements: [['if', [], condition,
                    continuing,
                    { statements: [], exit: ['break', loop.target, parameters.map(reference)] },
                ]],
                exit: ['yield', []],
            },
        }]]
        // Read-only state crosses the loop but introduces no source write at a
        // surrounding value/IIFE boundary. Its established value stays current.
        inner = [...inner, ...sources.flatMap((source, index) => events.writes.includes(source) ? [/** @type {const} */ ([source, reference(results[index])])] : [])]
    }
    const terminal = normalizedExit(source.exit, inner, context)
    return { block: pruneAliases({ statements: [...statements, ...terminal.statements], exit: terminal.exit }, retained.map(id => lookup(inner, id))), environment: inner, normal: terminal.exit[0] === 'yield', hasLoopExit, hasFunctionExit }
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
    /** @type {Context} */
    const context = { bindings: resolved.bindings, scopes: scopesOf(resolved.scope), loop: null, breakRegion: null }
    const normalized = normalizedBlock(resolved.body, environment, context).block
    const prefix = parameters.flatMap((id, i) => representatives[i] === i ? [/** @type {Statement} */ (['define', established[i], reference(id), 'required'])] : [])
    return { parameters, body: { statements: [...prefix, ...normalized.statements], exit: normalized.exit } }
}
