/**
 * The FunctionalScript EDAG (expression DAG): its stage 1 vocabulary and the
 * validation that admits a value into it.
 *
 * `validate` is a **total gate**. The EDAG is the public input of the
 * `Function` constructor, so it sees graphs no FunctionalScript compiler would
 * ever emit, and "our compiler would not produce that" is never an argument
 * for admitting one. Everything the shape allows and the semantics do not is
 * rejected here:
 *
 * - a value with no EDAG spelling — a function, a symbol, or a plain object
 *   (reserved, see `./types.ts`);
 * - an unknown operation tag, or a known tag with the wrong number of
 *   operands;
 * - a property operand that is not a permitted string or number constant, so
 *   prototype-chain lookup by a computed name has no spelling at all
 *   (`propertyValidate` below);
 * - an object entry that is not `[':', key, value]` with a string-constant
 *   key, or one whose entry array is reused in a second entry position;
 * - a cycle: sharing a node is how the graph is a DAG rather than a tree, but
 *   a node reachable from itself is not a computation.
 *
 * A node reached twice is validated once. That is not only a cost concern —
 * a graph sharing one node `n` times is `2^n` paths — it is also what makes
 * the cycle check exact: a node currently *open* on the path is a cycle,
 * while one already *done* is ordinary sharing.
 *
 * The stage 2 rules (a function body is a disjoint scope, so an operation node
 * must not cross a `'=>'` boundary) arrive with `'=>'` itself.
 *
 * @module
 *
 * @import { Result } from '../types/result/types.ts'
 * @import { ValidationError } from '../types/rtti/common/types.ts'
 * @import { Entry, Node, Property } from './types.ts'
 */

import { error, ok } from '../types/result/module.f.mjs'
import { isArray } from '../types/array/module.f.mjs'
import { prependPath, verror } from '../types/rtti/common/module.f.mjs'

/**
 * The `Object.prototype` names
 * [2330](../../spec/todo/2330-property-accessor.md) prohibits outright: each
 * one reaches the `Function` constructor, and from there arbitrary code.
 */
const prototypeChainName = /** @type {const} */ ([
    '__proto__', 'constructor',
])

/**
 * The instance-method names 2330 tabulates for `Object`. A method name is
 * prohibited in a *property* position whether or not the method itself has a
 * side effect: `a.indexOf` detached from `a` is a different value from the
 * method call `a.indexOf(x)`, which is why the EDAG has a separate `'.()'`
 * operation for the call (stage 2).
 */
const objectMethodName = /** @type {const} */ ([
    '__defineGetter__', '__defineSetter__', '__lookupGetter__',
    '__lookupSetter__', 'hasOwnProperty', 'isPrototypeOf',
    'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf',
])

/**
 * The instance-method names 2330 tabulates for `Array`. `copyWithin` is
 * spelled `copyWith` in that table; the JavaScript name is the one that has to
 * be unreachable.
 */
const arrayMethodName = /** @type {const} */ ([
    'at', 'concat', 'copyWithin', 'entries', 'every', 'fill', 'filter', 'find',
    'findIndex', 'findLast', 'findLastIndex', 'flat', 'flatMap', 'forEach',
    'includes', 'indexOf', 'join', 'keys', 'lastIndexOf', 'map', 'pop', 'push',
    'reduce', 'reduceRight', 'reverse', 'shift', 'slice', 'some', 'sort',
    'splice', 'toReversed', 'toSorted', 'toSpliced', 'unshift', 'values',
    'with',
])

/** The instance-method names 2330 tabulates for `Function`. */
const functionMethodName = /** @type {const} */ (['apply', 'bind', 'call'])

/**
 * The instance-method names 2330 tabulates for `Map` and does not share with
 * `Array`.
 */
const mapMethodName = /** @type {const} */ (['clear', 'delete', 'get', 'has', 'set'])

/** @type {ReadonlySet<string>} */
const prohibitedName = new Set([
    ...prototypeChainName,
    ...objectMethodName,
    ...arrayMethodName,
    ...functionMethodName,
    ...mapMethodName,
])

/**
 * Checks the property operand of `['.', object, property]`.
 *
 * A number constant is always permitted — it is an index, and no index reaches
 * the prototype chain. A string constant is permitted unless it names one of
 * the properties or methods
 * [2330](../../spec/todo/2330-property-accessor.md) prohibits. Anything else —
 * a bigint, a `null`, an operation node computing a string at run time — is
 * rejected, which is what keeps `o[name]` for a computed `name` out of the
 * language rather than guarded inside it.
 *
 * Exported because a compiler lowering source to `'.'` has to answer this
 * question about a property *before* it has a node to validate.
 *
 * @type {(property: unknown) => Result<Property, ValidationError>}
 */
export const propertyValidate = property => {
    if (typeof property === 'number') { return ok(property) }
    if (typeof property !== 'string') { return verror('a property must be a string or number constant') }
    return prohibitedName.has(property) ? verror('a prohibited property name') : ok(property)
}

/** @typedef {ReadonlySet<readonly unknown[]>} _Seen */

/** @typedef {{
 *   readonly done: _Seen
 *   readonly open: _Seen
 *   readonly entries: _Seen
 * }} _State */

/** @typedef {Result<_State, ValidationError>} _Result */

/**
 * Prefixes an operand index onto a failure's path, leaving a success alone.
 * @type {<T>(key: string) => (result: Result<T, ValidationError>) => Result<T, ValidationError>}
 */
const atPath = key => result => {
    const [tag, value] = result
    return tag === 'error' ? prependPath(key, error(value)) : ok(value)
}

/**
 * Walks the operands of `operation` from index 1, threading the state and
 * stopping at the first failure.
 * @type {(item: (state: _State) => (operand: unknown) => _Result) => (operation: readonly unknown[]) => (state: _State) => _Result}
 */
const operandsValidate = item => operation => state => {
    let acc = state
    for (let i = 1; i < operation.length; ++i) {
        const [tag, value] = atPath(`${i}`)(item(acc)(operation[i]))
        if (tag === 'error') { return error(value) }
        acc = value
    }
    return ok(acc)
}

/** @type {(state: _State) => (node: unknown) => _Result} */
const nodeValidate = state => node => {
    switch (typeof node) {
        case 'bigint':
        case 'boolean':
        case 'number':
        case 'string':
        case 'undefined': { return ok(state) }
        case 'object': {
            if (node === null) { return ok(state) }
            return isArray(node)
                ? operationValidate(state)(node)
                : verror('a plain object is not an EDAG node')
        }
        default: { return verror('a function or a symbol is not an EDAG node') }
    }
}

/**
 * Validates one operation node, memoizing it and keeping it on the open path
 * while its operands are walked.
 * @type {(state: _State) => (operation: readonly unknown[]) => _Result}
 */
const operationValidate = state => operation => {
    if (state.done.has(operation)) { return ok(state) }
    if (state.open.has(operation)) { return verror('a cycle is not an EDAG') }
    const opened = { ...state, open: new Set([...state.open, operation]) }
    const [tag, value] = tagValidate(opened)(operation)
    return tag === 'error'
        ? error(value)
        : ok({ ...value, open: state.open, done: new Set([...value.done, operation]) })
}

/**
 * Operand shapes are per tag, never a global "an array in operand position is
 * a tagged operation" rule, so a later operation with a differently shaped
 * operand is an addition rather than a change.
 * @type {(state: _State) => (operation: readonly unknown[]) => _Result}
 */
const tagValidate = state => operation => {
    switch (operation[0]) {
        case 'args': {
            return operation.length === 1 ? ok(state) : verror('["args"] takes no operands')
        }
        case '[]': { return nodesValidate(operation)(state) }
        case '{}': { return entriesValidate(operation)(state) }
        case '.': {
            if (operation.length !== 3) { return verror('["."] takes an object and a property') }
            const [, object, property] = operation
            const [tag, value] = atPath('2')(propertyValidate(property))
            return tag === 'error'
                ? error(value)
                : atPath('1')(nodeValidate(state)(object))
        }
        default: { return verror('an unknown operation tag') }
    }
}

/**
 * Validates one `[':', key, value]` entry and records its container identity.
 * @type {(state: _State) => (entry: unknown) => _Result}
 */
const entryValidate = state => entry => {
    if (!isArray(entry)) { return verror('an object entry must be an entry descriptor') }
    if (entry[0] !== ':') { return verror('an unknown object entry form') }
    if (entry.length !== 3) { return verror('[":"] takes a key and a value') }
    if (state.entries.has(entry)) { return verror('an entry descriptor is not shareable') }
    const [, key, value] = entry
    if (typeof key !== 'string') { return atPath('1')(verror('an entry key must be a string constant')) }
    const recorded = { ...state, entries: new Set([...state.entries, entry]) }
    return atPath('2')(nodeValidate(recorded)(value))
}

const nodesValidate = operandsValidate(nodeValidate)

const entriesValidate = operandsValidate(entryValidate)

/** @type {_State} */
const emptyState = { done: new Set(), open: new Set(), entries: new Set() }

/**
 * Answers whether `value` is a valid EDAG, returning **the value it was
 * given** on success — the same reference, so the sharing that makes the graph
 * a DAG survives the check. A failure carries the offending operand's path and
 * a short message, the shape
 * [rtti](../types/rtti/common/types.ts) uses.
 *
 * Reconstructing the value instead, the way rtti's `parse` does, is not
 * available to an EDAG reader: node identity is semantic here, so a rebuilt
 * graph would be a different computation.
 *
 * @type {(value: unknown) => Result<Node, ValidationError>}
 */
export const validate = value => {
    const [tag, e] = nodeValidate(emptyState)(value)
    // The one place the type system cannot follow: `unknown` has just been
    // walked against every rule `Node` states, and there is no runtime check
    // left to perform. `parse`-style reconstruction, which would carry the
    // type honestly, would lose the identities the EDAG means.
    return tag === 'error' ? error(e) : ok(/** @type {Node} */ (value))
}
