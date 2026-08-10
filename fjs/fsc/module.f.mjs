/**
 * FunctionalScript command utilities for compile workflows.
 *
 * @module
 */
import { strictEqual } from '../types/function/operator/module.f.mjs'
import { merge as rangeMapMerge, fromRange, get } from '../types/range_map/module.f.mjs'
/** @import { RangeMapArray, RangeMerge } from '../types/range_map/module.f.mjs' */
import { reduce as listReduce, toArray, map } from '../types/list/module.f.mjs'
/** @import { List } from '../types/list/module.f.mjs' */
import { range as asciiRange } from '../text/ascii/module.f.mjs'
import { flip, fn } from '../types/function/module.f.mjs'
import { one } from '../types/range/module.f.mjs'
/** @import { Range } from '../types/range/module.f.mjs' */
import { assertEq } from '../asserts/module.f.mjs'

const fromCharCode = String.fromCharCode

/** @typedef {readonly [readonly string[], _ToResult]} _Result */

/** @typedef {(codePoint: number) => _Result} _ToResult */

/** @template T @typedef {(state: T) => _ToResult} _CreateToResult */

/** @template T @typedef {RangeMapArray<_CreateToResult<T>>} _State */

/** @type {_ToResult} */
const unexpectedSymbol = codePoint => [[`unexpected symbol ${codePoint}`], unexpectedSymbol]

/** @type {<T>(state: T) => _ToResult} */
const def = () => unexpectedSymbol

const union =
    /**
     * @template T
     * @param {_CreateToResult<T>} a
     * @returns {(b: _CreateToResult<T>) => _CreateToResult<T>}
     */
    a => b => {
        if (a === def || a === b) { return b }
        if (b === def) { return a }
        throw [a, b]
    }

/** @type {readonly never[]} */
const empty = []

const reduce =
    /**
     * @template T
     * @param {List<_State<T>>} a
     * @returns {_State<T>}
     */
    a => {
        /** @type {RangeMerge<_CreateToResult<T>>} */
        const merge = rangeMapMerge({
            union,
            equal: strictEqual,
            def,
        })
        return toArray(listReduce(merge)(empty)(a))
    }

const codePointRange = flip(fromRange(def))

const range = fn(asciiRange).map(codePointRange).result

const rangeSet =
    /** @param {readonly string[]} l */
    l =>
    /**
     * @template T
     * @param {_CreateToResult<T>} f
     * @returns {_State<T>}
     */
    f => {
        /** @type {(a: Range) => (f: _CreateToResult<T>) => _State<T>} */
        const codePointRange = flip(fromRange(def))

        /** @type {(r: string) => _State<T>} */
        const g = r => codePointRange(asciiRange(r))(f)

        return reduce(map(g)(l))
    }

const create =
    /**
     * @template T
     * @param {List<_State<T>>} a
     * @returns {_CreateToResult<T>}
     */
    a => {
        const i = reduce(a)
        /** @type {(i: _State<T>) => (v: number) => (v: T) => _ToResult} */
        const x = get(def)
        return v => c => x(i)(c)(v)(c)
    }

export const terminal = -1

/** @type {() => _ToResult} */
const toInit = () => () => [[], init]

/** @type {(c: string) => _State<undefined>} */
const single = c =>
    range(c)(() => () => [[c], unexpectedSymbol])

const punctuation = /** @type {const} */("!\"%&'()*+,-./:;<=>?[]^`{|}~")

/** @type {_ToResult} */
export const init = create([
    codePointRange(one(terminal))(toInit),
    rangeSet(['\t', ' ', '\n', '\r'])(toInit),
    rangeSet(['$', '_', 'AZ', 'az'])(() => c => [[fromCharCode(c)], unexpectedSymbol]),
    range('09')(() => a => [[fromCharCode(a)], unexpectedSymbol]),
    ...[...punctuation].map(single),
])(undefined)

export const proof = {
    // union throws when two distinct non-def handlers are merged for the same range;
    // this path is unreachable through the public API (init has no overlapping ranges),
    // so we exercise it here where the private union function is in scope.
    throw: {
        unionConflict: () => {
            /** @type {_CreateToResult<undefined>} */
            const a = _s => unexpectedSymbol
            /** @type {_CreateToResult<undefined>} */
            const b = _s => unexpectedSymbol
            a(undefined)
            b(undefined)
            union(a)(b)
        }
    },
    // `def` is the range-map's default handler; the public API never calls it directly
    // (`init` covers every code point), so exercise it here where it's in scope.
    defHandler: () =>
        assertEq(def(undefined), unexpectedSymbol)
}
