const { at, set: insert, empty, entries } = require('.')
const list = require('../sequence')

{
    let m = insert('a')(1)(undefined)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== undefined) { throw 'error' }

    m = insert('b')(2)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('c')(m) !== undefined) { throw 'error' }

    m = insert('z')(3)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('z')(m) !== 3) { throw 'error' }
    if (at('')(m) !== undefined) { throw 'error' }

    m = insert('')(4)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('z')(m) !== 3) { throw 'error' }
    if (at('')(m) !== 4) { throw 'error' }
    if (at('Hello world!')(m) !== undefined) { throw 'error' }

    m = insert('Hello world!')(42)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('z')(m) !== 3) { throw 'error' }
    if (at('')(m) !== 4) { throw 'error' }
    if (at('Hello world!')(m) !== 42) { throw 'error' }
    if (at('x')(m) !== undefined) { throw 'error' }

    // console.log(Array.from(m.entries()))
}

{
    let m = insert('x')(12)(undefined)
    m = insert('y')(44)(m)
    if (at('x')(m) !== 12) { throw 'error' }
    if (at('y')(m) !== 44) { throw 'error' }
    if (at('a')(m) !== undefined) { throw 'error' }
    const e = list.toArray(entries(m))
    if (e.length !== 2) { throw 'error' }
}

{
    /** @type {import('.').Map<number>} */
    let m = empty
    for (let i = 0; i < 100_000; ++i) {
        m = insert((i * i).toString())(i)(m)
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
