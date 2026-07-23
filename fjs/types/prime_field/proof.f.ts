import { modSqrt, prime_field, sqrt } from './module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

export const proof = {
    throw: {
        reciprocal_zero: () => prime_field(7n).reciprocal(0n),
        sqrt_bad_prime: () => sqrt(prime_field(5n)),
    },
    prime_field_test: () => {
        const p = 0xffffffff_ffffffff_ffffffff_ffffffff_ffffffff_ffffffff_fffffffe_fffffc2fn;
        const f = prime_field(p)
        const sqrt_f = sqrt(f)
        return {
            neg: () => {
                assertEq(f.neg(0n), 0n)
                assertEq(f.neg(1n), p - 1n)
            },
            sub: () => {
                assertEq(f.sub(10n)(4n), 6n)
                assertEq(f.sub(11n)(14n), p - 3n)
            },
            add: () => {
                assertEq(f.add(13n)(24n), 37n)
                assertEq(f.add(77n)(f.neg(12n)), 65n)
            },
            mul: () => {
                assertEq(f.mul(100n)(0n), 0n)
                assertEq(f.mul(101n)(205n), 20_705n)
                assertEq(f.mul(304n)(f.neg(1n)), f.neg(304n))
                assertEq(f.mul(f.neg(507n))(609n), f.neg(308_763n))
                assertEq(f.mul(f.neg(713n))(f.neg(825n)), 588_225n)
            },
            reciprocal: () => {
                let i = 1n
                while (i < 10_000n) {
                    assertEq(f.mul(f.reciprocal(i))(i), 1n)
                    ++i
                }
            },
            pow: () => {
                const test
                    : (a: bigint) => void
                    = a => {
                    assertEq(f.pow(0n)(a), 1n)
                    assertEq(f.pow(1n)(a), a)
                    // https://en.wikipedia.org/wiki/Fermat%27s_little_theorem
                    // a^(p-1) % p = 1
                    assertEq(f.abs(f.pow(f.middle)(a)), 1n)
                    assertEq(f.pow(f.sub(f.max)(1n))(a), f.reciprocal(a))
                    assertEq(f.pow(f.max)(a), 1n)
                }
                // 0
                assertEq(f.pow(0n)(0n), 1n)
                assertEq(f.pow(f.max)(0n), 0n)
                // 1
                test(1n)
                // 2
                test(2n)
                assertEq(f.pow(2n)(2n), 4n)
                assertEq(f.pow(3n)(2n), 8n)
                assertEq(f.pow(128n)(2n), 1n << 128n)
                // 3
                test(3n)
                assertEq(f.pow(2n)(3n), 9n)
                assertEq(f.pow(3n)(3n), 27n)
                assertEq(f.pow(100n)(3n), 3n ** 100n)
                assertEq(f.pow(110n)(3n), 3n ** 110n)
                assertEq(f.pow(120n)(3n), 3n ** 120n)
                assertEq(f.pow(121n)(3n), 3n ** 121n)
                //
                test(f.middle)
                test(f.max - 1n)
                test(f.max)
            },
            sqrtExample: () => {
                const field = prime_field(7n);
                assertEq(sqrt(field)(4n), 2n)
            },
            sqrt: () => {
                const test
                    : (a: bigint) => void
                    = a => {
                    const a2 = f.mul(a)(a)
                    const s = sqrt_f(a2)
                    assert(s === null || f.abs(s) === f.abs(a), 'sqrt')
                }
                let i = 1n
                while (i < 1000n) {
                    test(i)
                    ++i;
                }
                test(f.middle);
                test(f.max);
            },
            reduce: () => {
                assertEq(f.reduce(13n), 13n)
                assertEq(f.reduce(-1n), p - 1n)
            },
            quadRes: () => {
                assert(f.quadRes(0n), 0n)
                assert(f.quadRes(1n), 1n)
                assert(f.quadRes(p), p)
                assert(!f.quadRes(3n), 3n)
                const f2 = prime_field(2n)
                assert(f2.quadRes(0n), '0 mod 2')
                assert(f2.quadRes(1n), '1 mod 2')
            },
            modSqrt: () => {
                const root = modSqrt(f)
                assertEq(root(4n), 2n)
                assertEq(f.pow2(root(2n)), 2n)
            },
            div: () => {
                assertEq(f.div(6n)(2n), 3n)
                assertEq(f.div(0n)(5n), 0n)
                assertEq(f.div(1n)(1n), 1n)
            },
            pow3: () => {
                assertEq(f.pow3(0n), 0n)
                assertEq(f.pow3(1n), 1n)
                assertEq(f.pow3(2n), 8n)
                assertEq(f.pow3(3n), 27n)
                assertEq(f.pow3(10n), 1000n)
            },
            abs: () => {
                assertEq(f.abs(0n), 0n)
                assertEq(f.abs(1n), 1n)
                assertEq(f.abs(f.neg(1n)), 1n)
                assertEq(f.abs(f.middle), f.middle)
            },
        }
    }
}
