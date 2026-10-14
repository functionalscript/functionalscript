/**
 * The built-in member functions, defined once, under `member`: for a
 * receiver's type, keyed by the name of its global — `String`, `Array`,
 * `Number` — the names whose body is written, each a FunctionalScript
 * function of the receiver and then the arguments as the call passed
 * them, `undefined` past the end. A name without a body is absent — a primitive no body
 * can define in terms of the rest, or a name whose body waits on a
 * primitive the language has not admitted yet, [`README.md`](./README.md)
 * says which — and each VM answers it from its own native table.
 *
 * Which names a module may call stays [`../prototype`](../prototype/module.f.js)'s;
 * [`./types.ts`](./types.ts) pins every key here an allowed name on its
 * type's prototype. Every executor reads this one table — the represented
 * interpreter runs a body as EDAG through the runtime its executor is
 * given, and NaNVM binds the module compiled to Rust by `npm run gen` — so
 * a member function is written here and nowhere else. The README says how
 * each binds it and how a name gets its body.
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
 * Whether `s` is the substring of `self` at `start`, a position already
 * clamped into it. An empty `s` is found anywhere, past the end included.
 *
 * @type {(self: string, s: string, start: number) => boolean}
 */
const found = (self, s, start) => {
    const end = start + s.length
    return end > self.length ? false : self.slice(start, end) === s
}

/** The table: `member`, then a receiver's type by its global's name, then a name, then the body. */
export const runtime = {
    member: {
        String: {
            /**
             * [`String.prototype.startsWith`](https://tc39.es/ecma262/#sec-string.prototype.startswith):
             * whether `ToString(search)` occurs at `position`, clamped into the
             * string. The search string is converted before the position, as
             * the algorithm orders them, and either conversion can throw — a
             * search whose own `toString` throws, a bigint position — so the
             * order is observable. The two are a call's arguments, which every
             * executor evaluates left to right; two `const`s would be evaluated
             * as the result demands them, the position first.
             *
             * @type {(self: string, search: unknown, at: unknown) => boolean}
             */
            startsWith: (self, search, at) => found(self, String(search), position(at, self.length)),
        },
    },
}
