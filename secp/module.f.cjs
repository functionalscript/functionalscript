const pf = require('../prime_field/module.f.cjs')
const { prime_field } = pf

/** @typedef {readonly[bigint, bigint]} Point2D */

/** @typedef {Point2D|null} Point */

/**
 * @typedef {{
 *  readonly p: bigint
 *  readonly g: Point2D
 *  readonly a: readonly[bigint, bigint]
 *  readonly n: bigint
 * }} Init
 */

/**
 * @typedef {{
 *  readonly pf: pf.PrimeField
 *  readonly nf: pf.PrimeField
 *  readonly y2: (x: bigint) => bigint
 *  readonly y: (x: bigint) => bigint|null
 *  readonly double: (a: Point2D) => Point
 *  readonly add: (a: Point2D) => (b: Point2D) => Point
 * }} Curve
 */

/** @type {(i: Init) => Curve} */
const curve = ({ p, a: [a0, a1], n }) => {
    const pf = prime_field(p)
    const { pow2, pow3, sub, add, mul, neg, div, sqrt } = pf
    /** @type {(xy: Point2D, pqx: bigint, m: bigint) => Point2D} */
    const from_m = ([x, y], pqx, m) => {
        const m2 = pow2(m)
        const rx = sub(m2)(pqx)
        const dx = sub(rx)(x)
        const ry = add(y)(mul(m)(dx))
        return [rx, neg(ry)]
    }
    const mul2 = mul(2n)
    const mul3div2 = mul(div(3n)(2n))
    const mulA1 = mul(a1)
    const addA0 = add(a0)
    /** @type {(x: bigint) => bigint} */
    const y2 = x => addA0(add(pow3(x))(mulA1(x)))
    /** @type {(p: Point2D) => Point} */
    const double = p => {
        const [x, y] = p
        return y === 0n ? null : from_m(p, mul2(x), mul3div2(div(pow2(x))(y)))
    }
    return {
        pf,
        nf: prime_field(n),
        y2,
        y: x => sqrt(y2(x)),
        double,
        add: p => q => {
            const [px, py] = p
            const [qx, qy] = q
            return px === qx
                ? py === qy ? double(p) : null
                : from_m(p, add(px)(qx), div(sub(py)(qy))(sub(px)(qx)))
        }
    }
}
