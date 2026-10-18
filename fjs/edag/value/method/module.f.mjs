/**
 * Built-in calls on evaluated values. The interpreter resolves own properties
 * before calling this dispatcher, which asks the runtime its executor was
 * given first — `dot` of [`fjs/js/runtime`](../../../js/runtime/module.f.js),
 * a represented function of the receiver and the key answering the callee,
 * the function of the arguments a body answers, or `undefined` — and
 * answers a name natively otherwise, the host's own built-in on the
 * primitive, or an algorithm over represented values, while the name has
 * no body. An executor given no runtime answers a name without a native
 * with the `TypeError` a VM that binds nothing throws. Conversion and callbacks
 * return represented failures, and array operations retain represented
 * element identities.
 *
 * @module
 * @import { EdagValue, Values, Runtime, Function as ValueFunction } from '../types.ts'
 * @import { Invoke } from '../call/types.ts'
 * @import { ValueResult } from '../control/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { ok, error, mapOk, okThen } from '../../../types/result/module.f.js'
import { allowedCalls, arrayPrototype, stringPrototype, numberPrototype, booleanPrototype, bigintPrototype, functionPrototype, objectPrototype } from '../../../js/prototype/module.f.js'
import { call } from '../call/module.f.mjs'
import { functionAt } from '../property/module.f.mjs'
import { isFunction, typeOf } from '../semantics/module.f.mjs'
import { toNumber, toString } from '../convert/module.f.mjs'
import { arrayMethod } from '../array_method/module.f.mjs'
import { max } from '../../../types/number/max/module.f.js'

/** The prototype a call on each receiver type looks in, by the type's global's name, as `fjs/js/runtime` keys it. */
const prototypes = {
    Object: objectPrototype,
    Array: arrayPrototype,
    String: stringPrototype,
    Number: numberPrototype,
    Boolean: booleanPrototype,
    BigInt: bigintPrototype,
    Function: functionPrototype,
}

/** A non-nullish receiver's type, by its global's name, as `fjs/js/runtime` keys it. @type {(receiver: EdagValue) => keyof typeof prototypes} */
const typeName = receiver => typeof receiver === 'string' ? 'String'
    : typeof receiver === 'number' ? 'Number'
    : typeof receiver === 'boolean' ? 'Boolean'
    : typeof receiver === 'bigint' ? 'BigInt'
    : isArray(receiver) && receiver[0] === '[]' ? 'Array'
    : isFunction(receiver) ? 'Function'
    : 'Object'

/**
 * The callee the runtime's `dot` answers for the receiver and the key: an
 * own property, or the function of the arguments the body of the name
 * answers for the receiver, and `undefined` for neither — or for no
 * runtime, or one without a `dot` function — and the throw where `dot`
 * throws, a body's first step. `dot` is pure, so asking it for the guard
 * of an optional call and again for the call costs and changes nothing.
 * The runtime's shape is `fjs/js/runtime`'s, which its `types.ts` pins.
 *
 * @type {(runtime: Runtime | undefined, key: string, receiver: EdagValue, invoke: Invoke) => Result<EdagValue | undefined, EdagValue>}
 */
const callee = (runtime, key, receiver, invoke) => {
    const dot = functionAt(runtime, ['dot'])
    if (dot === undefined) { return ok(undefined) }
    const answer = call(ok(dot), [() => ok(receiver), () => ok(key)], invoke)
    return answer[0] === 'error' ? answer : ok(absent(answer[1]) ? undefined : answer[1])
}

/**
 * The admitted names this dispatcher has no native implementation of:
 * each is answered by the runtime's `dot`, and by nothing without one. The
 * list is what `native` below leaves out, named once so the guard of an
 * optional call can ask it without running a native.
 */
const left = ['startsWith']

/**
 * Whether `key` is a name a call may make on the receiver: a non-nullish
 * receiver whose type's prototype has the name, and the name one
 * `allowedCalls` admits. What decides that a call goes to this dispatcher
 * rather than to whatever the receiver holds under the key.
 *
 * @type {(receiver: EdagValue, key: string) => boolean}
 */
export const admits = (receiver, key) => {
    if (receiver === null || typeOf(receiver) === 'undefined') { return false }
    return prototypes[typeName(receiver)].some(name => name === key) && allowedCalls.some(name => name === key)
}

/**
 * Whether a call of `key` on the receiver has an implementation bound, the
 * guard of an optional call asks before it evaluates arguments: the name
 * is admitted on the receiver's type, and either the runtime's `dot`
 * answers a callee for the receiver or this dispatcher answers the name
 * natively — the same question NaNVM's `Member::is_nullish` asks of its
 * table and its runtime, and a throw where `dot` throws.
 *
 * @type {(receiver: EdagValue, key: string, runtime: Runtime | undefined, invoke: Invoke) => Result<boolean, EdagValue>}
 */
export const hasMethod = (receiver, key, runtime, invoke) => {
    if (!admits(receiver, key)) { return ok(false) }
    return mapOk(f => f !== undefined || !left.some(name => name === key))(callee(runtime, key, receiver, invoke))
}

/** @type {(args: Values, index: number) => EdagValue} */
const argument = (args, index) => args[index] === undefined ? ['undefined'] : args[index]

/** @type {(value: EdagValue) => boolean} */
const absent = value => typeOf(value) === 'undefined'

/** ToIntegerOrInfinity after ToNumber. @type {(value: number) => number} */
const integer = value => Math.trunc(value) || 0

/** @type {(receiver: number | bigint, key: string, value: EdagValue, invoke: Invoke) => ValueResult} */
const numberMethod = (receiver, key, value, invoke) => {
    if (key === 'toString') {
        const result = absent(value) ? ok(10) : toNumber(value, invoke)
        const [kind, number] = result
        if (kind === 'error') { return result }
        const radix = integer(number)
        return radix < 2 || radix > 36 ? error(['undefined']) : ok(receiver.toString(radix))
    }
    // Only numbers have the three formatting methods.
    const number = /** @type {number} */ (receiver)
    if (absent(value)) {
        return ok(key === 'toFixed' ? number.toFixed() : key === 'toPrecision' ? number.toPrecision() : number.toExponential())
    }
    const result = toNumber(value, invoke)
    const [kind, digits] = result
    if (kind === 'error') { return result }
    const count = integer(digits)
    if (key !== 'toFixed' && !Number.isFinite(number)) { return ok(String(number)) }
    if (count < (key === 'toPrecision' ? 1 : 0) || count > 100) { return error(['undefined']) }
    return ok(key === 'toFixed' ? number.toFixed(count) : key === 'toPrecision' ? number.toPrecision(count) : number.toExponential(count))
}

/** @type {(receiver: string, search: string, replacement: EdagValue, all: boolean, invoke: Invoke) => ValueResult} */
const replace = (receiver, search, replacement, all, invoke) => {
    if (!isFunction(replacement)) {
        const result = toString(replacement, invoke)
        const [kind, text] = result
        if (kind === 'error') { return result }
        return ok(all ? receiver.replaceAll(search, text) : receiver.replace(search, text))
    }
    let text = ''
    let copied = 0
    let start = 0
    for (;;) {
        const at = receiver.indexOf(search, start)
        if (at < 0 || start > receiver.length) { return ok(text + receiver.slice(copied)) }
        const result = call(ok(replacement), [() => ok(search), () => ok(at), () => ok(receiver)], invoke)
        const [kind, value] = result
        if (kind === 'error') { return result }
        const converted = toString(value, invoke)
        const [convertedKind, part] = converted
        if (convertedKind === 'error') { return converted }
        text += receiver.slice(copied, at) + part
        copied = at + search.length
        if (!all) { return ok(text + receiver.slice(copied)) }
        start = at + max(1, search.length)
    }
}

/** The native string built-ins, `undefined` for a name the runtime's body answers. @type {(receiver: string, key: string, args: Values, invoke: Invoke) => ValueResult | undefined} */
const stringMethod = (receiver, key, args, invoke) => {
    const first = argument(args, 0)
    const second = argument(args, 1)
    switch (key) {
        case 'toString': { return ok(receiver) }
        // Supported hosts provide these admitted ES2024 methods; the
        // repository's declaration target still uses the ES2023 library.
        case 'isWellFormed': { return ok(/** @type {string & { isWellFormed(): boolean }} */ (receiver).isWellFormed()) }
        case 'toWellFormed': { return ok(/** @type {string & { toWellFormed(): string }} */ (receiver).toWellFormed()) }
        case 'trim': { return ok(receiver.trim()) }
        case 'trimStart': { return ok(receiver.trimStart()) }
        case 'trimEnd': { return ok(receiver.trimEnd()) }
        // The host's Unicode Default Case Conversion; the language pins its
        // Unicode version, which NaNVM asserts at compile time.
        case 'toLowerCase': { return ok(receiver.toLowerCase()) }
        case 'toUpperCase': { return ok(receiver.toUpperCase()) }
        case 'concat': {
            let text = receiver
            for (const value of args) {
                const result = toString(value, invoke)
                const [kind, part] = result
                if (kind === 'error') { return result }
                text += part
            }
            return ok(text)
        }
        case 'replace': case 'replaceAll': {
            const result = toString(first, invoke)
            const [kind, search] = result
            return kind === 'error' ? result : replace(receiver, search, second, key === 'replaceAll', invoke)
        }
        case 'split': {
            const result = absent(second) ? ok(0xFFFF_FFFF) : toNumber(second, invoke)
            const [kind, limit] = result
            if (kind === 'error') { return result }
            const separator = absent(first) ? ok(undefined) : toString(first, invoke)
            const [separatorKind, text] = separator
            if (separatorKind === 'error') { return separator }
            return ok(['[]', receiver.split(/** @type {string} */ (text), limit >>> 0)])
        }
        case 'at': case 'charAt': case 'charCodeAt': case 'codePointAt': case 'repeat':
        case 'padStart': case 'padEnd': case 'slice': case 'substring': {
            const result = toNumber(first, invoke)
            const [kind, index] = result
            if (kind === 'error') { return result }
            switch (key) {
                case 'at': { return ok(receiver.at(index) ?? ['undefined']) }
                case 'charAt': { return ok(receiver.charAt(index)) }
                case 'charCodeAt': { return ok(receiver.charCodeAt(index)) }
                case 'codePointAt': { return ok(receiver.codePointAt(index) ?? ['undefined']) }
                case 'repeat': {
                    const count = integer(index)
                    return count < 0 || count === Infinity ? error(['undefined']) : ok(receiver.repeat(count))
                }
                case 'padStart': case 'padEnd': {
                    // ToLength can establish a no-op before fill conversion.
                    if (integer(index) <= receiver.length) { return ok(receiver) }
                    const fill = absent(second) ? ok(' ') : toString(second, invoke)
                    const [fillKind, text] = fill
                    if (fillKind === 'error') { return fill }
                    return ok(key === 'padStart' ? receiver.padStart(index, text) : receiver.padEnd(index, text))
                }
                default: {
                    const end = absent(second) ? ok(undefined) : toNumber(second, invoke)
                    const [endKind, last] = end
                    if (endKind === 'error') { return end }
                    return ok(key === 'slice' ? receiver.slice(index, last) : receiver.substring(index, last))
                }
            }
        }
        case 'includes': case 'indexOf': case 'lastIndexOf': case 'endsWith': {
            const result = toString(first, invoke)
            const [kind, search] = result
            if (kind === 'error') { return result }
            const position = absent(second) ? ok(undefined) : toNumber(second, invoke)
            const [positionKind, index] = position
            if (positionKind === 'error') { return position }
            switch (key) {
                case 'includes': { return ok(receiver.includes(search, index)) }
                case 'indexOf': { return ok(receiver.indexOf(search, index)) }
                case 'lastIndexOf': { return ok(receiver.lastIndexOf(search, index)) }
                default: { return ok(receiver.endsWith(search, index)) }
            }
        }
        // `left`'s: the runtime's body, no host built-in.
        default: { return undefined }
    }
}

/** The native answer, `undefined` for a name this dispatcher leaves to the runtime. @type {(receiver: EdagValue, key: string, args: Values, invoke: Invoke) => ValueResult | undefined} */
const native = (receiver, key, args, invoke) => {
    if (typeof receiver === 'string') { return stringMethod(receiver, key, args, invoke) }
    if (typeof receiver === 'number' || typeof receiver === 'bigint') { return numberMethod(receiver, key, argument(args, 0), invoke) }
    if (isArray(receiver) && receiver[0] === '[]') { return arrayMethod(receiver, key, args, invoke) }
    // Ordinary objects inherit the stock method regardless of valueOf.
    return isArray(receiver) && receiver[0] === '{}' ? ok('[object Object]') : toString(receiver, invoke)
}

/**
 * Call an admitted built-in after operands have been evaluated: the callee
 * the runtime's `dot` answers for the receiver, with the arguments, else
 * natively where this dispatcher implements the name, else — no
 * implementation bound, the name not admitted on the receiver's type or
 * `dot` answering `undefined` for it — the `TypeError` of a VM that
 * binds nothing.
 *
 * @type {(receiver: EdagValue, key: string, args: Values, invoke: Invoke, runtime: Runtime | undefined) => ValueResult}
 */
export const method = (receiver, key, args, invoke, runtime) => {
    if (!admits(receiver, key)) { return error(['undefined']) }
    return okThen((/** @type {EdagValue | undefined} */ f) => {
        if (f !== undefined) { return call(ok(f), args.map(v => () => ok(v)), invoke) }
        const answer = native(receiver, key, args, invoke)
        return answer === undefined ? error(['undefined']) : answer
    })(callee(runtime, key, receiver, invoke))
}
