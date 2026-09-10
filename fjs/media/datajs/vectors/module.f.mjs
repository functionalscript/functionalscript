/**
 * What a proof over the DataJS conformance corpus compares with: the graph
 * a vector expects against the graph an implementation produced, sharing
 * included.
 *
 * A vector's expected graph is a value of the data model in which sharing is
 * spelled by reference — one `const` used twice — so the comparison is a
 * bijection between the containers of the two graphs, not structural
 * equality: where the expected graph reaches one node twice the actual must
 * too, and where it reaches two distinct nodes the actual may not merge them.
 * Leaves compare by `Object.is`, so that `-0` and `0` differ and `NaN` is
 * itself, and an object's members compare in observable order.
 *
 * The walk is over an explicit stack, so a graph nested as deep as a vector
 * allows costs no call stack.
 *
 * @module
 *
 * @import { Unknown } from '../types.ts'
 * @import { _Container, _Pair, _Stack, _State, _Task } from './private.ts'
 */

const { is, keys } = Object

/** @type {(path: string, what: string) => string} */
const at = (path, what) => `at ${path}: ${what}`

/** @type {(value: Unknown) => string} */
const show = value =>
    is(value, -0) ? '-0' :
    typeof value === 'bigint' ? `${value}n` :
    typeof value === 'string' ? JSON.stringify(value) :
    value instanceof Array ? 'an array' :
    typeof value === 'object' && value !== null ? 'an object' :
    String(value)

/**
 * The pair the expected container is in, if any: the same expected node
 * reached before, with the actual node it corresponded to then.
 *
 * @type {(pairs: readonly _Pair[], expected: object) => _Pair | undefined}
 */
const byExpected = (pairs, expected) => pairs.find(([e]) => e === expected)

/** @type {(pairs: readonly _Pair[], actual: object) => _Pair | undefined} */
const byActual = (pairs, actual) => pairs.find(([, a]) => a === actual)

/**
 * The tasks the children of two containers of one kind make, pushed onto
 * the stack, or the first difference between the containers' shapes.
 *
 * @type {(stack: _Stack, path: string, expected: _Container, actual: _Container) => _Stack | string}
 */
const children = (stack, path, expected, actual) => {
    if (expected instanceof Array) {
        if (!(actual instanceof Array)) { return at(path, `expected an array, got ${show(actual)}`) }
        if (expected.length !== actual.length) {
            return at(path, `expected ${expected.length} elements, got ${actual.length}`)
        }
        let result = stack
        for (let i = expected.length - 1; i >= 0; i -= 1) {
            result = { top: [`${path}[${i}]`, expected[i], actual[i]], rest: result }
        }
        return result
    }
    if (actual instanceof Array) { return at(path, `expected an object, got ${show(actual)}`) }
    const expectedKeys = keys(expected)
    const actualKeys = keys(actual)
    if (expectedKeys.length !== actualKeys.length) {
        return at(path, `expected ${expectedKeys.length} members, got ${actualKeys.length}`)
    }
    // the keys first, in document order, so that the first difference is the
    // first member that is out of place; then the members, last pushed first
    for (let i = 0; i < expectedKeys.length; i += 1) {
        if (expectedKeys[i] !== actualKeys[i]) {
            return at(path, `expected member ${i} to be ${JSON.stringify(expectedKeys[i])}, got ${JSON.stringify(actualKeys[i])}`)
        }
    }
    let result = stack
    for (let i = expectedKeys.length - 1; i >= 0; i -= 1) {
        const key = expectedKeys[i]
        result = { top: [`${path}[${JSON.stringify(key)}]`, expected[key], actual[key]], rest: result }
    }
    return result
}

/**
 * One comparison: a leaf by `Object.is`; a container by the bijection so
 * far, and, when it is new, by its children.
 *
 * @type {(state: _State, task: _Task) => _State | string}
 */
const compare = ([stack, pairs], task) => {
    const [path, expected, actual] = task
    if (typeof expected !== 'object' || expected === null) {
        return is(expected, actual) ? [stack, pairs] : at(path, `expected ${show(expected)}, got ${show(actual)}`)
    }
    if (typeof actual !== 'object' || actual === null) {
        return at(path, `expected ${show(expected)}, got ${show(actual)}`)
    }
    const known = byExpected(pairs, expected)
    if (known !== undefined) {
        return known[1] === actual ? [stack, pairs] : at(path, 'expected the node reached before, got another')
    }
    if (byActual(pairs, actual) !== undefined) {
        return at(path, 'expected a node of its own, got one reached before')
    }
    const next = children(stack, path, expected, actual)
    return typeof next === 'string' ? next : [next, [...pairs, [expected, actual]]]
}

/**
 * The first difference between the graph a vector expects and the graph an
 * implementation produced, in document order, or `null` where there is
 * none. The message names the path of the difference from the root, `$`.
 *
 * @type {(expected: Unknown) => (actual: Unknown) => string | null}
 */
export const difference = expected => actual => {
    /** @type {_State | string} */
    let state = [{ top: ['$', expected, actual], rest: null }, []]
    while (true) {
        if (typeof state === 'string') { return state }
        const [stack, pairs] = state
        if (stack === null) { return null }
        state = compare([stack.rest, pairs], stack.top)
    }
}
