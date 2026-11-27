/**
 * Host proof of the Heap module's two arenas on the host's WebAssembly
 * engine, against their plain FunctionalScript [model](./model/module.f.js).
 * In release, seeded sequences of allocations of every size, with another
 * allocator growing the memory between them, answer the model's addresses,
 * keep the model's pointer and end in the state words, and leave every
 * block's bytes as they were written. In debug, the same sequences mixed
 * with `dup`, `drop` and `free` of the blocks so far also keep the model's
 * counts, in each header and in `live()`, and trap where the model refuses
 * them, and `type_of` tells each block's type while its count is above 0. Memory that runs out traps where the model runs out, and so does a
 * `free` in release.
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)).
 *
 * @import { Module } from '../../types.ts'
 * @import { Counted } from './model/types.ts'
 */

import { assert, assertEq, assertNotNullish, assertOk } from '../../../asserts/module.f.js'
import { write } from '../../../media/wasm/binary/write/module.f.js'
import { check } from '../../check/module.f.js'
import { emit } from '../../wasm/module.f.js'
import { alloc, allocCounted, block, drop, dup, free, other, round, start, startCounted, typeOf } from './model/module.f.js'
import { counted, module } from './module.f.js'

/** A module's WebAssembly module, compiled once. @type {(m: Module) => WebAssembly.Module} */
const compile = m => new WebAssembly.Module(new Uint8Array(write(emit(assertOk(check(m))))))

/** The release arena's and the debug arena's WebAssembly modules. */
const release = compile(module)
const debug = compile(counted)

/**
 * An arena of `compiled` on a memory of one page that may grow to `most`,
 * after `init`: the heap's functions that the proofs call, and the memory.
 *
 * @param {WebAssembly.Module} compiled
 * @param {number} most
 */
const load = (compiled, most) => {
    /**
     * The heap's functions that the proofs call.
     *
     * @typedef {{
     *     readonly alloc: (t: number, n: number) => number
     *     readonly dup: (p: number) => unknown
     *     readonly drop: (p: number) => number
     *     readonly free: (p: number) => unknown
     *     readonly live: () => number
     *     readonly type_of: (p: number) => number
     * }} Heap
     */
    const memory = new WebAssembly.Memory({ initial: 1, maximum: most })
    const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': { memory } })
    const init = /** @type {() => void} */ (exports.init)
    init()
    return { heap: /** @type {Heap} */ (/** @type {unknown} */ (exports)), memory }
}

/** Whether `f` traps, as a misuse reaches an `unreachable`. @type {(f: () => unknown) => boolean} */
const traps = f => {
    try {
        f()
        return false
    } catch (e) {
        return e instanceof WebAssembly.RuntimeError
    }
}

/** A seeded generator of integers below a bound: the same seed gives the same sequence. @type {(seed: number) => (bound: number) => number} */
const random = seed => {
    let s = seed >>> 0
    return bound => {
        s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0
        return s % bound
    }
}

/** A size for the next block: mostly small, at times a page or more, and at times none. @type {(next: (bound: number) => number) => number} */
const sizeOf = next => {
    const k = next(100)
    return k < 5 ? 0 : k < 85 ? next(64) : k < 97 ? next(0x1_0000) : 0x1_0000 + next(0x4_0000)
}

/** The byte that block `j` holds at offset `i`. @type {(j: number, i: number) => number} */
const byte = (j, i) => (j * 31 + i) & 0xFF

/** Whether another allocator grows the memory before this step, as NaNVM does, and by how much. @type {(next: (bound: number) => number) => number} */
const otherPages = next => next(20) === 0 ? 1 + next(3) : 0

/** Grows `memory` by `k` pages, where the host lets it. @type {(memory: WebAssembly.Memory, k: number) => void} */
const growOther = (memory, k) => {
    try { memory.grow(k) } catch { /* a refused growth leaves the memory as it was, as the model says */ }
}

/** Writes block `j`'s bytes at `at`. @type {(memory: WebAssembly.Memory, j: number, at: number, n: number) => void} */
const fill = (memory, j, at, n) => {
    const bytes = new Uint8Array(memory.buffer)
    for (let i = 0; i < n; i += 1) { bytes[at + i] = byte(j, i) }
}

/** Checks that each block of `blocks` keeps the bytes that were written into it. @type {(memory: WebAssembly.Memory, blocks: readonly (readonly [at: number, n: number])[]) => void} */
const intact = (memory, blocks) => {
    const bytes = new Uint8Array(memory.buffer)
    blocks.forEach(([at, n], j) => {
        for (let i = 0; i < n; i += 1) { assert(bytes[at + i] === byte(j, i), [j, at, i]) }
    })
}

/**
 * Runs `steps` allocations from `seed` on a release arena that may grow to
 * `most` pages, beside the model, and answers how many steps ran before
 * both ran out of memory, or `steps`, and how many blocks started a new
 * region.
 *
 * @type {(seed: number, steps: number, most: number) => readonly [ran: number, regions: number]}
 */
const run = (seed, steps, most) => {
    const { heap, memory } = load(release, most)
    const next = random(seed)
    /** @type {(readonly [at: number, size: number])[]} */
    const blocks = []
    let model = assertNotNullish(start(1, most))
    let regions = 0
    for (let step = 0; step < steps; step += 1) {
        const k = otherPages(next)
        if (k > 0) {
            model = other(model, k)
            growOther(memory, k)
        }
        const n = sizeOf(next)
        const expected = alloc(model, n)
        if (expected === null) {
            assert(traps(() => heap.alloc(next(0x100), n)), [seed, step, n, 'expected out of memory'])
            return [step, regions]
        }
        const [after, at] = expected
        assertEq(heap.alloc(next(0x100), n) >>> 0, at)
        assert(at % 8 === 0, at)
        regions += at === model.top ? 0 : 1
        model = after
        fill(memory, blocks.length, at, n)
        blocks.push([at, n])
    }
    // the state words hold the model's pointer and end, and every block keeps what was written into it
    const words = new DataView(memory.buffer)
    assertEq(`${words.getUint32(model.state, true)} ${words.getUint32(model.state + 4, true)}`, `${model.top} ${model.end}`)
    assertEq(memory.buffer.byteLength, model.pages * 0x1_0000)
    intact(memory, blocks)
    return [steps, regions]
}

/**
 * Checks the debug arena's memory against the model `c`: the state words,
 * each block's size word and header, and a walk of the size words, which
 * reaches each block of `born` in birth order but where a new region
 * starts, and ends at the pointer. Answers how many regions the walk
 * jumped to.
 *
 * @type {(memory: WebAssembly.Memory, c: Counted, born: readonly number[]) => number}
 */
const matches = (memory, { arena, live, blocks }, born) => {
    const words = new DataView(memory.buffer)
    assertEq(`${words.getUint32(arena.state, true)} ${words.getUint32(arena.state + 4, true)} ${words.getUint32(arena.state + 8, true)}`,
        `${arena.top} ${arena.end} ${live}`)
    assertEq(memory.buffer.byteLength, arena.pages * 0x1_0000)
    let at = arena.state + 16
    let regions = 0
    for (const p of born) {
        const { n, t, count, freed } = assertNotNullish(block({ arena, live, blocks }, p))
        if (at + 16 !== p) {
            regions += 1
            at = p - 16
        }
        assertEq(words.getBigUint64(p - 16, true), BigInt(n) | (freed ? 1n << 32n : 0n))
        assertEq(words.getBigUint64(p - 8, true), BigInt(count) | BigInt(t) << 40n)
        at += 16 + round(words.getUint32(at, true))
    }
    assertEq(at, arena.top)
    return regions
}

/**
 * Runs `steps` operations from `seed` on a debug arena that may grow to
 * `most` pages, beside the model: allocations, and `dup`, `drop` and `free`
 * of blocks so far, which trap where the model refuses them, while `live()`
 * answers the model's count after each, and `type_of` the type of the block
 * that each took, or traps where the model tells none. Answers how many steps ran before
 * both ran out of memory, or `steps`, how many operations trapped, and how
 * many regions the arena started.
 *
 * @type {(seed: number, steps: number, most: number) => readonly [ran: number, trapped: number, regions: number]}
 */
const runCounted = (seed, steps, most) => {
    const { heap, memory } = load(debug, most)
    const next = random(seed)
    /** @type {number[]} */
    const born = []
    /** @type {(readonly [at: number, size: number])[]} */
    const blocks = []
    let model = assertNotNullish(startCounted(1, most))
    let trapped = 0
    /** One operation that the model answers `m` to: it must trap where `m` is `null`, and answer `answer(m)` elsewhere. @type {<M>(m: M | null, f: () => unknown, answer: (m: M) => unknown) => M | null} */
    const step = (m, f, answer) => {
        if (m === null) {
            assert(traps(f))
            trapped += 1
            return null
        }
        assertEq(f(), answer(m))
        return m
    }
    for (let s = 0; s < steps; s += 1) {
        const k = otherPages(next)
        if (k > 0) {
            model = { ...model, arena: other(model.arena, k) }
            growOther(memory, k)
        }
        const op = next(10)
        if (op < 5 || born.length === 0) {
            const n = sizeOf(next)
            const t = next(0x100)
            const expected = allocCounted(model, t, n)
            if (expected === null) {
                assert(traps(() => heap.alloc(t, n)), [seed, s, n, 'expected out of memory'])
                matches(memory, model, born)
                return [s, trapped, 0]
            }
            const [after, p] = expected
            assertEq(heap.alloc(t, n) >>> 0, p)
            model = after
            fill(memory, blocks.length, p, n)
            born.push(p)
            blocks.push([p, n])
        } else {
            const p = born[next(born.length)]
            if (op < 7) {
                model = step(dup(model, p), () => heap.dup(p), () => undefined) ?? model
            } else if (op < 9) {
                const d = step(drop(model, p), () => heap.drop(p), ([, released]) => released ? 1 : 0)
                model = d === null ? model : d[0]
            } else {
                model = step(free(model, p), () => heap.free(p), () => undefined) ?? model
            }
            const t = typeOf(model, p)
            if (t === null) { assert(traps(() => heap.type_of(p)), p) } else { assertEq(heap.type_of(p), t) }
        }
        assertEq(heap.live(), model.live)
    }
    const regions = matches(memory, model, born)
    intact(memory, blocks)
    return [steps, trapped, regions]
}

export const proof = {
    // Allocations of every size, a page and more among them, answer the model's addresses, 8-aligned, and no
    // block overwrites another or the state; another allocator's growth starts a new region.
    sequences: () => {
        const runs = [1, 2, 3, 42, 2026].map(seed => run(seed, 400, 0x1_0000))
        assert(runs.every(([ran]) => ran === 400), runs)
        assert(runs.some(([, regions]) => regions > 0), runs)
    },
    // A host that lets the memory grow to a few pages only: the arena runs out where the model does, and traps.
    outOfMemory: () => {
        for (const seed of [5, 6, 7]) { assert(run(seed, 10_000, 40)[0] < 10_000) }
    },
    // A memory that cannot grow at all leaves `init` nothing to put the state in, in either arena.
    noPage: () => {
        for (const compiled of [release, debug]) {
            const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 })
            const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': { memory } })
            assert(traps(/** @type {() => void} */ (exports.init)))
        }
    },
    // Release counts nothing: dup does nothing, drop never releases, and a free is a misuse.
    counts: () => {
        const { heap } = load(release, 0x1_0000)
        const p = heap.alloc(0, 8)
        assertEq(heap.dup(p), undefined)
        assertEq(heap.drop(p), 0)
        assert(traps(() => heap.free(p)))
    },
    // Debug: the same sizes mixed with dup, drop and free keep the model's addresses, headers and live count,
    // misuse among them traps where the model refuses it, and a walk of the size words finds every block.
    counted: () => {
        const runs = [1, 2, 3, 42, 2026].map(seed => runCounted(seed, 600, 0x1_0000))
        assert(runs.every(([ran, trapped]) => ran === 600 && trapped > 0), runs)
        assert(runs.some(([, , regions]) => regions > 0), runs)
    },
    // Debug runs out of memory where the model does, with its header counted in.
    countedOutOfMemory: () => {
        for (const seed of [5, 6, 7]) { assert(runCounted(seed, 10_000, 40)[0] < 10_000) }
    },
    // Debug refuses an address that no block has, a count of 0, a free of a live block and a second free, and
    // tells a block's type only while its count is above 0.
    misuse: () => {
        const { heap } = load(debug, 0x1_0000)
        const p = heap.alloc(1, 8)
        for (const q of [p + 4, p - 16, 0, p + 64]) {
            assert(traps(() => heap.dup(q)), q)
            assert(traps(() => heap.drop(q)), q)
            assert(traps(() => heap.free(q)), q)
            assert(traps(() => heap.type_of(q)), q)
        }
        assertEq(heap.type_of(p), 1)
        assert(traps(() => heap.free(p)))
        heap.dup(p)
        assertEq(`${heap.drop(p)} ${heap.drop(p)} ${heap.live()}`, '0 1 0')
        assert(traps(() => heap.type_of(p)))
        assert(traps(() => heap.dup(p)))
        assert(traps(() => heap.drop(p)))
        heap.free(p)
        assert(traps(() => heap.free(p)))
    },
}
