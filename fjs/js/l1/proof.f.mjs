import { assert, assertEq } from '../../asserts/module.f.js'
import { stringEquals, stringLess, strictEquals, toBoolean, typeOf } from './module.f.js'

/** A function value. @type {(a: unknown) => unknown} */
const f = a => a

const a = [1]
const o = { a: 1 }

/** Values of every kind, with the edge cases of each operation. */
const values = [
    undefined, null, true, false,
    0, -0, NaN, 1, -1.5, Infinity, -Infinity,
    '', 'a', 'ab', 'b', 'B', '\u{1F600}', '\uffff', '0', 'false',
    0n, 1n, -1n, 0x1_0000_0000_0000_0000n,
    a, [1], [], o, { a: 1 }, {}, f, () => 0,
]

/** The strings of {@link values}. */
const strings = values.filter(v => typeof v === 'string')

/** `[x, y]` for every `x` and `y` of `list`, each pair in both orders and each value with itself. */
const pairs = /** @type {<T>(list: readonly T[]) => readonly (readonly [T, T])[]} */ (list => list.flatMap(x => list.map(y => /** @type {const} */ ([x, y]))))

export const proof = {
    // `typeOf` is the `typeof` operator.
    typeOf: () => {
        values.forEach(v => assertEq(typeOf(v), typeof v))
    },
    // `toBoolean` is JavaScript's own `ToBoolean`.
    toBoolean: () => {
        values.forEach(v => assertEq(toBoolean(v), !!v, String(v)))
    },
    // `strictEquals` is `===` on every pair, and so on itself for each
    // value but `NaN`.
    strictEquals: () => {
        pairs(values).forEach(([x, y]) => assertEq(strictEquals(x, y), x === y, `${String(x)} ${String(y)}`))
        assert(strictEquals(-0, 0))
        assert(!strictEquals(NaN, NaN))
        assert(strictEquals(a, a))
        assert(!strictEquals(a, [1]))
    },
    // `stringEquals` and `stringLess` are `===` and `<` on every pair of
    // strings, by UTF-16 unit, so `'\uffff'` sorts after an astral
    // character's leading surrogate.
    strings: () => {
        pairs(strings).forEach(([x, y]) => {
            assertEq(stringEquals(x, y), x === y, `${x} ${y}`)
            assertEq(stringLess(x, y), x < y, `${x} ${y}`)
        })
        assert(stringLess('\u{1F600}', '\uffff'))
    },
}
