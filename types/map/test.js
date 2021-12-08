const { at, insert, empty, entries } = require('.')
const list = require('../sequence')

{
    let m = insert(empty)(['a', 1])

    if (at(m)('a') !== 1) { throw 'error' }
    if (at(m)('b') !== undefined) { throw 'error' }

    m = insert(m)(['b', 2])

    if (at(m)('a') !== 1) { throw 'error' }
    if (at(m)('b') !== 2) { throw 'error' }
    if (at(m)('c') !== undefined) { throw 'error' }

    m = insert(m)(['z', 3])

    if (at(m)('a') !== 1) { throw 'error' }
    if (at(m)('b') !== 2) { throw 'error' }
    if (at(m)('z') !== 3) { throw 'error' }
    if (at(m)('') !== undefined) { throw 'error' }

    m = insert(m)(['', 4])

    if (at(m)('a') !== 1) { throw 'error' }
    if (at(m)('b') !== 2) { throw 'error' }
    if (at(m)('z') !== 3) { throw 'error' }
    if (at(m)('') !== 4) { throw 'error' }
    if (at(m)('Hello world!') !== undefined) { throw 'error' }

    m = insert(m)(['Hello world!', 42])

    if (at(m)('a') !== 1) { throw 'error' }
    if (at(m)('b') !== 2) { throw 'error' }
    if (at(m)('z') !== 3) { throw 'error' }
    if (at(m)('') !== 4) { throw 'error' }
    if (at(m)('Hello world!') !== 42) { throw 'error' }
    if (at(m)('x') !== undefined) { throw 'error' }

    // console.log(Array.from(m.entries()))
}

{
    let m = insert(empty)(['x', 12])
    m = insert(m)(['y', 44])
    if (at(m)('x') !== 12) { throw 'error' }
    if (at(m)('y') !== 44) { throw 'error' }
    if (at(m)('a') !== undefined) { throw 'error' }
    const e = list.toArray(entries(m))
    if (e.length !== 2) { throw 'error' }
}

{
    /** @type {import('.').Map<number>} */
    let m = empty
    for (let i = 0; i < 100_000; ++i) {
        m = insert(m)([(i*i).toString(), i])
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
