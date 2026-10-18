/**
 * Shared represented operations. Each VM supplies operand evaluation and its
 * invocation model; this dispatcher threads that model's immutable state in
 * evaluation order and never materializes host values.
 *
 * A node is dispatched in tail position: a call whose value would be the
 * node's — a bare `()` or `?.()`, or the last call step of a chain, where the
 * callee is a represented function — is prepared and left for the executor
 * to make in the invocation's place, and the arms of `?:`, the last operand
 * of `,` and the right operand of `&&`, `||` and `??` are demanded through
 * the executor's `tail`, so the call they leave is the node's outcome. Every
 * other operand is demanded through `operand`, a value.
 *
 * @module
 * @import { ExpOp, StepOver, ItemsOver, Over } from '../types.ts'
 * @import { EdagValue, Values, Property, Array as ValueArray, Closure, Runtime, Static } from '../value/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke, Outcome } from '../value/call/types.ts'
 * @import { Evaluation, Evaluator, Tail } from './types.ts'
 */

import { isArray } from '../../types/array/module.f.mjs'
import { error, ok, okThen } from '../../types/result/module.f.js'
import { array } from '../value/array/module.f.mjs'
import { object } from '../value/object/module.f.mjs'
import { func } from '../value/function/module.f.mjs'
import { bind, prepare, settle } from '../value/call/module.f.mjs'
import { entry, findProperty, functionAt, read } from '../value/property/module.f.mjs'
import { throwValue } from '../value/control/module.f.mjs'
import { truthy, typeOf, instanceOf, unary as semanticUnary, binary as semanticBinary } from '../value/semantics/module.f.mjs'
import { unary as numericUnary, binary as numericBinary } from '../value/numeric/module.f.mjs'
import { binary as relational } from '../value/relational/module.f.mjs'
import { toPrimitive, toString } from '../value/convert/module.f.mjs'
import { admits, hasMethod, method } from '../value/method/module.f.mjs'
import { ownEntries } from '../value/entries/module.f.mjs'
import { noStatic, staticPath } from '../module.f.mjs'

/** Propagate failures without running the continuation.
 * @template S
 * @template {Tail<S>} R
 * @param {Evaluation<S>} evaluation
 * @param {(v: EdagValue, state: S) => R} next
 * @returns {R | Evaluation<S>}
 */
const then = (evaluation, next) => {
    const [state, result] = evaluation
    const [kind, value] = result
    return kind === 'error' ? evaluation : next(value, state)
}

/** @type {(value: EdagValue) => boolean} */
const nullish = value => value === null || typeOf(value) === 'undefined'

/**
 * The `entry` helper called, `['entry']`'s body for the executors that
 * invoke it: the entry its second argument names among the first's
 * enumerable own properties, the key converted as
 * `Object.getOwnPropertyDescriptor` converts one — through its own
 * `toString`, under `invoke`, where it is an object — after a nullish
 * receiver has failed, as `ToObject` fails before the key is read. The
 * two fixed arguments are the helper's `length`, padded with `undefined`
 * by the call.
 *
 * @type {(fixed: Values, invoke: Invoke) => ValueResult}
 */
export const entryCall = ([receiver, key], invoke) =>
    nullish(receiver) ? error(['undefined']) : okThen(name => entry(receiver, name))(toString(key, invoke))

/**
 * A static function called, for the executors that invoke one, its
 * arguments all in `args`, since the call binds none for a static:
 * `Object.entries`, which no body defines, on its first argument,
 * `ownEntries`; every other the body the runtime's `static` section holds
 * at its path, its arguments bound to the body's `length` as a call
 * binds a closure's, and `run` with the static as its `self`, since the
 * function the body is called as is the built-in, as NaNVM's item answers
 * its own accessor; and, with no runtime or none at the path, the failure
 * naming the static.
 *
 * @type {(runtime: Runtime | undefined, fn: Static, args: ValueArray, run: (body: Closure, fixed: Values, rest: ValueArray, self: Static) => Outcome) => Outcome}
 */
export const staticCall = (runtime, fn, args, run) => {
    const [, values] = args
    if (fn[0] === 'Object.entries') { return ownEntries(values.length === 0 ? ['undefined'] : values[0]) }
    const body = /** @type {Closure | undefined} */ (functionAt(runtime, ['static', ...staticPath(fn[0])]))
    if (body === undefined) { return error(noStatic(fn[0])) }
    const [fixed, rest] = bind(body[1], values)
    return run(body, fixed, rest, fn)
}

/** A node in tail position: its value, or the call it leaves for the executor.
 * @template E, S
 * @param {Evaluator<E, S>} evaluator
 * @returns {(node: Over<ExpOp, E>, state: S) => Tail<S>}
 */
export const operation = evaluator => {
    const { context, operand, tail, expression, invoke } = evaluator
    const { args, frame, fixed, rest, self, runtime } = context
    const moduleArgs = /** @type {ValueArray} */ (['[]', args])
    const made = settle(invoke)

    /** Make the call a tail evaluation left, where its value is needed now. @type {(evaluation: Tail<S>) => Evaluation<S>} */
    const settled = ([state, outcome]) => [state, made(outcome)]

    /** Resolve spreads before demanding the next item. @type {(items: ItemsOver<E>, state: S) => Evaluation<S>} */
    const items = (items, state) => {
        /** @type {Values} */
        let values = []
        for (const item of items) {
            const spread = isArray(item) && item[0] === '...'
            const [next, result] = operand(/** @type {E} */ (spread ? item[1] : item), state)
            state = next
            const resolved = array([spread ? ['...', () => result] : () => result])
            const [kind, value] = resolved
            if (kind === 'error') { return [state, resolved] }
            values = [...values, ...value[1]]
        }
        return [state, ok(['[]', values])]
    }

    /** The call prepared and left, after its arguments. @type {(callee: EdagValue, args: ItemsOver<E>, state: S) => Tail<S>} */
    const callValue = (callee, args, state) => then(items(args, state), (value, next) =>
        [next, prepare(ok(callee), /** @type {ValueArray} */ (value)[1].map(v => () => ok(v)))])

    /** Continue past a call step, or leave its call where no step follows. @type {(after: Tail<S>, continuation: StepOver<E> | undefined) => Tail<S>} */
    const continued = (after, continuation) => continuation === undefined ? after
        : then(settled(after), (value, next) => continueValue(value, continuation, next))

    /** @type {(step: StepOver<E> | undefined, state: S) => Tail<S>} */
    const skip = (step, state) => {
        if (step === undefined) { return [state, ok(['undefined'])] }
        const [tag, args, continuation] = step
        return tag === '|!()' ? callValue(['undefined'], args, state) : skip(continuation, state)
    }

    /** @type {(value: EdagValue, step: StepOver<E>, state: S) => Tail<S>} */
    const continueValue = (value, step, state) => {
        const [tag, arg, continuation] = step
        return tag === '|.'
            ? then(operand(arg, state), (key, next) => property(value, key, continuation, next))
            : continued(callValue(value, arg, state), continuation)
    }

    /** Resolve a receiver and key before any call arguments. @type {(receiver: EdagValue, key: EdagValue, step: StepOver<E> | undefined, state: S) => Tail<S>} */
    const property = (receiver, key, step, state) => {
        // EDAG indices are string/number literals or an explicit Number
        // operand. Its evaluation has already performed any conversion.
        const name = String(/** @type {string | number} */ (key))
        const value = read(ok(receiver), name, runtime)
        if (step === undefined) { return [state, value] }
        const [tag, arg, continuation] = step
        if (tag === '|.') { return then([state, value], (v, next) => continueValue(v, step, next)) }
        const own = isArray(receiver) && receiver[0] === '{}' && findProperty(receiver, name) !== undefined
        const builtin = !own && admits(receiver, name)
        /** The call, after its arguments. @type {(callee: EdagValue, state: S) => Tail<S>} */
        const proceed = (callee, next) => then(items(arg, next), (args, afterArgs) => {
            const values = /** @type {ValueArray} */ (args)[1]
            // a built-in method is answered as a value; a represented
            // function's call is left for the executor
            const result = builtin ? method(receiver, name, values, invoke, runtime)
                : prepare(ok(callee), values.map(v => () => ok(v)))
            return continued([afterArgs, result], continuation)
        })
        return then([state, value], (callee, next) => {
            if (tag !== '|?.()') { return proceed(callee, next) }
            // the guard, before the arguments: an own property that is
            // nullish skips, and so does a built-in no implementation is
            // bound for, which the runtime's body decides for its receiver
            // and may throw deciding
            const guard = builtin ? hasMethod(receiver, name, runtime, invoke) : ok(!nullish(callee))
            return then([next, guard], (has, after) => has ? proceed(callee, after) : skip(continuation, after))
        })
    }

    /** @type {(entries: Over<import('../types.ts').Object, E>[1], state: S) => Evaluation<S>} */
    const properties = (entries, state) => {
        /** @type {readonly Property[]} */
        let properties = []
        for (const item of entries) {
            const [next, first] = operand(item[1], state)
            state = next
            const [kind, value] = first
            if (kind === 'error') { return [state, first] }
            if (item[0] === '...') {
                const [, spread] = /** @type {readonly ['ok', import('../value/types.ts').Object]} */ (object([['...', () => first]]))
                properties = [...properties, ...spread[1]]
            } else {
                const keyResult = toString(value, invoke)
                const [keyKind, key] = keyResult
                if (keyKind === 'error') { return [state, keyResult] }
                const [afterValue, result] = operand(item[2], state)
                state = afterValue
                const [valueKind, v] = result
                if (valueKind === 'error') { return [state, result] }
                properties = [...properties, [':', key, v]]
            }
    }
    return [state, object(properties.map(p => () => ok(p)))]
    }

    /** @type {(node: Over<ExpOp, E>, state: S) => Tail<S>} */
    const operation = (node, state) => {
        switch (node[0]) {
            case 'undefined': { return [state, ok(['undefined'])] }
            case 'args': { return [state, ok(moduleArgs)] }
            case 'arg': { return [state, ok(/** @type {Values} */ (fixed)[node[1]])] }
            case 'rest': { return [state, ok(/** @type {ValueArray} */ (rest))] }
            case 'frame': { return [state, ok(frame[node[1]])] }
            // the function itself, the value the call was made on: the
            // analysis refuses a `self` outside a function, so none is a
            // precondition this evaluator restates as a thrown `undefined`
            case 'self': { return [state, self === undefined ? error(['undefined']) : ok(self)] }
            // the helper as a value: a fresh function each time, as `=>` makes one
            case 'entry': { return [state, ok(['entry'])] }
            // a static function as a value: the node, the built-in by its
            // name, one function however often it is read, whose call and
            // `length` the body the runtime's `static` section holds at
            // its path answers — `Object.entries`, which no body defines,
            // is answered natively — and with none — no runtime, or one
            // without the path — the executor fails naming it at the read,
            // never `undefined` and never a plausible value. Named here,
            // unlike everywhere else a node is read, since `Op0` is one
            // tuple whatever its tag: a static `isStatic` turned away would
            // still reach `binary` below as far as `tsc` can tell, and a
            // tag missing here is a type error for the same reason
            case 'Object.is': case 'Object.entries': case 'Number.isInteger': case 'Number.isSafeInteger': case 'Number.isNaN': case 'Number.isFinite': {
                const bound = node[0] === 'Object.entries' || functionAt(runtime, ['static', ...staticPath(node[0])]) !== undefined
                return [state, bound ? ok(/** @type {Static} */ ([node[0]])) : error(noStatic(node[0]))]
            }
            case '[]': { return items(node[1], state) }
            case '{}': { return properties(node[1], state) }
            case '=>': {
                const [, length, captures, body] = node
                return then(items(captures, state), (value, next) => [next,
                    func(length, /** @type {ValueArray} */ (value)[1].map(v => () => ok(v)), expression(body))])
            }
            case '()': { return then(operand(node[1], state), (callee, next) => callValue(callee, node[2], next)) }
            case '?.()': { return then(operand(node[1], state), (callee, next) => nullish(callee)
                ? skip(node[3], next)
                : continued(callValue(callee, node[2], next), node[3])) }
            case '.': case '?.': { return then(operand(node[1], state), (receiver, next) =>
                node[0] === '?.' && nullish(receiver) ? skip(node[3], next)
                    : then(operand(node[2], next), (key, after) => property(receiver, key, node[3], after))) }
            case ',': {
                const [, parts] = node
                const last = parts.at(-1)
                if (last === undefined) { return [state, ok(['undefined'])] }
                /** @type {Evaluation<S>} */
                let result = [state, ok(['undefined'])]
                for (const part of parts.slice(0, -1)) {
                    result = operand(part, result[0])
                    if (result[1][0] === 'error') { return result }
                }
                return tail(last, result[0])
            }
            case 'throw': {
                const [next, result] = operand(node[1], state)
                return [next, throwValue(result)]
            }
            case '&&': case '||': case '??': { return then(operand(node[1], state), (value, next) => {
                const take = node[0] === '&&' ? truthy(value) : node[0] === '||' ? !truthy(value) : nullish(value)
                return take ? tail(node[2], next) : [next, ok(value)]
            }) }
            case '?:': { return then(operand(node[1], state), (value, next) => tail(node[truthy(value) ? 2 : 3], next)) }
            case '!': case 'typeof': {
                const apply = semanticUnary[node[0]]
                return then(operand(node[1], state), (value, next) => [next, apply(value)])
            }
            // the constructor is a name, read from the node, never evaluated
            case 'instanceof': {
                const test = instanceOf[node[2]]
                return then(operand(node[1], state), (value, next) => [next, ok(test(value))])
            }
            case 'String': { return then(operand(node[1], state), (value, next) => [next, toString(value, invoke)]) }
            case '~': case 'Number': {
                const apply = numericUnary[node[0]]
                return then(operand(node[1], state), (value, next) =>
                    [next, okThen(apply)(toPrimitive(value, 'number', invoke))])
            }
            case '+': case '-': {
                if (node.length === 2) { return then(operand(node[1], state), (value, next) =>
                    [next, okThen(numericUnary[node[0]])(toPrimitive(value, 'number', invoke))]) }
                return binary(node, state)
            }
            default: { return binary(node, state) }
        }
    }

    /** @type {(node: readonly [import('../types.ts').Op2Id | import('../types.ts').Op12Id, E, E], state: S) => Evaluation<S>} */
    const binary = (node, state) => then(operand(node[1], state), (left, next) =>
        then(operand(node[2], next), (right, after) => {
            const [tag] = node
            switch (tag) {
                case '===': case '!==': { return [after, semanticBinary[tag](left, right)] }
                default: {
                    const a = toPrimitive(left, 'number', invoke)
                    const [kind, x] = a
                    if (kind === 'error') { return [after, a] }
                    const b = toPrimitive(right, 'number', invoke)
                    const [other, y] = b
                    if (other === 'error') { return [after, b] }
                    switch (tag) {
                        case '<': case '<=': case '>': case '>=': { return [after, relational[tag](x, y)] }
                        default: { return [after, numericBinary[/** @type {keyof typeof numericBinary} */ (tag)](x, y)] }
                    }
                }
            }
        }))


    return operation
}
