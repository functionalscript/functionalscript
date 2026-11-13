/**
 * Host proofs of the emitter: what only a WebAssembly engine can settle.
 *
 * [`proof.f.mjs`](./proof.f.mjs) holds the WAT that the emitter writes.
 * Whether that is a module an engine accepts, and whether it computes what
 * the IR means, needs an engine, and FunctionalScript runs no WebAssembly.
 * So each module of [`testlib.f.mjs`](../testlib.f.mjs) is compiled here by
 * the host's engine, and every function it exports is called on the edges of
 * its parameters' types and compared with a JavaScript twin, which computes
 * the same in exact integers and IEEE doubles, as
 * [`testlib.mjs`](./testlib.mjs) does it. The twins of the functions over
 * values of unknown kind are L1's own `toBoolean` and the functions of the
 * [L0 view](../../wasm/runtime/l0/module.f.js) that it reads.
 *
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { _Twin, _Value } from './types.ts'
 */

import { assert } from '../../asserts/module.f.js'
import { ARRAY, FUNCTION, OBJECT, STRING, asNumber, kind, length } from '../../wasm/runtime/l0/module.f.js'
import { toBoolean } from '../../wasm/runtime/l1/module.f.js'
import { corners, samples, unknown } from '../testlib.f.mjs'
import { edges, product, run } from './testlib.mjs'

// values

/** @type {(v: _Value) => bigint} */
const int = v => (assert(typeof v === 'bigint', v), v)

/** @type {(v: _Value) => number} */
const num = v => (assert(typeof v === 'number', v), v)

/** @type {(v: _Value) => boolean} */
const bit = v => (assert(typeof v === 'boolean', v), v)

/** The value that a value of `any` holds. @type {(v: _Value) => unknown} */
const held = v => {
    assert(typeof v === 'object', v)
    return v.any
}

// twins

/** @type {(x: number, k: number) => number} */
const pow = (x, k) => k <= 0 ? 1 : x * pow(x, k - 1)

/** @type {(a: number, b: number) => number} */
const hypot = (a, b) => Math.sqrt(a * a + b * b)

/** What each exported function computes, on the same arguments. @type {StringMap<_Twin>} */
const twins = {
    max: ([a, b]) => num(a) < num(b) ? b : a,
    sum: ([a, b]) => int(a) + int(b),
    sign: ([x]) => int(x) < 0n ? -1n : x === 0n ? 0n : 1n,
    clamp: ([x, lo, hi]) => int(x) < int(lo) ? lo : int(hi) < int(x) ? hi : x,
    area: ([w, h]) => int(w) * int(h),
    diff: ([a, b]) => int(a) - int(b),
    double: ([a]) => int(a) + int(a),
    delta: ([a, b]) => int(a) - int(b),
    product: ([a, b]) => int(a) * int(b),
    same: ([a, b]) => int(a) === int(b),
    lessU32: ([a, b]) => int(a) < int(b),
    lessMixed: ([a, b]) => int(a) < int(b),
    lessU64: ([a, b]) => int(a) < int(b),
    atMost: ([a, b]) => int(a) <= int(b),
    atMostU32: ([a, b]) => int(a) <= int(b),
    atMostI64: ([a, b]) => int(a) <= int(b),
    atMostU64: ([a, b]) => int(a) <= int(b),
    notEqual: ([a, b]) => int(a) !== int(b),
    toFloat: ([a]) => Number(int(a)),
    toFloatSigned: ([a]) => Number(int(a)),
    toFloatWide: ([a]) => Number(int(a)),
    average: ([a, b]) => Number(int(a) + int(b)) / 2,
    magnitude: ([x]) => Math.abs(-num(x)),
    hypot: ([a, b]) => hypot(num(a), num(b)),
    distance: ([x, y, p, q]) => hypot(num(p) - num(x), num(q) - num(y)),
    safeDiv: ([a, b]) => num(b) === 0 ? 0 : num(a) / num(b),
    pow: ([x, k]) => pow(num(x), num(k)),
    pick: ([a, b]) => (0 < num(a) ? num(a) : 0 < num(b) ? num(b) : 0) + 1,
    xor: ([a, b]) => bit(a) ? !bit(b) : b,
    topU32: () => 0xffff_ffffn,
    topU64: () => 0xffff_ffff_ffff_ffffn,
    bottomI64: () => -(1n << 63n),
    wide: ([x]) => bit(x) ? 1n : 1n << 40n,
    unitLocal: () => true,
    oneArm: () => 1,
    falseFirst: ([a]) => bit(a) ? 1 : 0,
    neverBlock: ([x]) => x,
    neverIf: ([a]) => bit(a) ? 1 : 2,
    guarded: ([, x]) => x,
    twice: ([a]) => a,
    toBoolean: ([v]) => toBoolean(held(v)),
    kindOf: ([v]) => BigInt(kind(held(v))),
    isNumber: ([v]) => typeof held(v) === 'number',
    size: ([v]) => [STRING, ARRAY, OBJECT, FUNCTION].includes(kind(held(v))) ? BigInt(length(held(v))) : 0n,
    tag: ([v]) => BigInt(kind(held(v))),
    number: ([v]) => asNumber(held(v)),
    fail: () => { throw 'no answer' },
    falsy: ([v]) => !toBoolean(held(v)),
}

/**
 * The arguments of the functions that the edges do not suit: `pow` recurses
 * `k` times, and `guarded` never returns where its `a` is `true`.
 *
 * @type {StringMap<readonly (readonly _Value[])[]>}
 */
const inputs = {
    pow: product([edges(['f64']), [0, -0, 1, 2, 10, -1, 0.5, 3.5]]),
    guarded: product([[false], edges(['f64'])]),
}

export const proof = {
    samples: () => run(samples, twins, inputs),
    corners: () => run(corners, twins, inputs),
    unknown: () => run(unknown, twins, inputs),
}
