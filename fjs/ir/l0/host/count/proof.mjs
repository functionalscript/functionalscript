/**
 * Host proofs of the counting host: how it counts, what it keeps, and
 * hand-written IR of the owned stage run on it, which leaves every cell as
 * it found it. A
 * WebAssembly import is the boundary: a FunctionalScript proof can neither
 * instantiate a module nor hold the cells that the imports count.
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../../AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)).
 *
 * @import { Param, Term, Type } from '../../../types.ts'
 * @import { Counting } from '../types.ts'
 */

import { assert, assertEq, assertOk } from '../../../../asserts/module.f.js'
import { write } from '../../../../media/wasm/binary/write/module.f.js'
import { check } from '../../../check/module.f.js'
import { add, bool, call, codeOf, f64, float, fn, get, if_, let_, lit, loop, lt, match, next, only, own, return_, throw_, u, unit } from '../../../module.f.js'
import { EMPTY, isShort, pack, packEnabled, v1EnabledTags } from '../../../runtime/string/short.f.js'
import { emit } from '../../../wasm/module.f.js'
import { layoutOf } from '../../../wasm/testlib.mjs'
import { any, array, func, l0 } from '../../module.f.js'
import { counting } from './module.mjs'

const string = only(any, 'string')

/** An i64 as the WebAssembly JavaScript API passes one. @type {(b: bigint) => bigint} */
const i64 = b => BigInt.asIntN(64, b)

/** The NaN boxes of Any's constants. */
const UNDEFINED = i64(0x7FF0_0000_0000_0020n)
const NULL = i64(0x7FF0_0000_0000_0030n)
const FALSE = i64(0x7FF0_0000_0000_0010n)
const TRUE = i64(0xFFF0_0000_0000_0010n)
/** Empty short-string box (Sergey EMPTY_STRING). */
const SHORT_EMPTY = i64(EMPTY)
/** A forged dyn-ref of cell 0, for a read of no value. */
const FORGED = i64(0x7FF0_0000_0000_0002n | (6n << 48n))
/** Emit policy for String variants B/C. */
const shortEmit = /** @type {const} */ ({ kind: 'shortWhenEnabled', enabledTags: v1EnabledTags })

/** The cells that are alive, as text: each cell index and its count. @type {(h: Counting) => string} */
const cells = h => h.live().map(([k, count]) => `${k}:${count}`).join()

/**
 * A function `f` over L0, checked, emitted and instantiated on a counting
 * host whose first boxes are those of `values`.
 *
 * @type {(params: readonly Param[], result: Type, body: Term, values: readonly unknown[]) => { readonly f: Function, readonly h: Counting }}
 */
const load = (params, result, body, values) => {
    const checked = assertOk(check({ imports: l0, functions: [['f', fn(params, result, body)]], exports: ['f'] }))
    const bytes = new Uint8Array(write(emit(checked)))
    assert(WebAssembly.validate(bytes))
    const h = counting(values)
    const { exports } = new WebAssembly.Instance(new WebAssembly.Module(bytes), { 'fjs:l0': h.imports })
    const f = exports.f
    assert(typeof f === 'function')
    return { f, h }
}

/** @type {(a: Term, b: Term) => Term} */
const concat = (a, b) => call('String', 'concat', [a, b])

/** @type {(v: Term) => Term} */
const drop = v => call('Any', 'drop', [v])

const a = get('a')
const one = lit(f64, 1)
const zero = lit(f64, 0)

export const proof = {
    // S2: the host accepts well-formed short-string boxes as strings; dup/drop
    // leave the bits alone; a bad short-family pattern traps.
    shortAccept: () => {
        const h = counting([])
        assertEq(h.read(SHORT_EMPTY), '')
        assertEq(h.imports.kind(SHORT_EMPTY), 4)
        assertEq(h.imports.length(SHORT_EMPTY), 0)
        assertEq(h.imports.dup(SHORT_EMPTY), SHORT_EMPTY)
        h.imports.drop(SHORT_EMPTY)
        assertEq(cells(h), '')
        const one = assertOk(pack([0x61]))
        const two = assertOk(pack([0x61, 0x62]))
        assertEq(`${h.read(i64(one))} ${h.imports.unit(i64(one), 0)}`, 'a 97')
        assertEq(`${h.read(i64(two))} ${h.imports.length(i64(two))}`, 'ab 2')
        assert(isShort(one) && isShort(two))
        // Bits in the short family that match no Sergey tag are not a value.
        const junk = i64(0x7FF0_0000_0000_00E8n)
        assert(isShort(BigInt.asUintN(64, junk)))
        try {
            h.read(junk)
            throw 'expected not a value'
        } catch (e) {
            assertEq(e, 'fjs:l0 host: not a value')
        }
    },
    // S2: default emit is always dyn-ref (A); B/C emit shorts for enabled tags
    // and keep the long path when no enabled tag fits.
    shortEmit: () => {
        const a = counting([])
        const longEmpty = a.imports.from_unit(0x61)
        assertEq(`${a.read(longEmpty)} ${cells(a)}`, 'a 0:1')
        assert(!isShort(BigInt.asUintN(64, longEmpty)))
        a.imports.drop(longEmpty)
        const b = counting([], 0, 0, shortEmit)
        const empty = b.own('')
        const one = b.imports.from_unit(0x62)
        const two = b.imports.concat(one, b.imports.from_unit(0x63))
        assertEq(`${b.read(empty)}|${b.read(one)}|${b.read(two)}`, '|b|bc')
        assert(isShort(BigInt.asUintN(64, empty)))
        assert(isShort(BigInt.asUintN(64, one)))
        assert(isShort(BigInt.asUintN(64, two)))
        assertEq(cells(b), '')
        // Three UTF-16 units fit a Sergey tag but not the v1 enabled set → long.
        assertEq(packEnabled([0x61, 0x62, 0x63], v1EnabledTags)[0], 'error')
        assertEq(pack([0x61, 0x62, 0x63])[0], 'ok')
        const miss = b.own('abc')
        assertEq(`${b.read(miss)} ${cells(b)}`, `abc ${handleOf(miss)}:1`)
        assert(!isShort(BigInt.asUintN(64, miss)))
    },
    // `dup` adds one to a cell's count, `drop` takes one away and frees the cell at zero, and a made value is a new cell.
    counts: () => {
        const h = counting(['a'])
        const [x] = h.first
        assertEq(cells(h), '0:1')
        assertEq(h.imports.dup(x), x)
        assertEq(cells(h), '0:2')
        h.imports.drop(x)
        assertEq(cells(h), '0:1')
        const s = h.imports.from_unit(0x62)
        const t = h.imports.concat(x, s)
        assertEq(`${h.read(s)} ${h.read(t)} ${h.imports.length(t)} ${h.imports.kind(t)}`, 'b ab 2 4')
        assertEq(cells(h), '0:1,1:1,2:1')
        h.imports.drop(x)
        h.imports.drop(s)
        assertEq(cells(h), '2:1')
        // substring and item make a cell too, an item of its own beside the array's
        const u = h.imports.substring(t, 1, 2)
        assertEq(`${h.read(u)} ${cells(h)}`, 'b 2:1,3:1')
        const c = counting([[t]])
        const [arr] = c.first
        const item = c.imports.item(arr, 0)
        assertEq(`${c.read(item)} ${cells(c)}`, `${t} 0:1,1:1`)
    },
    // Any's constants are their NaN boxes, kept as globals, and keep keeps every cell alive at its count: live tells
    // what changed since, a cell freed among it.
    kept: () => {
        const h = counting(['a'])
        const [x] = h.first
        const { undefined: u, null: n, true: t, false: f } = h.imports
        assertEq([u, n, t, f].map(g => `${g.value}:${String(h.read(g.value))}`).join(),
            `${UNDEFINED}:undefined,${NULL}:null,${TRUE}:true,${FALSE}:false`)
        assertEq(cells(h), '0:1')
        const s = h.imports.from_unit(0x61)
        h.keep()
        assertEq(cells(h), '')
        h.imports.drop(s)
        h.imports.dup(x)
        assertEq(cells(h), `0:2,${handleOf(s)}:0`)
    },
    // Any's copy variants are not counted: a value made of one is its own bits, and a dup, a drop, a push or a throw of
    // such a box leaves no cell.
    copy: () => {
        const h = counting([true, null, 'a'])
        const [t0, n0, s0] = h.first
        assertEq(cells(h), '0:1')
        assertEq([h.imports.from_bool(1), h.imports.from_bool(0), h.own(undefined), h.own(null)].join(),
            `${TRUE},${FALSE},${UNDEFINED},${NULL}`)
        assertEq([h.imports.dup(t0), h.imports.dup(UNDEFINED)].join(), `${t0},${UNDEFINED}`)
        h.imports.drop(n0)
        h.imports.drop(TRUE)
        h.imports.drop(TRUE)
        const b = h.imports.begin_array(2)
        h.imports.push(b, t0)
        h.imports.push(b, NULL)
        const arr = h.imports.seal(b)
        assertEq(`${JSON.stringify(h.read(arr))} ${h.read(t0)} ${cells(h)}`, `[true,null] true 0:1,${handleOf(arr)}:1`)
        h.imports.throw(FALSE)
        assertEq(`${h.has_thrown()} ${h.read(h.thrown())} ${cells(h)}`, `1 false 0:1,${handleOf(arr)}:1`)
        assertEq(typeof h.read(h.own(1.5)), 'number')
        assertEq(cells(h), `0:1,${handleOf(arr)}:1`)
    },
    // Ref ops count a live dyn-ref and refuse a forged or freed one.
    ref: () => {
        const h = counting(['a', 'b'])
        const [a0, b0] = h.first
        assertEq(h.imports.kind_ref(a0), 4)
        assertEq(h.imports.dup_ref(a0), a0)
        assertEq(cells(h), '0:2,1:1')
        assertEq(h.imports.same_ref(a0, a0), 1)
        assertEq(h.imports.same_ref(a0, b0), 0)
        // Two cells of one JS value are the same reference, as Any.same and NaNVM.
        const shared = ['x']
        const h2 = counting([shared, shared])
        const [s0, s1] = h2.first
        assert(s0 !== s1)
        assertEq(h2.imports.same_ref(s0, s1), 1)
        h.imports.drop_ref(a0)
        assertEq(cells(h), '0:1,1:1')
    },
    // The memory holds a module's data segments at data_base, past bytes that the host keeps, and make_string makes a cell
    // of the UTF-16 units at an address, the low byte of each first.
    makeString: () => {
        const h = counting([], 6)
        const base = h.imports.data_base.value
        assert(typeof base === 'number' && base > 0, base)
        new Uint8Array(h.imports.memory.buffer).set([0x61, 0x00, 0x3d, 0xd8, 0x00, 0xde], base)
        const s = h.imports.make_string(base, 3)
        const e = h.imports.make_string(base, 0)
        assertEq(`${h.read(s)} ${JSON.stringify(h.read(e))} ${cells(h)}`, `a\u{1F600} "" ${handleOf(s)}:1,${handleOf(e)}:1`)
    },
    // A builder is a handle of its own: push takes over a count of a cell as its next item, and seal ends the builder and
    // makes a cell of the array, which holds an array that it holds as its value. So does begin_object with push_property,
    // and a repeated key keeps its first position and its last value.
    builders: () => {
        const h = counting(['a', 'b'])
        const [a0, b0] = h.first
        const b = h.imports.begin_array(2)
        assertEq(h.builders().join(), `${b}`)
        h.imports.push(b, a0)
        assertEq(cells(h), '1:1')
        h.imports.push(b, h.imports.dup(b0))
        assertEq(cells(h), '1:1')
        const r = h.imports.seal(b)
        assertEq(`${JSON.stringify(h.read(r))} ${h.builders().length} ${cells(h)}`, `["a","b"] 0 1:1,${handleOf(r)}:1`)
        const c = h.imports.begin_array(1)
        assert(c !== b)
        h.imports.push(c, r)
        const t = h.imports.seal(c)
        assertEq(`${JSON.stringify(h.read(t))} ${cells(h)}`, `[["a","b"]] 1:1,${handleOf(t)}:1`)
        // push_all borrows an array cell and adds each of its items after what is pushed already.
        const all = h.imports.begin_array(2)
        h.imports.push(all, h.imports.from_unit(0x63))
        h.imports.push_all(all, t)
        const u = h.imports.seal(all)
        assertEq(`${JSON.stringify(h.read(u))} ${cells(h)}`, `["c",["a","b"]] 1:1,${handleOf(t)}:1,${handleOf(u)}:1`)
        h.imports.drop(u)
        const emptyArray = h.imports.seal(h.imports.begin_array(0))
        assertEq(JSON.stringify(h.read(emptyArray)), '[]')
        h.imports.drop(emptyArray)
        // Cell 0 was consumed by the array half; make fresh string cells for the object.
        const o = h.imports.begin_object(3)
        h.imports.push_property(o, h.imports.from_unit(0x61), h.imports.from_unit(0x62))
        h.imports.push_property(o, h.imports.from_unit(0x62), h.imports.from_unit(0x61))
        h.imports.push_property(o, h.imports.from_unit(0x61), h.imports.from_unit(0x63))
        const p = h.imports.seal(o)
        assertEq(`${JSON.stringify(h.read(p))} ${cells(h)}`, `{"a":"c","b":"a"} 1:1,${handleOf(t)}:1,${handleOf(p)}:1`)
        const emptyObject = h.imports.seal(h.imports.begin_object(0))
        assertEq(JSON.stringify(h.read(emptyObject)), '{}')
        h.imports.drop(emptyObject)
    },
    // `call` applies an existing function value to a sealed args array and answers a new cell of the result.
    call: () => {
        const add = (/** @type {unknown} */ a, /** @type {unknown} */ b) => /** @type {number} */ (a) + /** @type {number} */ (b)
        const h = counting([add, [2, 3]])
        const [f0, args0] = h.first
        h.keep()
        const r = h.imports.call(f0, args0)
        // a number is an immediate: the call leaves no new cell
        assertEq(`${h.read(r)} ${cells(h)}`, '5 ')
        h.imports.drop(r)
        assertEq(cells(h), '')
        const { f, h: m } = load(
            [['f', func], ['args', array]],
            any,
            call('Functions', 'call', [get('f'), get('args')]),
            [(/** @type {unknown} */ x) => x, ['ok']],
        )
        const [mf, ma] = m.first
        m.keep()
        const got = f(mf, ma)
        assert(typeof got === 'bigint')
        assertEq(`${m.read(got)} ${cells(m)}`, `ok ${handleOf(got)}:1`)
        m.imports.drop(got)
        assertEq(cells(m), '')
    },
    // `find` answers a property index or `-1`; `join` and `text` make owned cells.
    find: () => {
        const h = counting([{ b: 1, a: 2 }, 'b', 'a', 'z'])
        const [o, kb, ka, kz] = h.first
        h.keep()
        assertEq(`${h.imports.find(o, kb)} ${h.imports.find(o, ka)} ${h.imports.find(o, kz)} ${cells(h)}`, '0 1 -1 ')
    },
    join: () => {
        const h = counting([['a', '', 'b'], ', '])
        const [parts, sep] = h.first
        h.keep()
        const r = h.imports.join(parts, sep)
        assertEq(`${h.read(r)} ${cells(h)}`, `a, , b ${handleOf(r)}:1`)
        h.imports.drop(r)
        assertEq(cells(h), '')
    },
    key: () => {
        const h = counting([{ b: 1, a: 2 }])
        const [o] = h.first
        h.keep()
        const r = h.imports.key(o, 1)
        assertEq(`${h.read(r)} ${cells(h)}`, `a ${handleOf(r)}:1`)
        h.imports.drop(r)
        assertEq(cells(h), '')
    },
    text: () => {
        const f = (/** @type {unknown} */ a) => a
        const h = counting([f])
        const [f0] = h.first
        h.keep()
        const r = h.imports.text(f0)
        assertEq(`${h.read(r)} ${cells(h)}`, `${f.toString()} ${handleOf(r)}:1`)
        h.imports.drop(r)
        assertEq(cells(h), '')
    },
    // A throw from the function keeps its value and traps.
    callThrows: () => {
        const h = counting([() => { throw 'no' }, []])
        const [f0, args0] = h.first
        h.keep()
        try {
            h.imports.call(f0, args0)
            assert(false)
        } catch (e) {
            assertEq(e, 'no')
        }
        assertEq(`${h.has_thrown()} ${cells(h)}`, '1 ')
        const t = h.thrown()
        assertEq(`${h.read(t)} ${cells(h)}`, `no ${handleOf(t)}:1`)
        h.imports.drop(t)
        assertEq(cells(h), '')
    },
    // A throw takes over a cell and keeps its value, which `thrown` gives the caller as a cell of its own.
    thrown: () => {
        const h = counting(['x', 'y'])
        const [x, y] = h.first
        h.keep()
        assertEq(h.has_thrown(), 0)
        h.imports.throw(h.imports.dup(x))
        assertEq(`${h.has_thrown()} ${cells(h)}`, '1 ')
        const t = h.thrown()
        assertEq(`${h.read(t)} ${h.has_thrown()} ${cells(h)}`, `x 0 ${handleOf(t)}:1`)
        h.imports.drop(t)
        assertEq(cells(h), '')
        void y
    },
    // `fail` keeps a value without a cell, as a native import does after a FunctionalScript throw.
    fail: () => {
        const h = counting([])
        h.keep()
        h.fail('RangeError: Division by zero')
        assertEq(h.has_thrown(), 1)
        const t = h.thrown()
        assertEq(`${h.read(t)} ${h.has_thrown()} ${cells(h)}`, `RangeError: Division by zero 0 ${handleOf(t)}:1`)
        h.imports.drop(t)
        assertEq(cells(h), '')
    },
    // `recover` frees what a trap abandoned, back to the counts at which cells were kept, ends open builders, forgets a value
    // that no one asked for, and answers what it freed. It cannot give back a count that a module took from a kept cell.
    recover: () => {
        const h = counting(['x', 'y'])
        const [x, y] = h.first
        h.keep()
        h.imports.dup(x)
        const s = h.imports.from_unit(0x61)
        h.imports.begin_array(1)
        h.imports.throw(h.imports.dup(y))
        assertEq(`${h.recover().map(([k, n]) => `${k}:${n}`).join()} ${cells(h)} ${h.builders().length} ${h.has_thrown()}`,
            `0:1,${handleOf(s)}:1  0 0`)
        assertEq(h.recover().length, 0)
        h.imports.drop(y)
        assertEq(`${h.recover().length} ${cells(h)}`, '0 1:0')
    },
    // A handle of no cell throws, and so does one whose cell a drop freed, units past the memory, a handle of no builder or of
    // a sealed one, a push past a builder's length, a push_all past it, of an object builder or of no array, a seal of fewer items, a throw after a throw and `thrown` after none.
    // `call` of a non-function or non-array, `make_function` of a frame that is not an array or a text that is not a
    // string, a call of its function at an index past the table or of no code, and `frame` of a function that it did not
    // make or past its frame,
    // trap as misuse.
    throw: {
        none: () => { counting([]).read(FORGED) },
        freed: () => {
            const h = counting(['x'])
            const [x] = h.first
            h.imports.drop(x)
            h.imports.dup(x)
        },
        past: () => {
            const h = counting([])
            h.imports.make_string(h.imports.memory.buffer.byteLength - 1, 1)
        },
        builder: () => { counting([]).imports.seal(0) },
        sealed: () => {
            const h = counting([])
            const b = h.imports.begin_array(0)
            h.imports.seal(b)
            h.imports.push(b, UNDEFINED)
        },
        full: () => {
            const h = counting([])
            h.imports.push(h.imports.begin_array(0), UNDEFINED)
        },
        allFull: () => {
            const h = counting([['x']])
            h.imports.push_all(h.imports.begin_array(0), h.first[0])
        },
        allObject: () => {
            const h = counting([[]])
            h.imports.push_all(h.imports.begin_object(0), h.first[0])
        },
        allNotArray: () => {
            const h = counting(['x'])
            h.imports.push_all(h.imports.begin_array(1), h.first[0])
        },
        short: () => {
            const h = counting([])
            h.imports.seal(h.imports.begin_array(1))
        },
        twice: () => {
            const h = counting(['x', 'y'])
            const [x, y] = h.first
            h.imports.throw(x)
            h.imports.throw(y)
        },
        failTwice: () => {
            const h = counting([])
            h.fail('a')
            h.fail('b')
        },
        nothing: () => { counting([]).thrown() },
        callNotFunction: () => {
            const h = counting(['x', []])
            h.imports.call(h.first[0], h.first[1])
        },
        callNotArray: () => {
            const h = counting([() => 0, 'x'])
            h.imports.call(h.first[0], h.first[1])
        },
        frameNotArray: () => {
            const h = counting(['x'])
            h.imports.make_function(0, h.first[0], 0, UNDEFINED)
        },
        textNotString: () => {
            const h = counting([[], 1])
            h.imports.make_function(0, h.first[0], 0, h.first[1])
        },
        pastTable: () => {
            const h = counting([[]])
            const f = h.read(h.imports.make_function(0, h.first[0], 0, UNDEFINED))
            assert(typeof f === 'function')
            f()
        },
        noCode: () => {
            const h = counting([[]], 0, 1)
            const f = h.read(h.imports.make_function(0, h.first[0], 0, UNDEFINED))
            assert(typeof f === 'function')
            f()
        },
        frameOfOther: () => {
            const h = counting([() => 0])
            h.imports.frame(h.first[0], 0)
        },
        framePast: () => {
            const h = counting([['x']])
            h.imports.frame(h.imports.make_function(0, h.first[0], 0, UNDEFINED), 1)
        },
        kindRef: () => { counting([]).imports.kind_ref(FORGED) },
        // A live cell with a forged kind nibble traps, as NaNVM does.
        kindNibble: () => {
            const h = counting(['a'])
            const [a0] = h.first
            h.imports.kind_ref(i64(BigInt.asUintN(64, a0) ^ (1n << 48n)))
        },
        dupKindNibble: () => {
            const h = counting(['a'])
            const [a0] = h.first
            h.imports.dup_ref(i64(BigInt.asUintN(64, a0) ^ (1n << 48n)))
        },
        sameKindNibble: () => {
            const h = counting(['a'])
            const [a0] = h.first
            h.imports.same_ref(i64(BigInt.asUintN(64, a0) ^ (1n << 48n)), a0)
        },
        // A non-ref that is not a recognized scalar traps, as NaNVM does.
        dupMalformed: () => { counting([]).imports.dup(i64(0x7ff0_0000_0000_0040n)) },
        dropMalformed: () => { counting([]).imports.drop(i64(0x7ff0_0000_0000_0040n)) },
    },
    // `make_function` makes a function of the module's code, which reads its frame through `self` and its arguments
    // through `args`: JavaScript and `call` both call it, `length` and `text` are the ones given, a throw of the code is
    // the function's throw, and every cell is as it was after.
    closure: () => {
        const self = get('self')
        const args = get('args')
        const index = /** @type {(k: number) => Term} */ (k => lit(u(31), BigInt(k)))
        const borrowed = /** @type {readonly Param[]} */ ([['self', func], ['args', array]])
        const text = only(any, 'string', 'undefined')
        /** @type {(c: string, length: number) => Term} */
        const make = (c, length) => call('Functions', 'make_function', [codeOf(c), get('fr'), index(length), get('t')])
        const checked = assertOk(check({
            imports: l0,
            functions: [
                // the item 1 of its frame
                ['captured', fn(borrowed, any, call('Functions', 'frame', [self, index(1)]))],
                // its first argument
                ['first', fn(borrowed, any, call('Containers', 'item', [args, index(0)]))],
                // a throw of its arguments
                ['boom', fn(borrowed, any, throw_(call('Any', 'dup', [args])))],
                ['makeCaptured', fn([own('fr', array), own('t', text)], func, make('captured', 2))],
                ['makeFirst', fn([own('fr', array), own('t', text)], func, make('first', 1))],
                ['makeBoom', fn([own('fr', array), own('t', text)], func, make('boom', 0))],
            ],
            exports: ['makeCaptured', 'makeFirst', 'makeBoom'],
        }))
        const bytes = new Uint8Array(write(emit(checked)))
        assert(WebAssembly.validate(bytes))
        const compiled = new WebAssembly.Module(bytes)
        const { entries } = layoutOf(compiled)
        assertEq(entries, 3)
        const h = counting([['a', 'b'], '(x, y) => b', [], ['x']], 0, entries)
        const [fr, txt, empty, xs] = h.first
        const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': h.imports })
        const { makeCaptured, makeFirst, makeBoom } = exports
        assert(typeof makeCaptured === 'function' && typeof makeFirst === 'function' && typeof makeBoom === 'function')
        // the module fills the host's table, and exports none
        assert(exports.table === undefined && h.imports.table.get(0) !== null)
        h.keep()
        const c = makeCaptured(h.imports.dup(fr), h.imports.dup(txt))
        const f = makeFirst(h.imports.dup(empty), UNDEFINED)
        const b = makeBoom(h.imports.dup(empty), UNDEFINED)
        const [cf, ff, bf] = [c, f, b].map(h.read)
        assert(typeof cf === 'function' && typeof ff === 'function' && typeof bf === 'function')
        // JavaScript calls them, and each call frees the cells of `self` and `args` that it made
        assertEq(`${cf()} ${ff("y", "z")} ${cf.length} ${ff.length} ${bf.length}`, "b y 2 1 0")
        assertEq(cells(h), `${handleOf(c)}:1,${handleOf(f)}:1,${handleOf(b)}:1`)
        // `call` calls them too, and `text` and `length` answer the ones given
        const r = h.imports.call(f, xs)
        const t = h.imports.text(c)
        assertEq(`${h.read(r)} ${h.read(t)} ${h.read(h.imports.text(f))} ${h.imports.length(c)}`, 'x (x, y) => b undefined 2')
        h.imports.drop(r)
        h.imports.drop(t)
        // `frame` answers an owned item of the frame
        const k = h.imports.frame(c, 0)
        assertEq(h.read(k), 'a')
        h.imports.drop(k)
        // a throw of the code is the function's throw, from JavaScript and from `call`
        try {
            bf('v')
            assert(false)
        } catch (e) {
            assertEq(JSON.stringify(e), '["v"]')
        }
        assertEq(h.has_thrown(), 0)
        try {
            h.imports.call(b, xs)
            assert(false)
        } catch (e) {
            assertEq(JSON.stringify(e), '["x"]')
        }
        const thrown = h.thrown()
        assertEq(JSON.stringify(h.read(thrown)), '["x"]')
        h.imports.drop(thrown)
        // the text of a function that make_function did not make is its source
        const g = counting([() => 0])
        assertEq(g.read(g.imports.text(g.first[0])), '() => 0')
        for (const x of [c, f, b]) { h.imports.drop(x) }
        assertEq(cells(h), '')
    },
    // concat of a borrowed string answers an owned one, which the caller drops.
    concat: () => {
        const { f, h } = load([['a', string]], string, concat(a, a), ['ab'])
        const r = f(h.first[0])
        assert(typeof r === 'bigint')
        assertEq(`${h.read(r)} ${cells(h)}`, `abab 0:1,${handleOf(r)}:1`)
        h.imports.drop(r)
        assertEq(cells(h), '0:1')
    },
    // A function that makes a string and drops it leaves no cell.
    fromUnit: () => {
        const { f, h } = load([['c', u(16)]], unit, let_('s', call('String', 'from_unit', [get('c')]), s => drop(s)), [])
        f(0x61)
        assertEq(cells(h), '')
    },
    // An own parameter is the callee's to drop, and a dup is the caller's.
    own: () => {
        const { f, h } = load([own('v', any)], unit, drop(get('v')), ['x', 'y'])
        f(h.first[1])
        assertEq(cells(h), '0:1')
    },
    dup: () => {
        const { f, h } = load([['v', any]], any, call('Any', 'dup', [get('v')]), ['x'])
        const [x] = h.first
        assertEq(`${f(x)} ${cells(h)}`, `${x} 0:2`)
    },
    // A match lends its operand: the arm reads the string, then drops the owned value.
    lends: () => {
        const { f, h } = load([own('v', any)], u(31), match(get('v'), [
            [['string'], 'v.s', let_('n', call('String', 'length', [get('v.s')]), n => let_('d', drop(get('v')), () => n))],
            [null, null, let_('d', drop(get('v')), () => lit(u(31), 0n))],
        ]), ['abc', 1])
        const [s, n] = h.first
        assertEq(`${f(s)} ${f(n)} ${cells(h)}`, '3 0 ')
    },
    // A loop that owns its string doubles it k times, dropping each old one.
    loop: () => {
        const { f, h } = load([['a', string], ['k', f64]], string, loop('L', [['s', string, concat(a, a)], ['i', f64, one]], (s, i) =>
            if_(lt(i, get('k')), let_('t', concat(s, s), t => let_('d', drop(s), () => next('L', [['s', t], ['i', add(i, one)]]))), s)), ['ab'])
        const r = f(h.first[0], 3)
        assert(typeof r === 'bigint')
        assertEq(`${h.read(r)} ${h.live().length}`, 'abababababababab 2')
        h.imports.drop(r)
        assertEq(cells(h), '0:1')
    },
    // A path that leaves the function early drops what it owns first.
    early: () => {
        const { f, h } = load([['a', string], ['b', bool]], f64, let_('t', concat(a, a), t =>
            let_('x', if_(get('b'), let_('d', drop(t), () => return_(zero)), one), x =>
                let_('n', float(call('String', 'length', [t])), n => let_('e', drop(t), () => add(x, n))))), ['ab'])
        assertEq(`${f(h.first[0], 1)} ${f(h.first[0], 0)} ${cells(h)}`, '0 5 0:1')
    },
}

/** The cell index packed in a dyn-ref box. @type {(b: bigint) => bigint} */
const handleOf = b => (BigInt.asUintN(64, b) >> 2n) & 0x3fff_ffff_ffffn
