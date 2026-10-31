/**
 * Educational calculations use the actual secp module over F₂₃. Real-number
 * constructions are a separate analogy on y² = x³ − x + 1.
 * @module
 * @import { Point, Point2D, Curve } from '../../../crypto/secp/types.ts'
 * @import { RealPoint, Construction, Calculation } from './types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { encodeScalar } from '../../../basen/base16/module.f.mjs'
import { curve, isPublicKey, secp192r1, secp256k1, secp256r1, secp384r1, secp521r1 } from '../../../crypto/secp/module.f.mjs'
import { assert, assertNotNullish } from '../../../asserts/module.f.js'
import { ok, error } from '../../../types/result/module.f.js'
import { isDigits } from '../../../text/ascii/module.f.js'

/** The example from the secp README: all 28 finite points have order 29.
 * @type {Curve}
 */
export const toy = curve({ p: 23n, c: [4n, 1n], g: [0n, 2n], n: 29n })
const { pf: { mod, reciprocal }, add, neg, mul, g, y2 } = toy

/** @type {readonly Point2D[]} */
export const points = Array.from({ length: 23 }, (_, x) => BigInt(x)).flatMap(x =>
    Array.from({ length: 23 }, (_, y) => BigInt(y)).flatMap(y =>
        y * y % 23n === y2(x) ? [/** @type {const} */ ([x, y])] : []))

/** A display label; infinity has no XY coordinates.
 * @type {(p: Point) => string}
 */
export const pointText = p => p === null ? 'O (point at infinity)' : `(${p[0]}, ${p[1]})`

/** Only selectable curve points, plus the identity, are admitted.
 * @type {(text: string) => Point | undefined}
 */
export const pointOf = text => text === 'O' ? null : points.find(p => `${p[0]},${p[1]}` === text)

/** Decimal scalar admission before BigInt parsing, including educational 0G and nG.
 * @type {(text: string, max: bigint) => Result<bigint, string>}
 */
export const scalar = (text, max) => {
    if (!isDigits(text) || text.length > max.toString().length) {
        return error(`Enter a decimal integer from 0 to ${max}.`)
    }
    const k = BigInt(text)
    return k <= max ? ok(k) : error(`Enter a decimal integer from 0 to ${max}.`)
}

/** Each educational frame is computed with the module, not a second engine.
 * @type {(k: bigint) => readonly Point[]}
 */
export const sequence = k => Array.from({ length: Number(k) + 1 }, (_, i) => mul(BigInt(i))(g))

/** Every grid position on the finite-field secant or tangent. These are
 * discrete solutions of a modular equation, not samples of a Euclidean line.
 * @type {(p: Point, q: Point) => readonly Point2D[]}
 */
export const modularLine = (p, q) => {
    if (p === null || q === null) { return [] }
    const [x1, y1] = p
    const [x2, y2] = q
    const same = x1 === x2 && y1 === y2
    const denominator = mod(same ? 2n * y1 : x2 - x1)
    if (denominator === 0n) {
        return Array.from({ length: 23 }, (_, y) => /** @type {const} */ ([x1, BigInt(y)]))
    }
    const numerator = mod(same ? 3n * x1 * x1 + 1n : y2 - y1)
    const m = mod(numerator * reciprocal(denominator))
    return Array.from({ length: 23 }, (_, x) => {
        const bx = BigInt(x)
        return /** @type {const} */ ([bx, mod(y1 + m * (bx - x1))])
    })
}

/** Substituted modular formulas, with identity/inverse cases before division.
 * @type {(p: Point, q: Point) => Calculation}
 */
export const addition = (p, q) => {
    const result = add(p)(q)
    if (p === null || q === null) {
        return { result, lines: [`${pointText(p)} + ${pointText(q)} = ${pointText(result)}. O is the identity.`] }
    }
    const [x1, y1] = p
    const [x2, y2] = q
    if (result === null) {
        return { result, lines: ['The denominator is 0 mod 23; its modular inverse is undefined.', 'P + (−P) = O. Doubling a point with y = 0 also gives O.'] }
    }
    const doubling = x1 === x2
    const numerator = mod(doubling ? 3n * x1 * x1 + 1n : y2 - y1)
    const denominator = mod(doubling ? 2n * y1 : x2 - x1)
    const inverse = reciprocal(denominator)
    const m = mod(numerator * inverse)
    const [x3, y3] = result
    return { result, lines: [
        `${denominator}⁻¹ mod 23 = ${inverse}, because ${denominator} · ${inverse} mod 23 = 1.`,
        doubling
            ? `m = (3 · ${x1}² + 1) · (${2n * y1})⁻¹ mod 23 = ${m}`
            : `m = (${y2} − ${y1}) · (${x2} − ${x1})⁻¹ mod 23 = ${m}`,
        `x₃ = (${m}² − ${x1} − ${x2}) mod 23 = ${x3}`,
        `y₃ = (${m} · (${x1} − ${x3}) − ${y1}) mod 23 = ${y3}`,
    ] }
}

/** @type {(p: Point) => Calculation} */
export const negative = p => ({ result: neg(p), lines: [
    p === null ? '−O = O' : `−P = (${p[0]}, (−${p[1]}) mod 23) = ${pointText(neg(p))}`,
    'P + (−P) = O',
] })

/** The real curve's two branches. Invalid/off-curve inputs are refused.
 * @type {(x: number, branch: number) => RealPoint | null}
 */
export const realPoint = (x, branch) => {
    const square = x * x * x - x + 1
    return Number.isFinite(x) && square >= 0 ? [x, (branch < 0 ? -1 : 1) * Math.sqrt(square)] : null
}

/** @type {(p: RealPoint) => boolean} */
export const onRealCurve = ([x, y]) => Number.isFinite(x) && Number.isFinite(y)
    && Math.abs(y * y - (x * x * x - x + 1)) <= 1e-8 * Math.max(1, Math.abs(y * y))

/** Real secant/tangent construction; never treats modular points as geometry.
 * @type {(p: RealPoint, q: RealPoint) => Construction}
 */
export const construction = (p, q) => {
    if (!onRealCurve(p) || !onRealCurve(q)) { return { kind: 'refused', message: 'Select finite points on the real curve.' } }
    const [x1, y1] = p
    const [x2, y2] = q
    const same = x1 === x2 && y1 === y2
    if (x1 === x2 && (!same || y1 === 0)) { return { kind: 'infinity' } }
    const denominator = same ? 2 * y1 : x2 - x1
    if (Math.abs(denominator) < 1e-7) { return { kind: 'refused', message: 'The construction is too close to a vertical line to draw reliably.' } }
    const slope = (same ? 3 * x1 * x1 - 1 : y2 - y1) / denominator
    const x3 = slope * slope - x1 - x2
    const sy = slope * (x3 - x1) + y1
    /** @type {RealPoint} */
    const result = [x3, -sy]
    if (!Number.isFinite(slope) || !onRealCurve(result)) {
        return { kind: 'refused', message: 'This construction is numerically unstable. Move the inputs farther apart.' }
    }
    return { kind: 'finite', slope, third: [x3, sy], result }
}

/** @type {readonly { readonly name: string, readonly curve: Curve }[]} */
export const namedCurves = [
    { name: 'secp192r1', curve: secp192r1 },
    { name: 'secp256k1', curve: secp256k1 },
    { name: 'secp256r1', curve: secp256r1 },
    { name: 'secp384r1', curve: secp384r1 },
    { name: 'secp521r1', curve: secp521r1 },
]

/** Decimal, client-side demo key generation with SEC 1 validation and padded hex.
 * @type {(name: string, text: string) => Result<string, string>}
 */
export const publicKey = (name, text) => {
    const named = namedCurves.find(c => c.name === name)
    if (named === undefined) { return error('Select a supported curve.') }
    const c = named.curve
    const parsed = scalar(text, c.nf.p - 1n)
    if (parsed[0] === 'error') { return parsed }
    if (parsed[1] === 0n) { return error('The private scalar must satisfy 1 ≤ d < n.') }
    const q = assertNotNullish(c.mul(parsed[1])(c.g))
    assert(isPublicKey(c)(q))
    const hex = encodeScalar(Math.ceil(c.pf.p.toString(2).length / 8) * 2)
    return ok(`X = ${hex(q[0])}\nY = ${hex(q[1])}`)
}
