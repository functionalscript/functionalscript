/**
 * A host for the `fjs:l0` imports that is NaNVM itself, built as a `.wasm`
 * ([`nanvm/l0-wasm`](../../../../../nanvm/l0-wasm/src/lib.rs)), with the
 * same shape as the [counting host](../count/module.mjs), so that the
 * emitter's host proofs run a module on either
 * ([slice 12](../../../todo/slices.md)).
 *
 * - **The imports are NaNVM's exports**, passed as they are, so a module
 *   calls NaNVM with no JavaScript between. The loader adds what NaNVM
 *   cannot export: `data_base`, the address of a region that NaNVM's
 *   `reserve` gives for the module's data segments, as many bytes as its
 *   `fjs.layout` asks for, and Any's four constants, immutable `i64`
 *   globals of their NaN boxes: NaNVM's ABI speaks the box, so a number,
 *   `undefined`, `null` or a boolean is its own bits and only a reference
 *   holds a handle.
 * - **A code index runs through an adapter.** NaNVM hands every code
 *   index to its `fjs:host` import `invoke(code, self, args)`, which is
 *   the export of a small adapter module, `adapter`, so a call stays in
 *   WebAssembly: an index below `HOST` is a `call_indirect` into the table
 *   that the loader makes, of as many entries as the module's
 *   `fjs.layout` asks for, which the module imports and fills from
 *   `table_base`, `0`, so the adapter and the module share it
 *   ([L0 design §5](../../../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)).
 *   An index from `HOST` up goes on to JavaScript, and runs a
 *   JavaScript function that `own` gave NaNVM, on the values that its
 *   arguments hold. Where the function throws, the host gives NaNVM the
 *   value to `throw`, which traps.
 * - **Values cross by copy.** `own` makes NaNVM's value of a JavaScript
 *   value, through NaNVM's own L0 functions and bytes in a region it
 *   reserves, and `read` makes the JavaScript value of a handle the same
 *   way. An array, an object or a function that `own` made reads back as
 *   the JavaScript value it was made of, as a counting host answers the
 *   value that it holds, so a proof tells a module that answers what it
 *   was given from one that answers a copy. A function that `read` makes
 *   of a function of NaNVM calls it through NaNVM's `call`. Short-string
 *   boxes are accepted by NaNVM's ABI; emission follows `stringEmit`
 *   (default always dyn-ref), as on the counting host
 *   ([short-strings.md](../../../../../doc/sasha-gil/ir/short-strings.md) S2).
 * - **The host holds handles of its own**: one for each value that `own`
 *   made, to read it back, and one for each function that `read` made,
 *   to call it, and forgets those that NaNVM's `recover` frees. `live`
 *   leaves them out. NaNVM counts handles, not references, so
 *   `live` tells only how many handles a call left over or freed, not
 *   which: it answers one entry, the handle `-1` and that difference,
 *   where they are not as `keep` found them. `recover` answers the same of
 *   the handles that NaNVM's own `recover` freed, and `builders` one entry
 *   for each builder that is open.
 *
 * - **A trap keeps its text.** NaNVM traps bare under `panic=abort`, but
 *   keeps what a panic said, `l0.<name>: <reason>` for a misuse, and `trap`
 *   reads it through NaNVM's `trap_text_length` and `trap_text_into`, so the judge compares a misuse's
 *   reason on NaNVM as it does on the counting host.
 *
 * NaNVM's handles are its own, so `first` gives the handles of the first
 * values. L1's native rows are NaNVM's too, in Rust: `native` is its
 * exports for the `fjs:l1-native` imports, so a module that calls one
 * stays in WebAssembly as well.
 *
 * @module
 *
 * @import { Counting, StringEmit } from '../types.ts'
 * @import { _Nanvm } from './private.ts'
 * @import { Host as NativeHost } from '../../../native/host/types.ts'
 */

import { write } from '../../../../media/wasm/binary/write/module.f.js'

/** Default emit policy: variant A — every string stays a dyn-ref. @type {StringEmit} */
const alwaysDynRef = { kind: 'alwaysDynRef' }

/** The first code index of a JavaScript function that `own` gives NaNVM, past any module's table. */
export const HOST = 0x4000_0000

/**
 * The adapter: it imports `fjs:adapter` `table`, a table of code, and
 * `host`, and exports `invoke(code, self, args)`, which calls the code at
 * `code` in the table, or `host` from `HOST` up.
 *
 * @type {WebAssembly.Module}
 */
const adapter = new WebAssembly.Module(new Uint8Array(write({
    types: [
        { params: ['i64', 'i64'], results: ['i64'] },
        { params: ['i32', 'i64', 'i64'], results: ['i64'] },
    ],
    imports: [
        { module: 'fjs:adapter', name: 'table', desc: ['table', { element: 'funcref', limits: { min: 0, max: null } }] },
        { module: 'fjs:adapter', name: 'host', desc: ['func', 1] },
    ],
    functions: [{
        type: 1,
        locals: [],
        body: [
            ['local.get', 0], ['i32.const', HOST], ['i32.lt_u'],
            ['if', 'i64'],
            ['local.get', 1], ['local.get', 2], ['local.get', 0], ['call_indirect', 0, 0],
            ['else'],
            ['local.get', 0], ['local.get', 1], ['local.get', 2], ['call', 0],
            ['end'],
        ],
    }],
    tables: [],
    memories: [],
    globals: [],
    exports: [{ name: 'invoke', kind: 'func', index: 1 }],
    start: null,
    elements: [],
    dataCount: null,
    data: [],
    customs: [],
})))

const ARRAY = 6
const OBJECT = 7
const FUNCTION = 8

/** Whether a value is one of Any's copy variants: `undefined`, `null` or a boolean. @type {(value: unknown) => value is undefined | null | boolean} */
const isCopy = value => value === undefined || value === null || typeof value === 'boolean'

/**
 * The hosts of a compiled NaNVM: each call instantiates NaNVM afresh, with
 * `values` as its first values, a region of `data` bytes for a module's
 * data segments, and a table of `entries` for its code. `stringEmit`
 * selects whether allocating string imports may return a short box (B/C)
 * or always a dyn-ref (A), matching the counting host.
 *
 * @type {(nanvm: WebAssembly.Module) => (values: readonly unknown[], data?: number, entries?: number, stringEmit?: StringEmit) => Counting}
 */
export const nanvmHost = nanvm => (values, data = 0, entries = 0, stringEmit = alwaysDynRef) => {
    /** The table of code that the module fills and the adapter calls into. */
    const table = new WebAssembly.Table({ element: 'anyfunc', initial: entries })
    /** The JavaScript functions that `own` gave NaNVM, by code index from `HOST`. @type {Function[]} */
    const functions = []
    /** @type {(code: number, self: bigint, args: bigint) => bigint} */
    const host = (code, self, args) => {
        const f = functions[code - HOST]
        const xs = /** @type {readonly unknown[]} */ (read(args))
        /** @type {unknown} */
        let r
        try {
            r = f(...xs)
        } catch (e) {
            fail(e)
        }
        return own(r)
    }
    const { invoke } = new WebAssembly.Instance(adapter, { 'fjs:adapter': { table, host } }).exports
    const instance = new WebAssembly.Instance(nanvm, { 'fjs:host': { invoke } })
    const n = /** @type {_Nanvm} */ (/** @type {unknown} */ (instance.exports))
    n.set_string_emit_short(stringEmit.kind === 'shortWhenEnabled' ? 1 : 0)
    // Any's constants, as NaNVM boxes them: NaNVM is their one source.
    const UNDEFINED = n.constant_box(0)
    const NULL = n.constant_box(1)
    const FALSE = n.constant_box(2)
    const TRUE = n.constant_box(3)
    /** @type {(value: undefined | null | boolean) => bigint} */
    const constantOf = value => value === undefined ? UNDEFINED : value === null ? NULL : value ? TRUE : FALSE
    /** The units of a string, written in a region of their own. @type {(s: string) => bigint} */
    const makeString = s => {
        const ptr = n.reserve(2 * s.length)
        const view = new DataView(n.memory.buffer)
        for (let k = 0; k < s.length; k += 1) { view.setUint16(ptr + 2 * k, s.charCodeAt(k), true) }
        return n.make_string(ptr, s.length)
    }
    /** @type {(b: bigint) => bigint} */
    const makeBigint = b => {
        const negative = b < 0n
        /** @type {bigint[]} */
        const words = []
        for (let m = negative ? -b : b; m !== 0n; m >>= 64n) { words.push(BigInt.asUintN(64, m)) }
        const ptr = n.reserve(8 * words.length)
        const view = new DataView(n.memory.buffer)
        words.forEach((w, k) => view.setBigUint64(ptr + 8 * k, w, true))
        return n.make_bigint(words.length === 0 ? 0 : negative ? -1 : 1, ptr, words.length)
    }
    /** What `own` made, each a handle that the host keeps and the value: read back as that value. @type {(readonly [bigint, unknown])[]} */
    const made = []
    /** Forgets what `own` and `read` made whose handles NaNVM's `recover` freed. */
    const prune = () => {
        const alive = made.filter(([k]) => n.alive(k) === 1)
        made.length = 0
        made.push(...alive)
    }
    /** @type {(value: unknown) => bigint} */
    const own = value => {
        if (isCopy(value)) { return constantOf(value) }
        if (typeof value === 'number') { return n.from_f64(value) }
        if (typeof value === 'string') { return makeString(value) }
        if (typeof value === 'bigint') { return makeBigint(value) }
        // a value given twice is one value, as JavaScript's identity tells
        const known = made.find(([, v]) => v === value)
        if (known !== undefined) { return n.dup(known[0]) }
        /** @type {bigint} */
        let h
        if (Array.isArray(value)) {
            const b = n.begin_array(value.length)
            for (const x of value) { n.push(b, own(x)) }
            h = n.seal(b)
        } else if (typeof value === 'function') {
            const code = HOST + functions.length
            functions.push(value)
            const b = n.begin_array(0)
            h = n.make_function(code, n.seal(b), value.length, own(value.toString()))
        } else {
            const entries = Object.entries(/** @type {object} */ (value))
            const b = n.begin_object(entries.length)
            for (const [k, x] of entries) { n.push_property(b, own(k), own(x)) }
            h = n.seal(b)
        }
        made.push([n.dup(h), value])
        return h
    }
    /** @type {(h: bigint) => unknown} */
    const read = h => {
        const kind = n.kind(h)
        // a boolean is always one of Any's constants
        if (kind <= 3) { return kind === 0 ? undefined : kind === 1 ? null : kind === 2 ? h === TRUE : n.to_f64(h) }
        if (kind === 4) {
            const len = n.length(h)
            const ptr = n.reserve(2 * len)
            n.read_units(h, 0, len, ptr)
            const view = new DataView(n.memory.buffer)
            // in chunks, since an engine caps how many arguments a call takes
            let out = ''
            for (let k = 0; k < len; k += 0x1000) {
                out += String.fromCharCode(...Array.from({ length: Math.min(0x1000, len - k) }, (_, j) => view.getUint16(ptr + 2 * (k + j), true)))
            }
            return out
        }
        if (kind === 5) {
            const len = n.length(h)
            const ptr = n.reserve(8 * len)
            n.read_words(h, 0, len, ptr)
            const view = new DataView(n.memory.buffer)
            const m = Array.from({ length: len }, (_, k) => view.getBigUint64(ptr + 8 * k, true))
                .reduceRight((a, w) => (a << 64n) + w, 0n)
            return n.sign(h) < 0 ? -m : m
        }
        const found = made.find(([k]) => n.same(k, h) === 1)
        if (found !== undefined) { return found[1] }
        /** @type {(i: number) => unknown} */
        const at = i => {
            const x = n.item(h, i)
            const v = read(x)
            n.drop(x)
            return v
        }
        const len = n.length(h)
        if (kind === ARRAY) { return Array.from({ length: len }, (_, i) => at(i)) }
        if (kind === OBJECT) {
            return Object.fromEntries(Array.from({ length: len }, (_, i) => {
                const k = n.key(h, i)
                const key = read(k)
                n.drop(k)
                return [key, at(i)]
            }))
        }
        if (kind !== FUNCTION) { throw 'fjs:l0 nanvm: not a kind' }
        const f = n.dup(h)
        /** @type {(...xs: unknown[]) => unknown} */
        const fn = (...xs) => {
            n.enter()
            const args = own(xs)
            try {
                const r = n.call(f, args)
                const v = read(r)
                n.drop(r)
                n.drop(args)
                n.leave()
                return v
            } catch (e) {
                if (n.has_thrown() === 0) {
                    // a misuse threw nothing: free what the call made, and end its mark
                    n.recover()
                    prune()
                    throw e
                }
                const t = n.thrown()
                const v = read(t)
                n.drop(t)
                n.recover()
                prune()
                throw v
            }
        }
        Object.defineProperty(fn, 'length', { value: len })
        made.push([f, fn])
        return fn
    }
    /** Gives NaNVM a value to throw: NaNVM keeps it and traps. @type {(value: unknown) => never} */
    const fail = value => {
        n.throw(own(value))
        throw 'fjs:l0 nanvm: a throw that did not trap'
    }
    const first = values.map(own)
    const dataBase = n.reserve(data)
    /** @type {(h: bigint) => WebAssembly.Global} */
    const constant = h => new WebAssembly.Global({ value: 'i64', mutable: false }, h)
    /** The handles NaNVM holds that the host does not. */
    const others = () => n.live() - made.length
    let kept = others()
    /** @type {(d: number) => readonly (readonly [bigint, number])[]} */
    const entry = d => d === 0 ? [] : [[-1n, d]]
    return {
        imports: /** @type {Counting['imports']} */ ({
            ...instance.exports,
            data_base: new WebAssembly.Global({ value: 'i32', mutable: false }, dataBase),
            table,
            table_base: new WebAssembly.Global({ value: 'i32', mutable: false }, 0),
            undefined: constant(UNDEFINED),
            null: constant(NULL),
            false: constant(FALSE),
            true: constant(TRUE),
        }),
        first,
        native: /** @type {NativeHost} */ (/** @type {unknown} */ (instance.exports)),
        has_thrown: () => n.has_thrown() === 0 ? 0 : 1,
        thrown: n.thrown,
        trap: e => {
            // the text comes through memory, as bytes that the host reads do
            const len = n.trap_text_length()
            if (len < 0) { return e }
            const ptr = n.reserve(2 * len)
            n.trap_text_into(ptr)
            const view = new DataView(n.memory.buffer)
            return String.fromCharCode(...Array.from({ length: len }, (_, k) => view.getUint16(ptr + 2 * k, true)))
        },
        recover: () => {
            const before = others()
            n.recover()
            prune()
            return entry(before - others())
        },
        read,
        own,
        fail: value => {
            fail(value)
        },
        keep: () => {
            kept = others()
            n.enter()
        },
        live: () => entry(others() - kept),
        builders: () => Array.from({ length: n.open_builders() }, (_, k) => k),
    }
}
