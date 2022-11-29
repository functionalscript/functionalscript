const { sum, min, max, cmp } = require('./module.f.cjs')

module.exports = {
    sum: () => {
        const result = sum([2, 3, 4, 5])
        if (result !== 14) { throw result }
    },
    min: {
        empty: () => {
            const result = min([])
            if (result !== null) { throw result }
        },
        multi: () => {
            const result = min([1, 2, 12, -4, 8])
            if (result !== -4) { throw result }
        }
    },
    max: () => {
        const result = max([1, 2, 12, -4, 8])
        if (result !== 12) { throw result }
    },
    cmp: () => {
        const result = cmp(4)(5)
        if (result !== -1) { throw result }
    }
}