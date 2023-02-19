const { decToBin } = require('./module.f.cjs')

module.exports = {
    decToBin: [
        () => {
            const result = decToBin([0n, 0])
            if (result[0] !== 0b0_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== 0) { throw result[1] }
        },
        () => {
            const result = decToBin([0n, 10])
            if (result[0] !== 0b0_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== 0) { throw result[1] }
        },
        () => {
            const result = decToBin([0n, -10])
            if (result[0] !== 0b0_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== 0) { throw result[1] }
        },
        () => {
            const result = decToBin([1n, 0])
            if (result[0] !== 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== -52) { throw result[1] }
        },
        () => {
            const result = decToBin([1n, 1])
            if (result[0] !== 0b1_0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== -49) { throw result[1] }
        },
        () => {
            const result = decToBin([1000n, -2])
            if (result[0] !== 0b1_0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== -49) { throw result[1] }
        },
        () => {
            const result = decToBin([1n, -1])
            if (result[0] !== 0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n) { throw result[0].toString(2) } //+1
            if (result[1] !== -56) { throw result[1] }
        },
        () => {
            const result = decToBin([-1n, 0])
            if (result[0] !== -0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== -52) { throw result[1] }
        },
        () => {
            const result = decToBin([-1n, 1])
            if (result[0] !== -0b1_0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== -49) { throw result[1] }
        },
        () => {
            const result = decToBin([-1000n, -2])
            if (result[0] !== -0b1_0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== -49) { throw result[1] }
        },
        () => {
            const result = decToBin([-1n, -1])
            if (result[0] !== -0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n) { throw result[0].toString(2) } //+1
            if (result[1] !== -56) { throw result[1] }
        },
        () => {
            const result = decToBin([0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n, 0]) //54bits (...0.1)
            if (result[0] !== 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== 1) { throw result[1] }
        },
        () => {
            const result = decToBin([-0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011n, 0]) //54bits (...1.1)
            if (result[0] !== -0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n) { throw result[0].toString(2) }
            if (result[1] !== 1) { throw result[1] }
        },
        () => {
            const result = decToBin([-0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n, 0]) //54bits (...0.1)
            if (result[0] !== -0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== 1) { throw result[1] }
        },
        () => {
            const result = decToBin([-0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011n, 0]) //54bits (...1.1)
            if (result[0] !== -0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n) { throw result[0].toString(2) }
            if (result[1] !== 1) { throw result[1] }
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n, 0]) //55bits (...0.01)
            if (result[0] !== 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== 2) { throw result[1] }
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n, 0]) //55bits (...0.10)
            if (result[0] !== 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) { throw result[0].toString(2) }
            if (result[1] !== 2) { throw result[1] }
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0110n, 0]) //55bits (...1.10)
            if (result[0] !== 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n) { throw result[0].toString(2) }
            if (result[1] !== 2) { throw result[1] }
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011n, 0]) //55bits (0.11)
            if (result[0] !== 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n) { throw result[0].toString(2) }
            if (result[1] !== 2) { throw result[1] }
        },
    ]
}
