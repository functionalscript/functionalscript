/**
 * Host proof of Any's variants that know the IR heap, on the host's
 * WebAssembly engine: Any's module and an arena's, each compiled from the
 * IR, the arena on a memory of its own and Any on the host's `fjs:l0`,
 * joined through the Heap's imports. The engine is the effect: the IR runs
 * no WebAssembly, and the two modules meet only there. On either arena the
 * box of a long string in the IR heap answers kind 4 and the hooks count
 * it in the arena, in debug down to the `free` at a count of 0, while the
 * host's own references keep their counts as before and nothing leaks.
 * The checked variant refuses a block whose count is 0, a block of another
 * type, an address inside a block and a box with stray bits, in its kind and
 * in its hooks before they count. [NaNVM's
 * test](../../l0/host/nanvm/nanvm.test.mjs) runs these again with NaNVM's
 * `.wasm` as the host. A run on the engine is an effect by the owner's
 * ruling, until such runs move into files of their own
 * ([host proofs for effects only](../../../../todo/host-proofs-for-effects-only.md#engine-runs)).
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)).
 *
 * @import { Module } from '../../types.ts'
 */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { write } from '../../../media/wasm/binary/write/module.f.js'
import { check } from '../../check/module.f.js'
import { lifetime } from '../../lifetime/module.f.js'
import { emit } from '../../wasm/module.f.js'
import { hostOf } from '../../wasm/testlib.mjs'
import { IR_STRING } from '../box/module.f.js'
import { counted, module as release } from '../heap/module.f.js'
import { checkedWithHeap, withHeap } from './module.f.js'

/** A module's WebAssembly module, after the lifetime pass, compiled once. @type {(m: Module) => WebAssembly.Module} */
const compile = m => new WebAssembly.Module(new Uint8Array(write(emit(assertOk(check(assertOk(lifetime(m))))))))

/** The release arena's, the debug arena's and the two variants' WebAssembly modules. */
const releaseArena = compile(release)
const debugArena = compile(counted)
const plainAny = compile(withHeap)
const checkedAny = compile(checkedWithHeap)

/** The host's values: scalars, a string, a bigint and the three containers. */
const values = [undefined, null, false, true, 0, -0, 1.5, NaN, Infinity, -Infinity, 'ab', 12345678901234567890n, [1, 2], { x: 1 }, () => 0]

/** The type of a long string's block: L0's kind 4, form 0. */
const stringType = 0x40

/** The box of the long string whose block is at `p`. @type {(p: number) => bigint} */
const box = p => IR_STRING | BigInt(p)

/** Whether `f` traps, as a misuse reaches an `unreachable`. @type {(f: () => unknown) => boolean} */
const traps = f => {
    try {
        f()
        return false
    } catch (e) {
        return e instanceof WebAssembly.RuntimeError
    }
}

/**
 * Any of `any` and an arena of `arena`, after each `init`: the arena on a
 * memory of its own, and Any on a host of {@link values}, whose cells it
 * then keeps. Answers Any's and the arena's functions that the proofs
 * call, the memory, and the host.
 *
 * @param {WebAssembly.Module} any
 * @param {WebAssembly.Module} arena
 */
const load = (any, arena) => {
    /**
     * Any's functions that the proofs call.
     *
     * @typedef {{
     *     readonly kind: (v: bigint) => number
     *     readonly keep: (v: bigint) => bigint
     *     readonly take: (v: bigint) => bigint
     *     readonly forget: (v: bigint) => number
     * }} Any
     */
    /**
     * The arena's functions that the proofs call; `live` only in debug.
     *
     * @typedef {{
     *     readonly alloc: (t: number, n: number) => number
     *     readonly live: () => number
     * }} Heap
     */
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 0x1_0000 })
    const heap = new WebAssembly.Instance(arena, { 'fjs:l0': { memory } }).exports
    const init = /** @type {() => void} */ (heap.init)
    init()
    const h = hostOf(values)
    const { exports } = new WebAssembly.Instance(any, { 'fjs:l0': h.imports, 'fjs:ir/heap': heap })
    if (typeof exports.init === 'function') { exports.init() }
    h.keep()
    return {
        any: /** @type {Any} */ (/** @type {unknown} */ (exports)),
        heap: /** @type {Heap} */ (/** @type {unknown} */ (heap)),
        memory,
        h,
    }
}

/** The count in the header of the debug arena's block `p`. @type {(memory: WebAssembly.Memory, p: number) => number} */
const countOf = (memory, p) => new DataView(memory.buffer).getUint32(p - 8, true)

/** Whether a `free` marked the debug arena's block `p`, in the high half of its size word. @type {(memory: WebAssembly.Memory, p: number) => boolean} */
const freedOf = (memory, p) => new DataView(memory.buffer).getUint32(p - 12, true) === 1

/**
 * Checks that Any agrees with the host on the host's own values, as Any
 * that knows no IR heap does: the kind of each, and the hooks, which copy,
 * drop and move each reference through the host and leave no cell over.
 *
 * @type {(loaded: ReturnType<typeof load>) => void}
 */
const agrees = ({ any, h }) => {
    for (const v of h.first) { assertEq(any.kind(v), h.imports.kind(v)) }
    for (const v of h.first.filter(x => h.imports.kind(x) >= 4)) {
        assertEq(any.forget(any.keep(v)), 1)
        h.imports.drop(any.take(h.imports.dup(v)))
    }
    assertEq(h.live().length, 0)
}

export const proof = {
    // On the release arena an IR string is of kind 4, and the hooks pass it: `dup` does nothing, and `drop`
    // answers that no `free` follows, which the release arena would refuse.
    release: () => {
        const loaded = load(plainAny, releaseArena)
        const { any, heap } = loaded
        const s = box(heap.alloc(stringType, 12))
        assertEq(any.kind(s), 4)
        assertEq(any.keep(s), s)
        assertEq(any.take(s), s)
        assertEq(any.forget(s), 1)
        assertEq(any.forget(s), 1)
        agrees(loaded)
    },
    // On the debug arena the hooks count an IR string in its header, and the drop of its last owner frees the block.
    debug: () => {
        for (const compiled of [plainAny, checkedAny]) {
            const loaded = load(compiled, debugArena)
            const { heap, memory } = loaded
            const p = heap.alloc(stringType, 12)
            const s = box(p)
            assertEq(loaded.any.kind(s), 4)
            assertEq(loaded.any.keep(s), s)
            assertEq(`${countOf(memory, p)} ${heap.live()}`, '2 1')
            assertEq(loaded.any.forget(s), 1)
            assertEq(loaded.any.take(s), s)
            assertEq(`${countOf(memory, p)} ${freedOf(memory, p)}`, '1 false')
            assertEq(loaded.any.forget(s), 1)
            assertEq(`${countOf(memory, p)} ${freedOf(memory, p)} ${heap.live()}`, '0 true 0')
            // a freed block takes no more owners, and gives up none
            assert(traps(() => loaded.any.keep(s)))
            assert(traps(() => loaded.any.forget(s)))
            agrees(loaded)
        }
    },
    // The checked variant asks the debug arena the block's type: it refuses a freed block, a block of another
    // type, an address inside a block and a box with bits that no block's address has, which the plain variant
    // reads as a string.
    checked: () => {
        const plain = load(plainAny, debugArena)
        const checked = load(checkedAny, debugArena)
        for (const { any, heap } of [plain, checked]) {
            const p = heap.alloc(stringType, 8)
            const q = heap.alloc(0x60, 8)
            const r = heap.alloc(stringType, 8)
            assertEq(any.forget(box(p)), 1)
            const refused = [box(p), box(q), box(r + 8), box(r) | 1n << 40n, box(r) | 4n]
            assertEq(refused.map(s => traps(() => any.kind(s)) ? 'trap' : `${any.kind(s)}`).join(),
                any === checked.any ? 'trap,trap,trap,trap,trap' : '4,4,4,4,4')
            assertEq(any.kind(box(r)), 4)
        }
    },
    // The checked variant's hooks refuse the same boxes before they count: `dup` and `drop` of a block of another
    // type, an address inside a block and a box with stray bits trap and leave every count as it was, where the
    // plain variant counts the block that the address bits name.
    checkedHooks: () => {
        /** @type {(compiled: WebAssembly.Module, expected: string) => void} */
        const counted = (compiled, expected) => {
            const { any, heap, memory } = load(compiled, debugArena)
            const q = heap.alloc(0x60, 8)
            const r = heap.alloc(stringType, 16)
            const counts = () => `${countOf(memory, q)} ${countOf(memory, r)} ${heap.live()}`
            const forged = [box(q), box(r) | 1n << 40n, box(r) | 4n]
            const kept = forged.map(s => traps(() => any.keep(s)) ? 'trap' : 'kept').join()
            assertEq(`${kept}; ${counts()}`, expected)
        }
        counted(plainAny, 'kept,kept,kept; 2 3 2')
        counted(checkedAny, 'trap,trap,trap; 1 1 2')
        // a drop of each refuses too, and so does either hook on an address inside a block
        const { any, heap, memory } = load(checkedAny, debugArena)
        const q = heap.alloc(0x60, 8)
        const r = heap.alloc(stringType, 16)
        const refused = [box(q), box(r) | 1n << 40n, box(r) | 4n, box(r + 8)]
        assert(refused.every(s => traps(() => any.forget(s)) && traps(() => any.keep(s))))
        assertEq(`${countOf(memory, q)} ${countOf(memory, r)} ${heap.live()}`, '1 1 2')
        assertEq(any.forget(box(r)), 1)
        assertEq(`${countOf(memory, r)} ${heap.live()}`, '0 1')
    },
}
