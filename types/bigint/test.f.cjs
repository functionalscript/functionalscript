const { sum, abs } = require('./module.f.cjs')

/** @type {(m: bigint) => (e: number) => bigint} */
const pow = m => e => {
    switch (m) {
        case -1n: return e % 2 === 0 ? 1n : -1n
        case 0n: return 0n
        case 1n: return 1n
    }
    let result = 1n
    while (true) {
        if ((e & 1) !== 0) { result *= m; }
        e >>= 1;
        if (e === 0) { return result }
        m *= m;
    }
}

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
    pow: () => {
        if (pow(0n)(0) !== 0n) { throw [0n,0] }
        if (pow(0n)(1) !== 0n) { throw [0n, 1] }
        if (pow(0n)(1000) !== 0n) { throw [0n, 1000] }
        //
        if (pow(1n)(0) !== 1n) { throw [1n, 0] }
        if (pow(1n)(1) !== 1n) { throw [1n, 1] }
        if (pow(1n)(1000) !== 1n) { throw [1n, 1000] }
        //
        if (pow(-1n)(0) !== 1n) { throw [-1n, 0] }
        if (pow(-1n)(1) !== -1n) { throw [-1n, 1] }
        if (pow(-1n)(1000) !== 1n) { throw [-1n, 1000] }
        if (pow(-1n)(1001) !== -1n) { throw [-1n, 1001] }
        //
        if (pow(2n)(0) !== 1n) { throw [2n, 0] }
        if (pow(2n)(1) !== 2n) { throw [2n, 1] }
        if (pow(2n)(2) !== 4n) { throw [2n, 2] }
        if (pow(2n)(10) !== 1024n) { throw [2n, 10] }
        //
        if (pow(-2n)(0) !== 1n) { throw [-2n, 0] }
        if (pow(-2n)(1) !== -2n) { throw [-2n, 1] }
        if (pow(-2n)(2) !== 4n) { throw [-2n, 2] }
        if (pow(-2n)(10) !== 1024n) { throw [-2n, 10] }
        if (pow(-2n)(11) !== -2048n) { throw [-2n, 11] }
        //
        if (pow(-3n)(0) !== 1n) { throw [-3n, 0] }
        if (pow(-3n)(1) !== -3n) { throw [-3n, 1] }
        if (pow(-3n)(2) !== 9n) { throw [-3n, 2] }
        if (pow(-3n)(10) !== 59049n) { throw [-3n, 10] }
        if (pow(-3n)(11) !== -177147n) { throw [-3n, 11] }
    }
}