import { sum, abs, serialize, log2, bitLength, mask } from './module.f.ts'

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

const stringLog2 = (v: bigint): bigint => BigInt(v.toString(2).length) - 1n

const stringHexLog2 = (v: bigint): bigint => {
    const len = (BigInt(v.toString(16).length) - 1n) << 2n
    const x = v >> len
    return len + 31n - BigInt(Math.clz32(Number(x)))
}

const string32Log2 = (v: bigint): bigint => {
    const len = (BigInt(v.toString(32).length) - 1n) * 5n
    const x = v >> len
    return len + 31n - BigInt(Math.clz32(Number(x)))
}

const mathLog2 = (v: bigint) => {
    if (v <= 0n) { return -1n }
    let result = -1n
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
    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 32 before we divide it by 2.
    while (i !== 1023n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    const x = BigInt(Math.log2(Number(v)))
    return result + x + (v >> x)
}

const benchmark = (f: (_: bigint) => bigint) => () => {
    let e = 1_048_575n
    let c = 1n << e
    for (let i = 0n; i < 1_000; ++i) {
        const x = f(c)
        if (x !== e) { throw x }
        c >>= 1n
        --e
    }
}

export default {
    example: () => {
        const total = sum([1n, 2n, 3n]) // 6n
        if (total !== 6n) { throw total }

        const absoluteValue = abs(-42n) // 42n
        if (absoluteValue !== 42n) { throw total }

        const logValue = log2(8n) // 3n
        if (logValue !== 3n) { throw total }

        const bitCount = bitLength(255n) // 8n
        if (bitCount !== 8n) { throw total }

        const bitmask = mask(5n) // 31n
        if (bitmask !== 31n) { throw total }
    },
    benchmark: {
        str: benchmark(stringLog2),
        stringHexLog2: benchmark(stringHexLog2),
        string32Log2: benchmark(string32Log2),
        oldLog2: benchmark(oldLog2),
        log2: benchmark(log2),
        mathLog2: benchmark(mathLog2),
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
    }
}
