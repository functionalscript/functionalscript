import {
    sum,
    abs,
    serialize,
    log2,
    bitLength,
    mask,
    combination,
    factorial,
    xor,
    multiple,
    product,
    divUp,
    roundUp,
    divUp8,
    roundUp8
} from './module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'
import { min } from '../function/compare/module.f.ts'

const oldLog2 = (v: bigint): bigint => {
    if (v <= 0n) { return -1n }
    let result = 0n
    let i = 1n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            // overshot
            break
        }
        v = n
        result += i
        i <<= 1n // multiple by two
    }
    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 1 before we divide it by 2.
    while (i !== 1n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    return result
}

const strBinLog2 = (v: bigint): bigint => BigInt(v.toString(2).length) - 1n

const strHexLog2 = (v: bigint): bigint => {
    const len = (BigInt(v.toString(16).length) - 1n) << 2n
    return len + 31n - BigInt(Math.clz32(Number(v >> len)))
}

const str32Log2 = (v: bigint): bigint => {
    const len = (BigInt(v.toString(32).length) - 1n) * 5n
    return len + 31n - BigInt(Math.clz32(Number(v >> len)))
}

export const clz32Log2 = (v: bigint): bigint => {
    if (v <= 0n) { return -1n }
    let result = 31n
    let i = 32n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            // overshot
            break
        }
        v = n
        result += i
        i <<= 1n
    }
    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 32 before we divide it by 2.
    while (i !== 32n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    return result - BigInt(Math.clz32(Number(v)))
}

const m1023log2 = (v: bigint): bigint => {
    if (v <= 0n) { return -1n }

    //
    // 1. Fast Doubling.
    //

    let result = -1n
    // `bigints` higher than 2**1023 may lead to `Inf` during conversion to `number`.
    // For example: `Number((1n << 1024n) - (1n << 970n)) === Inf`.
    let i = 1023n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            // overshot
            break
        }
        v = n
        result += i
        i <<= 1n
    }

    //
    // 2. Binary Search.
    //

    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 1023 before we divide it by 2.
    while (i !== 1023n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }

    //
    // 3. Remainder Phase.
    //

    // We know that `v` is less than `1n << 1023` so we can calculate a remainder using
    // `Math.log2`.
    const rem = BigInt(Math.log2(Number(v)) | 0)
    // (v >> rem) is either `0` or `1`, and it's used as a correction for
    // Math.log2 rounding.
    return result + rem + (v >> rem)
}

type Benchmark = (f: (_: bigint) => bigint) => () => void

const benchmark: Benchmark = f => () => {
    let e = 1_048_575n
    let c = 1n << e
    for (let i = 0n; i < 1_100; ++i) {
        {
            const x = f(c)
            assertEq(x, e)
        }
        {
            const x = f(c - 1n)
            assertEq(x, e - 1n, [e, x])
        }
        c >>= 1n
        --e
    }
}


const benchmarkSmall: Benchmark = f => () => {
    let e = 2_000n
    let c = 1n << e
    do {
        {
            const x = f(c)
            assertEq(x, e, [e, x])
        }
        for (let j = 1n; j < min(c >> 1n)(1000n); ++j) {
            const x = f(c - j)
            assertEq(x, e - 1n, [j, e, x])
        }
        c >>= 1n
        --e
    } while (c !== 0n)
}

export const proof = {
    example: () => {
        const total = sum([1n, 2n, 3n]) // 6n
        assertEq(total, 6n)

        const absoluteValue = abs(-42n) // 42n
        assertEq(absoluteValue, 42n)

        const logValue = log2(8n) // 3n
        assertEq(logValue, 3n)

        const bitCount = bitLength(255n) // 8n
        assertEq(bitCount, 8n)

        const bitmask = mask(5n) // 31n
        assertEq(bitmask, 31n, benchmark)

        const m = min(3n)(13n) // 3n
        assertEq(m, 3n)

        const c = combination(3n, 2n, 1n) // 60n
        assertEq(c, 60n)
    },
    benchmark: () => {
        const list = {
            // strBinLog2,
            // strHexLog2,
            str32Log2,
            // oldLog2,
            // clz32Log2,
            // m1023log2,
            log2,
        }
        const transform = (b: Benchmark) =>
            Object.fromEntries(Object.entries(list).map(([k, f]) => [k, b(f)]))
        return {
            big: transform(benchmark),
            small: transform(benchmarkSmall),
        }
    },
    mask: () => {
        const result = mask(3n) // 7n
        assertEq(result, 7n)
    },
    sum: () => {
        const result = sum([2n, 3n, 4n, 5n])
        assertEq(result, 14n)
    },
    abs: [
        () => {
            const result = abs(10n)
            assertEq(result, 10n)
        },
        () => {
            const result = abs(-10n)
            assertEq(result, 10n)
        }
    ],
    serialize: [
        () => {
            const result = serialize(0n)
            assertEq(result, '0n')
        },
        () => {
            const result = serialize(123456789012345678901234567890n)
            assertEq(result, '123456789012345678901234567890n')
        },
        () => {
            const result = serialize(-55555n)
            assertEq(result, '-55555n')
        },
    ],
    log2: [
        () => {
            const result = log2(-3n)
            assertEq(result, -1n)
        },
        () => {
            const result = log2(0n)
            assertEq(result, -1n)
        },
        () => {
            const result = log2(1n)
            assertEq(result, 0n)
        },
        () => {
            const result = log2(2n)
            assertEq(result, 1n)
        },
        () => {
            const result = log2(3n)
            assertEq(result, 1n)
        },
        () => {
            const result = log2(4n)
            assertEq(result, 2n)
        },
        () => {
            const result = log2(7n)
            assertEq(result, 2n)
        },
        () => {
            const result = log2(8n)
            assertEq(result, 3n)
        },
        () => {
            const result = log2(15n)
            assertEq(result, 3n)
        },
        () => {
            const result = log2(16n)
            assertEq(result, 4n)
        },
        () => {
            // max for Bun (131_072 Bytes)
            const v = 1_048_575n
            const result = log2(1n << v)
            assertEq(result, v)
        },
        () => {
            const v = 0x18945n
            const result = log2(v)
            assertEq(result, 16n)
        }
    ],
    toString2: () => {
        // max for Bun (131_072 Bytes)
        const v = 1_048_575n
        const result = (1n << v).toString(2).length - 1
        assertEq(result, 1_048_575)
    },
    minus: () => {
        let i = 0n
        while (i < 1_048_575n) {
            const s = -i
            assertEq(i, -s, [i, s])
            i += 1n
        }
    },
    not: () => {
        let i = 0n
        while (i < 1_048_575n) {
            const s = ~i
            assertEq(i, ~s, [i, s])
            i += 1n
        }
    },
    bitLen: {
        0: () => {
            const s = bitLength(0n)
            assertEq(s, 0n)
        },
        m: () => {
            let i = 0n
            while (i < 10_000n) {
                const s = bitLength(1n << i)
                assertEq(s, i + 1n, [s, i])
                i += 1n
            }
        },
        big: () => {
            const s = bitLength(1n << 1_000_000n)
            assertEq(s, 1_000_001n)
        },
        neg: [
            () => {
                const s = bitLength(-1n)
                assertEq(s, 1n)
            },
            () => {
                const s = bitLength(-2n)
                assertEq(s, 2n)
            },
            () => {
                const s = bitLength(-3n)
                assertEq(s, 2n)
            },
            () => {
                const s = bitLength(-4n)
                assertEq(s, 3n)
            },
        ]
    },
    factorial: () => {
        {
            const r = factorial(3n)
            assertEq(r, 6n)
        }
        {
            const r = factorial(5n)
            assertEq(r, 120n)
        }
    },
    combination: () => {
        const r = combination(2n, 3n)
        assert(r == 120n / (2n * 6n), r)
    },
    combination50x50: () => {
        {
            const r = combination(1n, 1n)
            assertEq(r, 2n)
        }
        {
            const r = combination(2n, 2n)
            assertEq(r, 6n)
        }
        {
            const r = combination(3n, 3n)
            assertEq(r, 20n)
        }
        {
            const r = combination(4n, 4n)
            assertEq(r, 70n)
        }
    },
    combination3: () => {
        const r = combination(2n, 3n, 4n, 2n)
        // 2! * 3! * 4! * 2! : 2! * 2! * 3!
        // 2+3+4+2 = 5*6*7*8*9*10*11
        // e = 5 * 6 * 7 * 8 * 9 * 10 * 11 / (2n * 2n * 6n) =
        // e = 5     * 7 * 2 * 9 * 10 * 11 = 69300
        assertEq(r, 69300n)
    },
    divUp: () => {
        assertEq(divUp(8n)(0b1000n), 1n)
        assertEq(divUp(8n)(0b1111n), 2n)
    },
    roundUp: () => {
        assertEq(roundUp(8n)(0b1000n), 0b1000n)
        assertEq(roundUp(8n)(0b1111n), 0b10000n)
        assertEq(roundUp(8n)(3n), 8n)
    },
    divUp8: () => {
        assertEq(divUp8(0n), 0n)
        assertEq(divUp8(1n), 1n)
        assertEq(divUp8(0b1000n), 1n)
        assertEq(divUp8(8n), 1n)
        assertEq(divUp8(9n), 2n)
        assertEq(divUp8(0b1111n), 2n)
    },
    roundUp8: () => {
        assertEq(roundUp8(0n), 0n)
        assertEq(roundUp8(1n), 8n)
        assertEq(roundUp8(3n), 8n)
        assertEq(roundUp8(0b1000n), 0b1000n)
        assertEq(roundUp8(8n), 8n)
        assertEq(roundUp8(9n), 16n)
        assertEq(roundUp8(0b1111n), 0b10000n)
    },
    xor: () => {
        assertEq(xor(5n)(3n), 6n)
        assertEq(xor(0n)(15n), 15n)
        assertEq(xor(0xFFn)(0xF0n), 0x0Fn)
    },
    multiple: () => {
        assertEq(multiple(3n)(4n), 12n)
        assertEq(multiple(0n)(100n), 0n)
    },
    product: () => {
        assertEq(product([1n, 2n, 3n, 4n]), 24n)
        assertEq(product([5n, 6n]), 30n)
    },
}
