const { empty } = require('.')
const lib = require('../lib')

{
    let m = empty.set('a')(1)

    if (m.get('a') !== 1) { throw 'error' }
    if (m.get('b') !== undefined) { throw 'error' }

    m = m.set('b')(2)

    if (m.get('a') !== 1) { throw 'error' }
    if (m.get('b') !== 2) { throw 'error' }
    if (m.get('c') !== undefined) { throw 'error' }

    m = m.set('z')(3)

    if (m.get('a') !== 1) { throw 'error' }
    if (m.get('b') !== 2) { throw 'error' }
    if (m.get('z') !== 3) { throw 'error' }
    if (m.get('') !== undefined) { throw 'error' }

    m = m.set('')(4)

    if (m.get('a') !== 1) { throw 'error' }
    if (m.get('b') !== 2) { throw 'error' }
    if (m.get('z') !== 3) { throw 'error' }
    if (m.get('') !== 4) { throw 'error' }
    if (m.get('Hello world!') !== undefined) { throw 'error' }

    m = m.set('Hello world!')(42)

    if (m.get('a') !== 1) { throw 'error' }
    if (m.get('b') !== 2) { throw 'error' }
    if (m.get('z') !== 3) { throw 'error' }
    if (m.get('') !== 4) { throw 'error' }
    if (m.get('Hello world!') !== 42) { throw 'error' }
    if (m.get('x') !== undefined) { throw 'error' }

    // console.log(Array.from(m.entries()))
}

{
    const m = empty.set('x')(12).set('y')(44)
    if (m.get('x') !== 12) { throw 'error' }
    if (m.get('y') !== 44) { throw 'error' }
    if (m.get('a') !== undefined) { throw 'error' }
    const entries = Array.from(m.entries())
    if (entries.length !== 2) { throw 'error' }
}

{
    /** @type {import('.').Map<number>} */
    let m = empty
    for (let i = 0; i < 100_000; ++i) {
        m = m.set((i*i).toString())(i)
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
