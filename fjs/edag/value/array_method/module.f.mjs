/**
 * Pure array methods over evaluated EDAG values. New arrays retain their
 * elements' identities; callbacks receive represented values and return
 * represented failures. Sorting is stable for consistent comparators; the
 * [inconsistent-comparator caveat](../../../js/prototype/todo/to-sorted-inconsistent-comparator.md)
 * still applies.
 *
 * @module
 * @import { EdagValue, Values, Array as ValueArray, Function as ValueFunction } from '../types.ts'
 * @import { Invoke } from '../call/types.ts'
 * @import { ValueResult } from '../control/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { join } from '../array/module.f.mjs'
import { at } from '../at/module.f.mjs'
import { call } from '../call/module.f.mjs'
import { toNumber, toString } from '../convert/module.f.mjs'
import { is, isFunction, strictEqual, truthy, typeOf } from '../semantics/module.f.mjs'
import { slice } from '../slice/module.f.mjs'

/** @type {(args: Values, index: number) => EdagValue} */
const argument = (args, index) => args[index] === undefined ? ['undefined'] : args[index]

/** @type {(value: EdagValue) => boolean} */
const absent = value => typeOf(value) === 'undefined'

/** @type {(value: EdagValue) => value is ValueFunction} */
const callable = isFunction

/** ToIntegerOrInfinity after abstract ToNumber. @type {(value: number) => number} */
const integer = value => Math.trunc(value) || 0

/** A relative position clamped to a length. @type {(value: number, length: number) => number} */
const position = (value, length) => value < 0 ? Math.max(length + value, 0) : Math.min(value, length)

/** @type {(fn: ValueFunction, args: Values, invoke: Invoke) => ValueResult} */
const apply = (fn, args, invoke) => call(ok(fn), args.map(value => () => ok(value)), invoke)

/** Flatten represented arrays, leaving all other tuple forms intact. @type {(values: Values, depth: number) => Values} */
const flatten = (values, depth) => values.flatMap(value =>
    depth > 0 && isArray(value) && value[0] === '[]' ? flatten(value[1], depth - 1) : [value])

/** Callback methods sharing element/index/receiver arguments. @type {(receiver: ValueArray, key: string, fn: ValueFunction, invoke: Invoke) => ValueResult} */
const visit = (receiver, key, fn, invoke) => {
    const [, values] = receiver
    const reverse = key === 'findLast' || key === 'findLastIndex'
    /** @type {Values} */
    let output = []
    for (let offset = 0; offset < values.length; offset += 1) {
        const index = reverse ? values.length - 1 - offset : offset
        const element = values[index]
        const result = apply(fn, [element, index, receiver], invoke)
        const [kind, value] = result
        if (kind === 'error') { return result }
        switch (key) {
            case 'map': { output = [...output, value]; break }
            case 'flatMap': { output = [...output, ...flatten([value], 1)]; break }
            case 'filter': { if (truthy(value)) { output = [...output, element] }; break }
            case 'every': { if (!truthy(value)) { return ok(false) }; break }
            default: {
                if (truthy(value)) {
                    return ok(key === 'some' ? true : key === 'findIndex' || key === 'findLastIndex' ? index : element)
                }
            }
        }
    }
    switch (key) {
        case 'map': case 'flatMap': case 'filter': { return ok(['[]', output]) }
        case 'every': { return ok(true) }
        case 'some': { return ok(false) }
        case 'findIndex': case 'findLastIndex': { return ok(-1) }
        default: { return ok(['undefined']) }
    }
}

/** Fold in the chosen direction, distinguishing omitted initial values. @type {(receiver: ValueArray, key: string, args: Values, fn: ValueFunction, invoke: Invoke) => ValueResult} */
const reduce = (receiver, key, args, fn, invoke) => {
    const [, values] = receiver
    if (args.length < 2 && values.length === 0) { return error(['undefined']) }
    const reverse = key === 'reduceRight'
    let accumulated = args.length < 2 ? values[reverse ? values.length - 1 : 0] : args[1]
    for (let offset = args.length < 2 ? 1 : 0; offset < values.length; offset += 1) {
        const index = reverse ? values.length - 1 - offset : offset
        const result = apply(fn, [accumulated, values[index], index, receiver], invoke)
        const [kind, value] = result
        if (kind === 'error') { return result }
        accumulated = value
    }
    return ok(accumulated)
}

/** Search uses SameValueZero for includes and strict equality otherwise. @type {(receiver: ValueArray, key: string, args: Values, invoke: Invoke) => ValueResult} */
const search = (receiver, key, args, invoke) => {
    const [, values] = receiver
    const missing = key === 'includes' ? false : -1
    if (values.length === 0) { return ok(missing) }
    const reverse = key === 'lastIndexOf'
    const result = reverse && args.length < 2 ? ok(values.length - 1) : toNumber(argument(args, 1), invoke)
    const [kind, number] = result
    if (kind === 'error') { return result }
    const start = integer(number)
    const index = reverse ? Math.min(start < 0 ? values.length + start : start, values.length - 1) : position(start, values.length)
    const sought = argument(args, 0)
    for (let i = index; i >= 0 && i < values.length; i += reverse ? -1 : 1) {
        const value = values[i]
        if (strictEqual(value, sought) || key === 'includes' && is(value, sought)) { return ok(key === 'includes' ? true : i) }
    }
    return ok(missing)
}

/** Undefined sorts last without conversion or comparator invocation. @type {(a: EdagValue, b: EdagValue, comparator: EdagValue, invoke: Invoke) => Result<number, EdagValue>} */
const compare = (a, b, comparator, invoke) => {
    if (absent(a)) { return ok(absent(b) ? 0 : 1) }
    if (absent(b)) { return ok(-1) }
    if (callable(comparator)) {
        const result = apply(comparator, [a, b], invoke)
        const [kind, value] = result
        return kind === 'error' ? result : toNumber(value, invoke)
    }
    const left = toString(a, invoke)
    const [leftKind, first] = left
    if (leftKind === 'error') { return left }
    const right = toString(b, invoke)
    const [rightKind, second] = right
    return rightKind === 'error' ? right : ok(first < second ? -1 : first > second ? 1 : 0)
}

/** Stable insertion keeps equal elements in their original order. @type {(values: Values, comparator: EdagValue, invoke: Invoke) => ValueResult} */
const sorted = (values, comparator, invoke) => {
    if (!absent(comparator) && !callable(comparator)) { return error(['undefined']) }
    /** @type {Values} */
    let output = []
    for (const value of values) {
        let index = 0
        for (const previous of output) {
            const result = compare(value, previous, comparator, invoke)
            const [kind, order] = result
            if (kind === 'error') { return result }
            if (order < 0) { break }
            index += 1
        }
        output = [...output.slice(0, index), value, ...output.slice(index)]
    }
    return ok(['[]', output])
}

/** Call an array's admitted method with already evaluated arguments. @type {(receiver: ValueArray, key: string, args: Values, invoke: Invoke) => ValueResult} */
export const arrayMethod = (receiver, key, args, invoke) => {
    const [, values] = receiver
    const first = argument(args, 0)
    const second = argument(args, 1)
    switch (key) {
        case 'concat': { return ok(['[]', [...values, ...flatten(args, 1)]]) }
        case 'toReversed': { return ok(['[]', values.toReversed()]) }
        case 'toSorted': { return sorted(values, first, invoke) }
        case 'includes': case 'indexOf': case 'lastIndexOf': { return search(receiver, key, args, invoke) }
        case 'toString': case 'join': {
            const result = key === 'toString' || absent(first) ? ok(',') : toString(first, invoke)
            const [kind, separator] = result
            return kind === 'error' ? result : join(receiver, separator, value => toString(value, invoke))
        }
        case 'flat': {
            const result = absent(first) ? ok(1) : toNumber(first, invoke)
            const [kind, depth] = result
            return kind === 'error' ? result : ok(['[]', flatten(values, integer(depth))])
        }
        case 'at': case 'slice': case 'with': case 'toSpliced': {
            const result = toNumber(first, invoke)
            const [kind, number] = result
            if (kind === 'error') { return result }
            if (key === 'at') { return at(receiver, number) }
            if (key === 'slice') {
                const end = absent(second) ? ok(/** @type {const} */ (['undefined'])) : toNumber(second, invoke)
                const [endKind, last] = end
                return endKind === 'error' ? end : slice(receiver, number, last)
            }
            const relative = integer(number)
            if (key === 'with') {
                const index = relative < 0 ? values.length + relative : relative
                return index < 0 || index >= values.length ? error(['undefined']) : ok(['[]', [...values.slice(0, index), second, ...values.slice(index + 1)]])
            }
            const start = position(relative, values.length)
            const removed = args.length < 2 ? ok(args.length === 0 ? 0 : values.length - start) : toNumber(second, invoke)
            const [removedKind, count] = removed
            if (removedKind === 'error') { return removed }
            const end = start + Math.min(Math.max(integer(count), 0), values.length - start)
            return ok(['[]', [...values.slice(0, start), ...args.slice(2), ...values.slice(end)]])
        }
        case 'every': case 'filter': case 'find': case 'findIndex': case 'findLast':
        case 'findLastIndex': case 'flatMap': case 'map': case 'some': case 'reduce': case 'reduceRight': {
            if (!callable(first)) { return error(['undefined']) }
            return key === 'reduce' || key === 'reduceRight' ? reduce(receiver, key, args, first, invoke) : visit(receiver, key, first, invoke)
        }
        default: { return error(['undefined']) }
    }
}
