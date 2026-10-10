/**
 * Short Weierstrass elliptic-curve arithmetic over a prime field: `curve`
 * builds point negation, addition, and scalar multiplication for any
 * `secp`-family curve from its `(p, c, g, n)` parameters.
 *
 * @module
 *
 * @import { Equal, Reduce } from '../../types/function/operator/types.ts'
 * @import { Curve, Init, Point } from './types.ts'
 */

import { prime_field, sqrt } from '../../types/prime_field/module.f.mjs'
import { repeat } from '../../common/monoid/module.f.mjs'

/**
 * Constructs an elliptic curve with the given initialization parameters.
 *
 * @param {Init} _
 * @returns {Curve}
 *
 * @example
 *
 * ```js
 * // y² = x³ + x + 4 over F₂₃: 29 points, a prime order, so any finite
 * // point generates the whole group
 * const curveParams = {
 *     p: 23n,
 *     c: [4n, 1n],
 *     g: [0n, 2n],
 *     n: 29n
 * };
 * const curveInstance = curve(curveParams);
 *
 * // Access curve operations
 * const point = curveInstance.add([0n, 2n])([1n, 11n]); // [11n, 14n]
 * const negPoint = curveInstance.neg([0n, 2n]); // [0n, 21n]
 * const mulPoint = curveInstance.mul(3n)([0n, 2n]); // [11n, 9n]
 * const identity = curveInstance.mul(29n)(curveInstance.g); // null
 * ```
 */
export const curve = ({ p, c: [c0, c1], n, g }) => {
    const pf = prime_field(p)
    const { pow2, pow3, sub, add, mul, neg, div } = pf
    const mul3 = mul(3n)
    const mul2 = mul(2n)
    const addC1 = add(c1)
    const mulC1 = mul(c1)
    const addC0 = add(c0)

    /**
     * y**2 = x**3 + c1*x + c0
     *
     * @type {(x: bigint) => bigint}
     */
    const y2 = x => addC0(add(pow3(x))(mulC1(x)))

    /** @type {Reduce<Point>} */
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
            // (3 * px ** 2 + c1) / (2 * py)
            ? py !== qy || py === 0n ? null : [addC1(mul3(pow2(px))), mul2(py)]
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
        g,
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
        mul: repeat({ identity: null, operation: addPoint })
    }
}

/** @type {Equal<Point>} */
export const eq = a => b => {
    if (a === null || b === null) {
        return a === b
    }
    const [ax, ay] = a
    const [bx, by] = b
    return ax === bx && ay === by
}

/**
 * Whether `u` is a valid public key of the curve `c`, as SEC 1 §3.2.2.1
 * validates one: not the point at infinity, coordinates in `[0, p-1]`, on
 * the curve, and `n·u = O`. Formulas over any other pair of coordinates still
 * compute, but mean nothing, so a key from outside must pass this before it
 * is used.
 *
 * `n·u = O` shows that `u` is in the subgroup `g` generates only when that
 * subgroup holds every point of order `n`. For a prime `n`, as ECDSA
 * requires, the points with `n·u = O` number `1`, `n` or `n²`. Hasse's bound
 * puts at most `p + 1 + 2√p` points on the curve; when `n²` exceeds it, `n²`
 * cannot divide the curve's order, so the curve has no other point of order
 * `n`. A composite `n` gives no such guarantee: on `y² = x³ + 3x` over 7 with
 * `g = (1, 2)` and `n = 4`, `(3, 1)` passes outside `⟨g⟩`. `n` is not tested
 * for primality, as `p` is not either.
 * For a curve where `n²` does not exceed it, such as `y² = x³ + 6x` over 7
 * with `g = (0, 0)` and `n = 2`, where `(1, 0)` is a second point of order
 * 2, the test proves nothing, and every key is refused. The named curves
 * below all have cofactor 1: `n` is close to the curve's order, and `n²`
 * exceeds the bound by far.
 *
 * @type {(c: Curve) => (u: Point) => boolean}
 */
export const isPublicKey = ({ pf: { p, pow2 }, nf: { p: n }, y2, mul }) => {
    // `n² > p + 1 + 2√p`, in integers: `d = n² - p - 1 > 0` and `d² > 4p`.
    const d = n * n - p - 1n
    const nTorsionIsSubgroup = d > 0n && d * d > 4n * p
    /** @type {(v: bigint) => boolean} */
    const inField = v => 0n <= v && v < p
    return u => {
        if (!nTorsionIsSubgroup || u === null) {
            return false
        }
        const [x, y] = u
        return inField(x) && inField(y) && pow2(y) === y2(x) && mul(n)(u) === null
    }
}

/**
 * https://neuromancer.sk/std/secg/secp192r1
 * NIST P-192
 */
export const secp192r1 = curve({
    p: 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe_ffff_ffff_ffff_ffffn,
    c: [
        0x6421_0519_e59c_80e7_0fa7_e9ab_7224_3049_feb8_deec_c146_b9b1n, //< c0 = b
        0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe_ffff_ffff_ffff_fffcn, //< c1 = a
    ],
    g: [
        0x188d_a80e_b030_90f6_7cbf_20eb_43a1_8800_f4ff_0afd_82ff_1012n,
        0x0719_2b95_ffc8_da78_6310_11ed_6b24_cdd5_73f9_77a1_1e79_4811n
    ],
    n: 0xffff_ffff_ffff_ffff_ffff_ffff_99de_f836_146b_c9b1_b4d2_2831n,
})

// The curve doesn't have a simple square root function.
// /**
//  * https://std.neuromancer.sk/nist/P-224
//  * NIST P-224
//  */
// export const secp224r1: Curve = curve({
//     p: 0xffffffff_ffffffff_ffffffff_ffffffff_00000000_00000000_00000001n,
//     c: [
//         0xb4050a85_0c04b3ab_f5413256_5044b0b7_d7bfd8ba_270b3943_2355ffb4n, //< c0 = b
//         0xffffffff_ffffffff_ffffffff_fffffffe_ffffffff_ffffffff_fffffffen, //< c1 = a
//     ],
//     g: [
//         0xb70e0cbd_6bb4bf7f_321390b9_4a03c1d3_56c21122_343280d6_115c1d21n,
//         0xbd376388_b5f723fb_4c22dfe6_cd4375a0_5a074764_44d58199_85007e34n,
//     ],
//     n: 0xffffffff_ffffffff_ffffffff_ffff16a2_e0b8f03e_13dd2945_5c5c2a3dn,
// })

/**
 * https://en.bitcoin.it/wiki/Secp256k1
 * https://neuromancer.sk/std/secg/secp256k1
 */
export const secp256k1 = curve({
    p: 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe_ffff_fc2fn,
    c: [
        7n, //< c0 = b
        0n, //< c1 = a
    ],
    g: [
        0x79be_667e_f9dc_bbac_55a0_6295_ce87_0b07_029b_fcdb_2dce_28d9_59f2_815b_16f8_1798n,
        0x483a_da77_26a3_c465_5da4_fbfc_0e11_08a8_fd17_b448_a685_5419_9c47_d08f_fb10_d4b8n
    ],
    n: 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe_baae_dce6_af48_a03b_bfd2_5e8c_d036_4141n,
})

/**
 * https://neuromancer.sk/std/secg/secp256r1
 * NIST P-256
 */
export const secp256r1 = curve({
    p: 0xffff_ffff_0000_0001_0000_0000_0000_0000_0000_0000_ffff_ffff_ffff_ffff_ffff_ffffn,
    c: [
        0x5ac6_35d8_aa3a_93e7_b3eb_bd55_7698_86bc_651d_06b0_cc53_b0f6_3bce_3c3e_27d2_604bn, //< c0 = b
        0xffff_ffff_0000_0001_0000_0000_0000_0000_0000_0000_ffff_ffff_ffff_ffff_ffff_fffcn, //< c1 = a
    ],
    g: [
        0x6b17_d1f2_e12c_4247_f8bc_e6e5_63a4_40f2_7703_7d81_2deb_33a0_f4a1_3945_d898_c296n, //< x
        0x4fe3_42e2_fe1a_7f9b_8ee7_eb4a_7c0f_9e16_2bce_3357_6b31_5ece_cbb6_4068_37bf_51f5n, //< y
    ],
    n: 0xffff_ffff_0000_0000_ffff_ffff_ffff_ffff_bce6_faad_a717_9e84_f3b9_cac2_fc63_2551n,
})

/**
 * https://neuromancer.sk/std/secg/secp384r1
 */
export const secp384r1 = curve({
    p: 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe_ffff_ffff_0000_0000_0000_0000_ffff_ffffn,
    c: [
        0xb331_2fa7_e23e_e7e4_988e_056b_e3f8_2d19_181d_9c6e_fe81_4112_0314_088f_5013_875a_c656_398d_8a2e_d19d_2a85_c8ed_d3ec_2aefn, //< c0 = b
        0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe_ffff_ffff_0000_0000_0000_0000_ffff_fffcn, //< c1 = a
    ],
    g: [
        0xaa87_ca22_be8b_0537_8eb1_c71e_f320_ad74_6e1d_3b62_8ba7_9b98_59f7_41e0_8254_2a38_5502_f25d_bf55_296c_3a54_5e38_7276_0ab7n, //< x
        0x3617_de4a_9626_2c6f_5d9e_98bf_9292_dc29_f8f4_1dbd_289a_147c_e9da_3113_b5f0_b8c0_0a60_b1ce_1d7e_819d_7a43_1d7c_90ea_0e5fn, //< y
    ],
    n: 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_c763_4d81_f437_2ddf_581a_0db2_48b0_a77a_ecec_196a_ccc5_2973n,
})

/**
 * https://neuromancer.sk/std/secg/secp521r1
 */
export const secp521r1 = curve({
    p: 0x01ff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn,
    c: [
        0x0051_953e_b961_8e1c_9a1f_929a_21a0_b685_40ee_a2da_725b_99b3_15f3_b8b4_8991_8ef1_09e1_5619_3951_ec7e_937b_1652_c0bd_3bb1_bf07_3573_df88_3d2c_34f1_ef45_1fd4_6b50_3f00n, //< c0 = b
        0x01ff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_fffcn, //< c1 = a
    ],
    g: [
        0x00c6_858e_06b7_0404_e9cd_9e3e_cb66_2395_b442_9c64_8139_053f_b521_f828_af60_6b4d_3dba_a14b_5e77_efe7_5928_fe1d_c127_a2ff_a8de_3348_b3c1_856a_429b_f97e_7e31_c2e5_bd66n,
        0x0118_3929_6a78_9a3b_c004_5c8a_5fb4_2c7d_1bd9_98f5_4449_579b_4468_17af_bd17_273e_662c_97ee_7299_5ef4_2640_c550_b901_3fad_0761_353c_7086_a272_c240_88be_9476_9fd1_6650n,
    ],
    n: 0x01ff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_ffff_fffa_5186_8783_bf2f_966b_7fcc_0148_f709_a5d0_3bb5_c9b8_899c_47ae_bb6f_b71e_9138_6409n
})
