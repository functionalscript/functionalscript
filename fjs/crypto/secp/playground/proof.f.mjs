import { assert, assertEq, assertOk, assertError, assertNotNullish } from '../../../asserts/module.f.mjs'
import { eq, curve } from '../module.f.mjs'
import { toy, points, pointText, pointOf, scalar, sequence, addition, negative, realPoint, onRealCurve, construction, namedCurves, publicKey } from './module.f.mjs'

export const proof = {
    finite: () => {
        assertEq(points.length, 28)
        assertEq(pointText(null), 'O (point at infinity)')
        assertEq(pointText(toy.g), '(0, 2)')
        assertEq(pointOf('O'), null)
        assertEq(pointOf('99,2'), undefined)
        assert(eq(pointOf('0,2') ?? null)(toy.g))
        for (const p of points) {
            assertEq(toy.pf.pow2(p[1]), toy.y2(p[0]))
            assert(eq(addition(p, toy.neg(p)).result)(null))
            assert(eq(addition(p, null).result)(p))
            assert(eq(addition(null, p).result)(p))
            for (const q of points) { assert(eq(addition(p, q).result)(toy.add(p)(q))) }
        }
        const doubling = addition(toy.g, toy.g)
        assert(eq(doubling.result)([13n, 12n]))
        assert(doubling.lines.includes('m = (3 · 0² + 1) · (4)⁻¹ mod 23 = 6'))
        assert(eq(addition(toy.g, [13n, 12n]).result)([11n, 9n]))
        assert(eq(negative(toy.g).result)([0n, 21n]))
        assertEq(negative(null).result, null)
        assertEq(addition(null, null).result, null)
        for (let k = 0n; k <= 29n; ++k) {
            const frames = sequence(k)
            assertEq(frames.length, Number(k) + 1)
            frames.forEach((p, i) => assert(eq(p)(toy.mul(BigInt(i))(toy.g))))
        }
        assertEq(sequence(29n).at(-1), null)
        // The toy prime-order group has no finite y=0 point. Test the module
        // identity rule on a different nonsingular curve with such a point.
        const even = curve({ p: 7n, c: [0n, 6n], g: [0n, 0n], n: 2n })
        assertEq(even.add(even.g)(even.g), null)
    },
    scalar: () => {
        assertEq(assertOk(scalar('3', 29n)), 3n)
        assertEq(assertOk(scalar('0', 29n)), 0n)
        assertEq(assertOk(scalar('29', 29n)), 29n)
        for (const text of ['', '-1', '1.5', '0x3', 'NaN', '30', '999', ' 3', '3 ']) {
            assertEq(assertError(scalar(text, 29n)), 'Enter a decimal integer from 0 to 29.')
        }
    },
    real: () => {
        const p = assertNotNullish(realPoint(0, 1))
        const q = assertNotNullish(realPoint(1, 1))
        assertEq(realPoint(0, -1)?.[1], -1)
        assertEq(realPoint(-2, 1), null)
        assertEq(realPoint(Infinity, 1), null)
        assert(!onRealCurve([0, 2]))
        assert(!onRealCurve([NaN, 1]))
        assert(!onRealCurve([0, Infinity]))
        const c = construction(p, q)
        assert(c.kind === 'finite')
        assertEq(c.slope, 0)
        assertEq(c.third[0], -1)
        assertEq(c.third[1], 1)
        assertEq(c.result[1], -c.third[1])
        assert(onRealCurve(c.third))
        assert(onRealCurve(c.result))
        const tangent = construction(p, p)
        assert(tangent.kind === 'finite')
        assertEq(tangent.slope, -0.5)
        assertEq(tangent.result[0], 0.25)
        assertEq(tangent.result[1], -0.875)
        assertEq(construction(p, [0, -1]).kind, 'infinity')
        assertEq(construction([-1.324717957244746, 0], [-1.324717957244746, 0]).kind, 'infinity')
        assertEq(construction(p, [0, 2]).kind, 'refused')
        assertEq(construction([0, 2], p).kind, 'refused')
        assertEq(construction(p, assertNotNullish(realPoint(1e-9, 1))).kind, 'refused')
        const huge = assertNotNullish(realPoint(1e100, 1))
        assertEq(construction(huge, assertNotNullish(realPoint(1e100 + 1e90, 1))).kind, 'refused')
        for (const x of [-1.3, -1, 0, 0.5, 1, 2, 3]) {
            const a = assertNotNullish(realPoint(x, 1))
            const r = construction(a, p)
            assert(r.kind === 'finite')
            assert(onRealCurve(r.result))
        }
    },
    keys: () => {
        // Known 3G vectors, also cross-checked against Node’s OpenSSL ECDH.
        assertEq(assertOk(publicKey('secp256k1', '3')), 'X = f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9\nY = 388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672')
        assertEq(assertOk(publicKey('secp256r1', '3')), 'X = 5ecbe4d1a6330a44c8f7ef951d4bf165e6c6b721efada985fb41661bc6e7fd6c\nY = 8734640c4998ff7e374b06ce1a64a2ecd82ab036384fb83d9a79b127a27d5032')
        assertEq(assertError(publicKey('missing', '3')), 'Select a supported curve.')
        assertEq(assertError(publicKey('secp256k1', '0')), 'The private scalar must satisfy 1 ≤ d < n.')
        assertError(publicKey('secp256k1', 'xyz'))
        for (const { name, curve } of namedCurves) {
            assertOk(publicKey(name, '1'))
            assertOk(publicKey(name, '3'))
            assertError(publicKey(name, curve.nf.p.toString()))
        }
    },
}
