const { decToBin } = require('./module.f.cjs')

module.exports = {
    decToBin: [
        () => {
            const result = decToBin([0n, 0])
            if (result[0] !== 0b00_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0] }
            if (result[1] !== 0) { throw result[1] }
        },
        () => {
            const result = decToBin([0n, 10])
            if (result[0] !== 0b00_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0] }
            if (result[1] !== 0) { throw result[1] }
        },
        () => {
            const result = decToBin([0n, -10])
            if (result[0] !== 0b00_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0] }
            if (result[1] !== 0) { throw result[1] }
        },
        () => {
            const result = decToBin([1n, 0])
            if (result[0] !== 0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0] }
            if (result[1] !== -53) { throw result[1] }
        },
        () => {
            const result = decToBin([1n, 1])
            if (result[0] !== 0b10_1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0] }
            if (result[1] !== -50) { throw result[1] }
        },
        () => {
            const result = decToBin([1000n, -2])
            if (result[0] !== 0b10_1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0] }
            if (result[1] !== -50) { throw result[1] }
        },
        () => {
            const result = decToBin([1n, -1])
            if (result[0] !== 0b11_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011n) { throw result[0] }
            if (result[1] !== -57) { throw result[1] }
        },
        () => {
            const result = decToBin([-1n, 0])
            if (result[0] !== -0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0] }
            if (result[1] !== -53) { throw result[1] }
        },
        () => {
            const result = decToBin([-1n, 1])
            if (result[0] !== -0b10_1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0] }
            if (result[1] !== -50) { throw result[1] }
        },
        () => {
            const result = decToBin([-1000n, -2])
            if (result[0] !== -0b10_1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0] }
            if (result[1] !== -50) { throw result[1] }
        },
        () => {
            const result = decToBin([-1n, -1])
            if (result[0] !== -0b11_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011_0011n) { throw result[0] }
            if (result[1] !== -57) { throw result[1] }
        }
    ]
}
