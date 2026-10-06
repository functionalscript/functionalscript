/**
 * Interpret analyzed EDAG into represented values. An invocation threads an
 * immutable cache through demanded operands; an untaken branch establishes
 * nothing. Calls start a fresh cache and retain evaluated captures by identity.
 * Runtime compilation is a separate boundary: this interpreter never makes
 * host callables or converts language values to unknown.
 *
 * @module
 * @import { Exp, ExpOp, StepOver, ItemsOver, Over } from '../types.ts'
 * @import { Analysis, Node, Operand, Step } from '../analysis/types.ts'
 * @import { EdagValue, Values, Property, Array as ValueArray } from '../value/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke } from '../value/call/types.ts'
 * @import { Invocation } from './types.ts'
 * @import { _Cache, _Context, _Evaluation } from './private.ts'
 */

import { assert, assertOk } from '../../asserts/module.f.mjs'
import { isArray } from '../../types/array/module.f.mjs'
import { error, ok, okThen } from '../../types/result/module.f.mjs'
import { analysis, bindingError } from '../analysis/module.f.mjs'
import { array } from '../value/array/module.f.mjs'
import { object } from '../value/object/module.f.mjs'
import { func } from '../value/function/module.f.mjs'
import { call } from '../value/call/module.f.mjs'
import { findProperty, read } from '../value/property/module.f.mjs'
import { throwValue } from '../value/control/module.f.mjs'
import { truthy, typeOf, unary as semanticUnary, binary as semanticBinary } from '../value/semantics/module.f.mjs'
import { unary as numericUnary, binary as numericBinary } from '../value/numeric/module.f.mjs'
import { binary as relational } from '../value/relational/module.f.mjs'
import { toPrimitive, toString } from '../value/convert/module.f.mjs'
import { hasMethod, method } from '../value/method/module.f.mjs'

/** Propagate failures without running the continuation. @type {(evaluation: _Evaluation, next: (v: EdagValue, cache: _Cache) => _Evaluation) => _Evaluation} */
const then = (evaluation, next) => {
    const [cache, result] = evaluation
    const [kind, value] = result
    return kind === 'error' ? evaluation : next(value, cache)
}

/** @type {(value: EdagValue) => boolean} */
const nullish = value => value === null || typeOf(value) === 'undefined'

/** Restore one operand from the already restored prefix of the analysis. @type {(code: readonly ExpOp[], operand: Operand) => Exp} */
const expression = (code, operand) => isArray(operand) ? code[operand[1]] : operand

/** @type {(code: readonly ExpOp[], items: ItemsOver<Operand>) => ItemsOver<Exp>} */
const codeItems = (code, items) => items.map(item => isArray(item) && item[0] === '...'
    ? ['...', expression(code, item[1])] : expression(code, item))

/** @type {(code: readonly ExpOp[], step: Step) => StepOver<Exp>} */
const codeStep = (code, step) => {
    const [tag, operand, continuation] = step
    if (tag === '|.') {
        const key = expression(code, operand)
        return continuation === undefined ? [tag, key] : [tag, key, codeStep(code, continuation)]
    }
    const args = codeItems(code, operand)
    if (tag === '|!()') { return [tag, args] }
    return continuation === undefined ? [tag, args] : [tag, args, codeStep(code, continuation)]
}

/** Restore code, retaining table sharing, for the bodies carried by values. @type {(code: readonly ExpOp[], node: Node) => ExpOp} */
const codeNode = (code, node) => {
    switch (node[0]) {
        case '[]': { return ['[]', codeItems(code, node[1])] }
        case '{}': { return ['{}', node[1].map(p => p[0] === '...'
            ? ['...', expression(code, p[1])]
            : [':', expression(code, p[1]), expression(code, p[2])])] }
        case '=>': { return ['=>', node[1], node[2].map(x => expression(code, x)), expression(code, node[3])] }
        case ',': { return [',', node[1].map(x => expression(code, x))] }
        case '()': { return ['()', expression(code, node[1]), codeItems(code, node[2])] }
        case '?.()': {
            const [, callee, args, continuation] = node
            const head = /** @type {const} */ (['?.()', expression(code, callee), codeItems(code, args)])
            return /** @type {ExpOp} */ (continuation === undefined ? head : [...head, codeStep(code, continuation)])
        }
        case '.': case '?.': {
            const [tag, receiver, key, continuation] = node
            const head = /** @type {const} */ ([tag, expression(code, receiver), expression(code, key)])
            return /** @type {ExpOp} */ (continuation === undefined ? head : [...head, codeStep(code, continuation)])
        }
        default: {
            // All remaining tuples contain only metadata, primitives and
            // operand references, with no lists or continuation productions.
            return /** @type {ExpOp} */ (/** @type {unknown} */ (node.map(part => isArray(part) ? expression(code, part) : part)))
        }
    }
}

/** @type {(a: Analysis, context: _Context, root: Operand) => ValueResult} */
const evaluate = (a, context, root) => {
    const { nodes, shared } = a
    const { args, frame, fixed, rest } = context
    const code = nodes.reduce((/** @type {readonly ExpOp[]} */ prefix, node) => [...prefix, codeNode(prefix, node)], [])
    const moduleArgs = /** @type {ValueArray} */ (['[]', args])

    /** @type {(operand: Operand, cache: _Cache) => _Evaluation} */
    const operand = (operand, cache) => {
        if (!isArray(operand)) { return [cache, ok(operand)] }
        const [, index] = operand
        const established = cache.find(([i]) => i === index)
        if (established !== undefined) { return [cache, ok(established[1])] }
        const [next, result] = operation(nodes[index], cache)
        const [kind, value] = result
        return [kind === 'ok' && shared.includes(index) ? [...next, [index, value]] : next, result]
    }

    /** Resolve spreads before demanding the next item. @type {(items: ItemsOver<Operand>, cache: _Cache) => _Evaluation} */
    const items = (items, cache) => {
        /** @type {Values} */
        let values = []
        for (const item of items) {
            const spread = isArray(item) && item[0] === '...'
            const [next, result] = operand(isArray(item) && item[0] === '...' ? item[1] : item, cache)
            cache = next
            const resolved = array([spread ? ['...', () => result] : () => result])
            const [kind, value] = resolved
            if (kind === 'error') { return [cache, resolved] }
            values = [...values, ...value[1]]
        }
        return [cache, ok(['[]', values])]
    }

    /** @type {(callee: EdagValue, args: ItemsOver<Operand>, cache: _Cache) => _Evaluation} */
    const callValue = (callee, args, cache) => then(items(args, cache), (value, next) =>
        [next, call(ok(callee), /** @type {ValueArray} */ (value)[1].map(v => () => ok(v)), invoke)])

    /** @type {(step: Step | undefined, cache: _Cache) => _Evaluation} */
    const skip = (step, cache) => {
        if (step === undefined) { return [cache, ok(['undefined'])] }
        const [tag, args, continuation] = step
        return tag === '|!()' ? callValue(['undefined'], args, cache) : skip(continuation, cache)
    }

    /** @type {(value: EdagValue, step: Step | undefined, cache: _Cache) => _Evaluation} */
    const continueValue = (value, step, cache) => {
        if (step === undefined) { return [cache, ok(value)] }
        const [tag, arg, continuation] = step
        return tag === '|.'
            ? then(operand(arg, cache), (key, next) => property(value, key, continuation, next))
            : then(callValue(value, arg, cache), (result, next) => continueValue(result, continuation, next))
    }

    /** Resolve a receiver and key before any call arguments. @type {(receiver: EdagValue, key: EdagValue, step: Step | undefined, cache: _Cache) => _Evaluation} */
    const property = (receiver, key, step, cache) => {
        // EDAG indices are string/number literals or an explicit Number
        // operand. Its evaluation has already performed any conversion.
        const name = String(/** @type {string | number} */ (key))
        const value = read(ok(receiver), name)
        if (step === undefined) { return [cache, value] }
        const [tag, arg, continuation] = step
        if (tag === '|.') { return then([cache, value], (v, next) => continueValue(v, step, next)) }
        const own = isArray(receiver) && receiver[0] === '{}' && findProperty(receiver, name) !== undefined
        const builtin = !own && hasMethod(receiver, name)
        return then([cache, value], (callee, next) => {
            if (tag === '|?.()' && !builtin && nullish(callee)) { return skip(continuation, next) }
            return then(items(arg, next), (args, afterArgs) => {
                const values = /** @type {ValueArray} */ (args)[1]
                const result = builtin ? method(receiver, name, values, invoke)
                    : call(ok(callee), values.map(v => () => ok(v)), invoke)
                return then([afterArgs, result], (v, afterCall) => continueValue(v, continuation, afterCall))
            })
        })
    }

    /** @type {(node: Node, cache: _Cache) => _Evaluation} */
    const operation = (node, cache) => {
        switch (node[0]) {
            case 'undefined': { return [cache, ok(['undefined'])] }
            case 'args': { return [cache, ok(moduleArgs)] }
            case 'arg': { return [cache, ok(/** @type {Values} */ (fixed)[node[1]])] }
            case 'rest': { return [cache, ok(/** @type {ValueArray} */ (rest))] }
            case 'frame': { return [cache, ok(frame[node[1]])] }
            case '[]': { return items(node[1], cache) }
            case '{}': {
                /** @type {readonly Property[]} */
                let properties = []
                for (const item of node[1]) {
                    const [next, first] = operand(item[1], cache)
                    cache = next
                    const [kind, value] = first
                    if (kind === 'error') { return [cache, first] }
                    if (item[0] === '...') {
                        const [, spread] = /** @type {readonly ['ok', import('../value/types.ts').Object]} */ (object([['...', () => first]]))
                        properties = [...properties, ...spread[1]]
                    } else {
                        const keyResult = toString(value, invoke)
                        const [keyKind, key] = keyResult
                        if (keyKind === 'error') { return [cache, keyResult] }
                        const [afterValue, result] = operand(item[2], cache)
                        cache = afterValue
                        const [valueKind, v] = result
                        if (valueKind === 'error') { return [cache, result] }
                        properties = [...properties, [':', key, v]]
                    }
                }
                return [cache, object(properties.map(p => () => ok(p)))]
            }
            case '=>': {
                const [, length, captures, body] = node
                return then(items(captures, cache), (value, next) => [next,
                    func(length, /** @type {ValueArray} */ (value)[1].map(v => () => ok(v)), expression(code, body))])
            }
            case '()': { return then(operand(node[1], cache), (callee, next) => callValue(callee, node[2], next)) }
            case '?.()': { return then(operand(node[1], cache), (callee, next) => nullish(callee)
                ? skip(node[3], next)
                : then(callValue(callee, node[2], next), (value, after) => continueValue(value, node[3], after))) }
            case '.': case '?.': { return then(operand(node[1], cache), (receiver, next) =>
                node[0] === '?.' && nullish(receiver) ? skip(node[3], next)
                    : then(operand(node[2], next), (key, after) => property(receiver, key, node[3], after))) }
            case ',': {
                /** @type {_Evaluation} */
                let result = [cache, ok(['undefined'])]
                for (const part of node[1]) {
                    result = operand(part, result[0])
                    if (result[1][0] === 'error') { return result }
                }
                return result
            }
            case 'throw': {
                const [next, result] = operand(node[1], cache)
                return [next, throwValue(result)]
            }
            case '&&': case '||': case '??': { return then(operand(node[1], cache), (value, next) => {
                const take = node[0] === '&&' ? truthy(value) : node[0] === '||' ? !truthy(value) : nullish(value)
                return take ? operand(node[2], next) : [next, ok(value)]
            }) }
            case '?:': { return then(operand(node[1], cache), (value, next) => operand(node[truthy(value) ? 2 : 3], next)) }
            case '!': case 'typeof': {
                const apply = semanticUnary[node[0]]
                return then(operand(node[1], cache), (value, next) => [next, apply(value)])
            }
            case 'String': { return then(operand(node[1], cache), (value, next) => [next, toString(value, invoke)]) }
            case '~': case 'Number': {
                const apply = numericUnary[node[0]]
                return then(operand(node[1], cache), (value, next) =>
                    [next, okThen(apply)(toPrimitive(value, 'number', invoke))])
            }
            case '+': case '-': {
                if (node.length === 2) { return then(operand(node[1], cache), (value, next) =>
                    [next, okThen(numericUnary[node[0]])(toPrimitive(value, 'number', invoke))]) }
                return binary(node, cache)
            }
            default: { return binary(node, cache) }
        }
    }

    /** @type {(node: readonly [import('../types.ts').Op2Id | import('../types.ts').Op12Id, Operand, Operand], cache: _Cache) => _Evaluation} */
    const binary = (node, cache) => then(operand(node[1], cache), (left, next) =>
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

    return operand(root, [])[1]
}

/** Invoke a represented function, with fresh body state and retained captures. @type {Invoke} */
export const invoke = (fn, fixed, rest) => {
    const a = assertOk(analysis(fn))
    const [, index] = /** @type {import('../analysis/types.ts').Ref} */ (a.root)
    const [, , , body] = /** @type {Over<import('../types.ts').Function, Operand>} */ (a.nodes[index])
    return evaluate(a, { frame: fn[2], args: [], fixed, rest }, body)
}

/** Interpret a complete analyzed graph. Binding admission happens once here. @type {(a: Analysis) => (context: Invocation) => ValueResult} */
export const memo = a => {
    const problem = bindingError(a)
    assert(problem === null, problem)
    return context => evaluate(a, { ...context, frame: [] }, a.root)
}
