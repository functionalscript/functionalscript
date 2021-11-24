const list = require('.')
const { sum } = require('..')

/** @type {<T>(l: list.List<T>) => void} */
const print = a => {
    let i = a
    while (true) {
        const result = list.next(i)
        if (result === undefined) { return }
        // console.log(result[0])
        i = result[1]
    }
}

{
    const big = list.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 42, 60])
    const list0 = list.fromArray([0, 1, 2, 3])
    const list1 = list.flatMap(x => list.fromArray([x, x * 2, x * 3]))(list0)
    const list2 = list.concat(list0)(list0)
    const list3 = list.inclusiveScan(sum)(list0)
    const r = list.find(x => x === 42)(big)
    if (list.every(x => x > 0)(big) !== true) { throw 'x'}
    if (list.every(x => x < 20)(big) !== false) { throw 'x' }
    if (list.some(x => x > 100)(big) !== false) { throw 'x' }
    if (list.some(x => x > 50)(big) !== true) { throw 'x' }
    if (list.first(list.drop(16)(big)) !== 42) { throw 'drop'}
    {
        let x = big
        for (let i = 0; i < 1_000_000; ++i) {
            x = list.concat(list.empty)(x)
        }
        const r = list.next(x)
        // print(x)
    } 
    {
        let x = big
        for (let i = 0; i < 1_000_000; ++i) {
            x = list.concat(x)(list.one(i))
        }
        const r = list.next(x)
        // print(x)
    }
}