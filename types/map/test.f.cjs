const { at, setReplace, setReduce, empty, entries, remove } = require('./module.f.cjs')
const seq = require('../list/module.f.cjs')

{
    let m = setReplace('a')(1)(undefined)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== undefined) { throw 'error' }

    m = setReplace('b')(2)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('c')(m) !== undefined) { throw 'error' }

    m = setReplace('z')(3)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('z')(m) !== 3) { throw 'error' }
    if (at('')(m) !== undefined) { throw 'error' }

    m = setReplace('')(4)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('z')(m) !== 3) { throw 'error' }
    if (at('')(m) !== 4) { throw 'error' }
    if (at('Hello world!')(m) !== undefined) { throw 'error' }

    m = setReplace('Hello world!')(42)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('z')(m) !== 3) { throw 'error' }
    if (at('')(m) !== 4) { throw 'error' }
    if (at('Hello world!')(m) !== 42) { throw 'error' }
    if (at('x')(m) !== undefined) { throw 'error' }

    // console.log(Array.from(m.entries()))
    m = remove('Hello world!')(m)
    if (at('Hello world!')(m) !== undefined) { throw m }

    m = setReduce(a => b => a + b)('a')(43)(m)
    if (at('a')(m) !== 44) { throw 'error' }
}

{
    let m = setReplace('x')(12)(undefined)
    m = setReplace('y')(44)(m)
    if (at('x')(m) !== 12) { throw 'error' }
    if (at('y')(m) !== 44) { throw 'error' }
    if (at('a')(m) !== undefined) { throw 'error' }
    const e = seq.toArray(entries(m))
    if (e.length !== 2) { throw 'error' }
}

{
    /** @type {import('./module.f.cjs').Map<number>} */
    let m = empty
    for (let i = 0; i < 100_000; ++i) {
        m = setReplace((i * i).toString())(i)(m)
        /*
        console.log()
        console.log(`# ${i}`)
        console.log()
        for (const e of m.struct()) {
            console.log(e)
        }
        */
    }
}
