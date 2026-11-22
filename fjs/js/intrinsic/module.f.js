/**
 * The intrinsics: the member functions no body can define — the
 * primitives of [`../runtime/README.md`](../runtime/README.md), under the
 * code's word for them, since `Primitive` is the EDAG's name for a literal
 * value — each as a function a module calls, `slice(s, start, end)`, whose
 * body is the one member call. The compiler recognizes each body whole as
 * the EDAG's node of the member's name, `['slice']`, as it recognizes
 * `entry` and `hasEntry`
 * ([`../../types/object/entry`](../../types/object/entry/module.f.js)),
 * and every executor answers the node natively: the member call as an
 * executor makes it with no runtime — the receiver's own property, else
 * the native, else the `TypeError` of calling `undefined`. That is how the
 * runtime's bodies reach a native without naming what the runtime defines
 * ([`../runtime/README.md`](../runtime/README.md), "Two invariants"): the runtime
 * holds no member call: `found` calls `slice` as a function, and
 * `codePointAt` calls `charCodeAt`.
 *
 * The list is `intrinsics` in [`fjs/edag`](../../edag/module.f.js), each
 * with its helper's `length`, which the proof pins to the functions here.
 * A name joins it with its first consumer, and only where no body can
 * define it: each costs a recognized body, a node, its serialized text, an
 * interpreter answer and a Rust spelling.
 *
 * @module
 *
 * @import { CharCodeAt, Slice } from './types.ts'
 */

/**
 * [`String.prototype.slice`](https://tc39.es/ecma262/#sec-string.prototype.slice)
 * as a function of its receiver: the substring from `start` to `end`,
 * positions clamped into the string as the method clamps them. The
 * intrinsic is the member call on any receiver — an array's `slice` too —
 * and the type here is the string's, its one consumer's, until another
 * asks for more.
 *
 * @type {Slice}
 */
export const slice = (s, start, end) => s.slice(start, end)

/**
 * [`String.prototype.charCodeAt`](https://tc39.es/ecma262/#sec-string.prototype.charcodeat)
 * as a function of its receiver: the code unit at `at`, the position
 * `ToIntegerOrInfinity` of the argument, or `NaN` outside the string; the
 * position is given, since every body reading a code unit has one. The
 * code-unit read is the primitive every string body that looks at one
 * character stands on, `codePointAt` first; the type is the string's,
 * as `slice`'s is.
 *
 * @type {CharCodeAt}
 */
export const charCodeAt = (s, at) => s.charCodeAt(at)

/** Portable spelling used to recognize and serialize the ordered comparison. @type {string} */
export const structEqSource = `const structEq = (a, b) => {
    let pending = { top: [a, b], rest: null }
    while (pending !== null) {
        const x = pending.top[0]
        const y = pending.top[1]
        pending = pending.rest
        if (Object.is(x, y)) { continue }
        if (x === null || typeof x !== 'object' || y === null || typeof y !== 'object') { return false }
        if ((x instanceof Array) !== (y instanceof Array)) { return false }
        const left = x instanceof Array ? x : Object.entries(x)
        const right = y instanceof Array ? y : Object.entries(y)
        if (left.length !== right.length) { return false }
        let i = left.length
        while (i > 0) {
            i -= 1
            pending = { top: [left[Number(i)], right[Number(i)]], rest: pending }
        }
    }
    return true
}`
