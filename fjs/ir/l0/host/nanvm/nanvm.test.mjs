/**
 * The emitter's host proofs again, each module run on NaNVM's `.wasm`
 * through the [NaNVM host](./module.mjs) in place of the counting host
 * ([slice 12](../../../todo/slices.md)): the WebAssembly proofs, the
 * lifetime pass's, the FAST lowering's, the random programs, those of
 * Any's variants that know the IR heap, whose arena then has a memory of
 * its own beside NaNVM's, and those of String's module that knows it,
 * whose arena then grows NaNVM's own memory. A proof
 * that runs no module runs once more on the counting host, as it is.
 * L1's native rows run in NaNVM's Rust too, and are compared with
 * JavaScript on random floats, texts and bigints
 * ([slice 12c](../../../todo/slices.md)). A module that defines Any sees
 * NaNVM's NaN boxes as they are ([checkpoint 4c](../../../../../doc/sasha-gil/ir/runtime-in-ir.md)),
 * and one that counts the type that it defines does so through `Ref`,
 * NaNVM's functions of references, with no leak and no double drop
 * ([checkpoint 4d-1](../../../../../doc/sasha-gil/ir/defined-hooks.md)).
 * Any's own module in the IR
 * ([checkpoint 4d-2](../../../../../doc/sasha-gil/ir/defined-hooks.md#steps))
 * agrees with L0 on the same boxes.
 *
 * NaNVM's `.wasm` is built first, by
 *
 * ```sh
 * cargo build -p nanvm-l0-wasm --release --target wasm32-unknown-unknown
 * ```
 *
 * and this file fails where it is missing: it is named outside the host
 * proofs that `js-only.mjs` finds, so that a run without Rust still passes
 * those, and CI runs it after the build
 * (`node --test ./fjs/ir/l0/host/nanvm/nanvm.test.mjs`).
 *
 * @module
 */

import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { proof as fromFast } from '../../../from_fast/proof.mjs'
import { proof as random } from '../../../from_fast/random/proof.mjs'
import { proof as lifetime } from '../../../lifetime/proof.mjs'
import { proof as anyOnHeap } from '../../../runtime/any/proof.mjs'
import { proof as stringOnHeap } from '../../../runtime/string/heap.proof.mjs'
import { referencing, sealing } from '../../../testlib.f.js'
import { write } from '../../../../media/wasm/binary/write/module.f.js'
import { check } from '../../../check/module.f.js'
import { lifetime as lifetimePass } from '../../../lifetime/module.f.js'
import { module as anyModule } from '../../../runtime/any/module.f.js'
import { isShort, packEnabled, v1EnabledTags } from '../../../runtime/string/short.f.js'
import { emit } from '../../../wasm/module.f.js'
import { held, onHost, run } from '../../../wasm/testlib.mjs'
import { proof as wasm } from '../../../wasm/proof.mjs'
import { nanvmHost } from './module.mjs'

/** Where cargo writes NaNVM's `.wasm`, from the repository's root. */
const path = new URL('../../../../../target/wasm32-unknown-unknown/release/nanvm_l0_wasm.wasm', import.meta.url)

const host = nanvmHost(new WebAssembly.Module(readFileSync(path)))

/** @type {readonly (readonly [string, Readonly<Record<string, unknown>>])[]} */
const suites = [['wasm', wasm], ['lifetime', lifetime], ['from_fast', fromFast], ['random', random], ['any', anyOnHeap], ['string', stringOnHeap]]

let ran = 0
for (const [name, proofs] of suites) {
    for (const [k, f] of Object.entries(proofs)) {
        if (typeof f !== 'function') { continue }
        test(`${name}.${k}`, () => {
            ran += onHost(host, () => { f() })
        })
    }
}

/** A deterministic generator of 32-bit words: xorshift32 from `seed`. @type {(seed: number) => () => number} */
const words = seed => {
    let x = seed >>> 0
    return () => {
        x ^= x << 13
        x >>>= 0
        x ^= x >>> 17
        x ^= x << 5
        x >>>= 0
        return x
    }
}

/** The floats whose bits a generator gives, beside the edges of every kind. @type {(next: () => number, n: number) => readonly number[]} */
const floats = (next, n) => {
    const view = new DataView(new ArrayBuffer(8))
    const random = Array.from({ length: n }, () => {
        view.setUint32(0, next())
        view.setUint32(4, next())
        return view.getFloat64(0)
    })
    const small = Array.from({ length: n }, () => (next() - 0x8000_0000) / 2 ** (next() % 40))
    return [0, -0, 1, -1, 0.1, 0.1 + 0.2, 1e21, 1e-7, 123456789012345680000, 5e-324, Number.MAX_VALUE, NaN, Infinity, -Infinity, ...random, ...small]
}

/** Texts that `Number` reads, and many that it does not. @type {(next: () => number, n: number) => readonly string[]} */
const texts = (next, n) => {
    const parts = ['', ' ', '\t', '\n', '\u00a0', '\ufeff', '+', '-', '0', '1', '9', '.', 'e', 'E', 'x', '0x', '0b', '0o', 'f', 'Infinity', 'NaN', '_', '1e400', '\u0663']
    const random = Array.from({ length: n }, () =>
        Array.from({ length: next() % 6 }, () => parts[next() % parts.length]).join(''))
    return ['', ' 12 ', '0x1F', '0b101', '0o17', '1e3', '.5', '5.', '-Infinity', '+0', '-0', '1_000', '12a', ...random]
}

/** Calls a native row of a fresh NaNVM host on JavaScript values, and reads its answer. @type {(name: string, xs: readonly unknown[]) => unknown} */
const native = (name, xs) => {
    const h = host([])
    const f = /** @type {Function} */ (/** @type {Record<string, unknown>} */ (h.native)[name])
    const args = xs.map(x => typeof x === 'number' && name !== 'stringToNumber' && name !== 'bigintLess' ? x : h.own(x))
    const r = f(...args)
    return typeof r === 'bigint' ? h.read(r) : r
}

test('numberToString and stringToNumber agree with JavaScript', () => {
    const next = words(0x12c_5eed)
    for (const x of floats(next, 2000)) {
        const got = native('numberToString', [x])
        if (got !== String(x)) { throw ['numberToString', x, got, String(x)] }
    }
    for (const t of texts(next, 2000)) {
        const got = native('stringToNumber', [t])
        if (!Object.is(got, Number(t))) { throw ['stringToNumber', t, got, Number(t)] }
    }
})

test('numberShiftRight and numberAnd agree with JavaScript', () => {
    const next = words(0x5_41f7)
    const xs = floats(next, 300)
    for (const a of xs) {
        for (const b of xs.slice(0, 40)) {
            for (const [name, f] of /** @type {const} */ ([['numberShiftRight', (/** @type {number} */ x, /** @type {number} */ y) => x >> y], ['numberAnd', (/** @type {number} */ x, /** @type {number} */ y) => x & y]])) {
                const got = native(name, [a, b])
                if (!Object.is(got, f(a, b))) { throw [name, a, b, got, f(a, b)] }
            }
        }
    }
})

test('the bigint rows agree with JavaScript', () => {
    const next = words(0xb16_1e55)
    /** @type {() => bigint} */
    const big = () => {
        const w = Array.from({ length: next() % 5 }, () => BigInt(next()))
        const m = w.reduce((a, x) => (a << 32n) + x, 0n)
        return next() % 2 === 0 ? m : -m
    }
    /** @type {readonly (readonly [string, (a: bigint, b: bigint) => unknown])[]} */
    const rows = [
        ['bigintAdd', (a, b) => a + b],
        ['bigintSubtract', (a, b) => a - b],
        ['bigintMultiply', (a, b) => a * b],
        ['bigintDivide', (a, b) => a / b],
        ['bigintRemainder', (a, b) => a % b],
        ['bigintAnd', (a, b) => a & b],
        ['bigintEquals', (a, b) => a === b ? 1 : 0],
        ['bigintLess', (a, b) => a < b ? 1 : 0],
    ]
    for (let k = 0; k < 500; k += 1) {
        const [a, b] = [big(), big()]
        for (const [name, f] of rows) {
            if ((name === 'bigintDivide' || name === 'bigintRemainder') && b === 0n) { continue }
            const got = native(name, [a, b])
            if (got !== f(a, b)) { throw [name, a, b, got, f(a, b)] }
        }
        const by = BigInt(next() % 200 - 100)
        if (native('bigintShiftRight', [a, by]) !== a >> by) { throw ['bigintShiftRight', a, by] }
        if (native('bigintNegate', [a]) !== -a) { throw ['bigintNegate', a] }
        if (native('bigintToNumber', [a]) !== Number(a)) { throw ['bigintToNumber', a] }
        if (native('stringToBigInt', [String(a)]) !== a) { throw ['stringToBigInt', a] }
        if (native('bigintToString', [a]) !== String(a)) { throw ['bigintToString', a] }
        const x = [NaN, Infinity, -Infinity, 0][k % 8] ?? floats(next, 1)[14] ?? 0
        const mixed = native('bigintLess', [a, x])
        if (mixed !== (a < x ? 1 : a >= x ? 0 : -1)) { throw ['bigintLess', a, x, mixed] }
    }
})

/** A float's bits. @type {(x: number) => bigint} */
const bitsOf = x => {
    const v = new DataView(new ArrayBuffer(8))
    v.setFloat64(0, x)
    return v.getBigUint64(0)
}

/** The NaN box of a value of a copy variant or a number, as Sergey's README lays it out. @type {(v: unknown) => bigint} */
const boxed = v =>
    v === undefined ? 0x7FF0_0000_0000_0020n
    : v === null ? 0x7FF0_0000_0000_0030n
    : v === false ? 0x7FF0_0000_0000_0010n
    : v === true ? 0xFFF0_0000_0000_0010n
    : Number.isNaN(v) ? 0x7FF8_0000_0000_0000n
    : bitsOf(Number(v))

test('a module that defines Any sees the NaN boxes', () => {
    ran += onHost(host, () => run(sealing, {
        carrierOf: ([v]) => boxed(held(v)),
        isReference: ([v]) => {
            const x = held(v)
            if (x === null) { return false }
            // Short strings are scalar boxes under emit B (NaNVM default); long stay refs.
            if (typeof x === 'string') {
                const units = [...x].map(ch => /** @type {number} */ (ch.codePointAt(0)))
                return packEnabled(units, v1EnabledTags)[0] === 'error'
            }
            return ['bigint', 'object', 'function'].includes(typeof x)
        },
        boxOf: ([x]) => ({ any: x }),
    }, {}))
})

test('a module that counts the type it defines counts NaNVM references through its own hooks', () => {
    const owned = lifetimePass(referencing)
    if (owned[0] === 'error') { throw owned[1] }
    const checked = check(owned[1])
    if (checked[0] === 'error') { throw checked[1] }
    const compiled = new WebAssembly.Module(new Uint8Array(write(emit(checked[1]))))
    // a reference of each kind that NaNVM counts, and boxes that it does not
    const h = host(['ab', 12345678901234567890n, [1, 2], { x: 1 }, 1.5, undefined, null, true])
    const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': h.imports })
    h.keep()
    /** @type {(name: string, ...args: readonly bigint[]) => unknown} */
    const call = (name, ...args) => {
        const f = exports[name]
        if (typeof f !== 'function') { throw name }
        return f(...args)
    }
    for (const v of h.first) {
        // a copy is a new owner, which its drop gives up
        const copy = call('keep', v)
        if (typeof copy !== 'bigint') { throw ['keep', copy] }
        if (call('forget', copy) !== 1) { throw 'forget' }
        // two copies, each dropped where the function ends
        if (call('pair', v) !== 2) { throw 'pair' }
        // a move gives the same owner back, which the host drops
        const moved = call('take', h.imports.dup(v))
        if (typeof moved !== 'bigint') { throw ['take', moved] }
        h.imports.drop(moved)
    }
    const cells = h.live()
    if (cells.length !== 0) { throw ['leaked', cells] }
})

test("Any's IR module agrees with L0 on NaNVM and leaks no reference", () => {
    const owned = lifetimePass(anyModule)
    if (owned[0] === 'error') { throw owned[1] }
    const checked = check(owned[1])
    if (checked[0] === 'error') { throw checked[1] }
    const compiled = new WebAssembly.Module(new Uint8Array(write(emit(checked[1]))))
    const values = [undefined, null, false, true, 0, -0, 1.5, NaN, Infinity, -Infinity, 'ab', 12345678901234567890n, [1, 2], { x: 1 }, () => 0]
    const h = host(values)
    const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': h.imports })
    if (typeof exports.init === 'function') { exports.init() }
    h.keep()
    /** @type {(name: string, ...args: readonly unknown[]) => unknown} */
    const call = (name, ...args) => {
        const f = exports[name]
        if (typeof f !== 'function') { throw name }
        return f(...args)
    }
    // the four constants are the NaN boxes L0 uses (i64 as signed bigint)
    for (const [name, bits] of /** @type {const} */ ([
        ['undefinedOf', 0x7FF0_0000_0000_0020n],
        ['nullOf', 0x7FF0_0000_0000_0030n],
        ['falseOf', 0x7FF0_0000_0000_0010n],
        ['trueOf', 0xFFF0_0000_0000_0010n],
    ])) {
        const want = BigInt.asIntN(64, bits)
        if (call(name) !== want) { throw [name, call(name), want] }
    }
    // kind, and the scalar conversions, agree with L0 on every first cell
    for (const v of h.first) {
        if (call('kind', v) !== h.imports.kind(v)) { throw ['kind', v, call('kind', v), h.imports.kind(v)] }
        const k = h.imports.kind(v)
        if (k === 3) {
            const got = call('to_f64', v)
            const want = h.imports.to_f64(v)
            if (!Object.is(got, want)) { throw ['to_f64', v, got, want] }
        }
        if (k === 2) {
            if (call('to_bool', v) !== h.imports.to_bool(v)) { throw ['to_bool', v] }
        }
        // isRef matches dyn-ref boxes; short-string scalars (kind 4) are not refs.
        const ref = k >= 4 && !isShort(BigInt.asUintN(64, /** @type {bigint} */ (v)))
        if ((call('isRef', v) === 1) !== ref) { throw ['isRef', v, k, call('isRef', v)] }
    }
    // from_f64 / from_bool round-trip through L0's view
    for (const x of [0, -0, 1.5, NaN, Infinity, -Infinity, 1e-300, 1e300]) {
        const a = call('from_f64', x)
        const b = h.imports.from_f64(x)
        if (typeof a !== 'bigint' || a !== b) { throw ['from_f64', x, a, b] }
        if (!Object.is(call('to_f64', a), h.imports.to_f64(b))) { throw ['from_f64 round', x] }
        h.imports.drop(/** @type {bigint} */ (a))
    }
    for (const b of /** @type {const} */ ([0, 1])) {
        const a = call('from_bool', b)
        const c = h.imports.from_bool(b)
        if (a !== c) { throw ['from_bool', b, a, c] }
        if (call('to_bool', a) !== h.imports.to_bool(c)) { throw ['from_bool round', b] }
    }
    // a non-0/1 i32 still selects the true box, as L0's from_bool does
    if (call('from_bool', 7) !== h.imports.from_bool(1)) { throw ['from_bool', 7] }
    // same agrees with L0 on pairs of array/object/function; hooks copy and drop every reference with no leak
    const containers = h.first.filter(v => h.imports.kind(v) >= 6)
    for (const a of containers) {
        for (const b of containers) {
            if (call('same', a, b) !== h.imports.same(a, b)) { throw ['same', a, b] }
        }
    }
    for (const a of h.first.filter(v => h.imports.kind(v) >= 4)) {
        const copy = call('keep', a)
        if (typeof copy !== 'bigint') { throw ['keep', copy] }
        if (h.imports.kind(a) >= 6 && call('same', a, copy) !== 1) { throw ['same after keep', a, copy] }
        if (call('forget', copy) !== 1) { throw 'forget' }
        const moved = call('take', h.imports.dup(a))
        if (typeof moved !== 'bigint') { throw ['take', moved] }
        h.imports.drop(moved)
    }
    // numbers and other scalars: keep/forget through hooks that pass bits through
    for (const v of h.first.filter(x => h.imports.kind(x) <= 3)) {
        const copy = call('keep', v)
        if (copy !== v) { throw ['keep scalar', v, copy] }
        if (call('forget', copy) !== 1) { throw 'forget scalar' }
    }
    const cells = h.live()
    if (cells.length !== 0) { throw ['leaked', cells] }
})

test('a trap keeps its text until enter', () => {
    const h = host([])
    const s = h.own('ab')
    /** @type {(f: () => unknown) => unknown} */
    const caught = f => {
        try { f() } catch (e) { return e }
        throw 'no trap'
    }
    const e = caught(() => h.imports.unit(s, 2))
    if (!(e instanceof WebAssembly.RuntimeError)) { throw ['not a trap of WebAssembly', e] }
    if (h.trap?.(e) !== 'l0.unit: not an index') { throw ['text', e] }
    // taken
    if (h.trap?.(e) !== e) { throw 'the text was not taken' }
    caught(() => h.imports.unit(s, -1))
    h.keep()
    if (h.trap?.(e) !== e) { throw 'enter kept the text' }
    // a misuse in the middle of a change of NaNVM's state keeps its text too
    const full = caught(() => h.imports.push(h.imports.begin_array(0), 0n))
    // as the judge asks: whether it threw, then what it said, then what it abandoned
    if (h.has_thrown() !== 0) { throw 'a misuse threw' }
    if (h.trap?.(full) !== 'l0.push: full') { throw ['text of a full builder', full] }
    h.recover()
    if (h.builders().length !== 0) { throw 'recover left the builder open' }
})

test('make_string reads any bytes of the memory but those at address 0', () => {
    const h = host([])
    const exports = /** @type {Readonly<Record<string, unknown>>} */ (/** @type {unknown} */ (h.imports))
    const make = /** @type {(ptr: number, len: number) => bigint} */ (exports.make_string)
    const length = /** @type {(s: bigint) => number} */ (exports.length)
    const size = /** @type {WebAssembly.Memory} */ (exports.memory).buffer.byteLength
    /** The text of the trap of `f`. @type {(f: () => unknown) => unknown} */
    const trapped = f => {
        try { f() } catch (e) { return h.trap?.(e) }
        throw 'no trap'
    }
    // no units at address 0 are the empty string, and the memory's last unit is read
    if (length(make(0, 0)) !== 0) { throw 'empty' }
    if (length(make(size - 2, 1)) !== 1) { throw 'last unit' }
    // a unit at address 0 is no slice in Rust, and a unit past the memory is no byte of it
    if (trapped(() => make(0, 1)) !== 'l0.make_string: out of bounds') { throw 'address 0' }
    if (trapped(() => make(size - 2, 2)) !== 'l0.make_string: out of bounds') { throw 'past the memory' }
})

test('make_string reads the last unit of a memory of 65,536 pages', () => {
    const h = host([])
    const exports = /** @type {Readonly<Record<string, unknown>>} */ (/** @type {unknown} */ (h.imports))
    const make = /** @type {(ptr: number, len: number) => bigint} */ (exports.make_string)
    const length = /** @type {(s: bigint) => number} */ (exports.length)
    const memory = /** @type {WebAssembly.Memory} */ (exports.memory)
    // 2^32 bytes are more than a wasm32 `usize` holds, so the bound is no `usize`
    memory.grow(0x1_0000 - memory.buffer.byteLength / 0x1_0000)
    if (length(make(0xFFFF_FFFE, 1)) !== 1) { throw 'last unit' }
})

test('NaNVM ran modules', () => {
    if (ran === 0) { throw 'no module ran on NaNVM' }
})
