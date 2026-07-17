import {
    length,
    concat,
    countdown,
    cycle,
    drop,
    dropWhile,
    entries,
    every,
    filter,
    find,
    flat,
    flatMap,
    map,
    next,
    reduce,
    reverse,
    scan,
    some,
    take,
    takeWhile,
    toArray,
    zip,
    type List,
    first,
    filterMap,
    isEmpty,
    equal
} from './module.f.ts'
import { stringify, type Unknown } from '../../media/json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { addition, strictEqual, reduceToScan } from '../function/operator/module.f.ts'
import { assert } from '../../asserts/module.f.ts'

const str
    : (sequence: List<Unknown>) => string
    = sequence => stringify(sort)(toArray(sequence))

const stringifyTest = () => {
    const s = str([1, 2, 3])
    assert(s === '[1,2,3]', s)
}

const cycleTest = [
    () => {
        const x = str(toArray(take(10)(cycle([1, 2, 3]))))
        assert(x === '[1,2,3,1,2,3,1,2,3,1]', x)
    },
    () => {
        const x = str(toArray(cycle([])))
        assert(x === '[]', x)
    },
]

const countdownTest = () => {
    const result = str(countdown(10))
    assert(result === '[9,8,7,6,5,4,3,2,1,0]', result)
}

const flatTest = () => {
    const result = str(flat([[1, 2, 3], [4, 5], [6], [], [7, 8, 9]]))
    assert(result === '[1,2,3,4,5,6,7,8,9]', result)
}

const concatTest = () => {
    const result = concat([1])([2])
    const x = next(result)
    assert(x !== null, x)
    assert(x.first === 1, x)
}

const flatMapTest = () => {
    const result = str(flatMap((x: number) => [x, x * 2, x * 3])([0, 1, 2, 3]))
    assert(result === '[0,0,0,1,2,3,2,4,6,3,6,9]', result)
}

const takeTest = [
    () => {
        const result = str(take(3)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        assert(result === '[1,2,3]', result)
    },
    () => {
        const result = str(take(20)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        assert(result === '[1,2,3,4,5,6,7,8,9]', result)
    },
    () => {
        const result = str(take(0)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        assert(result === '[]', result)
    }
]

const findTest = [
    () => {
        const result = find(null)((x: number) => x % 2 === 0)([1, 3, 5, 7])
        assert(result === null, result)
    },
    () => {
        const result = find(null)((x: number) => x % 2 === 0)([1, 2, 3, 4])
        assert(result === 2, result)
    }
]

const takeWhileTest = [
    () => {
        const result = str(takeWhile((x: number) => x < 10)([1, 2, 3, 4, 5, 10, 11]))
        assert(result === '[1,2,3,4,5]', result)
    },
    () => {
        const result = str(takeWhile((x: number) => x < 6)([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        assert(result === '[1,2,3,4,5]', result)
    }
]

const dropWhileTest = () => {
    const result = str(dropWhile((x: number) => x < 10)([1, 2, 3, 4, 5, 10, 11]))
    assert(result === '[10,11]', result)
}

const dropTest = [
    () => {
        const result = str(drop(3)([1, 2, 3, 4, 5, 10, 11]))
        assert(result === '[4,5,10,11]', result)
    },
    () => {
        const result = str(drop(0)([1, 2, 3, 4, 5, 10, 11]))
        assert(result === '[1,2,3,4,5,10,11]', result)
    },
    () => {
        const result = str(drop(10)([1, 2, 3, 4, 5, 10, 11]))
        assert(result === '[]', result)
    }
]

const additionTests = [
    () => {
        const op = reduceToScan(addition)
        const result = str(scan(op)([2, 3, 4, 5]))
        assert(result === '[2,5,9,14]', result)
    },
    () => {
        const result = reduce(addition)(null)([2, 3, 4, 5])
        assert(result === 14, result)
    },
    () => {
        const result = reduce(addition)(null)([])
        assert(result === null, result)
    }
]

const entriesTest = [
    () => {
        const result = str(entries([]))
        assert(result === '[]', result)
    },
    () => {
        const result = str(entries(['hello', 'world']))
        assert(result === '[[0,"hello"],[1,"world"]]', result)
    }
]

const reverseTest = [
    () => {
        const result = str(reverse([]))
        assert(result === '[]', result)
    },
    () => {
        const result = str(reverse([1, 2, 3, 4, 5]))
        assert(result === '[5,4,3,2,1]', result)
    }
]

const zipTest = [
    () => {
        const result = str(zip([0, 1, 2])(['a', 'b', 'c', 'd']))
        assert(result === '[[0,"a"],[1,"b"],[2,"c"]]', result)
    },
    () => {
        const result = str(zip([0, 1, 2])(['a', 'b']))
        assert(result === '[[0,"a"],[1,"b"]]', result)
    }
]

const logic = () => {
    const map5 = map((x: number) => x > 5)

    return [
        () => {
            const result = some(map5([0, 1, 7]))
            assert(result, result)
        },
        () => {
            const result = some(map5([0, 1, 4]))
            assert(!(result), result)
        },
        () => {
            const result = some(map5([]))
            assert(!(result), result)
        },
        () => {
            const result = every(map5([0, 1, 7]))
            assert(!(result), result)
        },
        () => {
            const result = every(map5([6, 11, 7]))
            assert(result, result)
        },
        () => {
            const result = every(map5([]))
            assert(result, result)
        }
    ]
}

// stress tests

const stress = () => ({
    toArray: () => {
        // 200_000_000 is too much
        const n = 100_000_000
        const result = toArray(countdown(n))
        assert(result.length === n, result.length)
        const len = length(filter((x: number) => x > n)(result))
        assert(len === 0, len)
    },
    first: () => {
        // 100_000_000 is too much
        const n = 50_000_000
        const result = toArray(countdown(n))
        assert(result.length === n, result.length)
        const f = first(null)(result)
        assert(f === n - 1, f)
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
        assert(result.length === n, result.length)
        const len = length(filterMap(() => null)(result))
        assert(len === 0, len)
    },
    dropWhile: () => {
        // 50_000_000 is too much
        const n = 20_000_000
        const result = toArray(countdown(n))
        assert(result.length === n, result.length)
        const len = length(dropWhile(() => true)(result))
        assert(len === 0, len)
    },
    reverse: () => {
        // 10_000_000 is too much
        const n = 5_000_000
        const result = toArray(reverse(countdown(n)))
        assert(result.length === n, result.length)
    }

})

export const proof = {
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
            const result = equal(strictEqual)([1])([2, 3])
            assert(!(result), result)
        },
        () => {
            const result = equal(strictEqual)([1, 3])([1])
            assert(!(result), result)
        },
        () => {
            const result = equal(strictEqual)([15, 78])([15, 78])
            assert(result, result)
        },
        () => {
            const result = equal(strictEqual)([])([])
            assert(result, result)
        }
    ],
    isEmpty: [
        () => {
            const result = isEmpty(() => [])
            assert(result === true, result)
        },
        () => {
            const result = isEmpty(() => [2])
            assert(result === false, result)
        }
    ],
    length: () => {
        assert(length([1, 2, 3]) === 3, 3)
        assert(length(null) === 0, 0)
        assert(length(flat([[1, 3], null, () => [3], concat([12])([4, 89])])) === 6, 6)
    },
    filterMap: [
        () => {
            const result = str(filterMap((x: number) => x % 2 === 0 ? x * 10 : null)([1, 2, 3, 4, 5]))
            assert(result === '[20,40]', result)
        },
        () => {
            const result = str(filterMap((x: number) => x > 3 ? x : null)([1, 2, 3]))
            assert(result === '[]', result)
        },
    ],
    // stress
}
