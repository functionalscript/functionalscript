/**
 * The built-in functions, defined once, in two sections keyed by the
 * name of a global. `member` holds, for a receiver's type — `String`,
 * `Array`, `Number` — the names whose body is written, each a
 * FunctionalScript function of the receiver and then the arguments as the
 * call passed them, `undefined` past the end. `static` holds the static
 * functions by the path [`../static`](../static/module.f.js) admits them
 * under, `Object.is` at `static.Object.is` and `Number.isInteger` at
 * `static.Number.isInteger`, each a function of the arguments alone. A name without a body is absent — a primitive no body
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

import { isFinite_ } from '../../types/number/is_finite/module.f.js'
import { isInteger } from '../../types/number/is_integer/module.f.js'
import { isNaN_ } from '../../types/number/is_nan/module.f.js'
import { isSafeInteger } from '../../types/number/is_safe_integer/module.f.js'
import { is } from '../../types/object/is/module.f.js'

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

/**
 * The table: `static`, then a static path's keys, then the body; and
 * `member`, then a receiver's type by its global's name, then a name, then
 * the body.
 */
export const runtime = {
    static: {
        Object: {
            /**
             * [`Object.is`](https://tc39.es/ecma262/#sec-object.is):
             * SameValue. The body is the helper `fjs/types/object/is`,
             * imported rather than copied, so a module calling `Object.is`
             * and one importing `is` answer alike by construction.
             */
            is,
        },
        /**
         * The four `Number` predicates, none of which converts its
         * argument: each body is the helper of `fjs/types/number` a module
         * may import too, imported rather than copied, and each answers as
         * the built-in does for every kind of value.
         */
        Number: {
            /** [`Number.isInteger`](https://tc39.es/ecma262/#sec-number.isinteger) */
            isInteger,
            /** [`Number.isSafeInteger`](https://tc39.es/ecma262/#sec-number.issafeinteger) */
            isSafeInteger,
            /** [`Number.isNaN`](https://tc39.es/ecma262/#sec-number.isnan) */
            isNaN: isNaN_,
            /** [`Number.isFinite`](https://tc39.es/ecma262/#sec-number.isfinite) */
            isFinite: isFinite_,
        },
    },
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
