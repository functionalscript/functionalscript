import * as _ from './module.f.mjs'
const { at, setReplace, setReduce, empty, entries, remove } = _
import * as seq from '../list/module.f.mjs'

export default {
    main: [
        () => {
            let m = setReplace('a')(1)(null)

            if (at('a')(m) !== 1) { throw 'error' }
            if (at('b')(m) !== null) { throw 'error' }

            m = setReplace('b')(2)(m)

            if (at('a')(m) !== 1) { throw 'error' }
            if (at('b')(m) !== 2) { throw 'error' }
            if (at('c')(m) !== null) { throw 'error' }

            m = setReplace('z')(3)(m)

            if (at('a')(m) !== 1) { throw 'error' }
            if (at('b')(m) !== 2) { throw 'error' }
            if (at('z')(m) !== 3) { throw 'error' }
            if (at('')(m) !== null) { throw 'error' }

            m = setReplace('')(4)(m)

            if (at('a')(m) !== 1) { throw 'error' }
            if (at('b')(m) !== 2) { throw 'error' }
            if (at('z')(m) !== 3) { throw 'error' }
            if (at('')(m) !== 4) { throw 'error' }
            if (at('Hello world!')(m) !== null) { throw 'error' }

            m = setReplace('Hello world!')(42)(m)

            if (at('a')(m) !== 1) { throw 'error' }
            if (at('b')(m) !== 2) { throw 'error' }
            if (at('z')(m) !== 3) { throw 'error' }
            if (at('')(m) !== 4) { throw 'error' }
            if (at('Hello world!')(m) !== 42) { throw 'error' }
            if (at('x')(m) !== null) { throw 'error' }

            // console.log(Array.from(m.entries()))
            m = remove('Hello world!')(m)
            if (at('Hello world!')(m) !== null) { throw m }

            m = setReduce(a => b => a + b)('a')(43)(m)
            if (at('a')(m) !== 44) { throw 'error' }
        },
        () => {
            let m = setReplace('x')(12)(null)
            m = setReplace('y')(44)(m)
            if (at('x')(m) !== 12) { throw 'error' }
            if (at('y')(m) !== 44) { throw 'error' }
            if (at('a')(m) !== null) { throw 'error' }
            const e = seq.toArray(entries(m))
            if (e.length !== 2) { throw 'error' }
        },
    ],
    stress: () => {
        /** @type {import('./module.f.mjs').Map<number>} */
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
}
