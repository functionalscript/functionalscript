/**
 * Shared represented operations. Each VM supplies operand evaluation and its
 * invocation model; this dispatcher threads that model's immutable state in
 * evaluation order and never materializes host values.
 *
 * A node is dispatched in tail position: a call whose value would be the
 * node's — a bare `()` or `?.()`, or the last call step of a chain, where the
 * callee is a represented function — is prepared and left for the executor
 * to make in the invocation's place, and the arms of `?:`, the last operand
 * of `,` and the selected arm of `?:` are demanded through
 * the executor's `tail`, so the call they leave is the node's outcome. Every
 * other operand is demanded through `operand`, a value.
 *
 * @module
 * @import { ExpOp, StepOver, ItemsOver, Over } from '../types.ts'
 * @import { EdagValue, Values, Property, Array as ValueArray, Closure, Function as ValueFunction, Intrinsic, Runtime, Static } from '../value/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Body, Invoke, Outcome } from '../value/call/types.ts'
 * @import { Context, Evaluation, Evaluator, Tail } from './types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { _ResolvedMember } from './private.ts'
 */

import { isArray } from '../../types/array/module.f.mjs'
import { error, ok, okThen } from '../../types/result/module.f.js'
import { array } from '../value/array/module.f.mjs'
import { object } from '../value/object/module.f.mjs'
import { func } from '../value/function/module.f.mjs'
import { bind, call, invoker, prepare, settle } from '../value/call/module.f.mjs'
import { entry, findProperty, functionAt, hasEntry, read } from '../value/property/module.f.mjs'
import { throwValue } from '../value/control/module.f.mjs'
import { isNullish, truthy, instanceOf, unary as semanticUnary, binary as semanticBinary } from '../value/semantics/module.f.mjs'
import { unary as numericUnary, binary as numericBinary } from '../value/numeric/module.f.mjs'
import { binary as relational } from '../value/relational/module.f.mjs'
import { toPrimitive, toString } from '../value/convert/module.f.mjs'
import { admits, callee, hasMethod, method } from '../value/method/module.f.mjs'
import { staticBody } from '../value/property/module.f.mjs'
import { ownEntries } from '../value/entries/module.f.mjs'
import { isIntrinsic, isStatic, noStatic } from '../module.f.mjs'

/**
 * The failure of an `in` node under an executor whose runtime has no
 * `in` function, or no runtime at all: as {@link noStatic} for a static,
 * the operator refused by name, never answered with a plausible value.
 */
export const noIn = 'no binding for the in operator'

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

/**
 * The `entry` helper called, `['entry']`'s body for the executors that
 * invoke it: the value of the entry its second argument names among the
 * first's enumerable own properties, or `undefined`, the key converted as
 * `Object.getOwnPropertyDescriptor` converts one — through its own
 * `toString`, under `invoke`, where it is an object — after a nullish
 * receiver has failed, as `ToObject` fails before the key is read. The
 * two fixed arguments are the helper's `length`, padded with `undefined`
 * by the call.
 *
 * @type {(fixed: Values, invoke: Invoke) => ValueResult}
 */
export const entryCall = ([receiver, key], invoke) =>
    isNullish(receiver) ? error(['undefined']) : okThen(name => entry(receiver, name))(toString(key, invoke))

/**
 * The `hasEntry` helper called, `['hasEntry']`'s body: whether the entry
 * is there, `true` for one holding `undefined`, which `entryCall` reads
 * as none, the receiver and the key treated as `entryCall` treats them.
 *
 * @type {(fixed: Values, invoke: Invoke) => ValueResult}
 */
export const hasEntryCall = ([receiver, key], invoke) =>
    isNullish(receiver) ? error(['undefined']) : okThen(name => hasEntry(receiver, name))(toString(key, invoke))

/**
 * An intrinsic called, `['slice']`'s body: the member call of the name on
 * the receiver, `s.slice(a, b)`, as an executor answers it with no
 * runtime — the receiver's own property, else the native, else the
 * `TypeError` of calling `undefined` — so the runtime's bodies reach a
 * native through it without naming what the runtime defines
 * (`fjs/js/runtime/README.md`, "Two invariants"). The receiver is the helper's first
 * fixed argument and the native's arguments the rest, as its `length`
 * binds them, `undefined` where the call passed none, as the helper
 * itself passes them on.
 *
 * @type {(fn: Intrinsic, fixed: Values, invoke: Invoke) => ValueResult}
 */
export const intrinsicCall = ([name], [receiver, ...args], invoke) => {
    const own = isArray(receiver) && receiver[0] === '{}' ? findProperty(receiver, name) : undefined
    return own === undefined ? method(receiver, name, args, invoke, undefined) : call(ok(own[2]), args.map(v => () => ok(v)), invoke)
}

/**
 * A static function called, for the executors that invoke one, its
 * arguments all in `args`, since the call binds none for a static:
 * `Object.entries`, which no body defines, on its first argument,
 * `ownEntries`; every other the body the runtime's `static` answers for
 * the id, asked through `invoke`, its arguments bound to the body's
 * `length` as a call binds a closure's, and `run` with the static as its
 * `self`, since the function the body is called as is the built-in; and,
 * with no runtime or no body for the id, the failure naming the static.
 *
 * @type {(runtime: Runtime | undefined, fn: Static, args: ValueArray, run: (body: Closure, fixed: Values, rest: ValueArray, self: Static) => Outcome, invoke: Invoke) => Outcome}
 */
export const staticCall = (runtime, fn, args, run, invoke) => {
    const [, values] = args
    if (fn[0] === 'Object.entries') { return ownEntries(values.length === 0 ? ['undefined'] : values[0]) }
    const body = staticBody(runtime, fn, invoke)
    if (body[0] === 'error') { return body }
    if (body[1] === undefined) { return error(noStatic(fn[0])) }
    const [fixed, rest] = bind(body[1][1], values)
    return run(body[1], fixed, rest, fn)
}

/**
 * The invoker of an executor given `runtime`, the executor naming only
 * `run`, how it walks a closure's body under the context of an
 * invocation: a represented function run with itself as its `self`; a
 * static function's body found in the runtime by `staticCall` and run
 * with the static as its `self`; the `entry` and `hasEntry` helpers and
 * an intrinsic, which have no body, answered in place — and every call a
 * body leaves in tail position, made in its place by `invoker`. The
 * context carries the closure's frame, its bindings and the runtime, so
 * every invocation under this one sees the same runtime.
 *
 * @type {(run: (fn: Closure, context: Context) => Outcome) => (runtime: Runtime | undefined) => Invoke}
 */
export const invokerWith = run => runtime => {
    /** @type {(fn: Closure, fixed: Values, rest: ValueArray, self: ValueFunction) => Outcome} */
    const closure = (fn, fixed, rest, self) => run(fn, { frame: fn[2], args: [], fixed, rest, self, runtime })
    /** @type {Body} */
    const body = (fn, fixed, rest) => fn[0] === 'entry' ? entryCall(fixed, invoke)
        : fn[0] === 'hasEntry' ? hasEntryCall(fixed, invoke)
        : isIntrinsic(fn) ? intrinsicCall(fn, fixed, invoke)
        : isStatic(fn) ? staticCall(runtime, fn, rest, closure, invoke)
        : closure(fn, fixed, rest, fn)
    const invoke = invoker(body)
    return invoke
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

    /** Read first, retaining own-field shadowing and built-in dispatch. @type {(receiver: EdagValue, key: EdagValue) => Result<_ResolvedMember, EdagValue>} */
    const resolveMember = (receiver, key) => {
        // EDAG indices are string/number literals or an explicit Number
        // operand. Its evaluation has already performed any conversion.
        const name = String(/** @type {string | number} */ (key))
        const result = read(ok(receiver), name, runtime, invoke)
        if (result[0] === 'error') { return result }
        const own = isArray(receiver) && receiver[0] === '{}' && findProperty(receiver, name) !== undefined
        return ok({ name, value: result[1], builtin: !own && admits(receiver, name) })
    }

    /** Presence is checked before arguments; callable validation belongs to the call. @type {(receiver: EdagValue, member: _ResolvedMember) => Result<boolean, EdagValue>} */
    const memberPresent = (receiver, { name, value, builtin }) =>
        builtin ? hasMethod(receiver, name, runtime, invoke) : ok(!isNullish(value))

    /** Resolve a receiver and key before any call arguments. @type {(receiver: EdagValue, key: EdagValue, step: StepOver<E> | undefined, state: S) => Tail<S>} */
    const property = (receiver, key, step, state) => {
        const resolved = resolveMember(receiver, key)
        if (resolved[0] === 'error') { return [state, resolved] }
        const member = resolved[1]
        const { name, value, builtin } = member
        if (step === undefined) { return [state, ok(value)] }
        const [tag, arg, continuation] = step
        if (tag === '|.') { return continueValue(value, step, state) }
        /** The call, after its arguments. @type {(callee: EdagValue, state: S) => Tail<S>} */
        const proceed = (callee, next) => then(items(arg, next), (args, afterArgs) => {
            const values = /** @type {ValueArray} */ (args)[1]
            // a built-in method is answered as a value; a represented
            // function's call is left for the executor
            const result = builtin ? method(receiver, name, values, invoke, runtime)
                : prepare(ok(callee), values.map(v => () => ok(v)))
            return continued([afterArgs, result], continuation)
        })
        if (tag !== '|?.()') {
            // the callee is read before the arguments, as `a.f` is
            // before `x` in `a.f(x)`: a built-in's is what the runtime's
            // `dot` answers, which may throw, and is asked again by the
            // call, a body being pure
            const resolved = builtin ? okThen(() => ok(value))(callee(runtime, name, receiver, invoke)) : ok(value)
            return then([state, resolved], (_, after) => proceed(value, after))
        }
        // the guard, before the arguments: an own property that is
        // nullish skips, and so does a built-in no implementation is
        // bound for, which the runtime's body decides for its receiver
        // and may throw deciding
        return then([state, memberPresent(receiver, member)], (has, after) => has ? proceed(value, after) : skip(continuation, after))
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
            case 'hasEntry': { return [state, ok(['hasEntry'])] }
            // an intrinsic as a value: the node, fresh as `entry` is, its
            // call `intrinsicCall`'s; named here as the statics are below
            case 'slice': case 'charCodeAt': { return [state, ok(/** @type {Intrinsic} */ ([node[0]]))] }
            // a static function as a value: the node, the built-in by its
            // name, one function however often it is read, whose call and
            // `length` the body the runtime's `static` answers for its id
            // — `Object.entries`, which no body defines, is answered
            // natively — and with none — no runtime, or no body for the id
            // — the executor fails naming it at the read, never `undefined`
            // and never a plausible value; a throw of `static` is the
            // read's. Named here,
            // unlike everywhere else a node is read, since `Op0` is one
            // tuple whatever its tag: a static `isStatic` turned away would
            // still reach `binary` below as far as `tsc` can tell, and a
            // tag missing here is a type error for the same reason
            case 'Object.is': case 'Object.entries': case 'Object.fromEntries': case 'Number.isInteger': case 'Number.isSafeInteger': case 'Number.isNaN': case 'Number.isFinite': {
                if (node[0] === 'Object.entries') { return [state, ok(/** @type {Static} */ ([node[0]]))] }
                const body = staticBody(runtime, [node[0]], invoke)
                return [state, body[0] === 'error' ? body : body[1] === undefined ? error(noStatic(node[0])) : ok(/** @type {Static} */ ([node[0]]))]
            }
            case '[]': { return items(node[1], state) }
            case '{}': { return properties(node[1], state) }
            case '=>': {
                const [, length, captures, body] = node
                return then(items(captures, state), (value, next) => [next,
                    func(length, /** @type {ValueArray} */ (value)[1].map(v => () => ok(v)), expression(body))])
            }
            case '()': { return then(operand(node[1], state), (callee, next) => callValue(callee, node[2], next)) }
            case '?.()': { return then(operand(node[1], state), (callee, next) => isNullish(callee)
                ? skip(node[3], next)
                : continued(callValue(callee, node[2], next), node[3])) }
            case '.': case '?.': { return then(operand(node[1], state), (receiver, next) =>
                node[0] === '?.' && isNullish(receiver) ? skip(node[3], next)
                    : then(operand(node[2], next), (key, after) => property(receiver, key, node[3], after))) }
            case 'memberPresent': { return then(operand(node[1], state), (receiver, next) =>
                then(operand(node[2], next), (key, after) =>
                    [after, okThen(member => memberPresent(receiver, member))(resolveMember(receiver, key))])) }
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
            // the key is a spelling, read from the node, never evaluated;
            // the answer is the runtime's body, `runtime.in(key, value)`,
            // called as any function is, so its throw is the node's — and
            // with no runtime or no body, the failure naming the operator
            case 'in': {
                const body = functionAt(runtime, ['in'])
                return then(operand(node[2], state), (value, next) =>
                    [next, body === undefined ? error(noIn) : call(ok(body), [() => ok(node[1]), () => ok(value)], invoke)])
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
