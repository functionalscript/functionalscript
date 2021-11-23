const list = require('.')
const { sum } = require('..')

/** @type {<T>(l: list.List<T>) => void} */
const print = a => {
    let i = a
    while (true) {
        const result = list.get(i)
        if (result === undefined) { return }
        console.log(result[0])
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
    {
        let x = big
        for (let i = 0; i < 1_000_000; ++i) {
            x = list.concat(list.empty)(x)
        }
        const r = list.get(x)
        print(x)
    } 
    {
        let x = big
        for (let i = 0; i < 1_000_000; ++i) {
            x = list.concat(x)(list.one(i))
        }
        const r = list.get(x)
        // print(x)
    }
}