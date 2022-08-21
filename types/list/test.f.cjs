const _ = require('./module.f.cjs')
const json = require('../../json/module.f.cjs')
const { sort } = require('../object/module.f.cjs')
const { addition, strictEqual, reduceToScan: foldToScan } = require('../function/operator/module.f.cjs')

/** @type {(sequence: _.List<json.Unknown>) => string} */
const stringify = sequence => json.stringify(sort)(_.toArray(sequence))

{
    const x = stringify(_.toArray(_.take(10)(_.cycle([1, 2, 3]))))
    if (x !== '[1,2,3,1,2,3,1,2,3,1]') { throw x }
}

{
    const s = stringify([1, 2, 3])
    if (s !== '[1,2,3]') { throw s }
}

{
    const result = stringify(_.countdown(10))
    if (result !== '[9,8,7,6,5,4,3,2,1,0]') { throw result }
}

{
    const result = stringify(_.flat([[1, 2, 3], [4, 5], [6], [], [7, 8, 9]]))
    if (result !== '[1,2,3,4,5,6,7,8,9]') { throw result }
}

{
    const result = _.concat([1])([2])
    const x = _.next(result)
    if (x === undefined) { throw x }
    if (x.first !== 1) { throw x }
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
    const result = stringify(_.take(3)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    if (result !== '[1,2,3]') { throw result }
}

{
    const result = stringify(_.take(20)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    if (result !== '[1,2,3,4,5,6,7,8,9]') { throw result }
}

{
    const result = stringify(_.take(0)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    if (result !== '[]') { throw result }
}

{
    const result = _.find(undefined)(x => x % 2 === 0)([1, 3, 5, 7])
    if (result !== undefined) { throw result }
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
    const result = stringify(_.drop(3)([1, 2, 3, 4, 5, 10, 11]))
    if (result !== '[4,5,10,11]') { throw result }
}

{
    const result = stringify(_.drop(0)([1, 2, 3, 4, 5, 10, 11]))
    if (result !== '[1,2,3,4,5,10,11]') { throw result }
}

{
    const result = stringify(_.drop(10)([1, 2, 3, 4, 5, 10, 11]))
    if (result !== '[]') { throw result }
}

{
    const op = foldToScan(addition)
    const result = stringify(_.scan(op)([2, 3, 4, 5]))
    if (result !== '[2,5,9,14]') { throw result }
}

{
    const result = _.foldT(addition)(undefined)([2, 3, 4, 5])
    if (result !== 14) { throw result }
}

{
    const result = _.foldT(addition)(undefined)([])
    if (result !== undefined) { throw result }
}

{
    const result = stringify(_.entries([]))
    if (result !== '[]') { throw result }
}

{
    const result = stringify(_.entries(['hello', 'world']))
    if (result !== '[[0,"hello"],[1,"world"]]') { throw result }
}

{
    const result = stringify(_.reverse([]))
    if (result !== '[]') { throw result }
}

{
    const result = stringify(_.reverse([1, 2, 3, 4, 5]))
    if (result !== '[5,4,3,2,1]') { throw result }
}

{
    const result = stringify(_.zip([0, 1, 2])(['a', 'b', 'c', 'd']))
    if (result !== '[[0,"a"],[1,"b"],[2,"c"]]') { throw result }
}

{
    const result = stringify(_.zip([0, 1, 2])(['a', 'b']))
    if (result !== '[[0,"a"],[1,"b"]]') { throw result }
}

const map5 = _.map(x => x > 5)

{
    const result = _.some(map5([0, 1, 7]))
    if (!result) { throw result }
}

{
    const result = _.some(map5([0, 1, 4]))
    if (result) { throw result }
}

{
    const result = _.some(map5([]))
    if (result) { throw result }
}

{
    const result = _.every(map5([0, 1, 7]))
    if (result) { throw result }
}

{
    const result = _.every(map5([6, 11, 7]))
    if (!result) { throw result }
}

{
    const result = _.every(map5([]))
    if (!result) { throw result }
}

{
    const result = _.equal(strictEqual)([1])([2, 3])
    if (result) { throw result }
}

{
    const result = _.equal(strictEqual)([1, 3])([1])
    if (result) { throw result }
}

{
    const result = _.equal(strictEqual)([15, 78])([15, 78])
    if (!result) { throw result }
}

{
    const result = _.equal(strictEqual)([])([])
    if (!result) { throw result }
}

{
    const result = _.isEmpty(() => [])
    if (result !== true) { throw result }
}

{
    const result = _.isEmpty(() => [2])
    if (result !== false) { throw result }
}



// stress tests

const stress = () => {

    {
        // 200_000_000 is too much
        const n = 100_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const len = _.length(_.filter(x => x > n)(result))
        if (len !== 0) { throw len }
    }

    console.log('first')

    {
        // 100_000_000 is too much
        const n = 50_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const first = _.first(undefined)(result)
        if (first !== n - 1) { throw first }
    }

    console.log('concat back')

    {
        /** @type {_.List<number>} */
        let sequence = []
        // 20_000_000 is too much
        for (let i = 0; i < 10_000_000; ++i) {
            sequence = _.concat(sequence)([i])
        }
        const r = _.toArray(sequence)
    }

    console.log('flat to Array')

    {
        /** @type {_.List<number>} */
        let sequence = []
        // 4_000_000 is too much
        for (let i = 0; i < 2_000_000; ++i) {
            sequence = _.flat([sequence, [i]])
        }
        const r = _.toArray(sequence)
    }

    console.log('flat next')

    {
        /** @type {_.List<number>} */
        let sequence = []
        // 5_000_000 is too much
        for (let i = 0; i < 4_000_000; ++i) {
            sequence = _.flat([sequence, [i]])
        }
        const a = _.next(sequence)
    }

    console.log('concat front')

    {
        /** @type {_.List<number>} */
        let sequence = []
        // 20_000_000 is too much
        for (let i = 0; i < 10_000_000; ++i) {
            sequence = _.concat([i])(sequence)
        }
        const a = _.next(sequence)
    }

    {
        /** @type {_.List<number>} */
        let sequence = []
        // 10_000_000 is too much
        for (let i = 0; i < 5_000_000; ++i) {
            sequence = _.flat([[i], sequence])
        }
        const a = _.next(sequence)
    }

    console.log('filterMap')

    {
        // 100_000_000 is too much
        const n = 50_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const len = _.length(_.filterMap(() => undefined)(result))
        if (len !== 0) { throw len }
    }

    console.log('dropWhile')

    {
        // 50_000_000 is too much
        const n = 20_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const len = _.length(_.dropWhile(() => true)(result))
        if (len !== 0) { throw len }
    }

    console.log('reverse')

    {
        // 10_000_000 is too much
        const n = 5_000_000
        const result = _.toArray(_.reverse(_.countdown(n)))
        if (result.length !== n) { throw result.length }
    }
}

// stress()

module.exports = {

}
