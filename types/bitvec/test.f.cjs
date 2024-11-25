const { size } = require('./module.f.cjs')

module.exports = {
    0: () => {
        const s = size(0n)
        if (s !== 0n) { throw s }
    },
    m: () => {
        let i = 0n
        while (i < 10_000n) {
            const s = size(1n << i)
            if (s !== i + 1n) { throw [s, i] }
            i += 1n
        }
    },
    big: () => {
        const s = size(1n << 10_000_000n)
        if (s !== 10_000_001n) { throw s }
    },
    neg: [
        () => {
            const s = size(-1n)
            if (s !== 1n) { throw s }
        },
        () => {
            const s = size(-2n)
            if (s !== 2n) { throw s }
        },
        () => {
            const s = size(-3n)
            if (s !== 2n) { throw s }
        },
        () => {
            const s = size(-4n)
            if (s !== 3n) { throw s }
        },
    ]
}
