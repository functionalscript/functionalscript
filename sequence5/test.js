const _ = require('.')
const json = require('../json')
const { sort } = require('../object')

/** @type {(sequence: _.Sequence<json.Json>) => string} */
const stringify = sequence => json.stringify(sort)(_.toArray(sequence))

{
    const s = stringify([1, 2, 3])
    if (s !== '[1,2,3]') { throw s }
}

{
    const result = stringify(_.countdown(10))
    if (result !== '[9,8,7,6,5,4,3,2,1,0]') { throw result }
}

{
    const result = stringify(_.concat([1, 2, 3], [4, 5], [6], [], [7, 8, 9]))
    if (result !== '[1,2,3,4,5,6,7,8,9]') { throw result }
}

{
    const result = _.concat([1], [2])
    const x = _.next(result)
}

{
    const result = stringify(_.flatMap(x => [x, x * 2, x * 3])([0, 1, 2, 3]))
    if (result !== '[0,0,0,1,2,3,2,4,6,3,6,9]') { throw result }
}

{
    const result = stringify(_.takeWhile(x => x < 6)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    if (result !== '[1,2,3,4,5]') { throw result }
}

// stress tests

const stress = () => {
    {
        // 200_000_000 is too much
        const n = 100_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const first = _.first(result)
        if (first !== n - 1) { throw first }
    }

    {
        /** @type {_.Sequence<number>} */
        let sequence = []
        // 2_000_000 is too much
        for (let i = 0; i < 1_000_000; ++i) {
            sequence = _.concat(sequence, [i])
        }
        const r = _.toArray(sequence)
    }

    {
        /** @type {_.Sequence<number>} */
        let sequence = []
        // 5_000_000 is too much
        for (let i = 0; i < 2_000_000; ++i) {
            sequence = _.concat(sequence, [i])
        }
        const a = _.next(sequence)
    }

    {
        /** @type {_.Sequence<number>} */
        let sequence = []
        // 10_000_000 is too much
        for (let i = 0; i < 5_000_000; ++i) {
            sequence = _.concat([i], sequence)
        }
        const a = _.next(sequence)
    }
}

// stress()

module.exports = {

}