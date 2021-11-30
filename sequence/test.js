const _ = require('.')
const json = require('../json')
const { sort } = require('../object')
const { addition } = require('../function/operator')

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

{
    const result = _.find(undefined)(x => x % 2 === 0)([1, 2, 3, 4])
    if (result !== 2) { throw result }
}

{
    const result = stringify(_.takeWhile(x => x < 10)([1, 2, 3, 4, 5, 10, 11]))
    if (result !== '[1,2,3,4,5]') { throw result }
}

{
    const result = stringify(_.dropWhile(x => x < 10)([1, 2, 3, 4, 5, 10, 11]))
    if (result !== '[10,11]') { throw result }
}

{
    const op = _.scanState(addition)
    const result = stringify(_.scan(op)([2, 3, 4, 5]))
    if (result !== '[2,5,9,14]') { throw result }
}

{
    const result = _.sum([2, 3, 4, 5])
    if (result !== 14) { throw result }
}

{
    const result = _.fold(addition)(undefined)([2, 3, 4, 5])
    if (result !== 14) { throw result }
}

{
    const result = _.fold(addition)(undefined)([])
    if (result !== undefined) { throw result }
}

{
    const result = _.join('/')([])
    if (result !== '') { throw result }
}

{
    const result = _.join('/')([''])
    if (result !== '') { throw result }
}

{
    const result = stringify(_.entries([]))
    if (result !== '[]') { throw result }
}

{
    const result = stringify(_.entries(['hello', 'world']))
    if (result !== '[[0,"hello"],[1,"world"]]') { throw result }
}

// stress tests

const stress = () => {
    {
        // 200_000_000 is too much
        const n = 100_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const first = _.first(undefined)(result)
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

//stress()

module.exports = {

}