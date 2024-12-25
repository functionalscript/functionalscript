import * as _ from './module.f.ts'
import * as json from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { addition, strictEqual, reduceToScan } from '../function/operator/module.f.ts'

const stringify
    : (sequence: _.List<json.Unknown>) => string
    = sequence => json.stringify(sort)(_.toArray(sequence))

const stringifyTest = () => {
    const s = stringify([1, 2, 3])
    if (s !== '[1,2,3]') { throw s }
}

const cycle = () => {
    const x = stringify(_.toArray(_.take(10)(_.cycle([1, 2, 3]))))
    if (x !== '[1,2,3,1,2,3,1,2,3,1]') { throw x }
}

const countdown = () => {
    const result = stringify(_.countdown(10))
    if (result !== '[9,8,7,6,5,4,3,2,1,0]') { throw result }
}

const flat = () => {
    const result = stringify(_.flat([[1, 2, 3], [4, 5], [6], [], [7, 8, 9]]))
    if (result !== '[1,2,3,4,5,6,7,8,9]') { throw result }
}

const concat = () => {
    const result = _.concat([1])([2])
    const x = _.next(result)
    if (x === null) { throw x }
    if (x.first !== 1) { throw x }
}

const flatMap = () => {
    const result = stringify(_.flatMap((x: number) => [x, x * 2, x * 3])([0, 1, 2, 3]))
    if (result !== '[0,0,0,1,2,3,2,4,6,3,6,9]') { throw result }
}

const take = [
    () => {
        const result = stringify(_.take(3)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        if (result !== '[1,2,3]') { throw result }
    },
    () => {
        const result = stringify(_.take(20)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        if (result !== '[1,2,3,4,5,6,7,8,9]') { throw result }
    },
    () => {
        const result = stringify(_.take(0)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        if (result !== '[]') { throw result }
    }
]

const find = [
    () => {
        const result = _.find(null)((x: number) => x % 2 === 0)([1, 3, 5, 7])
        if (result !== null) { throw result }
    },
    () => {
        const result = _.find(null)((x: number) => x % 2 === 0)([1, 2, 3, 4])
        if (result !== 2) { throw result }
    }
]

const takeWhile = [
    () => {
        const result = stringify(_.takeWhile((x: number) => x < 10)([1, 2, 3, 4, 5, 10, 11]))
        if (result !== '[1,2,3,4,5]') { throw result }
    },
    () => {
        const result = stringify(_.takeWhile((x: number) => x < 6)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        if (result !== '[1,2,3,4,5]') { throw result }
    }
]

const dropWhile = () => {
    const result = stringify(_.dropWhile((x: number) => x < 10)([1, 2, 3, 4, 5, 10, 11]))
    if (result !== '[10,11]') { throw result }
}

const drop = [
    () => {
        const result = stringify(_.drop(3)([1, 2, 3, 4, 5, 10, 11]))
        if (result !== '[4,5,10,11]') { throw result }
    },
    () => {
        const result = stringify(_.drop(0)([1, 2, 3, 4, 5, 10, 11]))
        if (result !== '[1,2,3,4,5,10,11]') { throw result }
    },
    () => {
        const result = stringify(_.drop(10)([1, 2, 3, 4, 5, 10, 11]))
        if (result !== '[]') { throw result }
    }
]

const additionTests = [
    () => {
        const op = reduceToScan(addition)
        const result = stringify(_.scan(op)([2, 3, 4, 5]))
        if (result !== '[2,5,9,14]') { throw result }
    },
    () => {
        const result = _.reduce(addition)(null)([2, 3, 4, 5])
        if (result !== 14) { throw result }
    },
    () => {
        const result = _.reduce(addition)(null)([])
        if (result !== null) { throw result }
    }
]

const entries = [
    () => {
        const result = stringify(_.entries([]))
        if (result !== '[]') { throw result }
    },
    () => {
        const result = stringify(_.entries(['hello', 'world']))
        if (result !== '[[0,"hello"],[1,"world"]]') { throw result }
    }
]

const reverse = [
    () => {
        const result = stringify(_.reverse([]))
        if (result !== '[]') { throw result }
    },
    () => {
        const result = stringify(_.reverse([1, 2, 3, 4, 5]))
        if (result !== '[5,4,3,2,1]') { throw result }
    }
]

const zip = [
    () => {
        const result = stringify(_.zip([0, 1, 2])(['a', 'b', 'c', 'd']))
        if (result !== '[[0,"a"],[1,"b"],[2,"c"]]') { throw result }
    },
    () => {
        const result = stringify(_.zip([0, 1, 2])(['a', 'b']))
        if (result !== '[[0,"a"],[1,"b"]]') { throw result }
    }
]

const logic = () => {
    const map5 = _.map((x: number) => x > 5)

    return [
        () => {
            const result = _.some(map5([0, 1, 7]))
            if (!result) { throw result }
        },
        () => {
            const result = _.some(map5([0, 1, 4]))
            if (result) { throw result }
        },
        () => {
            const result = _.some(map5([]))
            if (result) { throw result }
        },
        () => {
            const result = _.every(map5([0, 1, 7]))
            if (result) { throw result }
        },
        () => {
            const result = _.every(map5([6, 11, 7]))
            if (!result) { throw result }
        },
        () => {
            const result = _.every(map5([]))
            if (!result) { throw result }
        }
    ]
}

// stress tests

const stress = () => ({
    toArray: () => {
        // 200_000_000 is too much
        const n = 100_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const len = _.length(_.filter((x: number) => x > n)(result))
        if (len !== 0) { throw len }
    },
    first: () => {
        // 100_000_000 is too much
        const n = 50_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const first = _.first(null)(result)
        if (first !== n - 1) { throw first }
    },
    concatBack: () => {
        let sequence
            : _.List<number>
            = []
        // 20_000_000 is too much
        // 10_000_000 is too much for Deno 1
        for (let i = 0; i < 5_000_000; ++i) {
            sequence = _.concat(sequence)([i])
        }
        const r = _.toArray(sequence)
    },
    flatToArray: () => {
        let sequence
            : _.List<number>
            = []
        // 4_000_000 is too much
        for (let i = 0; i < 2_000_000; ++i) {
            sequence = _.flat([sequence, [i]])
        }
        const r = _.toArray(sequence)
    },
    flatNext: () => {
        let sequence
            : _.List<number>
            = []
        // 4_000_000 is too much
        for (let i = 0; i < 2_000_000; ++i) {
            sequence = _.flat([sequence, [i]])
        }
        const a = _.next(sequence)
    },
    concatFront: () => {
        let sequence
            : _.List<number>
            = []
        // 20_000_000 is too much
        for (let i = 0; i < 10_000_000; ++i) {
            sequence = _.concat([i])(sequence)
        }
        const a = _.next(sequence)
    },
    flatFront: () => {
        let sequence
            : _.List<number>
            = []
        // 10_000_000 is too much
        for (let i = 0; i < 5_000_000; ++i) {
            sequence = _.flat([[i], sequence])
        }
        const a = _.next(sequence)
    },
    filterMap: () => {
        // 100_000_000 is too much
        const n = 50_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const len = _.length(_.filterMap(() => null)(result))
        if (len !== 0) { throw len }
    },
    dropWhile: () => {
        // 50_000_000 is too much
        const n = 20_000_000
        const result = _.toArray(_.countdown(n))
        if (result.length !== n) { throw result.length }
        const len = _.length(_.dropWhile(() => true)(result))
        if (len !== 0) { throw len }
    },
    reverse: () => {
        // 10_000_000 is too much
        const n = 5_000_000
        const result = _.toArray(_.reverse(_.countdown(n)))
        if (result.length !== n) { throw result.length }
    }

})

export default {
    stringifyTest,
    cycle,
    countdown,
    flat,
    concat,
    flatMap,
    take,
    find,
    takeWhile,
    dropWhile,
    drop,
    additionTests,
    entries,
    reverse,
    zip,
    logic,
    strictEqual: [
        () => {
            const result = _.equal(strictEqual)([1])([2, 3])
            if (result) { throw result }
        },
        () => {
            const result = _.equal(strictEqual)([1, 3])([1])
            if (result) { throw result }
        },
        () => {
            const result = _.equal(strictEqual)([15, 78])([15, 78])
            if (!result) { throw result }
        },
        () => {
            const result = _.equal(strictEqual)([])([])
            if (!result) { throw result }
        }
    ],
    isEmpty: [
        () => {
            const result = _.isEmpty(() => [])
            if (result !== true) { throw result }
        },
        () => {
            const result = _.isEmpty(() => [2])
            if (result !== false) { throw result }
        }
    ],
    length: () => {
        if (_.length([1, 2, 3]) !== 3) { throw 3 }
        if (_.length(null) !== 0) { throw 0 }
        if (_.length(_.flat([[1, 3], null, () => [3], _.concat([12])([4, 89])])) !== 6) { throw 6 }
    },
    // stress
}
