/**
 * The built-in member functions, defined once: for each of the seven
 * receiver types, every name a module may call on it, and what answers
 * the call. An entry is a body — a FunctionalScript function of the
 * receiver and then the arguments as the call passed them, `undefined`
 * past the end — or the marker `'native'`, a name every VM binds itself:
 * a primitive no body can define in terms of the rest, or a name whose
 * body waits on a primitive the language has not admitted yet. Which of
 * the two a marker is, and why, is the comment beside it.
 *
 * The keys are the admitted set: a type has exactly the member functions
 * its object holds, which [`./types.ts`](./types.ts) pins against the
 * prototype lists of [`../prototype`](../prototype/module.f.js), and the
 * parser's `allowedCalls` there names the same functions. Every executor
 * reads this one table — the represented interpreter runs a body as EDAG
 * through the runtime its executor is given, and NaNVM binds the module
 * compiled to Rust by `npm run gen` — so a member function is written
 * here and nowhere else. [`README.md`](./README.md) says how each binds it
 * and how a name moves from the marker to a body.
 *
 * @module
 */

import { isNaN_ } from '../../types/number/is_nan/module.f.js'

/**
 * `ToNumber`, as the operators apply it: a bigint throws the `TypeError`
 * `ToNumber` throws, where `Number(x)` would convert it.
 *
 * @type {(value: unknown) => number}
 */
const toNumber = value => /** @type {number} */ (value) - 0

/**
 * A position argument as the string methods read one:
 * `ToIntegerOrInfinity`, which makes `NaN` and `undefined` `0`, and then
 * clamped into the string, between `0` and its `length`. The clamp comes
 * first here, since an infinity has no fraction to drop, and truncating a
 * finite position after it answers the same.
 *
 * @type {(value: unknown, length: number) => number}
 */
const position = (value, length) => {
    const n = toNumber(value)
    const p = isNaN_(n) ? 0 : n
    return p < 0 ? 0 : p > length ? length : p - p % 1
}

/**
 * The table: a type, then a name, then the body or the marker.
 */
export const runtime = /** @type {const} */ ({
    object: {
        toString: 'native',
    },
    array: {
        at: 'native',
        concat: 'native',
        every: 'native',
        filter: 'native',
        find: 'native',
        findIndex: 'native',
        findLast: 'native',
        findLastIndex: 'native',
        flat: 'native',
        flatMap: 'native',
        includes: 'native',
        indexOf: 'native',
        join: 'native',
        lastIndexOf: 'native',
        map: 'native',
        reduce: 'native',
        reduceRight: 'native',
        slice: 'native',
        some: 'native',
        toReversed: 'native',
        toSorted: 'native',
        toSpliced: 'native',
        toString: 'native',
        with: 'native',
    },
    string: {
        at: 'native',
        charAt: 'native',
        // A primitive: the code unit read every other string body is
        // written over.
        charCodeAt: 'native',
        codePointAt: 'native',
        concat: 'native',
        endsWith: 'native',
        includes: 'native',
        indexOf: 'native',
        isWellFormed: 'native',
        lastIndexOf: 'native',
        padEnd: 'native',
        padStart: 'native',
        repeat: 'native',
        replace: 'native',
        replaceAll: 'native',
        // A primitive: the substring every other string body is written
        // over — the language has no other way to take part of a string.
        slice: 'native',
        split: 'native',
        /**
         * [`String.prototype.startsWith`](https://tc39.es/ecma262/#sec-string.prototype.startswith):
         * whether `ToString(search)` occurs at `position`, clamped into the
         * string. The search string is converted before the position, as
         * the algorithm orders them, and an empty one is found anywhere,
         * past the end included.
         *
         * @type {(self: string, search: unknown, at: unknown) => boolean}
         */
        startsWith: (self, search, at) => {
            const s = String(search)
            const start = position(at, self.length)
            const end = start + s.length
            return end > self.length ? false : self.slice(start, end) === s
        },
        substring: 'native',
        // Waits on a string from a code unit, `String.fromCharCode`, which
        // the static-function step admits: the Unicode case tables are
        // written over it.
        toLowerCase: 'native',
        toString: 'native',
        toUpperCase: 'native',
        toWellFormed: 'native',
        trim: 'native',
        trimEnd: 'native',
        trimStart: 'native',
    },
    number: {
        // The three formatters and a nondecimal radix wait on `BigInt`,
        // which the static-function step admits: the exact decimal
        // expansion of a double is written over it.
        toExponential: 'native',
        toFixed: 'native',
        toPrecision: 'native',
        toString: 'native',
    },
    boolean: {
        toString: 'native',
    },
    bigint: {
        toString: 'native',
    },
    function: {
        toString: 'native',
    },
})
