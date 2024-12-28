import { curve, secp256k1, secp192r1, secp256r1, eq, type Init, type Point } from './module.f.ts'

export default {
    example: () => {
        const curveParams: Init = {
            p: 23n,
            a: [0n, 1n],
            g: [1n, 1n],
            n: 19n
        }
        const c = curve(curveParams)
        // Access curve operations
        const point = c.add([1n, 1n])([2n, 5n]); // Add two points
        const negPoint = c.neg([1n, 1n]); // Negate a point
        const mulPoint = c.mul([1n, 1n])(3n); // Multiply a point by 3
    },
    test: () => {
        const test_curve
        : (c: Init) => void
        = c => {
            const { g } = c
            const { mul, neg, pf: { abs }, y: yf, nf: { p: n } } = curve(c)
            const point_check
            : (p: Point) => void
            = p => {
                if (p === null) { throw 'p === null' }
                const [x, y] = p
                const ye = yf(x)
                if (ye === null) { throw 'ye === null' }
                if (abs(ye) !== abs(y)) { throw 'ye' }
            }
            point_check(g)
            point_check(neg(g))
            const test_mul
            : (p: Point) => void
            = p => {
                if (mul(p)(0n) !== null) { throw 'O' }
                if (mul(p)(1n) !== p) { throw 'p' }
                if (mul(p)(n) !== null) { throw 'n' }
                const pn = neg(p)
                if (!eq(mul(p)(n - 1n))(pn)) { throw 'n - 1' }
                const f
                : (s: bigint) => void
                = s => {
                    const r = mul(p)(s)
                    point_check(r)
                    const rn = mul(pn)(s)
                    point_check(rn)
                    if (!eq(r)(neg(rn))) { throw 'r != -rn' }
                }
                f(2n)
                f(3n)
                f(4n << 128n)
                f((5n << 128n) + 6n)
                f(7n << 128n)
                f((8n << 128n) + 9n)
            }
            test_mul(g)
            test_mul(neg(g))
        }
        test_curve(secp256k1)
        test_curve(secp192r1)
        test_curve(secp256r1)
    }
}
