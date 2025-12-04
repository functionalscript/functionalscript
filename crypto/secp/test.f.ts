import { prime_field } from '../../types/prime_field/module.f.ts'
import { curve, secp256k1, secp192r1, secp256r1, eq, type Point, secp384r1, secp521r1, type Curve, type Init } from './module.f.ts'

const poker = (param: Curve) => () => {
    // (c ^ x) ^ y = c ^ (x * y)
    // c ^ ((x * y) * (1/x * 1/y)) = c
    // const { g, n } = param
    const { mul, y, nf: { p: n } } = param
    const f = (m: bigint) => (pList: readonly Point[]) => pList.map(mul(m))
    //
    const pf = prime_field(n)
    //           0        1        2        3        4        5        6        7
    const sA = 0x01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEFn % n
    const sB = 0xFEDCBA98_FEDCBA98_FEDCBA98_FEDCBA98_FEDCBA98_FEDCBA98_FEDCBA98_FEDCBA98n % n
    // "22d3ad011aec6aabdb3d3d47636f3e2859de02298c87a496"
    // "2b359de5cfb5937a5610d565dceaef2a760ceeaec96e68140757f0c8371534e0"
    // "1359162ede91207ccaea1de94afc63c1db5a967c1e6e21f91ef9f077f20a46b6"
    const rA = pf.reciprocal(sA)
    // "e1e768c7427cf5bafd58756df9b54b9ec2558201f129f4ab"
    // "edaf7ede285c3da723c54fcdaa3b631f626681f884d8f41fae55c4f552bb551e"
    // "6ca248e88c124478975b57c4c3ca682bd8be0f0d9f11593d01273d9ceebdb735"
    const rB = pf.reciprocal(sB)
    //
    let d: readonly Point[] = []
    for (let i = 0n; i < 52n; ++i) {
        let nonce = 0n // can be a random number in a range [`0`, `p >> 6n`).
        let x = 0n
        let yi: bigint|null
        while (true) {
            x = i | (nonce << 6n)
            yi = y(x)
            if (yi !== null) {
                break
            }
            ++nonce
        }
        d = [...d, [x, yi]]
    }
    //
    const dA = f(sA)(d)
    const dAB = f(sB)(dA)
    const dB = f(rA)(dAB)
    const dN = f(rB)(dB)
    //
    let m = 0n
    for (const p of dN) {
        if (p === null) {
            throw 'null'
        }
        const x = p[0] & 0x3Fn
        if (x !== m) { throw [p[0], x, m] }
        ++m
    }
}

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
        const mulPoint = c.mul(3n)([1n, 1n]); // Multiply a point by 3
    },
    test: () => {
        const test_curve
        : (c: Curve) => void
        = c => {
            const { mul, neg, pf: { abs }, y: yf, nf: { p: n }, g } = c
            const point_check = (p: Point): void => {
                if (p === null) { throw 'p === null' }
                const [x, y] = p
                const ye = yf(x)
                if (ye === null) { throw 'ye === null' }
                if (abs(ye) !== abs(y)) { throw 'ye' }
            }
            point_check(g)
            point_check(neg(g))
            const test_mul = (p: Point): void => {
                if (mul(0n)(p) !== null) { throw 'O' }
                if (mul(1n)(p) !== p) { throw 'p' }
                if (mul(n)(p) !== null) { throw 'n' }
                const pn = neg(p)
                if (!eq(mul(n - 1n)(p))(pn)) { throw 'n - 1' }
                const f
                : (s: bigint) => void
                = s => {
                    const r = mul(s)(p)
                    point_check(r)
                    const rn = mul(s)(pn)
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
        test_curve(secp384r1)
        test_curve(secp521r1)
    },
    poker: () => {
        const c = {
            secp192r1,
            //secp256k1,
            //secp256r1,
        }
        return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, poker(v)]))
    }
}
