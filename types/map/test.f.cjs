const { at, set, empty, entries, remove } = require('./main.f.cjs')
const seq = require('../list/main.f.cjs')

{
    let m = set('a')(1)(undefined)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== undefined) { throw 'error' }

    m = set('b')(2)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('c')(m) !== undefined) { throw 'error' }

    m = set('z')(3)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('z')(m) !== 3) { throw 'error' }
    if (at('')(m) !== undefined) { throw 'error' }

    m = set('')(4)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('z')(m) !== 3) { throw 'error' }
    if (at('')(m) !== 4) { throw 'error' }
    if (at('Hello world!')(m) !== undefined) { throw 'error' }

    m = set('Hello world!')(42)(m)

    if (at('a')(m) !== 1) { throw 'error' }
    if (at('b')(m) !== 2) { throw 'error' }
    if (at('z')(m) !== 3) { throw 'error' }
    if (at('')(m) !== 4) { throw 'error' }
    if (at('Hello world!')(m) !== 42) { throw 'error' }
    if (at('x')(m) !== undefined) { throw 'error' }

    // console.log(Array.from(m.entries()))
    m = remove('Hello world!')(m)
    if (at('Hello world!')(m) !== undefined) { throw m }
}

{
    let m = set('x')(12)(undefined)
    m = set('y')(44)(m)
    if (at('x')(m) !== 12) { throw 'error' }
    if (at('y')(m) !== 44) { throw 'error' }
    if (at('a')(m) !== undefined) { throw 'error' }
    const e = seq.toArray(entries(m))
    if (e.length !== 2) { throw 'error' }
}

{
    /** @type {import('./main.f.cjs').Map<number>} */
    let m = empty
    for (let i = 0; i < 100_000; ++i) {
        m = set((i * i).toString())(i)(m)
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
