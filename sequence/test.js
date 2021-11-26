const seq = require('.')
const { empty, next, list, flatMap, concat, exclusiveScan, find, every, some, first, drop, map, generate } = require('.')
const { sum } = require('./operator')
const array = require('./array')
const json = require('../json')
const { identity } = require('../function')

/** @type {<T>(input: seq.Sequence<T>) => void} */
const print = input => {
    let i = input
    while (true) {
        const result = next(i)
        if (result === undefined) { return }
        console.log(result[0])
        i = result[1]
    }
}

{
    const big = list(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 42, 60)
    const list0 = list(0, 1, 2, 3)
    const list1 = flatMap(x => list(x, x * 2, x * 3))(list0)
    const list2 = concat(list0, list0)
    const list3 = exclusiveScan(sum)(list0)
    const r = find(x => x === 42)(big)
    if (every(x => x > 0)(big) !== true) { throw 'x' }
    if (every(x => x < 20)(big) !== false) { throw 'x' }
    if (some(x => x > 100)(big) !== false) { throw 'x' }
    if (some(x => x > 50)(big) !== true) { throw 'x' }
    if (first(drop(16)(big)) !== 42) { throw 'drop' }
    {
        const a = map(generate)(generate(100_000))
        const ar = array.fromSequence(a)
        // This operation uses a lot of stack because `...` 
        // puts array items on a stack.
        // Use `array.sequence` instead
        const x = concat(...ar)
        const r = next(x)
        // print(x)
    }
    {
        const a = array.fromSequence(generate(1_000_000))
        let x = concat(array.sequence(a), big)
        const r = next(x)
        // print(x)
    }
    {
        let x = big
        for (let i = 0; i < 1_000_000; ++i) {
            x = concat(empty, x)
        }
        const r = next(x)
        // print(x)
    }
    {
        let x = big
        for (let i = 0; i < 1_000_000; ++i) {
            x = concat(x, list(i))
        }
        const r = next(x)
        // print(x)
    }
}

{
    const x = seq.join(':')(seq.list("1", "2", "3", "4", "5", "6"))
    if (x !== "1:2:3:4:5:6") { throw x }
}

{
    const r = seq.reverse(seq.list(1, 2, 3, 4))
    const s = array.fromSequence(r)
    const j = json.stringify(identity)(s)
    if (j !== '[4,3,2,1]') { throw j }
}