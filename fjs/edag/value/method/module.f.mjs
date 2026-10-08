/**
 * Built-in calls on evaluated values. The interpreter resolves own properties
 * before calling this dispatcher. Conversion and callbacks return represented
 * failures, and array operations retain represented element identities.
 *
 * @module
 * @import { EdagValue, Values } from '../types.ts'
 * @import { Invoke } from '../call/types.ts'
 * @import { ValueResult } from '../control/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { allowedCalls, arrayPrototype, stringPrototype, numberPrototype, booleanPrototype, bigintPrototype, functionPrototype, objectPrototype } from '../../../js/prototype/module.f.js'
import { call } from '../call/module.f.mjs'
import { isFunction, typeOf } from '../semantics/module.f.mjs'
import { toNumber, toString } from '../convert/module.f.mjs'
import { arrayMethod } from '../array_method/module.f.mjs'

/** Built-in availability, before an optional call evaluates arguments. @type {(receiver: EdagValue, key: string) => boolean} */
export const hasMethod = (receiver, key) => {
    if (receiver === null || typeOf(receiver) === 'undefined') { return false }
    const prototype = typeof receiver === 'string' ? stringPrototype
        : typeof receiver === 'number' ? numberPrototype
        : typeof receiver === 'boolean' ? booleanPrototype
        : typeof receiver === 'bigint' ? bigintPrototype
        : isArray(receiver) && receiver[0] === '[]' ? arrayPrototype
        : isFunction(receiver) ? functionPrototype
        : objectPrototype
    return prototype.some(name => name === key) && allowedCalls.some(name => name === key)
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
        start = at + Math.max(1, search.length)
    }
}

/** @type {(receiver: string, key: string, args: Values, invoke: Invoke) => ValueResult} */
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
        default: {
            // includes, indexOf, lastIndexOf, startsWith and endsWith.
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
                case 'startsWith': { return ok(receiver.startsWith(search, index)) }
                default: { return ok(receiver.endsWith(search, index)) }
            }
        }
    }
}

/** Call an admitted built-in after operands have been evaluated. @type {(receiver: EdagValue, key: string, args: Values, invoke: Invoke) => ValueResult} */
export const method = (receiver, key, args, invoke) => {
    if (!hasMethod(receiver, key)) { return error(['undefined']) }
    if (typeof receiver === 'string') { return stringMethod(receiver, key, args, invoke) }
    if (typeof receiver === 'number' || typeof receiver === 'bigint') { return numberMethod(receiver, key, argument(args, 0), invoke) }
    if (isArray(receiver) && receiver[0] === '[]') { return arrayMethod(receiver, key, args, invoke) }
    // Ordinary objects inherit the stock method regardless of valueOf.
    return isArray(receiver) && receiver[0] === '{}' ? ok('[object Object]') : toString(receiver, invoke)
}
