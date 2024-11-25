const { size } = require('./module.f.cjs')

module.exports = {
    0: () => {
        const s = size(0n)
        if (s !== 0n) { throw s }
    },
    1: () => {
        const s = size(1n)
        console.log(s)
        if (s !== 1n) { throw s }
    }
}
