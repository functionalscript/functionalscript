const op = require('../types/function/operator/module.f.cjs')
const pf = require('../prime_field/module.f.cjs')
const { generic_mul, prime_field } = pf

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
 *  readonly add: op.Reduce<Point>
 *  readonly mul: (a: Point) => (n: bigint) => Point
 * }} Curve
 */

/** @type {(i: Init) => Curve} */
const curve = ({ p, a: [a0, a1], n }) => {
    const pf = prime_field(p)
    const { pow2, pow3, sub, add, mul, neg, div, sqrt } = pf
    const mul3div2 = mul(div(3n)(2n))
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
        const m = px === qx
            // (3/2) * (px ** 2) / py
            ? py !== qy || py === 0n ? null : mul3div2(div(pow2(px))(py))
            // (py - qy) / (px - qx)
            : div(sub(py)(qy))(sub(px)(qx))
        if (m === null) {
            return null
        }
        // m ** 2 - px - qx
        const rx = sub(pow2(m))(add(px)(qx))
        // [rx, m * (px - rx) - py]
        return [rx, sub(mul(m)(sub(px)(rx)))(py)]
    }
    return {
        pf,
        nf: prime_field(n),
        y2,
        y: x => sqrt(y2(x)),
        add: addPoint,
        mul: generic_mul(null, addPoint)
    }
}
