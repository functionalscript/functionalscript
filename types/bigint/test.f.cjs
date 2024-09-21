const { sum, abs, serialize, log2x } = require('./module.f.cjs')

module.exports = {
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
    log2x: [
        () => {
            const result = log2x(0n)
            if (result !== 0n) { throw result }
        },
        () => {
            const result = log2x(1n)
            if (result !== 1n) { throw result }
        },
        () => {
            const result = log2x(2n)
            if (result !== 2n) { throw result }
        },
        () => {
            const result = log2x(3n)
            if (result !== 2n) { throw result }
        },
        () => {
            const result = log2x(4n)
            if (result !== 3n) { throw result }
        },
        () => {
            const result = log2x(7n)
            if (result !== 3n) { throw result }
        },
        () => {
            const result = log2x(8n)
            if (result !== 4n) { throw result }
        },
        () => {
            const result = log2x(15n)
            if (result !== 4n) { throw result }
        },
        () => {
            const result = log2x(16n)
            if (result !== 5n) { throw result }
        }
    ]
}