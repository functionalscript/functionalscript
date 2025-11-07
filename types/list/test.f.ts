import { length, concat, countdown, cycle, drop, dropWhile, entries, every, filter, find, flat, flatMap, map, next, reduce, reverse, scan, some, take, takeWhile, toArray, zip, type List, first, filterMap, isEmpty } from './module.f.ts'
import * as json from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { addition, strictEqual, reduceToScan } from '../function/operator/module.f.ts'

const str
    : (sequence: List<json.Unknown>) => string
    = sequence => json.stringify(sort)(toArray(sequence))

const stringifyTest = () => {
    const s = str([1, 2, 3])
    if (s !== '[1,2,3]') { throw s }
}

const cycleTest = () => {
    const x = str(toArray(take(10)(cycle([1, 2, 3]))))
    if (x !== '[1,2,3,1,2,3,1,2,3,1]') { throw x }
}

const countdownTest = () => {
    const result = str(countdown(10))
    if (result !== '[9,8,7,6,5,4,3,2,1,0]') { throw result }
}

const flatTest = () => {
    const result = str(flat([[1, 2, 3], [4, 5], [6], [], [7, 8, 9]]))
    if (result !== '[1,2,3,4,5,6,7,8,9]') { throw result }
}

const concatTest = () => {
    const result = concat([1])([2])
    const x = next(result)
    if (x === null) { throw x }
    if (x.first !== 1) { throw x }
}

const flatMapTest = () => {
    const result = str(flatMap((x: number) => [x, x * 2, x * 3])([0, 1, 2, 3]))
    if (result !== '[0,0,0,1,2,3,2,4,6,3,6,9]') { throw result }
}

const takeTest = [
    () => {
        const result = str(take(3)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        if (result !== '[1,2,3]') { throw result }
    },
    () => {
        const result = str(take(20)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        if (result !== '[1,2,3,4,5,6,7,8,9]') { throw result }
    },
    () => {
        const result = str(take(0)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        if (result !== '[]') { throw result }
    }
]

const findTest = [
    () => {
        const result = find(null)((x: number) => x % 2 === 0)([1, 3, 5, 7])
        if (result !== null) { throw result }
    },
    () => {
        const result = find(null)((x: number) => x % 2 === 0)([1, 2, 3, 4])
        if (result !== 2) { throw result }
    }
]

const takeWhileTest = [
    () => {
        const result = str(takeWhile((x: number) => x < 10)([1, 2, 3, 4, 5, 10, 11]))
        if (result !== '[1,2,3,4,5]') { throw result }
    },
    () => {
        const result = str(takeWhile((x: number) => x < 6)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        if (result !== '[1,2,3,4,5]') { throw result }
    }
]

const dropWhileTest = () => {
    const result = str(dropWhile((x: number) => x < 10)([1, 2, 3, 4, 5, 10, 11]))
    if (result !== '[10,11]') { throw result }
}

const dropTest = [
    () => {
        const result = str(drop(3)([1, 2, 3, 4, 5, 10, 11]))
        if (result !== '[4,5,10,11]') { throw result }
    },
    () => {
        const result = str(drop(0)([1, 2, 3, 4, 5, 10, 11]))
        if (result !== '[1,2,3,4,5,10,11]') { throw result }
    },
    () => {
        const result = str(drop(10)([1, 2, 3, 4, 5, 10, 11]))
        if (result !== '[]') { throw result }
    }
]

const additionTests = [
    () => {
        const op = reduceToScan(addition)
        const result = str(scan(op)([2, 3, 4, 5]))
        if (result !== '[2,5,9,14]') { throw result }
    },
    () => {
        const result = reduce(addition)(null)([2, 3, 4, 5])
        if (result !== 14) { throw result }
    },
    () => {
        const result = reduce(addition)(null)([])
        if (result !== null) { throw result }
    }
]

const entriesTest = [
    () => {
        const result = str(entries([]))
        if (result !== '[]') { throw result }
    },
    () => {
        const result = str(entries(['hello', 'world']))
        if (result !== '[[0,"hello"],[1,"world"]]') { throw result }
    }
]

const reverseTest = [
    () => {
        const result = str(reverse([]))
        if (result !== '[]') { throw result }
    },
    () => {
        const result = str(reverse([1, 2, 3, 4, 5]))
        if (result !== '[5,4,3,2,1]') { throw result }
    }
]

const zipTest = [
    () => {
        const result = str(zip([0, 1, 2])(['a', 'b', 'c', 'd']))
        if (result !== '[[0,"a"],[1,"b"],[2,"c"]]') { throw result }
    },
    () => {
        const result = str(zip([0, 1, 2])(['a', 'b']))
        if (result !== '[[0,"a"],[1,"b"]]') { throw result }
    }
]

const logic = () => {
    const map5 = map((x: number) => x > 5)

    return [
        () => {
            const result = some(map5([0, 1, 7]))
            if (!result) { throw result }
        },
        () => {
            const result = some(map5([0, 1, 4]))
            if (result) { throw result }
        },
        () => {
            const result = some(map5([]))
            if (result) { throw result }
        },
        () => {
            const result = every(map5([0, 1, 7]))
            if (result) { throw result }
        },
        () => {
            const result = every(map5([6, 11, 7]))
            if (!result) { throw result }
        },
        () => {
            const result = every(map5([]))
            if (!result) { throw result }
        }
    ]
}

// stress tests

const stress = () => ({
    toArray: () => {
        // 200_000_000 is too much
        const n = 100_000_000
        const result = toArray(countdown(n))
        if (result.length !== n) { throw result.length }
        const len = length(filter((x: number) => x > n)(result))
        if (len !== 0) { throw len }
    },
    first: () => {
        // 100_000_000 is too much
        const n = 50_000_000
        const result = toArray(countdown(n))
        if (result.length !== n) { throw result.length }
        const f = first(null)(result)
        if (f !== n - 1) { throw f }
    },
    concatBack: () => {
        let sequence
            : List<number>
            = []
        // 20_000_000 is too much
        // 10_000_000 is too much for Deno 1
        for (let i = 0; i < 5_000_000; ++i) {
            sequence = concat(sequence)([i])
        }
        const r = toArray(sequence)
    },
    flatToArray: () => {
        let sequence
            : List<number>
            = []
        // 4_000_000 is too much
        for (let i = 0; i < 2_000_000; ++i) {
            sequence = flat([sequence, [i]])
        }
        const r = toArray(sequence)
    },
    flatNext: () => {
        let sequence
            : List<number>
            = []
        // 4_000_000 is too much
        for (let i = 0; i < 2_000_000; ++i) {
            sequence = flat([sequence, [i]])
        }
        const a = next(sequence)
    },
    concatFront: () => {
        let sequence
            : List<number>
            = []
        // 20_000_000 is too much
        for (let i = 0; i < 10_000_000; ++i) {
            sequence = concat([i])(sequence)
        }
        const a = next(sequence)
    },
    flatFront: () => {
        let sequence
            : List<number>
            = []
        // 10_000_000 is too much
        for (let i = 0; i < 5_000_000; ++i) {
            sequence = flat([[i], sequence])
        }
        const a = next(sequence)
    },
    filterMap: () => {
        // 100_000_000 is too much
        const n = 50_000_000
        const result = toArray(countdown(n))
        if (result.length !== n) { throw result.length }
        const len = length(filterMap(() => null)(result))
        if (len !== 0) { throw len }
    },
    dropWhile: () => {
        // 50_000_000 is too much
        const n = 20_000_000
        const result = toArray(countdown(n))
        if (result.length !== n) { throw result.length }
        const len = length(dropWhile(() => true)(result))
        if (len !== 0) { throw len }
    },
    reverse: () => {
        // 10_000_000 is too much
        const n = 5_000_000
        const result = toArray(reverse(countdown(n)))
        if (result.length !== n) { throw result.length }
    }

})

export default {
    stringifyTest,
    cycle: cycleTest,
    countdown: countdownTest,
    flat: flatTest,
    concat: concatTest,
    flatMap: flatMapTest,
    take: takeTest,
    find: findTest,
    takeWhile: takeWhileTest,
    dropWhile: dropWhileTest,
    drop: dropTest,
    additionTests,
    entries: entriesTest,
    reverse: reverseTest,
    zip: zipTest,
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
            const result = isEmpty(() => [])
            if (result !== true) { throw result }
        },
        () => {
            const result = isEmpty(() => [2])
            if (result !== false) { throw result }
        }
    ],
    length: () => {
        if (length([1, 2, 3]) !== 3) { throw 3 }
        if (length(null) !== 0) { throw 0 }
        if (length(flat([[1, 3], null, () => [3], concat([12])([4, 89])])) !== 6) { throw 6 }
    },
    // stress
}
