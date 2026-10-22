/**
 * Construct an EDAG from immutable FAST values and explicit evaluations.
 * This pass knows no source declarations or mutable names. Value blocks do
 * not create functions; only ordinary functions establish invocation scopes.
 *
 * @module
 *
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { BindingId, Block, Definition, Exit, Function as FastFunction, Loop, Operator, Value } from '../../js/ast/types.ts'
 * @import { Environment, Lowered, Transfer } from './types.ts'
 * @import { Binding, Results, Scope, ScopedTransfer, Work } from './private.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { mapOperator, operatorOperands } from '../../js/ast/module.f.mjs'
import { scalarLoopOf } from '../../js/ast/loop/module.f.mjs'
import { freeLoopBindings } from './control/module.f.mjs'
import { rootLoopOf, scalarHelper } from './loop/module.f.mjs'
import { step } from '../../common/monoid/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

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

/** Immutable map runs give logarithmic lookup and amortized logarithmic append. @type {(run: ReadonlyMap<BindingId, Binding>) => (scope: Scope['index']) => Scope['index']} */
const appendIndex = step(mergeIndex)

/** Preserve first-entry lookup and every entry's transfer order. @type {(scope: Scope, entry: Binding) => Scope} */
const established = (scope, entry) => ({
    index: bindingOf(scope, entry[0]) === undefined ? appendIndex(new Map([[entry[0], entry]]))(scope.index) : scope.index,
    entries: { head: scope.entries, tail: [entry] },
})

/** @type {(environment: Environment) => Scope} */
const scopeOf = environment => environment.reduce(established, /** @type {Scope} */ ({ index: null, entries: null }))

/** @type {(scope: Scope, binding: BindingId) => Exp} */
const lookup = (scope, binding) => assertNotNullish(bindingOf(scope, binding), 'unbound FAST value')[1]

/** Materialize the public environment only when an external transfer needs it. @type {(transfer: Transfer | undefined) => ScopedTransfer} */
const transferOf = transfer => transfer === undefined ? defaultTransfer : (exit, scope) => transfer(exit, toArray(scope.entries))

/** @type {(m: ExpOp, n: ExpOp) => boolean} */
const sameCapture = (m, n) => m === n || (['arg', 'rest', 'frame', 'self'].includes(m[0]) && m.length === n.length && m.every((x, i) => x === n[i]))

/** @type {(fn: FastFunction, environment: Scope) => Lowered} */
const functionValue = (fn, environment) => {
    const captures = fn.captures.map(capture => scopedValue(capture.value, environment))
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
    const scope = scopeOf(inner)
    const root = rootLoopOf(fn)
    const body = root === null ? scopedBlock(fn.body, scope) : scalarRoot(fn, root, scope)
    return { exp: ['=>', fn.parameters.length, slots, anchored(body)], anchors: floated(captures) }
}

/** The canonical scalar invocation loop reuses its owning function. @type {(fn: FastFunction, loop: Loop, environment: Scope) => Lowered} */
const scalarRoot = (fn, loop, environment) => {
    const parts = scalarLoopOf(loop)
    if (parts === null) { throw 'general structured loop construction is not connected yet' }
    let scope = environment
    for (const statement of fn.body.statements.slice(0, -1)) {
        // rootLoopOf admits only aliases of already established bindings.
        const alias = /** @type {Definition} */ (statement)
        scope = established(scope, [alias[1], scopedValue(alias[2], scope).exp])
    }
    const parameter = scopedValue(loop.initial[0], scope)
    const inner = established(scope, [loop.parameters[0], parameter.exp])
    const self = fn.self === null ? /** @type {Exp} */ (['self']) : lookup(environment, fn.self)
    /** @type {ScopedTransfer} */
    const transition = (exit, scope) => {
        if (exit[0] === 'yield' || exit[0] === 'throw') { return defaultTransfer(exit, scope) }
        // scalarLoopOf fixes the step's transfer; child value regions admit
        // normal yields or failures only, so no other nonlocal exit reaches us.
        const continued = /** @type {Extract<Exit, readonly ['continue', ...unknown[]]>} */ (exit)
        const next = scopedValue(continued[2][0], scope, transition)
        return { exp: ['()', self, [next.exp]], anchors: next.anchors }
    }
    const condition = scopedValue(parts.condition, inner)
    const step = scopedBlock(parts.step, inner, transition)
    return { exp: ['?:', condition.exp, anchored(step), parameter.exp], anchors: [...parameter.anchors, ...condition.anchors] }
}

/** Existing scalar helpers capture already-established immutable values. @type {(loop: Loop, environment: Scope, transfer: ScopedTransfer) => Lowered} */
const scalarLoop = (loop, environment, transfer) => {
    if (scalarLoopOf(loop) === null) { throw 'general structured loop construction is not connected yet' }
    const free = freeLoopBindings(loop)
    if (free.some(binding => bindingOf(environment, binding)?.[2] === 'lazy')) {
        throw 'lazy free loop bindings require shared demand-state lowering'
    }
    const fn = functionValue(scalarHelper(loop), environment)
    const initial = scopedValue(loop.initial[0], environment, transfer)
    return { exp: ['()', fn.exp, [initial.exp]], anchors: [...fn.anchors, ...initial.anchors] }
}

/**
 * Positions whose required evaluations remain in their conditional region.
 * The source expression itself never moves out of that region.
 *
 * @type {(operator: Operator<Value>, index: number) => boolean}
 */
const isLazyOperand = (operator, index) => {
    if (['&&', '||', '??', '?:'].includes(operator[0])) { return index !== 0 }
    if (operator[0] === '?.' || operator[0] === '?.()') { return index !== 0 }
    if (operator[0] === '.') {
        return index >= (operator[2] instanceof Array ? 2 : 1)
    }
    return false
}

/** Immediate eager dependencies retain binding identity, including primitives. @type {(root: Value) => readonly BindingId[]} */
const eagerReferences = root => {
    /** @type {readonly Value[]} */
    let pending = [root]
    /** @type {readonly BindingId[]} */
    let result = []
    while (pending.length !== 0) {
        const [value, ...rest] = pending
        if (value === null || typeof value !== 'object') { pending = rest; continue }
        if (value[0] === 'ref') { result = [...result, value[1]]; pending = rest; continue }
        if (value[0] === 'function') { pending = [...value[1].captures.map(capture => capture.value), ...rest]; continue }
        if (value[0] === 'block') { result = [...result, ...blockReferences(value[1])]; pending = rest; continue }
        if (value[0] === 'if') { pending = [value[1], ...rest]; continue }
        pending = [...operatorOperands(value).filter((_, i) => !isLazyOperand(value, i)), ...rest]
    }
    return result
}

/** @type {(exit: Exit) => readonly BindingId[]} */
const exitReferences = exit => exit[0] === 'yield' ? exit[1].flatMap(eagerReferences)
    : exit[0] === 'break' || exit[0] === 'continue' ? exit[2].flatMap(eagerReferences)
    : exit[0] === 'throw' ? eagerReferences(exit[1]) : eagerReferences(exit[2])

/** @type {(block: Block) => readonly (readonly [BindingId, readonly BindingId[]])[]} */
const dependencies = block => block.statements.flatMap(statement => statement[0] === 'define' ? [[statement[1], eagerReferences(statement[2])]] : [])

/** @type {(relations: readonly (readonly [BindingId, readonly BindingId[]])[], roots: readonly BindingId[]) => readonly BindingId[]} */
const closure = (relations, roots) => {
    let pending = roots
    /** @type {readonly BindingId[]} */
    let found = []
    while (pending.length !== 0) {
        const [id, ...rest] = pending
        if (found.includes(id)) { pending = rest; continue }
        found = [...found, id]
        pending = [...(relations.find(([binding]) => binding === id)?.[1] ?? []), ...rest]
    }
    return found
}

/** Evaluations every normal execution of this block reaches. @type {(block: Block) => readonly BindingId[]} */
const requiredReferences = block => [
    ...exitReferences(block.exit),
    ...block.statements.flatMap(statement => statement[0] === 'define' ? statement[3] === 'required' ? eagerReferences(statement[2]) : []
        : statement[0] === 'block' ? blockReferences(statement[2])
        : statement[0] === 'if' ? eagerReferences(statement[2])
        : [...statement[1].initial.flatMap(eagerReferences), ...freeLoopBindings(statement[1])]),
]

/** A result block's dependencies outside the identities it establishes. @type {(block: Block) => readonly BindingId[]} */
const blockReferences = block => {
    const relations = dependencies(block)
    return closure(relations, requiredReferences(block)).filter(id => !relations.some(([binding]) => binding === id))
}

/** Canonical required roots exclude computations already established eagerly. @type {(block: Block) => readonly BindingId[]} */
const requiredRoots = block => {
    const reached = closure(dependencies(block), requiredReferences(block))
    return block.statements.flatMap(statement => statement[0] === 'define' && statement[3] === 'required' && !reached.includes(statement[1]) ? [statement[1]] : [])
}

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

/**
 * Lower a normalized expression with an explicit operator stack. A reference
 * returns its established node, while separate equal operations stay separate.
 *
 * @type {(root: Value, environment: Scope, transfer?: ScopedTransfer) => Lowered}
 */
const scopedValue = (root, environment, transfer = defaultTransfer) => {
    /** @type {Work} */
    let work = { kind: 'expand', value: root, rest: null }
    /** @type {Results} */
    let results = null
    while (work !== null) {
        if (work.kind === 'expand') {
            const value = work.value
            /** @type {Lowered | null} */
            const leaf = value === undefined ? plain(['undefined'])
                : value === null || typeof value !== 'object' ? plain(value)
                : value[0] === 'ref' ? plain(lookup(environment, value[1]))
                : value[0] === 'function' ? functionValue(value[1], environment)
                : value[0] === 'block' ? lowerRegion(value[1], environment, transfer)
                : value[0] === 'if' ? conditional(value[1], value[2], value[3], environment, transfer)
                : null
            if (leaf !== null) {
                results = { value: leaf, rest: results }
                work = work.rest
                continue
            }
            const operator = /** @type {Operator<Value>} */ (value)
            const operands = operatorOperands(operator)
            work = operands.reduceRight((rest, value) => ({ kind: 'expand', value, rest }), /** @type {Work} */ ({ kind: 'operator', operator, operands, rest: work.rest }))
            continue
        }
        /** @type {readonly Lowered[]} */
        let values = []
        let remaining = results
        for (const _ of work.operands) {
            const result = assertNotNullish(remaining, 'missing FAST operand')
            values = [result.value, ...values]
            remaining = result.rest
        }
        results = { value: combined(work.operator, values), rest: remaining }
        work = work.rest
    }
    return assertNotNullish(results, 'missing FAST result').value
}

/** @type {(condition: Value, then: Block, otherwise: Block, environment: Scope, transfer: ScopedTransfer) => Lowered} */
const conditional = (condition, then, otherwise, environment, transfer) => {
    const test = scopedValue(condition, environment, transfer)
    return { exp: ['?:', test.exp, anchored(lowerRegion(then, environment, transfer)), anchored(lowerRegion(otherwise, environment, transfer))], anchors: test.anchors }
}

/** Baseline value regions have normal results or fail; nonlocal exits follow in E. @type {(block: Block, environment: Scope, transfer: ScopedTransfer) => Lowered} */
const lowerRegion = (block, environment, transfer) => {
    if (block.exit[0] !== 'yield' && block.exit[0] !== 'throw') {
        throw 'nonlocal transfers in value regions require structured completion lowering'
    }
    return scopedBlock(block, environment, transfer)
}

/** One result stays scalar; other signatures use their declared order. @type {(values: readonly Lowered[]) => Lowered} */
const resultsValue = values => ({ exp: values.length === 1 ? values[0].exp : ['[]', values.map(value => value.exp)], anchors: floated(values) })

/** @type {ScopedTransfer} */
const defaultTransfer = (exit, environment) => {
    if (exit[0] === 'yield') { return resultsValue(exit[1].map(value => scopedValue(value, environment))) }
    if (exit[0] === 'return') { return scopedValue(exit[2], environment) }
    if (exit[0] === 'throw') {
        const value = scopedValue(exit[1], environment)
        return { exp: ['throw', value.exp], anchors: value.anchors }
    }
    throw 'a loop transfer requires its owning loop'
}

/** Bind ordered results without changing their established identity. @type {(bindings: readonly BindingId[], exp: Exp) => Environment} */
const resultBindings = (bindings, exp) => bindings.map((binding, i) => [binding, bindings.length === 1 ? exp : ['.', exp, i]])

/**
 * Required definitions retain their position as eager anchors. Lazy definitions
 * provide node identity and establish no extra evaluation by themselves.
 *
 * @type {(block: Block, environment: Scope, transfer?: ScopedTransfer) => Lowered}
 */
const scopedBlock = (block, environment, transfer = defaultTransfer) => {
    let scope = environment
    const required = requiredRoots(block)
    const reached = closure(dependencies(block), requiredReferences(block))
    /** @type {readonly Exp[]} */
    let anchors = []
    for (const statement of block.statements) {
        if (statement[0] === 'define') {
            const value = scopedValue(statement[2], scope, transfer)
            const initializer = statement[2]
            const deferred = statement[3] === 'lazy' && initializer !== null && typeof initializer === 'object'
                && (initializer[0] !== 'ref' || bindingOf(scope, initializer[1])?.[2] === 'lazy')
            scope = established(scope, deferred ? [statement[1], anchored(value), 'lazy'] : [statement[1], statement[3] === 'lazy' ? anchored(value) : value.exp])
            if (statement[3] === 'required') {
                anchors = [...anchors, ...value.anchors, ...(required.includes(statement[1]) ? [value.exp] : [])]
            }
            continue
        }
        if (statement[0] === 'loop') {
            const value = scalarLoop(statement[1], scope, transfer)
            scope = established(scope, [statement[1].results[0], value.exp])
            anchors = [...anchors, ...value.anchors, ...(!reached.includes(statement[1].results[0]) ? [value.exp] : [])]
            continue
        }
        const value = statement[0] === 'block' ? lowerRegion(statement[2], scope, transfer)
            : conditional(statement[2], statement[3], statement[4], scope, transfer)
        scope = resultBindings(statement[1], value.exp).reduce(established, scope)
        anchors = [...anchors, ...value.anchors, value.exp]
    }
    const result = transfer(block.exit, scope)
    return { exp: result.exp, anchors: [...anchors, ...result.anchors] }
}

/** Lower a value under externally established bindings. @type {(root: Value, environment: Environment, transfer?: Transfer) => Lowered} */
export const lowerValue = (root, environment, transfer) => scopedValue(root, scopeOf(environment), transferOf(transfer))

/** Construct a block without rescanning accumulated bindings on every read. @type {(block: Block, environment?: Environment, transfer?: Transfer) => Lowered} */
export const lowerBlock = (block, environment = [], transfer) => scopedBlock(block, scopeOf(environment), transferOf(transfer))

/** The graph at a normalized FAST block's result boundary. @type {(block: Block, environment?: Environment) => Exp} */
export const fromFast = (block, environment = []) => anchored(lowerBlock(block, environment))
