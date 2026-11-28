/**
 * Host proof of String's IR module where the IR heap holds long strings
 * ([heap.f.js](./heap.f.js)) against [its model](./model/module.f.js), on
 * the host's WebAssembly engine: the module, an arena and Any that knows
 * the IR heap, each compiled from the IR, share the host's memory and meet
 * through the Heap's imports. The engine is the effect: the IR runs no
 * WebAssembly, and the modules meet only there. On either arena, seeded
 * runs of `concat`, `substring`, `length` and `unit`, with copies and drops
 * through Any, over short boxes of every tag, strings of the IR heap and
 * the host's, answer the model's form and units, an operand's very bits
 * where the model answers the operand, and the model's failures; each block
 * holds its length and its units, and in debug its type and its count; and
 * when every string is dropped the host has no cell over and the debug
 * arena no block. [NaNVM's test](../../l0/host/nanvm/nanvm.test.mjs) runs
 * these again with NaNVM's `.wasm` as the host. A run on the engine is an
 * effect by the owner's ruling, until such runs move into files of their
 * own ([host proofs for effects only](../../../../todo/host-proofs-for-effects-only.md#engine-runs)).
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)).
 *
 * @import { Module } from '../../types.ts'
 * @import { Form, Str } from './model/types.ts'
 */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { write } from '../../../media/wasm/binary/write/module.f.js'
import { check } from '../../check/module.f.js'
import { lifetime } from '../../lifetime/module.f.js'
import { emit } from '../../wasm/module.f.js'
import { hostOf } from '../../wasm/testlib.mjs'
import { withHeap as anyWithHeap } from '../any/module.f.js'
import { BLOCK, isIrStringBits } from '../box/module.f.js'
import { counted, module as release } from '../heap/module.f.js'
import { withHeap } from './heap.f.js'
import { concat, substring, unit } from './model/module.f.js'
import { isShort, maxEnabledLen, pack, v1EnabledTags } from './short.f.js'

/** A module's WebAssembly module, after the lifetime pass, compiled once. @type {(m: Module) => WebAssembly.Module} */
const compile = m => new WebAssembly.Module(new Uint8Array(write(emit(assertOk(check(assertOk(lifetime(m))))))))

/** The release arena's, the debug arena's, String's and Any's WebAssembly modules. */
const releaseArena = compile(release)
const debugArena = compile(counted)
const strings = compile(withHeap)
const anyHeap = compile(anyWithHeap)

/** The type of a long string's block: L0's kind 4, form 0. */
const stringType = 0x40

/** Whether `f` throws: a trap, or a failure of the host's. @type {(f: () => unknown) => boolean} */
const fails = f => {
    try {
        f()
        return false
    } catch {
        return true
    }
}

/** The units of a text. @type {(text: string) => readonly number[]} */
const unitsOf = text => Array.from({ length: text.length }, (_, k) => text.charCodeAt(k))

/** The text of units. @type {(units: readonly number[]) => string} */
const textOf = units => String.fromCharCode(...units)

/** The form of a string's bits: a short box first, since an `s7x7` box may hold any nibble. @type {(b: bigint) => Form} */
const formOf = b => isShort(b) ? 'short' : isIrStringBits(b) ? 'ir' : 'host'

/**
 * String, Any and an arena of `arena`, after `init`, all on the memory of a
 * host that `run` would make now. Answers String's and Any's functions,
 * the arena's, the memory, the host, and the most units that the host
 * boxes short, which its emit policy says: none on the counting host, 2 on
 * NaNVM's.
 *
 * @param {WebAssembly.Module} arena
 */
const load = arena => {
    /**
     * String's functions.
     *
     * @typedef {{
     *     readonly length: (s: bigint) => number
     *     readonly unit: (s: bigint, i: number) => number
     *     readonly concat: (a: bigint, b: bigint) => bigint
     *     readonly substring: (s: bigint, start: number, end: number) => bigint
     * }} Strings
     */
    /**
     * Any's functions that the proofs call: a copy of a borrowed value, and the drop of an owned one.
     *
     * @typedef {{
     *     readonly keep: (v: bigint) => bigint
     *     readonly forget: (v: bigint) => number
     * }} Any
     */
    /**
     * The arena's functions that the proofs call; `live` only in debug.
     *
     * @typedef {{ readonly live?: () => number }} Heap
     */
    const h = hostOf([])
    const { memory } = h.imports
    const heap = new WebAssembly.Instance(arena, { 'fjs:l0': { memory } }).exports
    const init = /** @type {() => void} */ (heap.init)
    init()
    const imports = { 'fjs:l0': h.imports, 'fjs:ir/heap': heap }
    const s = new WebAssembly.Instance(strings, imports).exports
    const any = new WebAssembly.Instance(anyHeap, imports).exports
    h.keep()
    const probe = h.own('ab')
    const hostShort = isShort(probe) ? maxEnabledLen(v1EnabledTags) : -1
    if (!isShort(probe)) { h.imports.drop(probe) }
    return {
        s: /** @type {Strings} */ (/** @type {unknown} */ (s)),
        any: /** @type {Any} */ (/** @type {unknown} */ (any)),
        heap: /** @type {Heap} */ (/** @type {unknown} */ (heap)),
        memory: /** @type {WebAssembly.Memory} */ (memory),
        h,
        hostShort,
    }
}

/**
 * A string of the run: its bits, which the run owns, and the model's
 * string.
 *
 * @typedef {{ readonly bits: bigint, readonly str: Str }} Held
 */

/**
 * Checks that the bits `b` are the string `str`: its form, and its units
 * through String's `length` and `unit`; a block's length and units in the
 * memory too, and in debug its type and a count above 0.
 *
 * @type {(loaded: ReturnType<typeof load>, b: bigint, str: Str) => void}
 */
const holds = ({ s, memory, heap }, b, str) => {
    assertEq(formOf(b), str.form)
    const n = s.length(b)
    assertEq(textOf(Array.from({ length: n }, (_, k) => s.unit(b, k))), textOf(str.units))
    if (str.form === 'ir') {
        const p = Number(b & BLOCK)
        const view = new DataView(memory.buffer)
        assertEq(view.getUint32(p, true), str.units.length)
        assertEq(textOf(Array.from({ length: n }, (_, k) => view.getUint16(p + 4 + 2 * k, true))), textOf(str.units))
        if (heap.live !== undefined) {
            assertEq(view.getUint8(p - 8 + 5), stringType)
            assert(view.getUint32(p - 8, true) > 0)
        }
    }
}

/** The texts of the short boxes of every tag that a run starts with. */
const shortTexts = ['', 'a', 'ab', '€éā', 'abcd', 'hello', 'abcdef', 'abcdefg', '$0A_az12']

/** The texts of the host's strings that a run starts with. */
const hostTexts = ['', 'x', 'xy', 'host!', 'a longer string of the host’s']

/**
 * The strings that a run starts with: a short box of each tag, the host's
 * strings, and strings of the IR heap that `concat` makes of short boxes.
 *
 * @type {(loaded: ReturnType<typeof load>) => readonly Held[]}
 */
const first = loaded => {
    const { s, h } = loaded
    /** @type {(text: string) => Held} */
    const short = text => {
        const units = unitsOf(text)
        return { bits: BigInt.asIntN(64, assertOk(pack(units))), str: { form: 'short', units } }
    }
    /** @type {(text: string) => Held} */
    const host = text => {
        const bits = h.own(text)
        return { bits, str: { form: formOf(bits), units: unitsOf(text) } }
    }
    const shorts = shortTexts.map(short)
    const [ab, c] = [short('ab'), short('a')]
    const made = { bits: s.concat(ab.bits, c.bits), str: concat(loaded.hostShort)(ab.str, c.str) }
    holds(loaded, made.bits, made.str)
    const twice = { bits: s.concat(made.bits, made.bits), str: concat(loaded.hostShort)(made.str, made.str) }
    return [...shorts, ...hostTexts.map(host), made, twice]
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

/** The most units of a string that a run makes, so that joins do not grow without end. */
const cap = 600

/**
 * A seeded run of `steps` steps over the strings that a run starts with:
 * each `concat`, `substring` and `unit` answers as the model does, or
 * fails where it fails, `keep` copies and `forget` drops a string through
 * Any, and at the end every string is dropped. Answers how many steps
 * failed as the model said.
 *
 * @type {(loaded: ReturnType<typeof load>, seed: number, steps: number) => number}
 */
const runOf = (loaded, seed, steps) => {
    const { s, any, hostShort } = loaded
    const next = words(seed)
    /** @type {(n: number) => number} */
    const below = n => next() % n
    /** @type {Held[]} */
    const pool = [...first(loaded)]
    /** A string of the pool, one of the IR's three times in four, since the host's operand makes the host's string. @type {() => Held} */
    const pick = () => {
        const ours = below(4) === 0 ? [] : pool.filter(x => x.str.form !== 'host')
        const from = ours.length === 0 ? pool : ours
        return from[below(from.length)]
    }
    let failed = 0
    for (let k = 0; k < steps; k += 1) {
        const op = below(10)
        if (op < 4) {
            const [a, b] = [pick(), pick()]
            if (a.str.units.length + b.str.units.length > cap) { continue }
            const model = concat(hostShort)(a.str, b.str)
            const bits = s.concat(a.bits, b.bits)
            holds(loaded, bits, model)
            if (model === a.str) { assertEq(bits, a.bits) }
            if (model === b.str) { assertEq(bits, b.bits) }
            pool.push({ bits, str: model })
        } else if (op < 7) {
            const x = pick()
            const n = x.str.units.length
            // a host's string fails in the host, which the module only calls, so its parts stay inside it; one in four
            // of the IR's parts is any two indices, from one before the string to one past it
            const [i, j] = x.str.form !== 'host' && below(4) === 0 ? [below(n + 3) - 1, below(n + 3) - 1] : [below(n + 1), below(n + 1)].sort((p, q) => p - q)
            const model = substring(hostShort)(x.str, i, j)
            if (model === null) {
                assert(fails(() => s.substring(x.bits, i, j)))
                failed += 1
            } else {
                const bits = s.substring(x.bits, i, j)
                holds(loaded, bits, model)
                if (model === x.str) { assertEq(bits, x.bits) }
                pool.push({ bits, str: model })
            }
        } else if (op < 8) {
            const x = pick()
            const i = x.str.form === 'host' ? below(x.str.units.length + 1) - 1 : below(x.str.units.length + 2) - 1
            const model = unit(x.str, i)
            if (model === null) {
                if (x.str.form !== 'host') {
                    assert(fails(() => s.unit(x.bits, i)))
                    failed += 1
                }
            } else {
                assertEq(s.unit(x.bits, i), model)
            }
        } else if (op < 9) {
            const x = pick()
            pool.push({ bits: any.keep(x.bits), str: x.str })
        } else if (pool.length > 1) {
            const [x] = pool.splice(below(pool.length), 1)
            assertEq(any.forget(x.bits), 1)
        }
    }
    for (const x of pool) { assertEq(any.forget(x.bits), 1) }
    return failed
}

/**
 * Checks that nothing is left over: the host has no cell, and the debug
 * arena no block whose count is above 0.
 *
 * @type {(loaded: ReturnType<typeof load>) => void}
 */
const balanced = ({ h, heap }) => {
    assertEq(h.live().length, 0)
    if (heap.live !== undefined) { assertEq(heap.live(), 0) }
}

export const proof = {
    // Two short boxes of 3 units join in a block, which holds its length and its units; a block's join with a block,
    // a short box and the host's string keeps each form's units, and the host's operand leaves the join to the host.
    concat: () => {
        for (const arena of [releaseArena, debugArena]) {
            const loaded = load(arena)
            const { s, any, h, hostShort } = loaded
            const j = concat(hostShort)
            /** @type {(text: string) => Held} */
            const short = text => ({ bits: BigInt.asIntN(64, assertOk(pack(unitsOf(text)))), str: { form: 'short', units: unitsOf(text) } })
            const [ab, c, x, y, empty] = [short('ab'), short('c'), short('x'), short('y'), short('')]
            const abc = { bits: s.concat(ab.bits, c.bits), str: j(ab.str, c.str) }
            assertEq(abc.str.form, 'ir')
            holds(loaded, abc.bits, abc.str)
            const long = s.concat(abc.bits, abc.bits)
            holds(loaded, long, { form: 'ir', units: unitsOf('abcabc') })
            const mixed = s.concat(x.bits, abc.bits)
            holds(loaded, mixed, { form: 'ir', units: unitsOf('xabc') })
            // two units are a short box, and an empty operand answers the other
            const xy = s.concat(x.bits, y.bits)
            holds(loaded, xy, { form: 'short', units: unitsOf('xy') })
            const [left, right] = [s.concat(empty.bits, abc.bits), s.concat(abc.bits, empty.bits)]
            assertEq(`${left === abc.bits} ${right === abc.bits}`, 'true true')
            // the host joins its own string with a copy of the block's units
            const hosted = h.own('host!')
            const joined = s.concat(abc.bits, hosted)
            holds(loaded, joined, { form: formOf(hosted) === 'short' ? 'short' : 'host', units: unitsOf('abchost!') })
            holds(loaded, abc.bits, abc.str)
            for (const b of [abc.bits, left, right, long, mixed, xy, joined, hosted]) { assertEq(any.forget(b), 1) }
            balanced(loaded)
        }
    },
    // A part of a block is a block of its units, which `copy` writes, or a short box; every unit is the block itself,
    // which gains an owner; a part of a short box of 3 units or more is a block that its units' stores write; and a
    // part outside the string, or a unit past its end, fails.
    substring: () => {
        for (const arena of [releaseArena, debugArena]) {
            const loaded = load(arena)
            const { s, any, memory, heap } = loaded
            const s8 = BigInt.asIntN(64, assertOk(pack(unitsOf('$0A_az12'))))
            const part = s.substring(s8, 1, 6)
            holds(loaded, part, { form: 'ir', units: unitsOf('0A_az') })
            const inner = s.substring(part, 1, 4)
            holds(loaded, inner, { form: 'ir', units: unitsOf('A_a') })
            holds(loaded, s.substring(part, 2, 4), { form: 'short', units: unitsOf('_a') })
            holds(loaded, s.substring(part, 3, 3), { form: 'short', units: [] })
            const whole = s.substring(part, 0, 5)
            assertEq(whole, part)
            if (heap.live !== undefined) { assertEq(new DataView(memory.buffer).getUint32(Number(part & BLOCK) - 8, true), 2) }
            assertEq([[0, 6], [3, 2], [6, 6]].map(([i, j]) => fails(() => s.substring(part, i, j))).join(), 'true,true,true')
            assertEq([5, -1].map(i => fails(() => s.unit(part, i))).join(), 'true,true')
            for (const b of [part, inner, whole]) { assertEq(any.forget(b), 1) }
            balanced(loaded)
        }
    },
    // Seeded runs over every form answer as the model does, on both arenas, and leave nothing over.
    seeded: () => {
        for (const arena of [releaseArena, debugArena]) {
            for (const seed of [1, 2, 3, 4, 5]) {
                const loaded = load(arena)
                assert(runOf(loaded, seed, 400) > 0)
                balanced(loaded)
            }
        }
    },
}
