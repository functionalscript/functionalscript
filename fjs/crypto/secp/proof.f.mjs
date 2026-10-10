/**
 * @import { Point, Curve, Init } from './types.ts'
 */

import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { prime_field } from '../../types/prime_field/module.f.mjs'
import { curve, secp256k1, secp192r1, secp256r1, eq, isPublicKey, secp384r1, secp521r1 } from './module.f.mjs'

/** @type {(param: Curve) => () => void} */
const poker = param => () => {
    // (c ^ x) ^ y = c ^ (x * y)
    // c ^ ((x * y) * (1/x * 1/y)) = c
    // const { g, n } = param
    const { mul, y, nf: { p: n } } = param
    /** @type {(m: bigint) => (pList: readonly Point[]) => readonly Point[]} */
    const f = m => pList => pList.map(mul(m))
    //
    const pf = prime_field(n)
    //           0        1        2        3        4        5        6        7
    const sA = 0x0123_4567_89AB_CDEF_0123_4567_89AB_CDEF_0123_4567_89AB_CDEF_0123_4567_89AB_CDEFn % n
    const sB = 0xFEDC_BA98_FEDC_BA98_FEDC_BA98_FEDC_BA98_FEDC_BA98_FEDC_BA98_FEDC_BA98_FEDC_BA98n % n
    // "22d3ad011aec6aabdb3d3d47636f3e2859de02298c87a496"
    // "2b359de5cfb5937a5610d565dceaef2a760ceeaec96e68140757f0c8371534e0"
    // "1359162ede91207ccaea1de94afc63c1db5a967c1e6e21f91ef9f077f20a46b6"
    const rA = pf.reciprocal(sA)
    // "e1e768c7427cf5bafd58756df9b54b9ec2558201f129f4ab"
    // "edaf7ede285c3da723c54fcdaa3b631f626681f884d8f41fae55c4f552bb551e"
    // "6ca248e88c124478975b57c4c3ca682bd8be0f0d9f11593d01273d9ceebdb735"
    const rB = pf.reciprocal(sB)
    //
    /** @type {readonly Point[]} */
    let d = []
    for (let i = 0n; i < 52n; ++i) {
        let nonce = 0n // can be a random number in a range [`0`, `p >> 6n`).
        let x = 0n
        /** @type {bigint | null} */
        let yi
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
        assert(p !== null, 'null')
        const x = p[0] & 0x3Fn
        assertEq(x, m, [p[0], x, m])
        ++m
    }
}

export const proof = {
    example: () => {
        /** @type {Init} */
        const curveParams = {
            p: 23n,
            c: [4n, 1n],
            g: [0n, 2n],
            n: 29n
        }
        const c = curve(curveParams)
        // Access curve operations
        const point = c.add([0n, 2n])([1n, 11n])
        const negPoint = c.neg([0n, 2n])
        const mulPoint = c.mul(3n)([0n, 2n])
        const identity = c.mul(29n)(c.g)
        assert(eq(point)([11n, 14n]))
        assert(eq(negPoint)([0n, 21n]))
        assert(eq(mulPoint)([11n, 9n]))
        assertEq(identity, null)
    },
    test: () => {
        /** @type {(c: Curve) => void} */
        const test_curve = c => {
            const { mul, neg, pf: { abs }, y: yf, nf: { p: n }, g } = c
            /** @type {(p: Point) => void} */
            const point_check = p => {
                assert(p !== null, 'p === null')
                const [x, y] = p
                const ye = assertNotNullish(yf(x), 'ye === null')
                assertEq(abs(ye), abs(y), 'ye')
            }
            point_check(g)
            point_check(neg(g))
            /** @type {(p: Point) => void} */
            const test_mul = p => {
                assertEq(mul(0n)(p), null, 'O')
                assertEq(mul(1n)(p), p, 'p')
                assertEq(mul(n)(p), null, 'n')
                const pn = neg(p)
                assert(eq(mul(n - 1n)(p))(pn), 'n - 1')
                /** @type {(s: bigint) => void} */
                const f = s => {
                    const r = mul(s)(p)
                    point_check(r)
                    const rn = mul(s)(pn)
                    point_check(rn)
                    assert(eq(r)(neg(rn)), 'r != -rn')
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
    },
    // Cover null (point at infinity) branches in neg, add, and eq.
    nullPointOps: () => {
        const c = secp256k1
        assertEq(c.neg(null), null)
        assert(eq(null)(null))
        assert(!eq(null)(c.g))
        assert(!eq(c.g)(null))
        assert(eq(c.add(c.g)(null))(c.g))
    },
    isPublicKey: () => {
        const k = isPublicKey(secp256k1)
        const { pf: { p }, g } = secp256k1
        const [gx, gy] = assertNotNullish(g, 'g === null')
        assert(k(g))
        assert(k(secp256k1.mul(12345n)(g)))
        // the point at infinity
        assert(!k(null))
        // coordinates outside `[0, p-1]`, though congruent to `g`'s
        assert(!k([-1n, gy]))
        assert(!k([gx + p, gy]))
        assert(!k([gx, gy + p]))
        // off the curve
        assert(!k([gx, gy + 1n]))
        // every named curve meets the bound on `n`, so its generator passes
        for (const c of [secp192r1, secp256k1, secp256r1, secp384r1, secp521r1]) {
            assert(isPublicKey(c)(c.g))
        }
        // on the curve but outside the subgroup: `y^2 = x^3 + x + 1` over 11
        // has 14 points; `g = (0, 1)` generates the subgroup of order 7, and
        // `7^2 = 49` exceeds the bound `11 + 1 + 2·√11`, about 18.6.
        // `(1, 5)` is on the curve and outside it.
        const c14 = curve({ p: 11n, c: [1n, 1n], g: [0n, 1n], n: 7n })
        assert(isPublicKey(c14)([0n, 1n]))
        assert(!isPublicKey(c14)([1n, 5n]))
    },
    isPublicKeyRefusesSmallN: () => {
        // `y^2 = x^3 + 6x` over 7, `g = (0, 0)`, `n = 2`: `n^2 - p - 1 < 0`.
        // `(1, 0)` has `2·u = O` but is not in `{O, g}`; without the bound,
        // it would pass, and `verify` would accept `[1, 1]` on message "8".
        const c2 = curve({ p: 7n, c: [0n, 6n], g: [0n, 0n], n: 2n })
        assert(eq(c2.mul(2n)([1n, 0n]))(null))
        assert(!isPublicKey(c2)([1n, 0n]))
        assert(!isPublicKey(c2)([0n, 0n]))
        // `y^2 = x^3 + 1` over 7, `n = 3`: `d = 1 > 0` but `d^2 = 1 <= 28`.
        // Even the generator is refused: the bound cannot vouch for any key.
        const c3 = curve({ p: 7n, c: [1n, 0n], g: [0n, 1n], n: 3n })
        assert(!isPublicKey(c3)([0n, 1n]))
    },
}
