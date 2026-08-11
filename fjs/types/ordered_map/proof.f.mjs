import { at, setReplace, setReduce, empty, entries, remove, fromEntries } from './module.f.mjs'
/** @import { OrderedMap } from './types.ts' */
import { toArray } from '../list/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    main: [
        () => {
            let m = setReplace('a')(1)(null)

            assertEq(at('a')(m), 1)
            assertEq(at('b')(m), null)

            m = setReplace('b')(2)(m)

            assertEq(at('a')(m), 1)
            assertEq(at('b')(m), 2)
            assertEq(at('c')(m), null)

            m = setReplace('z')(3)(m)

            assertEq(at('a')(m), 1)
            assertEq(at('b')(m), 2)
            assertEq(at('z')(m), 3)
            assertEq(at('')(m), null)

            m = setReplace('')(4)(m)

            assertEq(at('a')(m), 1)
            assertEq(at('b')(m), 2)
            assertEq(at('z')(m), 3)
            assertEq(at('')(m), 4)
            assertEq(at('Hello world!')(m), null)

            m = setReplace('Hello world!')(42)(m)

            assertEq(at('a')(m), 1)
            assertEq(at('b')(m), 2)
            assertEq(at('z')(m), 3)
            assertEq(at('')(m), 4)
            assertEq(at('Hello world!')(m), 42)
            assertEq(at('x')(m), null)

            // console.log(Array.from(m.entries()))
            m = remove('Hello world!')(m)
            assertEq(at('Hello world!')(m), null)

            m = setReduce((/** @type {number} */a) => (/** @type {number} */b) => a + b)('a')(43)(m)
            assertEq(at('a')(m), 44)
        },
        () => {
            let m = setReplace('x')(12)(null)
            m = setReplace('y')(44)(m)
            assertEq(at('x')(m), 12)
            assertEq(at('y')(m), 44)
            assertEq(at('a')(m), null)
            const e = toArray(entries(m))
            assertEq(e.length, 2)
        },
    ],
    fromEntries: () => {
        /** @type {readonly (readonly [string, number])[]} */
        const list = [['a', 1], ['b', 2], ['c', 3]]
        const m = fromEntries(list)
        assertEq(at('a')(m), 1)
        assertEq(at('b')(m), 2)
        assertEq(at('c')(m), 3)
        assertEq(at('d')(m), null)
        // duplicate key: last one wins
        const m2 = fromEntries(/** @type {const} */([['x', 10], ['x', 20]]))
        assertEq(at('x')(m2), 20)
    },
    stress: () => {
        /** @type {OrderedMap<number>} */
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
