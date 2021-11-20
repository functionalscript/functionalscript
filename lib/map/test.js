const { map } = require('.')
const lib = require('..')

{
    let m = map.set('a')(1)

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
    /** @type {import('.').Map<number>} */
    let m = map
    for (let i = 0; i < 1_000_000; ++i) {
        m = m.set(i.toString())(i * i)
        if (i % 100_000 === 0) { console.log(i) }
    }
    for (const e of m.entries()) {
        // console.log(e)
    }
}
console.log(':')
{
    /** @type {import('..').Dictionary<number>} */
    let m = lib.dictionary
    for (let i = 0; i < 100_000; ++i) {
        m = m.set(i.toString())(i * i)
        if (i % 10_000 === 0) { console.log(i) }
    }
    for (const e of m.entries()) {
        // console.log(e)
    }
}