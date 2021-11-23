const list = require('.')
const { sum } = require('..')

/** @type {<T>(l: list.List<T>) => void} */
const print = a => {
    let i = a()
    while (i !== undefined) {
        console.log(i[0])
        i = i[1]()
    }
}

{
    const big = list.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 42, 60])
    print(big)
    /*
    const list0 = list.fromArray([0, 1, 2, 3])
    const list1 = list.flatMap(x => list.fromArray([x, x * 2, x * 3]))(list0)
    const list2 = list.concat(list0)(list0)
    const list3 = list.inclusiveScan(sum)(list0)
    print(list3)
    const r = list.find(x => x === 42)(list.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 42, 60]))
    */
}