/**
 * The call-contract corpus: the `nanvm-harness` fixtures, read by more than
 * one executor. A fixture is a source module whose default export reports its
 * own identity, laziness and throws as ordinary values, so the same file can
 * be run by Node (the independent reference), by the FJS interpreter and, as
 * generated Rust, by `nanvm-lib`. See
 * [callable-function-objects](../../../nanvm-lib/todo/callable-function-objects.md),
 * Stage 8.
 *
 * Every fixture is in the corpus unless {@link exceptions} names it and says
 * why, so a new fixture is compared by default and an exception cannot be
 * silent.
 *
 * @module
 */

import { isArray } from '../../types/array/module.f.mjs'

/** Where the fixtures are: one `.mjs` module each, a helper one imports beside them. */
export const fixturesDirectory = 'nanvm-harness/fixtures'

/**
 * The fixtures no executor comparison covers, each with its reason. A fixture
 * here is not wrong; it tests something other than the language's value
 * contract.
 *
 * @type {{ readonly [file: string]: string }}
 */
export const exceptions = {
    'function-text.mjs': 'a function\'s text is the specified function-text exception: the reference prints the host\'s source, the executors the shared renderer\'s',
    'function.mjs': 'exports a function as its default, which the harness\'s own call action tests; a language call is observed by a fixture that calls at module level',
    'parity.mjs': 'exports programs for a host to perform, not values: `nanvm-harness/tests/parity.rs` and `fjs/nanvm/parity/proof.mjs` compare the hosts through them',
    'rest-function.mjs': 'exports a function as its default, which the harness\'s own call action tests; a language call is observed by a fixture that calls at module level',
}

const extension = '.mjs'

/**
 * The corpus: the `.mjs` files of a fixture directory listing that no
 * exception excludes.
 *
 * @type {(names: readonly string[]) => readonly string[]}
 */
export const corpus = names => names.filter(name => name.endsWith(extension) && exceptions[name] === undefined)

/**
 * The corpus fixtures whose reference default export is `undefined`, each with
 * its reason. Comparing `undefined` with `undefined` proves nothing, so a
 * fixture with such a default must be named here: an unfinished fixture cannot
 * pass as a trivial one, and an entry that stops being `undefined` is stale.
 *
 * @type {{ readonly [file: string]: string }}
 */
export const undefinedDefault = {
    'effect.mjs': 'tests a named export, which the corpus does not compare',
    'exports.mjs': 'tests the export object, which the corpus does not compare',
    'missing.mjs': 'reading past the arguments supplied answers `undefined`, which is the observation',
    'named-imports.mjs': 'tests a named import, which the corpus does not compare',
    'named-imports-math.mjs': 'tests a named import, which the corpus does not compare',
}

/**
 * Walk the children in order, threading the containers seen so far.
 *
 * @type {(seen: readonly unknown[], children: readonly unknown[], walk: (seen: readonly unknown[], value: unknown) => readonly [unknown, readonly unknown[]]) => readonly [readonly unknown[], readonly unknown[]]}
 */
const walkAll = (seen, children, walk) => children.reduce(
    /** @type {(acc: readonly [readonly unknown[], readonly unknown[]], child: unknown) => readonly [readonly unknown[], readonly unknown[]]} */
    ([done, known], child) => {
        const [shape, next] = walk(known, child)
        return [[...done, shape], next]
    },
    /** @type {readonly [readonly unknown[], readonly unknown[]]} */ ([[], seen]))

/**
 * A value with its aliasing written out: an array or object seen for the
 * first time is `['node', n, 'array' | 'object', children]` and every later
 * sight of it `['alias', n]`, `n` being the order of first sight. Two values
 * with equal contents but different sharing differ, which a structural
 * comparison alone cannot say: it accepts `[shared, shared]` for two copies.
 * An object's children are its `[key, child]` pairs in own-property order.
 *
 * @type {(value: unknown) => unknown}
 */
export const withAliasing = value => {
    /** @type {(seen: readonly unknown[], v: unknown) => readonly [unknown, readonly unknown[]]} */
    const walk = (seen, v) => {
        if (typeof v !== 'object' || v === null) { return [v, seen] }
        const id = seen.indexOf(v)
        if (id !== -1) { return [['alias', id], seen] }
        const n = seen.length
        const known = [...seen, v]
        if (isArray(v)) {
            const [children, next] = walkAll(known, v, walk)
            return [['node', n, 'array', children], next]
        }
        const entries = Object.entries(v)
        const [children, next] = walkAll(known, entries.map(([, child]) => child), walk)
        return [['node', n, 'object', entries.map(([key], i) => [key, children[i]])], next]
    }
    return walk([], value)[0]
}

/**
 * A data value with every `-0` written as `0`, which is what `JSON.stringify`
 * and `nanvm-lib`'s `to_json` do and the compiler's own JSON writer does not.
 * Arrays and objects keep their shape and order; a leaf other than `-0` is
 * returned as it is. The JSON layer of an expectation is written from this,
 * and `-0` itself is the graph layer's to compare.
 *
 * @type {(value: unknown) => unknown}
 */
export const withoutNegativeZero = value => {
    if (Object.is(value, -0)) { return 0 }
    if (isArray(value)) { return value.map(withoutNegativeZero) }
    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, withoutNegativeZero(child)]))
    }
    return value
}
