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
 * itself; an object is a plain one, under `Object.prototype` or `null`, and
 * its members compare in observable order.
 *
 * The walk is over an explicit stack, so a graph nested as deep as a vector
 * allows costs no call stack.
 *
 * `bytes` is the other thing a proof over the corpus needs: the bytes a
 * byte-form document spells, from the one hex spelling the schema admits.
 *
 * @module
 *
 * @import { TreeArray } from '../../json/types.ts'
 * @import { Primitive, Unknown } from '../types.ts'
 * @import { _Container, _Member, _Pair, _Stack, _State, _Task } from './private.ts'
 */

const { is, keys, hasOwn, getPrototypeOf, getOwnPropertyDescriptor, getOwnPropertyNames, getOwnPropertySymbols, prototype: objectPrototype } = Object

/**
 * An own member of an actual container, read without running anything: its
 * value where it is a data property, and otherwise what stands in its place
 * — a hole, which no expected graph has, or an accessor, which is outside
 * the data model because reading a getter is an effect. The descriptor is
 * how the accessor is seen at all: `actual[key]` would run the getter while
 * asking whether it should have been there.
 *
 * @type {(actual: object, key: string | number) => _Member}
 */
const member = (actual, key) => {
    const d = getOwnPropertyDescriptor(actual, key)
    return d === undefined ? ['hole'] : hasOwn(d, 'value') ? ['value', d.value] : ['accessor']
}

/**
 * The difference an own property outside the data model makes, or `null`.
 * What a container holds is its data: an array's elements, an object's
 * members, and nothing else — so a symbol key, and a name the expected
 * graph does not have, are differences of the container rather than of
 * anything under it. An array's `length` is the one exception the spec
 * names: it is on every array, it is not a member, and the element list
 * carries it.
 *
 * @type {(path: string, expected: _Container, actual: _Container) => string | null}
 */
const outsideTheModel = (path, expected, actual) => {
    if (getOwnPropertySymbols(actual).length !== 0) {
        return at(path, 'expected data members only, got a symbol-keyed property')
    }
    for (const name of getOwnPropertyNames(actual)) {
        if (!(isArray(actual) && name === 'length') && !hasOwn(expected, name)) {
            return at(path, `expected data members only, got the own property ${JSON.stringify(name)}`)
        }
    }
    return null
}

/** The value of a lowercase hex digit, or `-1` for any other code unit. @type {(unit: number) => number} */
const hexDigit = unit =>
    unit >= 0x30 && unit <= 0x39 ? unit - 0x30 :
    unit >= 0x61 && unit <= 0x66 ? unit - 0x57 :
    -1

/**
 * Whether `hex` is spelled as a byte document is: lowercase pairs separated
 * by single spaces, at least one pair, nothing else.
 *
 * @type {(hex: string) => boolean}
 */
const isHex = hex => {
    if (hex.length % 3 !== 2) { return false }
    for (let i = 0; i < hex.length; i += 3) {
        if (hexDigit(hex.charCodeAt(i)) < 0 || hexDigit(hex.charCodeAt(i + 1)) < 0) { return false }
        if (i + 2 < hex.length && hex.charCodeAt(i + 2) !== 0x20) { return false }
    }
    return true
}

/**
 * The bytes a `['hex', …]` document spells, or `null` where the string is
 * not that spelling: lowercase pairs separated by single spaces and nothing
 * else, the one spelling the corpus admits so that a byte vector reads as
 * the issue's byte tables do.
 *
 * @type {(hex: string) => readonly number[] | null}
 */
export const bytes = hex =>
    isHex(hex)
        ? Array.from({ length: (hex.length + 1) / 3 }, (_, i) => hexDigit(hex.charCodeAt(i * 3)) * 16 + hexDigit(hex.charCodeAt(i * 3 + 1)))
        : null

// by the data model's boundary, not the prototype chain: an array under a
// `null` prototype is an array whose prototype is outside the model; and
// typed over the model's own arrays, which are read-only, so that the
// other branch narrows to the object
const isArray = /** @type {(value: Unknown) => value is TreeArray<Primitive>} */ (Array.isArray)

/**
 * Whether a value is a `Document` as the schema has one: a string, or the
 * exact two-element tuple `['hex', string]` whose string is the one hex
 * spelling.
 *
 * A data module carries no annotations, so the cast at each set's import is
 * a claim and each set's proof is what checks it. That means checking the
 * shape and not only the tag: `{"0": "hex", "1": "00"}` and
 * `["hex", "00", "extra"]` both answer `'hex'` to `document[0]`, and
 * neither is the tuple the type admits.
 *
 * @type {(document: Unknown) => boolean}
 */
export const isDocument = document =>
    typeof document === 'string'
    || (isArray(document)
        && document.length === 2
        && document[0] === 'hex'
        && typeof document[1] === 'string'
        && bytes(document[1]) !== null)

/** @type {(path: string, what: string) => string} */
const at = (path, what) => `at ${path}: ${what}`

/** @type {(value: Unknown) => string} */
const show = value =>
    is(value, -0) ? '-0' :
    typeof value === 'bigint' ? `${value}n` :
    typeof value === 'string' ? JSON.stringify(value) :
    isArray(value) ? 'an array' :
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
    if (isArray(expected)) {
        if (!isArray(actual)) { return at(path, `expected an array, got ${show(actual)}`) }
        if (expected.length !== actual.length) {
            return at(path, `expected ${expected.length} elements, got ${actual.length}`)
        }
        const outside = outsideTheModel(path, expected, actual)
        if (outside !== null) { return outside }
        // an expected graph has no holes and no accessors, so either in the
        // actual is a difference of its own — `[undefined]` is not
        // `new Array(1)` — and it is reported where the walk reaches it,
        // after the elements before
        let result = stack
        for (let i = expected.length - 1; i >= 0; i -= 1) {
            const elementPath = `${path}[${i}]`
            const m = member(actual, i)
            result = {
                top: m[0] === 'value' ? [elementPath, expected[i], m[1]] : [elementPath, expected[i], undefined, m[0]],
                rest: result,
            }
        }
        return result
    }
    if (isArray(actual)) { return at(path, `expected an object, got ${show(actual)}`) }
    // an object of the data model is a plain one, under `Object.prototype`
    // or `null`, the two a reader may build it with; a `Date`, a `Map` or a
    // boxed number has no members to compare and is not data
    const proto = getPrototypeOf(actual)
    if (proto !== objectPrototype && proto !== null) { return at(path, 'expected an object, got a non-plain object') }
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
    const outside = outsideTheModel(path, expected, actual)
    if (outside !== null) { return outside }
    let result = stack
    for (let i = expectedKeys.length - 1; i >= 0; i -= 1) {
        const key = expectedKeys[i]
        const m = member(actual, key)
        result = {
            top: m[0] === 'value'
                ? [`${path}[${JSON.stringify(key)}]`, expected[key], m[1]]
                : [`${path}[${JSON.stringify(key)}]`, expected[key], undefined, m[0]],
            rest: result,
        }
    }
    return result
}

/**
 * One comparison: a hole or an accessor in the actual, a difference
 * whatever is expected;
 * a leaf by `Object.is`; a container by the bijection so far, and, when it
 * is new, by its children.
 *
 * @type {(state: _State, task: _Task) => _State | string}
 */
const compare = ([stack, pairs], task) => {
    const [path, expected, actual, mark] = task
    if (mark !== undefined) {
        return at(path, `expected ${show(expected)}, got ${mark === 'hole' ? 'a hole' : 'an accessor'}`)
    }
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
