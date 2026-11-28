/**
 * Host proof of the Heap module's release arena on the host's WebAssembly
 * engine, against its plain FunctionalScript [model](./model/module.f.js):
 * seeded sequences of allocations of every size, with another allocator
 * growing the memory between them, answer the model's addresses, keep the
 * model's pointer and end in the state words, and leave every block's
 * bytes as they were written. Memory that runs out traps where the model
 * runs out, and so does a `free`.
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)).
 *
 * @import { Arena } from './model/types.ts'
 */

import { assert, assertEq, assertNotNullish, assertOk } from '../../../asserts/module.f.js'
import { write } from '../../../media/wasm/binary/write/module.f.js'
import { check } from '../../check/module.f.js'
import { emit } from '../../wasm/module.f.js'
import { alloc, other, start } from './model/module.f.js'
import { module } from './module.f.js'

/** The release arena's WebAssembly module, compiled once. */
const compiled = new WebAssembly.Module(new Uint8Array(write(emit(assertOk(check(module))))))

/**
 * The arena on a memory of `pages` pages, one unless given, that may grow
 * to `most`, after `init`: its exports, the memory, and the model's arena.
 *
 * @type {(most: number, pages?: number) => { readonly exports: WebAssembly.Exports, readonly memory: WebAssembly.Memory, readonly arena: Arena }}
 */
const load = (most, pages = 1) => {
    const memory = new WebAssembly.Memory({ initial: pages, maximum: most })
    const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': { memory } })
    const init = /** @type {() => void} */ (exports.init)
    init()
    return { exports, memory, arena: assertNotNullish(start(pages, most)) }
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

/**
 * Runs `steps` allocations from `seed` on an arena that may grow to `most`
 * pages, beside the model, and answers how many steps ran before both ran
 * out of memory, or `steps`, and how many blocks started a new region.
 *
 * @type {(seed: number, steps: number, most: number) => readonly [ran: number, regions: number]}
 */
const run = (seed, steps, most) => {
    const { exports, memory, arena } = load(most)
    const allocate = /** @type {(t: number, n: number) => number} */ (exports.alloc)
    const next = random(seed)
    /** @type {(readonly [at: number, size: number])[]} */
    const blocks = []
    let model = arena
    let regions = 0
    for (let step = 0; step < steps; step += 1) {
        if (next(20) === 0) {
            // another allocator grows the memory, as NaNVM does, so the arena's next pages may not follow its region
            const k = 1 + next(3)
            model = other(model, k)
            try { memory.grow(k) } catch { /* a refused growth leaves the memory as it was, as the model says */ }
        }
        const n = sizeOf(next)
        const expected = alloc(model, n)
        if (expected === null) {
            assert(traps(() => allocate(next(0x100), n)), [seed, step, n, 'expected out of memory'])
            return [step, regions]
        }
        const [after, at] = expected
        assertEq(allocate(next(0x100), n) >>> 0, at)
        assert(at % 8 === 0, at)
        regions += at === model.top ? 0 : 1
        model = after
        const bytes = new Uint8Array(memory.buffer)
        for (let i = 0; i < n; i += 1) { bytes[at + i] = byte(blocks.length, i) }
        blocks.push([at, n])
    }
    // the state words hold the model's pointer and end, and every block keeps what was written into it
    const words = new DataView(memory.buffer)
    assertEq(`${words.getUint32(model.state, true)} ${words.getUint32(model.state + 4, true)}`, `${model.top} ${model.end}`)
    assertEq(memory.buffer.byteLength, model.pages * 0x1_0000)
    const bytes = new Uint8Array(memory.buffer)
    blocks.forEach(([at, n], j) => {
        for (let i = 0; i < n; i += 1) { assert(bytes[at + i] === byte(j, i), [seed, j, at, i]) }
    })
    return [steps, regions]
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
    // Near the last page, where a chunk would end past it, a full region grows by the request alone, as the model
    // does: after `init` on 65,519 pages, a block that fills the first region and one more of 8 bytes, whose page
    // ends at 65,521, well below the arena's last page.
    nearLastPage: () => {
        const { exports, memory, arena } = load(0x1_0000, 65_519)
        const allocate = /** @type {(t: number, n: number) => number} */ (exports.alloc)
        const [full, first] = assertNotNullish(alloc(arena, 0xFFF0))
        assertEq(allocate(0, 0xFFF0) >>> 0, first)
        const [after, second] = assertNotNullish(alloc(full, 8))
        assertEq(allocate(0, 8) >>> 0, second)
        assertEq(second, first + 0xFFF0)
        assertEq(memory.buffer.byteLength, after.pages * 0x1_0000)
        assertEq(after.pages, 65_521)
    },
    // A region that ends where the memory does counts its tail, as the model does: on a memory that may grow to 3
    // pages, a block of 0x1_0008 bytes after `init` takes the one page that the host still gives.
    tail: () => {
        const { exports, memory, arena } = load(3)
        const [after, at] = assertNotNullish(alloc(arena, 0x1_0008))
        assertEq(/** @type {(t: number, n: number) => number} */ (exports.alloc)(0, 0x1_0008) >>> 0, at)
        assertEq(memory.buffer.byteLength, after.pages * 0x1_0000)
        assertEq(after.pages, 3)
    },
    // Blocks of 0 bytes take 8 each, as the model's do, so no two blocks share an address.
    empty: () => {
        const { exports, arena } = load(0x1_0000)
        const allocate = /** @type {(t: number, n: number) => number} */ (exports.alloc)
        const [b, p] = assertNotNullish(alloc(arena, 0))
        const [, q] = assertNotNullish(alloc(b, 0))
        assertEq(`${allocate(0, 0) >>> 0} ${allocate(0, 0) >>> 0} ${allocate(0, 8) >>> 0}`, `${p} ${q} ${q + 8}`)
        assertEq(q - p, 8)
    },
    // A memory that cannot grow at all leaves `init` nothing to put the state in.
    noPage: () => {
        const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 })
        const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': { memory } })
        assert(traps(/** @type {() => void} */ (exports.init)))
    },
    // Release counts nothing: dup does nothing, drop never releases, and a free is a misuse.
    counts: () => {
        const { exports } = load(0x1_0000)
        const p = /** @type {(t: number, n: number) => number} */ (exports.alloc)(0, 8)
        assertEq(/** @type {(p: number) => unknown} */ (exports.dup)(p), undefined)
        assertEq(/** @type {(p: number) => number} */ (exports.drop)(p), 0)
        assert(traps(() => /** @type {(p: number) => unknown} */ (exports.free)(p)))
    },
}
