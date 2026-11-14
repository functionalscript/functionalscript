/**
 * @import { View } from './types.ts'
 */

import { assertEq } from '../../../asserts/module.f.js'
import { handles, view } from './module.f.js'

/** One value of each kind, in tag order. */
const values = [undefined, null, true, 1.5, 'ab', 7n, [1, 2, 3], { a: 1 }, (/** @type {unknown} */ a) => a]

const h = view(handles(values))

/** The view over a table of its own. @type {(values: readonly unknown[]) => View} */
const over = values => view(handles(values))

export const proof = {
    // A handle is an index of the table, and each import answers for its value.
    kind: () => assertEq(values.map((_, k) => h.kind(BigInt(k))).join(), '0,1,2,3,4,5,6,7,8'),
    to_f64: () => assertEq(h.to_f64(3n), 1.5),
    to_bool: () => {
        assertEq(h.to_bool(2n), 1)
        assertEq(over([false]).to_bool(0n), 0)
    },
    // `same` is identity: two handles of one value are the same, and two equal values are not.
    same: () => {
        assertEq(h.same(6n, 6n), 1)
        const o = { a: 1 }
        assertEq(over([o, o, { a: 1 }]).same(0n, 1n), 1)
        assertEq(over([o, o, { a: 1 }]).same(0n, 2n), 0)
        assertEq(h.same(6n, 8n), 0)
    },
    length: () => assertEq([4n, 5n, 6n, 7n, 8n].map(h.length).join(), '2,1,3,1,1'),
    unit: () => assertEq(`${h.unit(4n, 0)},${h.unit(4n, 1)}`, '97,98'),
    // `from_unit` and `concat` answer the string that they make, for a host to give a handle.
    from_unit: () => assertEq(h.from_unit(0x62), 'b'),
    concat: () => assertEq(h.concat(4n, 4n), 'abab'),
    // Where L0 traps, the import throws: a handle of no value, or a value of another kind.
    throw: {
        negative: () => { h.kind(-1n) },
        past: () => { h.kind(9n) },
        empty: () => { over([]).kind(0n) },
        toF64: () => { h.to_f64(2n) },
        toBool: () => { h.to_bool(3n) },
        same: () => { h.same(4n, 4n) },
        length: () => { h.length(3n) },
        unitPast: () => { h.unit(4n, 2) },
        unitOfNoString: () => { h.unit(6n, 0) },
        fromUnit: () => { h.from_unit(0x1_0000) },
        concat: () => { h.concat(4n, 5n) },
    },
}
