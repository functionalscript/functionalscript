import { prime_field, sqrt } from './module.f.ts'

export default {
    prime_field_test: () => {
        const p = 0xffffffff_ffffffff_ffffffff_ffffffff_ffffffff_ffffffff_fffffffe_fffffc2fn;
        const f = prime_field(p)
        const sqrt_f = sqrt(f)
        return {
            neg: () => {
                if (f.neg(0n) !== 0n) { throw '-0' }
                if (f.neg(1n) !== p - 1n) { throw '-1' }
            },
            sub: () => {
                if (f.sub(10n)(4n) !== 6n) { throw '10 - 4'}
                if (f.sub(11n)(14n) !== p - 3n) { throw '11 - 14' }
            },
            add: () => {
                if (f.add(13n)(24n) !== 37n) { throw '13 + 24' }
                if (f.add(77n)(f.neg(12n)) !== 65n) { throw '77 + (-12)' }
            },
            mul: () => {
                if (f.mul(100n)(0n) !== 0n) { throw '100 * 0' }
                if (f.mul(101n)(205n) !== 20_705n) { throw '101 * 205' }
                if (f.mul(304n)(f.neg(1n)) !== f.neg(304n)) { throw '304 * -1' }
                if (f.mul(f.neg(507n))(609n) !== f.neg(308_763n)) { throw '-507 * 609' }
                if (f.mul(f.neg(713n))(f.neg(825n)) !== 588_225n) { throw '-713 * -825' }
            },
            reciprocal: () => {
                let i = 1n
                while (i < 10_000n) {
                    const x = f.reciprocal(i)
                    if (f.mul(x)(i) !== 1n) { throw i }
                    ++i
                }
            },
            pow: () => {
                const test
                    : (a: bigint) => void
                    = a => {
                    if (f.pow(0n)(a) !== 1n) { throw '**0'}
                    if (f.pow(1n)(a) !== a) { throw '**1' }
                    // https://en.wikipedia.org/wiki/Fermat%27s_little_theorem
                    // a^(p-1) % p = 1
                    if (f.abs(f.pow(f.middle)(a)) !== 1n) { throw '**middle' }
                    if (f.pow(f.sub(f.max)(1n))(a) !== f.reciprocal(a)) { throw '**(max-1)' }
                    if (f.pow(f.max)(a) !== 1n) { throw '**max' }
                }
                // 0
                if (f.pow(0n)(0n) !== 1n) { throw '0**0'}
                if (f.pow(f.max)(0n) !== 0n) { throw '0**max' }
                // 1
                test(1n)
                // 2
                test(2n)
                if (f.pow(2n)(2n) !== 4n) { throw '2**2' }
                if (f.pow(3n)(2n) !== 8n) { throw '2**3' }
                if (f.pow(128n)(2n) !== 1n << 128n) { throw '2**128' }
                // 3
                test(3n)
                if (f.pow(2n)(3n) !== 9n) { throw '3**2' }
                if (f.pow(3n)(3n) !== 27n) { throw '3**3' }
                if (f.pow(100n)(3n) !== 3n ** 100n) { throw '3**100' }
                if (f.pow(110n)(3n) !== 3n ** 110n) { throw '3**110' }
                if (f.pow(120n)(3n) !== 3n ** 120n) { throw '3**120' }
                if (f.pow(121n)(3n) !== 3n ** 121n) { throw '3**121' }
                //
                test(f.middle)
                test(f.max - 1n)
                test(f.max)
            },
            sqrtExample: () => {
                const field = prime_field(7n);
                const root = sqrt(field)(4n);
                if (root !== 2n) { throw root }
            },
            sqrt: () => {
                const test
                    : (a: bigint) => void
                    = a => {
                    const a2 = f.mul(a)(a)
                    const s = sqrt_f(a2)
                    if (s !== null && f.abs(s) !== f.abs(a)) { throw 'sqrt' }
                }
                let i = 1n
                while (i < 1000n) {
                    test(i)
                    ++i;
                }
                test(f.middle);
                test(f.max);
            }
        }
    }
}
