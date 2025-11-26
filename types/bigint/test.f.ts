import {
    sum,
    abs,
    serialize,
    log2,
    bitLength,
    mask,
    min,
    combination,
    factorial,
    divUp,
    roundUp
} from './module.f.ts'

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
            if (x !== e) { throw x }
        }
        {
            const x = f(c - 1n)
            if (x !== e - 1n) { throw [e, x] }
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
            if (x !== e) { throw [e, x] }
        }
        for (let j = 1n; j < min(c >> 1n)(1000n); ++j) {
            const x = f(c - j)
            if (x !== e - 1n) { throw [j, e, x] }
        }
        c >>= 1n
        --e
    } while (c !== 0n)
}

export default {
    example: () => {
        const total = sum([1n, 2n, 3n]) // 6n
        if (total !== 6n) { throw total }

        const absoluteValue = abs(-42n) // 42n
        if (absoluteValue !== 42n) { throw absoluteValue }

        const logValue = log2(8n) // 3n
        if (logValue !== 3n) { throw logValue }

        const bitCount = bitLength(255n) // 8n
        if (bitCount !== 8n) { throw bitCount }

        const bitmask = mask(5n) // 31n
        if (bitmask !== 31n) { throw benchmark }

        const m = min(3n)(13n) // 3n
        if (m !== 3n) { throw m }

        const c = combination(3n, 2n, 1n) // 60n
        if (c !== 60n) { throw c }
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
        if (result !== 7n) { throw result }
    },
    sum: () => {
        const result = sum([2n, 3n, 4n, 5n])
        if (result !== 14n) { throw result }
    },
    abs: [
        () => {
            const result = abs(10n)
            if (result !== 10n) { throw result }
        },
        () => {
            const result = abs(-10n)
            if (result !== 10n) { throw result }
        }
    ],
    serialize: [
        () => {
            const result = serialize(0n)
            if (result !== '0n') { throw result }
        },
        () => {
            const result = serialize(123456789012345678901234567890n)
            if (result !== '123456789012345678901234567890n') { throw result }
        },
        () => {
            const result = serialize(-55555n)
            if (result !== '-55555n') { throw result }
        },
    ],
    log2: [
        () => {
            const result = log2(-3n)
            if (result !== -1n) { throw result }
        },
        () => {
            const result = log2(0n)
            if (result !== -1n) { throw result }
        },
        () => {
            const result = log2(1n)
            if (result !== 0n) { throw result }
        },
        () => {
            const result = log2(2n)
            if (result !== 1n) { throw result }
        },
        () => {
            const result = log2(3n)
            if (result !== 1n) { throw result }
        },
        () => {
            const result = log2(4n)
            if (result !== 2n) { throw result }
        },
        () => {
            const result = log2(7n)
            if (result !== 2n) { throw result }
        },
        () => {
            const result = log2(8n)
            if (result !== 3n) { throw result }
        },
        () => {
            const result = log2(15n)
            if (result !== 3n) { throw result }
        },
        () => {
            const result = log2(16n)
            if (result !== 4n) { throw result }
        },
        () => {
            // max for Bun (131_072 Bytes)
            const v = 1_048_575n
            const result = log2(1n << v)
            if (result !== v) { throw result }
        },
        () => {
            const v = 0x18945n
            const result = log2(v)
            if (result !== 16n) { throw result }
        }
    ],
    toString2: () => {
        // max for Bun (131_072 Bytes)
        const v = 1_048_575n
        const result = (1n << v).toString(2).length - 1
        if (result !== 1_048_575) { throw result }
    },
    minus: () => {
        let i = 0n
        while (i < 1_048_575n) {
            const s = -i
            if (i !== -s) { throw [i, s] }
            i += 1n
        }
    },
    not: () => {
        let i = 0n
        while (i < 1_048_575n) {
            const s = ~i
            if (i !== ~s) { throw [i, s] }
            i += 1n
        }
    },
    bitLen: {
        0: () => {
            const s = bitLength(0n)
            if (s !== 0n) { throw s }
        },
        m: () => {
            let i = 0n
            while (i < 10_000n) {
                const s = bitLength(1n << i)
                if (s !== i + 1n) { throw [s, i] }
                i += 1n
            }
        },
        big: () => {
            const s = bitLength(1n << 1_000_000n)
            if (s !== 1_000_001n) { throw s }
        },
        neg: [
            () => {
                const s = bitLength(-1n)
                if (s !== 1n) { throw s }
            },
            () => {
                const s = bitLength(-2n)
                if (s !== 2n) { throw s }
            },
            () => {
                const s = bitLength(-3n)
                if (s !== 2n) { throw s }
            },
            () => {
                const s = bitLength(-4n)
                if (s !== 3n) { throw s }
            },
        ]
    },
    factorial: () => {
        {
            const r = factorial(3n)
            if (r !== 6n) { throw r }
        }
        {
            const r = factorial(5n)
            if (r !== 120n) { throw r }
        }
    },
    combination: () => {
        const r = combination(2n, 3n)
        if (r != 120n / (2n * 6n)) { throw r }
    },
    combination50x50: () => {
        {
            const r = combination(1n, 1n)
            if (r !== 2n) { throw r }
        }
        {
            const r = combination(2n, 2n)
            if (r !== 6n) { throw r }
        }
        {
            const r = combination(3n, 3n)
            if (r !== 20n) { throw r }
        }
        {
            const r = combination(4n, 4n)
            if (r !== 70n) { throw r }
        }
    },
    combination3: () => {
        const r = combination(2n, 3n, 4n, 2n)
        // 2! * 3! * 4! * 2! : 2! * 2! * 3!
        // 2+3+4+2 = 5*6*7*8*9*10*11
        // e = 5 * 6 * 7 * 8 * 9 * 10 * 11 / (2n * 2n * 6n) =
        // e = 5     * 7 * 2 * 9 * 10 * 11 = 69300
        if (r !== 69300n) { throw r }
    },
    divUp: () => {
        if (divUp(8n)(0b1000n) !== 1n) { throw new Error("fail") }
        if (divUp(8n)(0b1111n) !== 2n) { throw new Error("fail") }
    },
    roundUp: () => {
        if (roundUp(8n)(0b1000n) !== 0b1000n) { throw new Error("fail") }
        if (roundUp(8n)(0b1111n) !== 0b10000n) { throw new Error("fail") }
        if (roundUp(8n)(3n) !== 8n) { throw new Error("fail") }
    },
}
