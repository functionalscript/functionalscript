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
    const m = map.set('x')(12).set('y')(44)
    lib.panic_if('map.get(\'x\')')(m.get('x') !== 12)
    lib.panic_if('map.get(\'y\')')(m.get('y') !== 44)
    lib.panic_if('map.get(\'a\')')(m.get('a') !== undefined)
    const entries = Array.from(m.entries())
    lib.panic_if('map.entries()')(entries.length !== 2)
}


{
    /** @type {import('.').Map<number>} */
    let m = map
    for (let i = 0; i < 10; ++i) {
        m = m.set((i*i).toString())(i)
        console.log()
        console.log(`# ${i}`)
        console.log()
        for (const e of m.struct()) {
            console.log(e)
        }
    }
}
