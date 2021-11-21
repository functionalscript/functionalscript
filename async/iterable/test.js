const { cast, map, filter, flatMap, sum } = require('.')

const test = async () => {
    {
        const a = cast([1, 2, 3])
        const m = map(async x => x * x)(a)
        const result = await sum(m)
        if (result !== 14) { throw 'filter' }
    }
    {
        const a = cast([1, 2, 3, 4])
        const f = filter(async x => x !== 2)(a)
        const result = await sum(f)
        if (result !== 8) { throw 'filter' }
    }
    {
        const a = cast([1, 2])
        const f = flatMap(x => cast([x, x * x]))(a)
        const result = await sum(f)
        if (result !== 8) { throw 'filter' }
    }
}

test()
