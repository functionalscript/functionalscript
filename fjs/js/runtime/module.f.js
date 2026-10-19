/**
 * The built-in functions, defined once, in two sections and the dispatcher
 * over them. `member` holds,
 * by name, the member functions whose body is written, `startsWith`: each
 * a FunctionalScript function of the receiver alone, answering `undefined`
 * for a receiver the name is no member of, or the function of the
 * arguments as the call passed them, `undefined` past the end — so the body
 * dispatches on its receiver's type itself, and an executor asks it in two
 * steps, the first before any argument exists, which is what the guard of
 * `a.startsWith?.(x)` needs. `static` holds the static
 * functions by the path [`../static`](../static/module.f.js) admits them
 * under, `Object.is` at `static.Object.is` and `Number.isInteger` at
 * `static.Number.isInteger`, each a function of the arguments alone. Each
 * body is a VM's and no module's: a module calls the built-in, `Object.is`
 * or `Number.isInteger`, and every executor answers it from here, so
 * nothing else exports the body. A name without a body is absent — a
 * primitive no body can define in terms of the rest, or a name whose body
 * waits on a primitive the language has not admitted yet,
 * [`README.md`](./README.md) says which — and each VM answers it from its
 * own native table.
 *
 * Which names a module may call stays [`../prototype`](../prototype/module.f.js)'s;
 * [`./types.ts`](./types.ts) pins every key here an allowed name. Every
 * executor reads this one table — the represented
 * interpreter runs a body as EDAG through the runtime its executor is
 * given, and NaNVM binds the module compiled to Rust by `npm run gen` — so
 * a built-in function is written here and nowhere else. `dot` is the
 * dispatcher a call step asks, the one place the resolution of a callee is
 * written ([DESIGN.md §13](../../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution)):
 * the callee of `a[key](...)` on a non-nullish receiver — the receiver's
 * own enumerable property under the key, whatever it holds, which shadows
 * a built-in as it does in JavaScript, else what the `member` body of the
 * name answers for the receiver, else `undefined`, which the executor
 * calls and throws for, or skips under `?.()`. The interpreter asks it
 * before its natives; NaNVM's call step is native until the
 * static-runtime printer compiles the table `dot` reads, and the printer
 * leaves `dot` out until then
 * ([`../todo/runtime-members.md`](../todo/runtime-members.md)). The README
 * says how each binds it and how a name gets its body.
 *
 * @module
 */

import { isNegativeZero } from '../../types/number/is_negative_zero/module.f.js'
import { entry, hasEntry } from '../../types/object/entry/module.f.js'
import { slice } from '../intrinsic/module.f.js'

/**
 * [`Number.isNaN`](https://tc39.es/ecma262/#sec-number.isnan): whether `n`
 * is `NaN`. `NaN` is the one value that is not strictly equal to itself, so
 * the comparison alone is the test: every other number, and every value of
 * another type, is `false`, without coercion, as the global `isNaN`, which
 * converts first, does not answer. The name ends in `_` so that it never
 * shadows that global.
 *
 * @type {(n: unknown) => boolean}
 */
const isNaN_ = n => n !== n

/**
 * [`Number.isFinite`](https://tc39.es/ecma262/#sec-number.isfinite):
 * whether `n` is a finite number. A number times `0` is `0` exactly when it
 * is finite: an infinity times `0` and `NaN` times `0` are both `NaN`, and
 * `-0` is `0` under `===`. A value of another type is `false` without
 * coercion, as the global `isFinite`, which converts first, does not
 * answer; the `_` is `isNaN_`'s.
 *
 * @type {(n: unknown) => boolean}
 */
const isFinite_ = n => typeof n === 'number' && n * 0 === 0

/**
 * [`Number.isInteger`](https://tc39.es/ecma262/#sec-number.isinteger):
 * whether `n` is a finite integral number, both zeros and integers beyond
 * the safe range included. A fraction, an infinity and `NaN` all leave a
 * remainder that is not `0`; a value of another type is `false` without
 * coercion.
 *
 * @type {(n: unknown) => boolean}
 */
const isInteger = n => typeof n === 'number' && n % 1 === 0

/**
 * [`Number.isSafeInteger`](https://tc39.es/ecma262/#sec-number.issafeinteger):
 * an integer within the exact integer range of a double, whose 53 bits of
 * precision make the inclusive bound `2^53 - 1` on either side.
 *
 * @type {(n: unknown) => boolean}
 */
const isSafeInteger = n => typeof n === 'number' && isInteger(n) && -0x1f_ffff_ffff_ffff <= n && n <= 0x1f_ffff_ffff_ffff

/**
 * [`Object.is`](https://tc39.es/ecma262/#sec-object.is): whether `a` and
 * `b` are the same value, SameValue, which is `===` except on the two
 * values `===` reads the other way. Two values equal under `===` are the
 * same unless one is `-0` and the other is not, and two values unequal
 * under `===` are the same only where both are `NaN`. An array, an object
 * and a function compare by identity, as `===` compares them.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
const is = (a, b) => a === b
    ? isNegativeZero(a) === isNegativeZero(b)
    : isNaN_(a) && isNaN_(b)

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
 * The substring is the intrinsic `slice`, called as a function: a member
 * call would name what the runtime defines
 * ([`../intrinsic`](../intrinsic/module.f.js)).
 *
 * @type {(self: string, s: string, start: number) => boolean}
 */
const found = (self, s, start) => {
    const end = start + s.length
    return end > self.length ? false : slice(self, start, end) === s
}

/** The member section: a name, then the body. */
const member = {
    /**
     * [`String.prototype.startsWith`](https://tc39.es/ecma262/#sec-string.prototype.startswith),
     * a string's and no other type's: whether `ToString(search)` occurs
     * at `position`, clamped into the string. The search string is
     * converted before the position, as the algorithm orders them, and
     * either conversion can throw — a search whose own `toString`
     * throws, a bigint position — so the order is observable. The two
     * are a call's arguments, which every executor evaluates left to
     * right; two `const`s would be evaluated as the result demands
     * them, the position first.
     *
     * @type {(self: unknown) => undefined | ((search: unknown, at: unknown) => boolean)}
     */
    startsWith: self => typeof self !== 'string' ? undefined
        : (search, at) => found(self, String(search), position(at, self.length)),
}

/**
 * The table: `static`, then a static path's keys, then the body; `member`,
 * then a name, then the body; and `dot`, the dispatcher over `member`.
 */
export const runtime = {
    static: {
        Object: { is },
        Number: { isInteger, isSafeInteger, isNaN: isNaN_, isFinite: isFinite_ },
    },
    member,
    /**
     * The callee of `self[key](...)`, the receiver not nullish: the
     * receiver's own enumerable property under the key — an object's
     * field, an array's or a string's element, its presence asked by
     * `hasEntry` so that an own `undefined` is found, its value read by
     * `entry` — else what the `member` body of the name answers for the
     * receiver, the function of the arguments or `undefined`, else
     * `undefined`. An own property wins whatever it holds, as it does in
     * JavaScript: `{ toString: f }` calls `f`, `{ x: undefined }.x()`
     * throws, and `[1][0]()` throws for the element. `entry(member, key)`
     * reads the table as the object literal it is, so no inherited name
     * answers, and nothing is built on the way: a receiver that owns
     * nothing under the key costs one scan, an object that owns it two.
     * A body's throw is the call's, or the guard's. The core rule of
     * DESIGN.md §13 holds here: no member call and no optional chain,
     * only the two helpers, a conditional and a plain call of a function
     * value, since an executor runs this to answer a member call. The
     * runtime's proof pins the shape on the EDAG.
     *
     * @type {(self: unknown, key: string) => unknown}
     */
    dot: (self, key) => {
        if (hasEntry(self, key)) { return entry(self, key) }
        const body = /** @type {undefined | ((self: unknown) => unknown)} */ (entry(member, key))
        return body === undefined ? undefined : body(self)
    },
}
