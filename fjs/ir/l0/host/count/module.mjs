/**
 * A host for the `fjs:l0` imports that counts every value, so that a
 * misplaced `dup` or `drop` shows: the [L0 view's imports](../module.f.js)
 * over cells that it holds, each a value and a count. Every `i64` that
 * crosses the ABI is a NaN box
 * ([runtime-in-ir.md](../../../../../doc/sasha-gil/ir/runtime-in-ir.md)
 * checkpoint 4e): a number, `undefined`, `null` or a boolean is its own
 * bits, and a reference packs a cell index in a dyn-ref box.
 *
 * - **A cell holds a counted value.** Long strings, bigints, arrays,
 *   objects and functions live in cells. A handle in a dyn-ref box names
 *   a cell by its index. A handle that names no cell throws, and so does
 *   one whose cell a `drop` freed.
 * - **Short strings are scalar boxes**
 *   ([short-strings.md](../../../../../doc/sasha-gil/ir/short-strings.md)
 *   S2): the host **accepts** every well-formed Sergey short-string tag
 *   in `read` / `kind` / `dup` / `drop` (pass-through bits, like a
 *   number). **Emission** is per String-manifest policy: default
 *   `alwaysDynRef` (variant A) keeps every made string a cell; pass
 *   `shortWhenEnabled` with enabled tags (B/C) to pack when a concrete
 *   tag fits, else the long path.
 * - **`dup` and `drop` count references.** On a dyn-ref they add or take
 *   one from its cell; on a scalar box they leave the bits alone. `Ref`'s
 *   `dup_ref` / `drop_ref` / `kind_ref` / `same_ref` do the same over
 *   bits that must be a live reference.
 * - **A copy value is not counted.** Any names `undefined`, `null`,
 *   `boolean` and `number` as its copy variants: `from_f64` and
 *   `from_bool` answer immediates, and a `dup` or a `drop` of one is a
 *   no-op. A short-string box is the same for counting.
 * - **What a constant holds is kept.** Any's `undefined`, `null`, `true`
 *   and `false` are their NaN boxes, as immutable globals. `keep` keeps
 *   every cell alive at its count. `live` then tells what a call
 *   changed: a cell that is not kept and is alive, and a kept one at
 *   another count, `0` where it was freed.
 * - **A builder is a handle of its own**, an `i32` that names an array or
 *   an object that is not sealed yet
 *   ([L0 design §8](../../../../../doc/sasha-gil/wasm/l0-design.md#8-containers-a-builder-handle-then-seal)):
 *   `begin_array(n)` begins one of `n` items and `begin_object(n)` one of
 *   `n` properties, `push` or `push_property` takes over a box as its next
 *   item or property (and the key, a string), a count of it that a `drop`
 *   would take away, `push_all` borrows a box of an array and adds each
 *   of its items, and `seal` ends the builder and makes a box of the
 *   array or the object, which the caller owns
 *   ([§9](../../../../../doc/sasha-gil/wasm/l0-design.md#9-objects-the-runtime-keeps-keys-unique-and-ordered):
 *   a repeated key keeps its first position and its last value). A push
 *   or a `push_all` past `n` items, a seal of fewer, and a handle of no builder, or of one
 *   that is sealed, throw. `builders` tells which are not sealed.
 * - **`call` invokes an existing function value**
 *   ([L0 design §12](../../../../../doc/sasha-gil/wasm/l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)):
 *   it borrows a box that holds a JavaScript function and a box that
 *   holds a sealed array of arguments, applies the function to those
 *   arguments, and answers a new box of the result. A throw from the
 *   function keeps its value as `throw` does and traps. A value that is
 *   not a function, or arguments that are not an array, trap as misuse.
 * - **`make_function` makes a JavaScript function of the module's code**
 *   ([slice 11b](../../../todo/slices.md#decisions-for-slice-11-2026-11-20)):
 *   it takes over a box of a sealed frame array and a box of a text, a
 *   string or `undefined`, and makes a box of a function whose `length`
 *   is the one given. A call of the function, from `call` or from
 *   JavaScript, makes a box of the function itself and one of its
 *   arguments array, calls the code at its index in the table that the
 *   host makes, with both borrowed, and frees them after. A throw of the code keeps its value, so the
 *   function throws that value, which `call` keeps again. `frame(self, i)`
 *   makes a box of item `i` of the frame, and `text` answers the text
 *   given. A frame that is not an array, a text that is not a string, a
 *   `frame` of a function that `make_function` did not make, or past its
 *   frame, and a call of an index that holds no code, throw.
 * - **A throw keeps its value**
 *   ([L0 design §13](../../../../../doc/sasha-gil/wasm/l0-design.md#13-errors-a-throw-traps)):
 *   `throw` takes over a box, as `push` does, keeps its value and
 *   returns, so that the `unreachable` after its call traps. The host then
 *   asks `has_thrown`, and `thrown` makes a box of the value, which the
 *   caller owns. `fail` keeps a value the same way without a box, for a
 *   FunctionalScript throw that a native import rethrows after recording
 *   it. `recover` frees what the frames that the trap abandoned held: each
 *   cell that is not kept, each kept one counted more than it was kept at,
 *   back to that count, and each builder that is not sealed, and it forgets
 *   a value that no one asked for. It answers the cells that it freed,
 *   each with the counts it took away, so a proof tells a throw that left
 *   nothing behind. It cannot give back a count that a module took away
 *   from a cell that it borrowed, so `live` still shows one.
 * - **The host makes the memory**, as a loader does
 *   ([L0 design §5](../../../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)):
 *   the region of a module's data segments starts at `data_base`, past
 *   bytes that the host keeps for itself, and holds as many bytes as the
 *   module's `fjs.layout` asks for. It makes the table too, of as many
 *   entries as the layout asks for, which the module fills from
 *   `table_base`, `0`. `make_string(ptr, len)` makes a box of
 *   the string of the `len` UTF-16 units at `ptr`, the low byte of each
 *   first, and throws where they reach past the memory.
 *
 * Counting is state, and a WebAssembly import has nowhere else to keep it,
 * so this is a host boundary in plain JavaScript beside the
 * FunctionalScript of the view
 * ([fjs/AGENTS.md §3.1](../../../../AGENTS.md#31-immutability-and-purity)).
 *
 * @module
 *
 * @import { Counting, StringEmit } from '../types.ts'
 */

import { isShort, maxEnabledLen, packEnabled, unpack } from '../../../runtime/string/short.f.js'
import { kind as valueKind } from '../../../../wasm/runtime/l0/module.f.js'
import { view } from '../module.f.js'

/** Default emit policy: variant A — every string stays a dyn-ref. @type {StringEmit} */
const alwaysDynRef = { kind: 'alwaysDynRef' }

/** The exponent's bits: a float whose exponent is not all ones is finite. */
const EXP = 0x7FF0_0000_0000_0000n
/** The bits that tell a non-finite number from the other scalars. */
const TAG8 = 0x7FF0_0000_0000_00FFn
/** The one NaN a number is boxed as. */
const NAN = 0x7FF8_0000_0000_0000n
/** The bits that tell a counted reference, and what they are for one. */
const REF_TAG = 0xFFF0_0000_0000_0003n
const DYN_REF = 0x7FF0_0000_0000_0002n

/** The NaN box of `undefined`. */
const UNDEFINED = 0x7FF0_0000_0000_0020n
/** The NaN box of `null`. */
const NULL = 0x7FF0_0000_0000_0030n
/** The NaN box of `false`. */
const FALSE = 0x7FF0_0000_0000_0010n
/** The NaN box of `true`. */
const TRUE = 0xFFF0_0000_0000_0010n

/** An i64 as the WebAssembly JavaScript API passes one. @type {(b: bigint) => bigint} */
const i64 = b => BigInt.asIntN(64, b)

/** Whether bits are a number: finite, or non-finite with the number's tag. @type {(b: bigint) => boolean} */
const isNumberBits = b => {
    const x = BigInt.asUintN(64, b)
    return (x & EXP) !== EXP || (x & TAG8) === EXP
}

/** Whether bits are a dynamic reference. @type {(b: bigint) => boolean} */
const isRefBits = b => (BigInt.asUintN(64, b) & REF_TAG) === DYN_REF

/**
 * UTF-16 units of a JS string (surrogate pairs stay as two units).
 *
 * @type {(s: string) => readonly number[]}
 */
const unitsOf = s => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i))

/**
 * Units of a well-formed short-string box, `'bad'` when the bits look
 * short but match no Sergey tag, or `null` when they are not in the short
 * family. A `'bad'` box must trap as not a value, never as a dyn-ref.
 *
 * @type {(b: bigint) => readonly number[] | 'bad' | null}
 */
const shortUnits = b => {
    const x = BigInt.asUintN(64, b)
    if (!isShort(x)) { return null }
    const u = unpack(x)
    return u[0] === 'ok' ? u[1] : 'bad'
}

/**
 * Whether bits are a recognized scalar: a number, one of Any's four
 * constant boxes, or a well-formed short string. NaNVM's `dup` / `drop`
 * only pass through inlines; anything else goes through `get` / `take`
 * and traps when unboxing fails.
 *
 * @type {(b: bigint) => boolean}
 */
const isScalarBits = b => {
    if (isNumberBits(b)) { return true }
    const x = BigInt.asUintN(64, b)
    if (x === UNDEFINED || x === NULL || x === FALSE || x === TRUE) { return true }
    const s = shortUnits(b)
    return s !== null && s !== 'bad'
}

/** The cell index packed in a dyn-ref box. @type {(b: bigint) => bigint} */
const handleOf = b => (BigInt.asUintN(64, b) >> 2n) & 0x3fff_ffff_ffffn

/** A number's box: its bits, with every NaN the one NaN. @type {(x: number) => bigint} */
const numberBox = x => i64(Number.isNaN(x) ? NAN : BigInt(floatBits(x)))

/** The IEEE bits of a float, as an unsigned 64-bit integer. @type {(x: number) => bigint} */
const floatBits = x => {
    const buf = new ArrayBuffer(8)
    new DataView(buf).setFloat64(0, x, true)
    return new DataView(buf).getBigUint64(0, true)
}

/** The float of IEEE bits. @type {(b: bigint) => number} */
const floatOf = b => {
    const buf = new ArrayBuffer(8)
    new DataView(buf).setBigUint64(0, BigInt.asUintN(64, b), true)
    return new DataView(buf).getFloat64(0, true)
}

/** Where the region of a module's data segments starts: past bytes that a runtime would keep for itself. */
const dataBase = 0x100

/**
 * A counting host whose first boxes are those of `values`, each a scalar
 * immediate or a counted cell, and whose memory holds `data` bytes of a
 * module's data segments at `data_base`, and whose table holds `entries`
 * of its code at `table_base`. `stringEmit` selects whether allocating
 * string imports may return a short box (B/C) or always a dyn-ref (A).
 *
 * @type {(values: readonly unknown[], data?: number, entries?: number, stringEmit?: StringEmit) => Counting}
 */
export const counting = (values, data = 0, entries = 0, stringEmit = alwaysDynRef) => {
    /** @type {Map<bigint, { readonly value: unknown, readonly count: number }>} */
    const cells = new Map()
    /** The count at which each kept cell was kept. @type {Map<bigint, number>} */
    const kept = new Map()
    let next = 0n
    /** @type {(h: bigint) => { readonly value: unknown, readonly count: number }} */
    const cell = h => {
        const c = cells.get(h)
        if (c === undefined) { throw 'fjs:l0 host: not a handle' }
        return c
    }
    /** A dyn-ref box of a live cell. @type {(h: bigint, kind: number) => bigint} */
    const boxRef = (h, kind) => i64(DYN_REF | (BigInt(kind) << 48n) | (h << 2n))
    /** The kind nibble `tttt` packed in a dyn-ref box. @type {(b: bigint) => number} */
    const kindOf = b => Number((BigInt.asUintN(64, b) >> 48n) & 0xfn)
    /** @type {(b: bigint) => bigint} */
    const refHandle = b => {
        if (!isRefBits(b)) { throw 'fjs:l0 host: not a value' }
        const h = handleOf(b)
        const { value } = cell(h)
        // NaNVM checks the box's kind against the value it keeps for the
        // handle; a forged `tttt` must trap the same way.
        if (kindOf(b) !== valueKind(value)) { throw 'fjs:l0 host: not a value' }
        return h
    }
    /** @type {(value: unknown) => bigint} */
    const make = value => {
        if (value === undefined) { return i64(UNDEFINED) }
        if (value === null) { return i64(NULL) }
        if (value === true) { return i64(TRUE) }
        if (value === false) { return i64(FALSE) }
        if (typeof value === 'number') { return numberBox(value) }
        if (typeof value === 'string' && stringEmit.kind === 'shortWhenEnabled'
            && value.length <= maxEnabledLen(stringEmit.enabledTags)) {
            const packed = packEnabled(unitsOf(value), stringEmit.enabledTags)
            if (packed[0] === 'ok') { return i64(packed[1]) }
        }
        const h = next
        next = h + 1n
        cells.set(h, { value, count: 1 })
        return boxRef(h, valueKind(value))
    }
    /** @type {(b: bigint) => unknown} */
    const read = b => {
        if (isNumberBits(b)) { return floatOf(b) }
        const x = BigInt.asUintN(64, b)
        if (x === UNDEFINED) { return undefined }
        if (x === NULL) { return null }
        if (x === FALSE) { return false }
        if (x === TRUE) { return true }
        const short = shortUnits(b)
        if (short === 'bad') { throw 'fjs:l0 host: not a value' }
        if (short !== null) { return String.fromCharCode(...short) }
        return cell(refHandle(b)).value
    }
    /** @type {(b: bigint) => bigint} */
    const dup = b => {
        if (isScalarBits(b)) { return b }
        const h = refHandle(b)
        const { value, count } = cell(h)
        cells.set(h, { value, count: count + 1 })
        return b
    }
    /** @type {(b: bigint) => void} */
    const drop = b => {
        if (isScalarBits(b)) { return }
        const h = refHandle(b)
        const { value, count } = cell(h)
        if (count === 1) {
            cells.delete(h)
        } else {
            cells.set(h, { value, count: count - 1 })
        }
    }
    /**
     * The builders that are not sealed: an array or an object, how many
     * items each takes, and those it has (for an object, each a key and a
     * value).
     *
     * @type {Map<number, { readonly kind: 'array' | 'object', readonly length: number, readonly items: readonly unknown[] }>}
     */
    const builders = new Map()
    let nextBuilder = 0
    /** @type {(b: number) => { readonly kind: 'array' | 'object', readonly length: number, readonly items: readonly unknown[] }} */
    const builder = b => {
        const x = builders.get(b)
        if (x === undefined) { throw 'fjs:l0 host: not a builder' }
        return x
    }
    /** @type {(kind: 'array' | 'object', n: number) => number} */
    const begin = (kind, n) => {
        const b = nextBuilder
        nextBuilder = b + 1
        builders.set(b, { kind, length: n, items: [] })
        return b
    }
    /** A constant of Any: its NaN box as an immutable global. @type {(bits: bigint) => WebAssembly.Global} */
    const constant = bits => new WebAssembly.Global({ value: 'i64', mutable: false }, i64(bits))
    /** The value that a throw keeps, until `thrown` or `recover` takes it. @type {{ readonly value: unknown } | null} */
    let held = null
    /** The frame and the text of each function that `make_function` made. @type {WeakMap<object, { readonly items: readonly unknown[], readonly text: string | undefined }>} */
    const made = new WeakMap()
    /** The table of the module's code, which it fills from `table_base`. */
    const table = new WebAssembly.Table({ element: 'anyfunc', initial: entries })
    const v = view(read)
    const memory = new WebAssembly.Memory({ initial: Math.ceil((dataBase + data) / 0x1_0000) })
    /** @type {(ptr: number, len: number) => string} */
    const units = (ptr, len) => {
        const bytes = new DataView(memory.buffer)
        if (ptr < 0 || len < 0 || ptr + 2 * len > bytes.byteLength) { throw 'fjs:l0 host: make_string past the memory' }
        return String.fromCharCode(...Array.from({ length: len }, (_, k) => bytes.getUint16(ptr + 2 * k, true)))
    }
    /** The first boxes, one per value. */
    const first = values.map(make)
    return {
        imports: {
            memory,
            data_base: new WebAssembly.Global({ value: 'i32', mutable: false }, dataBase),
            table,
            table_base: new WebAssembly.Global({ value: 'i32', mutable: false }, 0),
            make_string: (ptr, len) => make(units(ptr, len)),
            undefined: constant(UNDEFINED),
            null: constant(NULL),
            true: constant(TRUE),
            false: constant(FALSE),
            kind: v.kind,
            to_f64: v.to_f64,
            from_f64: x => make(v.from_f64(x)),
            to_bool: v.to_bool,
            from_bool: b => make(v.from_bool(/** @type {0 | 1} */ (b))),
            same: v.same,
            length: v.length,
            unit: v.unit,
            dup,
            drop,
            kind_ref: b => valueKind(cell(refHandle(b)).value),
            dup_ref: b => {
                refHandle(b)
                return dup(b)
            },
            drop_ref: b => {
                refHandle(b)
                drop(b)
            },
            // Reference identity is the JS value in the cell, as NaNVM's
            // `same_ref` compares the objects behind the handles and as
            // Any.same does: two cells of one array are one value, even when
            // their handles differ.
            same_ref: (a, b) => cell(refHandle(a)).value === cell(refHandle(b)).value ? 1 : 0,
            from_unit: c => make(v.from_unit(c)),
            concat: (a, b) => make(v.concat(a, b)),
            substring: (s, start, end) => make(v.substring(s, start, end)),
            item: (c, i) => make(v.item(c, i)),
            find: v.find,
            begin_array: n => begin('array', n),
            begin_object: n => begin('object', n),
            push: (b, h) => {
                const { kind, length, items } = builder(b)
                if (kind !== 'array') { throw 'fjs:l0 host: push of an object builder' }
                if (items.length >= length) { throw 'fjs:l0 host: push past the length of a builder' }
                const value = read(h)
                drop(h)
                builders.set(b, { kind, length, items: [...items, value] })
            },
            push_all: (b, a) => {
                const { kind, length, items } = builder(b)
                if (kind !== 'array') { throw 'fjs:l0 host: push_all of an object builder' }
                const all = read(a)
                if (!Array.isArray(all)) { throw 'fjs:l0 host: push_all of a value that is not an array' }
                if (items.length + all.length > length) { throw 'fjs:l0 host: push_all past the length of a builder' }
                builders.set(b, { kind, length, items: [...items, ...all] })
            },
            push_property: (b, k, h) => {
                const { kind, length, items } = builder(b)
                if (kind !== 'object') { throw 'fjs:l0 host: push_property of an array builder' }
                if (items.length >= length) { throw 'fjs:l0 host: push_property past the length of a builder' }
                const key = read(k)
                if (typeof key !== 'string') { throw 'fjs:l0 host: push_property of a key that is not a string' }
                const value = read(h)
                drop(k)
                drop(h)
                builders.set(b, { kind, length, items: [...items, [key, value]] })
            },
            seal: b => {
                const { kind, length, items } = builder(b)
                if (items.length !== length) { throw 'fjs:l0 host: seal of a builder that is not full' }
                builders.delete(b)
                if (kind === 'array') { return make(items) }
                // A repeated key keeps its first position and its last value.
                /** @type {Map<string, unknown>} */
                const last = new Map()
                /** @type {string[]} */
                const order = []
                for (const [key, value] of /** @type {readonly (readonly [string, unknown])[]} */ (items)) {
                    if (!last.has(key)) { order.push(key) }
                    last.set(key, value)
                }
                return make(Object.fromEntries(order.map(key => [key, last.get(key)])))
            },
            join: (parts, separator) => make(v.join(parts, separator)),
            key: (o, i) => make(v.key(o, i)),
            make_function: (code, frame, length, text) => {
                const items = read(frame)
                const t = read(text)
                if (!Array.isArray(items)) { throw 'fjs:l0 host: make_function of a frame that is not an array' }
                if (t !== undefined && typeof t !== 'string') { throw 'fjs:l0 host: make_function of a text that is not a string' }
                drop(frame)
                drop(text)
                /** @type {(...args: unknown[]) => unknown} */
                const fn = (...args) => {
                    const c = code >= 0 && code < table.length ? table.get(code) : null
                    if (typeof c !== 'function') { throw 'fjs:l0 host: make_function of no code' }
                    const self = make(fn)
                    const a = make(args)
                    try {
                        const r = c(self, a)
                        const value = read(r)
                        drop(r)
                        return value
                    } catch (e) {
                        // a throw of the code traps, and the value that it keeps is the function's throw
                        if (held === null) { throw e }
                        const { value } = held
                        held = null
                        throw value
                    } finally {
                        drop(self)
                        drop(a)
                    }
                }
                Object.defineProperty(fn, 'length', { value: length })
                made.set(fn, { items, text: t })
                return make(fn)
            },
            call: (f, args) => {
                const fn = read(f)
                const a = read(args)
                if (typeof fn !== 'function') { throw 'fjs:l0 host: call of a non-function' }
                if (!Array.isArray(a)) { throw 'fjs:l0 host: call args is not an array' }
                try {
                    return make(fn(...a))
                } catch (e) {
                    if (held !== null) { throw 'fjs:l0 host: a throw after a throw' }
                    held = { value: e }
                    throw e
                }
            },
            text: f => {
                const m = made.get(/** @type {object} */ (read(f)))
                return make(m === undefined ? v.text(f) : m.text)
            },
            throw: h => {
                if (held !== null) { throw 'fjs:l0 host: a throw after a throw' }
                const value = read(h)
                drop(h)
                held = { value }
            },
            frame: (self, i) => {
                const m = made.get(/** @type {object} */ (read(self)))
                if (m === undefined) { throw 'fjs:l0 host: frame of a function that make_function did not make' }
                if (i < 0 || i >= m.items.length) { throw 'fjs:l0 host: frame past its length' }
                return make(m.items[i])
            },
        },
        first,
        has_thrown: () => held === null ? 0 : 1,
        thrown: () => {
            if (held === null) { throw 'fjs:l0 host: nothing was thrown' }
            const { value } = held
            held = null
            return make(value)
        },
        recover: () => {
            held = null
            builders.clear()
            /** @type {(readonly [bigint, number])[]} */
            const freed = []
            for (const [h, { value, count }] of [...cells]) {
                const k = kept.get(h) ?? 0
                if (count <= k) { continue }
                freed.push([h, count - k])
                if (k === 0) {
                    cells.delete(h)
                } else {
                    cells.set(h, { value, count: k })
                }
            }
            return freed
        },
        read,
        own: make,
        fail: value => {
            if (held !== null) { throw 'fjs:l0 host: a throw after a throw' }
            held = { value }
        },
        keep: () => {
            for (const [h, { count }] of cells) { kept.set(h, count) }
        },
        live: () => [
            ...[...cells].flatMap(([h, { count }]) => kept.get(h) === count ? [] : [/** @type {const} */ ([h, count])]),
            ...[...kept.keys()].flatMap(h => cells.has(h) ? [] : [/** @type {const} */ ([h, 0])]),
        ],
        builders: () => [...builders.keys()],
    }
}
