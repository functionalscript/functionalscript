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
 * ([`../todo/runtime-value.md`](../todo/runtime-value.md)): the runtime
 * holds no member call, and `found` calls `slice` as a function.
 *
 * The list is `intrinsics` in [`fjs/edag`](../../edag/module.f.mjs), each
 * with its helper's `length`, which the proof pins to the functions here.
 * A name joins it with its first consumer, and only where no body can
 * define it: each costs a recognized body, a node, its serialized text, an
 * interpreter answer and a Rust spelling.
 *
 * @module
 *
 * @import { Slice } from './types.ts'
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
