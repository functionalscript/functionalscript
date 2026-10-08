/**
 * Shared represented operations. Each VM supplies operand evaluation and its
 * invocation model; this dispatcher threads that model's immutable state in
 * evaluation order and never materializes host values.
 *
 * @module
 * @import { ExpOp, StepOver, ItemsOver, Over } from '../types.ts'
 * @import { EdagValue, Values, Property, Array as ValueArray } from '../value/types.ts'
 * @import { Evaluation, Evaluator } from './types.ts'
 */

import { isArray } from '../../types/array/module.f.mjs'
import { error, ok, okThen } from '../../types/result/module.f.mjs'
import { array } from '../value/array/module.f.mjs'
import { object } from '../value/object/module.f.mjs'
import { func } from '../value/function/module.f.mjs'
import { call } from '../value/call/module.f.mjs'
import { findProperty, read } from '../value/property/module.f.mjs'
import { throwValue } from '../value/control/module.f.mjs'
import { truthy, typeOf, instanceOf, unary as semanticUnary, binary as semanticBinary } from '../value/semantics/module.f.mjs'
import { unary as numericUnary, binary as numericBinary } from '../value/numeric/module.f.mjs'
import { binary as relational } from '../value/relational/module.f.mjs'
import { toPrimitive, toString } from '../value/convert/module.f.mjs'
import { hasMethod, method } from '../value/method/module.f.mjs'

/** Propagate failures without running the continuation.
 * @template S
 * @param {Evaluation<S>} evaluation
 * @param {(v: EdagValue, state: S) => Evaluation<S>} next
 * @returns {Evaluation<S>}
 */
const then = (evaluation, next) => {
    const [state, result] = evaluation
    const [kind, value] = result
    return kind === 'error' ? evaluation : next(value, state)
}

/** @type {(value: EdagValue) => boolean} */
const nullish = value => value === null || typeOf(value) === 'undefined'

/** @template E, S
 * @param {Evaluator<E, S>} evaluator
 * @returns {(node: Over<ExpOp, E>, state: S) => Evaluation<S>}
 */
export const operation = evaluator => {
    const { context, operand, expression, invoke } = evaluator
    const { args, frame, fixed, rest, self } = context
    const moduleArgs = /** @type {ValueArray} */ (['[]', args])

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

    /** @type {(callee: EdagValue, args: ItemsOver<E>, state: S) => Evaluation<S>} */
    const callValue = (callee, args, state) => then(items(args, state), (value, next) =>
        [next, call(ok(callee), /** @type {ValueArray} */ (value)[1].map(v => () => ok(v)), invoke)])

    /** @type {(step: StepOver<E> | undefined, state: S) => Evaluation<S>} */
    const skip = (step, state) => {
        if (step === undefined) { return [state, ok(['undefined'])] }
        const [tag, args, continuation] = step
        return tag === '|!()' ? callValue(['undefined'], args, state) : skip(continuation, state)
    }

    /** @type {(value: EdagValue, step: StepOver<E> | undefined, state: S) => Evaluation<S>} */
    const continueValue = (value, step, state) => {
        if (step === undefined) { return [state, ok(value)] }
        const [tag, arg, continuation] = step
        return tag === '|.'
            ? then(operand(arg, state), (key, next) => property(value, key, continuation, next))
            : then(callValue(value, arg, state), (result, next) => continueValue(result, continuation, next))
    }

    /** Resolve a receiver and key before any call arguments. @type {(receiver: EdagValue, key: EdagValue, step: StepOver<E> | undefined, state: S) => Evaluation<S>} */
    const property = (receiver, key, step, state) => {
        // EDAG indices are string/number literals or an explicit Number
        // operand. Its evaluation has already performed any conversion.
        const name = String(/** @type {string | number} */ (key))
        const value = read(ok(receiver), name)
        if (step === undefined) { return [state, value] }
        const [tag, arg, continuation] = step
        if (tag === '|.') { return then([state, value], (v, next) => continueValue(v, step, next)) }
        const own = isArray(receiver) && receiver[0] === '{}' && findProperty(receiver, name) !== undefined
        const builtin = !own && hasMethod(receiver, name)
        return then([state, value], (callee, next) => {
            if (tag === '|?.()' && !builtin && nullish(callee)) { return skip(continuation, next) }
            return then(items(arg, next), (args, afterArgs) => {
                const values = /** @type {ValueArray} */ (args)[1]
                const result = builtin ? method(receiver, name, values, invoke)
                    : call(ok(callee), values.map(v => () => ok(v)), invoke)
                return then([afterArgs, result], (v, afterCall) => continueValue(v, continuation, afterCall))
            })
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

    /** @type {(node: Over<ExpOp, E>, state: S) => Evaluation<S>} */
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
                : then(callValue(callee, node[2], next), (value, after) => continueValue(value, node[3], after))) }
            case '.': case '?.': { return then(operand(node[1], state), (receiver, next) =>
                node[0] === '?.' && nullish(receiver) ? skip(node[3], next)
                    : then(operand(node[2], next), (key, after) => property(receiver, key, node[3], after))) }
            case ',': {
                /** @type {Evaluation<S>} */
                let result = [state, ok(['undefined'])]
                for (const part of node[1]) {
                    result = operand(part, result[0])
                    if (result[1][0] === 'error') { return result }
                }
                return result
            }
            case 'throw': {
                const [next, result] = operand(node[1], state)
                return [next, throwValue(result)]
            }
            case '&&': case '||': case '??': { return then(operand(node[1], state), (value, next) => {
                const take = node[0] === '&&' ? truthy(value) : node[0] === '||' ? !truthy(value) : nullish(value)
                return take ? operand(node[2], next) : [next, ok(value)]
            }) }
            case '?:': { return then(operand(node[1], state), (value, next) => operand(node[truthy(value) ? 2 : 3], next)) }
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
                case '===': case '!==': case 'is': { return [after, semanticBinary[tag](left, right)] }
                case 'own': { return [after, typeof right === 'string' ? read(ok(left), right) : error(['undefined'])] }
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
