import * as _ from './module.f.mjs'
const { sum, abs, serialize, log2, bitLength } = _

export default {
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