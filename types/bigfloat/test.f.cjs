const { decToBin } = require('./module.f.cjs')

module.exports = {
    decToBin: [
        () => {
            const result = decToBin({ mantissa: 0n, exp: 0})
            if (result.mantissa !== 0b00_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result.mantissa }
            if (result.exp !== 0) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: 0n, exp: 10})
            if (result.mantissa !== 0b00_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result.mantissa }
            if (result.exp !== 0) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: 0n, exp: -10})
            if (result.mantissa !== 0b00_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result.mantissa }
            if (result.exp !== 0) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: 1n, exp: 0})
            if (result.mantissa !== 0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result.mantissa }
            if (result.exp !== -53) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: 1n, exp: 1})
            if (result.mantissa !== 0b10_1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result.mantissa }
            if (result.exp !== -50) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: 1000n, exp: -2})
            if (result.mantissa !== 0b10_1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result.mantissa }
            if (result.exp !== -50) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: 1n, exp: -1})
            if (result.mantissa !== 0b11_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011n) { throw result.mantissa }
            if (result.exp !== -57) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: -1n, exp: 0})
            if (result.mantissa !== -0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result.mantissa }
            if (result.exp !== -53) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: -1n, exp: 1})
            if (result.mantissa !== -0b10_1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result.mantissa }
            if (result.exp !== -50) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: -1000n, exp: -2})
            if (result.mantissa !== -0b10_1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result.mantissa }
            if (result.exp !== -50) { throw result.exp }
        },
        () => {
            const result = decToBin({ mantissa: -1n, exp: -1})
            if (result.mantissa !== -0b11_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011n) { throw result.mantissa }
            if (result.exp !== -57) { throw result.exp }
        }
    ]
}
