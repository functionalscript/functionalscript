import { at, first, last, head, tail, splitFirst, splitLast, empty, includes, repeat, dedup, assoc, occurrences } from './module.f.mjs'
import { stringifySorted } from '../../media/json/module.f.mjs'
import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.js'

export const proof = {
    stringify: () => {
        const result = stringifySorted([1, 20, 300])
        assertEq(result, '[1,20,300]')
    },
    at: [
        () => {
            const result = at(2)([1, 20, 300])
            assertEq(result, 300)
        },

        () => {
            const result = at(3)([1, 20, 300])
            assertEq(result, null)
        }
    ],
    first: [
        () => {
            const result = first([1, 20, 300])
            assertEq(result, 1)
        },
        () => {
            const result = first([])
            assertEq(result, null)
        }
    ],
    last: [
        () => {
            const result = last([1, 20, 300])
            assertEq(result, 300)
        },
        () => {
            const result = last([])
            assertEq(result, null)
        }
    ],
    head: [
        () => {
            const result = assertNotNullish(head([1, 20, 300]))
            const str = stringifySorted(result)
            assertEq(str, '[1,20]')
        },
        () => {
            const result = head([])
            assertEq(result, null)
        }
    ],
    tail: [
        () => {
            const result = tail([1, 20, 300])
            const str = stringifySorted(result)
            assertEq(str, '[20,300]')
        },
        () => {
            const result = tail([])
            assertEq(result, null)
        }
    ],

    splitFirst: [
        () => {
            const result = splitFirst([1, 20, 300])
            const str = stringifySorted(result)
            assertEq(str, '[1,[20,300]]')
        },
        () => {
            const result = splitFirst([])
            assertEq(result, null)
        },
        // A stored nullish element is an element: `[null]` has a first one,
        // even though `first([null])` cannot say so.
        () => {
            const result = splitFirst([null])
            assertStructurallySame(result, [null, []])
        },
        () => {
            const result = splitFirst([undefined])
            assertStructurallySame(result, [undefined, []])
        },
        () => {
            const result = splitFirst([undefined, 20, 300])
            assertStructurallySame(result, [undefined, [20, 300]])
        },
    ],
    splitLast: [
        () => {
            const result = splitLast([1, 20, 300])
            const str = stringifySorted(result)
            assertEq(str, '[[1,20],300]')
        },
        () => {
            const result = splitLast([])
            assertEq(result, null)
        },
        () => {
            const result = splitLast([null])
            assertStructurallySame(result, [[], null])
        },
        () => {
            const result = splitLast([undefined])
            assertStructurallySame(result, [[], undefined])
        },
        () => {
            const result = splitLast([1, 20, undefined])
            assertStructurallySame(result, [[1, 20], undefined])
        }
    ],
    empty: () => {
        const x = empty
        /** @type {readonly number[]} */
        const a = x
        /** @type {readonly string[]} */
        const b = x
        const c = [...a, ...b, ...x]
        assertEq(c.length, 0, c)
    },
    includes: () => {
        const ab = includes(/** @type {const} */ (['a', 'b']))
        assert(ab('b'))
        assert(!ab('c'))
    },
    repeat: [
        () => assertStructurallySame(repeat(0)('x'), []),
        () => assertStructurallySame(repeat(3)('x'), ['x', 'x', 'x'])
    ],
    dedup: [
        () => assertStructurallySame(dedup([]), []),
        () => assertStructurallySame(dedup(['b', 'a', 'b', 'c', 'a']), ['b', 'a', 'c']),
        // identity, not structure: two equal-looking objects both stay
        () => {
            const x = {}
            assertEq(dedup([x, {}, x]).length, 2)
        },
        // `NaN !== NaN`: no `NaN` is a repeat, so none is dropped
        () => assertEq(dedup([NaN, 1, NaN]).length, 3),
        // `-0 === 0`: the later one is a repeat
        () => assertStructurallySame(dedup([0, -0]), [0]),
    ],
    assoc: [
        () => assertEq(assoc('b')([['a', 1], ['b', 2], ['b', 3]]), 2),
        () => assertEq(assoc('c')([['a', 1], ['b', 2]]), null),
        () => assertEq(assoc('a')([]), null),
        // identity, not structure
        () => {
            const k = {}
            assertEq(assoc(k)([[{}, 1], [k, 2]]), 2)
        },
        // a stored `undefined` is a value, not absence
        () => assertEq(assoc('a')([['a', undefined]]), undefined),
        () => assertEq(assoc('a')([['a', null]]), null),
    ],
    occurrences: [
        () => {
            const { indexOf, lastIndexOf } = occurrences(['a', 'b', 'b', 'a', 'c'])
            assertStructurallySame(['a', 'b', 'c'].map(indexOf), [0, 1, 4])
            assertStructurallySame(['a', 'b', 'c'].map(lastIndexOf), [3, 2, 4])
        },
        // the answers `Array`'s own methods give, absent names included
        () => {
            const names = ['x', 'y', 'x', 'z', 'y', 'x']
            const { indexOf, lastIndexOf } = occurrences(names)
            const asked = [...names, 'w']
            assertStructurallySame(asked.map(indexOf), asked.map(n => names.indexOf(n)))
            assertStructurallySame(asked.map(lastIndexOf), asked.map(n => names.lastIndexOf(n)))
        },
        () => {
            const { indexOf, lastIndexOf } = occurrences([])
            assertEq(indexOf('a'), -1)
            assertEq(lastIndexOf('a'), -1)
        },
    ]
}
