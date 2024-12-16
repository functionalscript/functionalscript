// @ts-self-types="./module.f.d.mts"
import * as Operator from '../../types/function/operator/module.f.mjs'
import * as pf from '../prime_field/module.f.mjs'
import * as bi from '../../types/bigint/module.f.mjs'
const { scalar_mul } = bi
const { prime_field, sqrt } = pf

/**
 * A 2D point represented as a pair of `bigint` values `[x, y]`.
 *
 * @typedef {readonly[bigint, bigint]} Point2D
 */

/**
 * A 2D point on an elliptic curve, represented as a pair of `bigint` values.
 * `null` represents the point at infinity (`O`).
 *
 * @typedef {Point2D|null} Point
 */

/**
 * Initialization parameters for an elliptic curve.
 *
 * @typedef {{
 *  readonly p: bigint
 *  readonly a: readonly[bigint, bigint]
 *  readonly g: readonly[bigint, bigint]
 *  readonly n: bigint
 * }} Init
 */

/**
 * Represents an elliptic curve and its associated operations.
 *
 * @typedef {{
 *  readonly pf: pf.PrimeField
 *  readonly nf: pf.PrimeField
 *  readonly y2: (x: bigint) => bigint
 *  readonly y: (x: bigint) => bigint|null
 *  readonly neg: (a: Point) => Point
 *  readonly add: Operator.Reduce<Point>
 *  readonly mul: (a: Point) => (n: bigint) => Point
 * }} Curve
 */

/**
 * Constructs an elliptic curve with the given initialization parameters.
 *
 * @example
 *
 * ```js
 * const curveParams = {
 *     p: 23n,
 *     a: [0n, 1n],
 *     g: [1n, 1n],
 *     n: 19n
 * };
 * const curveInstance = curve(curveParams);
 *
 * // Access curve operations
 * const point = curveInstance.add([1n, 1n])([2n, 5n]); // Add two points
 * const negPoint = curveInstance.neg([1n, 1n]); // Negate a point
 * const mulPoint = curveInstance.mul([1n, 1n])(3n); // Multiply a point by 3
 * ```
 *
 * @type {(i: Init) => Curve}
 */
export const curve = ({ p, a: [a0, a1], n }) => {
    const pf = prime_field(p)
    const { pow2, pow3, sub, add, mul, neg, div } = pf
    const mul3 = mul(3n)
    const mul2 = mul(2n)
    const addA1 = add(a1)
    const mulA1 = mul(a1)
    const addA0 = add(a0)
    // y**2 = a1*x**3 + a0
    /** @type {(x: bigint) => bigint} */
    const y2 = x => addA0(add(pow3(x))(mulA1(x)))
    /** @type {Operator.Reduce<Point>} */
    const addPoint = p => q => {
        if (p === null) {
            return q
        }
        if (q === null) {
            return p
        }
        const [px, py] = p
        const [qx, qy] = q
        const md = px === qx
            // (3 * px ** 2 + a1) / (2 * py)
            ? py !== qy || py === 0n ? null : [addA1(mul3(pow2(px))), mul2(py)]
            // (py - qy) / (px - qx)
            : [sub(py)(qy), sub(px)(qx)]
        if (md === null) {
            return null
        }
        const [ma, mb] = md
        const m = div(ma)(mb)
        // m ** 2 - px - qx
        const rx = sub(pow2(m))(add(px)(qx))
        // [rx, m * (px - rx) - py]
        return [rx, sub(mul(m)(sub(px)(rx)))(py)]
    }
    const sqrt_p = sqrt(pf)
    return {
        pf,
        nf: prime_field(n),
        y2,
        y: x => sqrt_p(y2(x)),
        neg: p => {
            if (p === null) {
                return null
            }
            const [x, y] = p
            return [x, neg(y)]
        },
        add: addPoint,
        mul: scalar_mul({ 0: null, add: addPoint })
    }
}

/** @type {(a: Point) => (b: Point) => boolean} */
export const eq = a => b => {
    if (a === null || b === null) {
        return a === b
    }
    const [ax, ay] = a
    const [bx, by] = b
    return ax === bx && ay === by
}

/**
 * https://neuromancer.sk/std/secg/secp192r1
 *
 * @type {Init}
 */
export const secp192r1 = {
    p: 0xffffffff_ffffffff_ffffffff_fffffffe_ffffffff_ffffffffn,
    a: [
        0x64210519_e59c80e7_0fa7e9ab_72243049_feb8deec_c146b9b1n,
        0xffffffff_ffffffff_ffffffff_fffffffe_ffffffff_fffffffcn
    ],
    g: [
        0x188da80e_b03090f6_7cbf20eb_43a18800_f4ff0afd_82ff1012n,
        0x07192b95_ffc8da78_631011ed_6b24cdd5_73f977a1_1e794811n
    ],
    n: 0xffffffff_ffffffff_ffffffff_99def836_146bc9b1_b4d22831n,
}

/**
 * https://en.bitcoin.it/wiki/Secp256k1
 * https://neuromancer.sk/std/secg/secp256k1
 *
 * @type {Init}
 */
export const secp256k1 = {
    p: 0xffffffff_ffffffff_ffffffff_ffffffff_ffffffff_ffffffff_fffffffe_fffffc2fn,
    a: [7n, 0n],
    g: [
        0x79be667e_f9dcbbac_55a06295_ce870b07_029bfcdb_2dce28d9_59f2815b_16f81798n,
        0x483ada77_26a3c465_5da4fbfc_0e1108a8_fd17b448_a6855419_9c47d08f_fb10d4b8n
    ],
    n: 0xffffffff_ffffffff_ffffffff_fffffffe_baaedce6_af48a03b_bfd25e8c_d0364141n,
}

/**
 * https://neuromancer.sk/std/secg/secp256r1
 *
 * @type { Init }
 */
export const secp256r1 ={
    p: 0xffffffff_00000001_00000000_00000000_00000000_ffffffff_ffffffff_ffffffffn,
    a: [
        0x5ac635d8_aa3a93e7_b3ebbd55_769886bc_651d06b0_cc53b0f6_3bce3c3e_27d2604bn, //< b
        0xffffffff_00000001_00000000_00000000_00000000_ffffffff_ffffffff_fffffffcn, //< a
    ],
    g: [
        0x6b17d1f2_e12c4247_f8bce6e5_63a440f2_77037d81_2deb33a0_f4a13945_d898c296n, //< x
        0x4fe342e2_fe1a7f9b_8ee7eb4a_7c0f9e16_2bce3357_6b315ece_cbb64068_37bf51f5n, //< y
    ],
    n: 0xffffffff_00000000_ffffffff_ffffffff_bce6faad_a7179e84_f3b9cac2_fc632551n,
}
