const _ = require('.')
const { concat } = require('./concat0')

const test1 = () => {
    /** @type {_.Sequence<number>} */
    let m = undefined
    for (let i = 0; i < 1_000_000; ++i) {
        m = concat(m)(t => [i, t])
    }
    return m
}

const test2 = () => {
    /** @type {_.Sequence<number>} */
    let m = undefined
    for (let i = 0; i < 1_000_000; ++i) {
        m = concat([1, undefined])(m)
    }
    return m
}

console.log(_.sum(test1()))
// console.log(_.sum(test2()))
