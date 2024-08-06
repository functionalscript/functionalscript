const op = require('../types/function/operator/module.f.cjs')
const pf = require('../prime_field/module.f.cjs')
const { scalar_mul, prime_field, sqrt } = pf

/** @typedef {readonly[bigint, bigint]} Point2D */

/** @typedef {Point2D|null} Point */

/**
 * @typedef {{
 *  readonly p: bigint
 *  readonly a: readonly[bigint, bigint]
 *  readonly g: readonly[bigint, bigint]
 *  readonly n: bigint
 * }} Init
 */

/**
 * @typedef {{
 *  readonly pf: pf.PrimeField
 *  readonly nf: pf.PrimeField
 *  readonly y2: (x: bigint) => bigint
 *  readonly y: (x: bigint) => bigint|null
 *  readonly neg: (a: Point) => Point
 *  readonly add: op.Reduce<Point>
 *  readonly mul: (a: Point) => (n: bigint) => Point
 * }} Curve
 */

/** @type {(i: Init) => Curve} */
const curve = ({ p, a: [a0, a1], n }) => {
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
    /** @type {op.Reduce<Point>} */
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
        mul: scalar_mul(null, addPoint)
    }
}

module.exports = {
    curve,
    /** @type {(a: Point) => (b: Point) => boolean} */
    eq: a => b => {
        if (a === null || b === null) {
            return a === b
        }
        const [ax, ay] = a
        const [bx, by] = b
        return ax === bx && ay === by
    },
    /** @type {Init} */
    secp256k1: {
        p: 0xffffffff_ffffffff_ffffffff_ffffffff_ffffffff_ffffffff_fffffffe_fffffc2fn,
        a: [7n, 0n],
        g: [
            0x79be667e_f9dcbbac_55a06295_ce870b07_029bfcdb_2dce28d9_59f2815b_16f81798n,
            0x483ada77_26a3c465_5da4fbfc_0e1108a8_fd17b448_a6855419_9c47d08f_fb10d4b8n
        ],
        n: 0xffffffff_ffffffff_ffffffff_fffffffe_baaedce6_af48a03b_bfd25e8c_d0364141n,
    },
    /** @type {Init} */
    secp192r1: {
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
    },
}
