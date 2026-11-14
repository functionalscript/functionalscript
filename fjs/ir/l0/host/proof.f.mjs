import { assertEq } from '../../../asserts/module.f.js'
import { host } from './module.f.js'

/** One value of each kind, in tag order. */
const values = [undefined, null, true, 1.5, 'ab', 7n, [1, 2, 3], { a: 1 }, (/** @type {unknown} */ a) => a]

const h = host(values)

export const proof = {
    // A handle is an index of the table, and each import answers for its value.
    kind: () => assertEq(values.map((_, k) => h.kind(BigInt(k))).join(), '0,1,2,3,4,5,6,7,8'),
    to_f64: () => assertEq(h.to_f64(3n), 1.5),
    to_bool: () => {
        assertEq(h.to_bool(2n), 1)
        assertEq(host([false]).to_bool(0n), 0)
    },
    // `same` is identity: two handles of one value are the same, and two equal values are not.
    same: () => {
        assertEq(h.same(6n, 6n), 1)
        const o = { a: 1 }
        assertEq(host([o, o, { a: 1 }]).same(0n, 1n), 1)
        assertEq(host([o, o, { a: 1 }]).same(0n, 2n), 0)
        assertEq(h.same(6n, 8n), 0)
    },
    length: () => assertEq([4n, 5n, 6n, 7n, 8n].map(h.length).join(), '2,1,3,1,1'),
    unit: () => assertEq(`${h.unit(4n, 0)},${h.unit(4n, 1)}`, '97,98'),
    // `dup` and `drop` count; `from_unit` and `concat` allocate a cell the caller owns.
    count: () => {
        const c = host(['a'])
        assertEq(c.live(), 1)
        const d = c.dup(0n)
        assertEq(d, 0n)
        assertEq(c.live(), 1)
        c.drop(0n)
        assertEq(c.live(), 1)
        c.drop(0n)
        assertEq(c.live(), 0)
        const s = c.from_unit(0x62)
        assertEq(c.read(s), 'b')
        assertEq(c.live(), 1)
        const t = c.concat(s, s)
        assertEq(c.read(t), 'bb')
        assertEq(c.live(), 2)
        c.drop(s)
        c.drop(t)
        assertEq(c.live(), 0)
    },
    // Where L0 traps, the import throws: a handle of no value, or a value of another kind.
    throw: {
        negative: () => { h.kind(-1n) },
        past: () => { h.kind(9n) },
        empty: () => { host([]).kind(0n) },
        toF64: () => { h.to_f64(2n) },
        toBool: () => { h.to_bool(3n) },
        same: () => { h.same(4n, 4n) },
        length: () => { h.length(3n) },
        unitPast: () => { h.unit(4n, 2) },
        unitOfNoString: () => { h.unit(6n, 0) },
        dropTwice: () => {
            const c = host(['x'])
            c.drop(0n)
            c.drop(0n)
        },
        fromUnit: () => { h.from_unit(0x1_0000) },
    },
}
