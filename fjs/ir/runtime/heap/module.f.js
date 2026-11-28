/**
 * Heap written in the IR, the bump arena
 * ([heap.md](../../../../doc/sasha-gil/ir/heap.md#the-bump-arena)): the
 * Heap interface, {@link iface}, and its release variant, {@link module},
 * which keeps no header, counts nothing and frees nothing, so that a block
 * costs a bump of a pointer. It reads and writes L0's `Memory`, whose calls
 * the emitter writes as instructions, and a plain FunctionalScript
 * [model](./model/module.f.js) answers the same addresses.
 *
 * - **The state lives in the first region.** The constant `state`, which
 *   `init` evaluates, grows the memory by a page and keeps where it
 *   starts. Its first words hold the pointer, `top`, and the end of the
 *   region that the pointer is in, `end`, and the first region's blocks
 *   start 16 bytes in, 8-aligned.
 * - **A block is its size rounded up to 8**, at the pointer, which moves
 *   past it. A size is at most `0xFFFF_FFF8`, so the rounding stays below
 *   4 GiB.
 * - **A full region grows the memory** by the larger of the request and 16
 *   pages, 1 MiB, or by the request alone where the host refuses that. New
 *   pages that follow the region extend it; elsewhere, as where another
 *   allocator grew the memory in between, they start a new region, and the
 *   old one's tail is left.
 * - **The arena uses no byte past `0xFFFF_0000`**, where the last page of a
 *   4 GiB memory starts, so every address and every end fit 32 bits. A
 *   growth that the host refuses or that would reach past it traps as a
 *   misuse, out of memory, which the caller does not see as a failure
 *   ([L0 design §11](../../../../doc/sasha-gil/wasm/l0-design.md#11-misuse-traps-and-only-calls-fail)).
 * - **Release counts nothing.** `dup` does nothing and `drop` answers
 *   `false`, so no block is released and nothing that a block holds needs
 *   a `drop`, and `free`, which only a release calls, traps as a misuse.
 *
 * @module
 *
 * @import { Interface, Module, Term } from '../../types.ts'
 */

import { memory } from '../../l0/module.f.js'
import { add, and, bool, call, constant, eq, false_, fn, if_, int, le, let_, lt, make, misuse, mul, n, shr, signature, u, unit } from '../../module.f.js'

/** An address in the memory, of a block or of the state. */
const address = u(32)

/** A size that `alloc` takes: at most the bytes that round up to 8 below 4 GiB. */
const size = int(0n, 0xFFFF_FFF8n)

/** A block's type, the kind included, which the header of a counting variant keeps. */
const type = u(8)

/** A size of the memory in pages of 64 KiB, as `Memory` answers one. */
const pages = int(0n, 0x1_0000n)

/** Where `init` puts the state: at the start of a page, with a page for the first region before `0xFFFF_0000`. */
const stateAt = int(0n, 0xFFFE_0000n)

/** The page at which the arena's last region must end: no byte of the arena is past `0xFFFF_0000`. */
const lastPage = /** @type {const} */ (0xFFFFn)

/** The pages that a full region asks for at least: 1 MiB. */
const chunk = /** @type {const} */ (16n)

/**
 * The Heap interface: `alloc(t, n)`, a block of `n` bytes, 8-aligned, for
 * an object of type `t`; `dup(p)`, one owner more; `drop(p)`, one owner
 * less, which answers whether the caller must release what the block holds
 * and `free` it; and `free(p)`, after the release.
 *
 * @type {Interface}
 */
export const iface = {
    abi: 'fjs:ir/heap',
    types: [],
    functions: [
        ['alloc', signature([['t', type], ['n', size]], address)],
        ['dup', signature([['p', address]], unit)],
        ['drop', signature([['p', address]], bool)],
        ['free', signature([['p', address]], unit)],
    ],
}

/** L0's `Memory`'s function `name` of `args`, which the emitter writes as an instruction. @type {(name: string, args: readonly Term[]) => Term} */
const memoryOf = (name, args) => call('Memory', name, args)

/** The state, which `init` evaluates once. */
const state = constant('self', 'state')

/** Where the state keeps the end of the pointer's region. */
const endAt = add(state, n(4n))

/** Memory that cannot hold one more block. */
const outOfMemory = misuse('out of memory')

/**
 * The state that `init` evaluates: a page that the memory grows by, whose
 * first words hold the pointer, past them, and the end of the page.
 *
 * @type {Term}
 */
const started = let_('first', memoryOf('grow', [n(1n)]), g =>
    if_(eq(g, n(-1n)), outOfMemory, if_(lt(g, n(lastPage)),
        let_('at', mul(g, n(0x1_0000n)), at =>
            let_('top.set', memoryOf('store32', [at, add(at, n(16n))]), () =>
                let_('end.set', memoryOf('store32', [add(at, n(4n)), add(at, n(0x1_0000n))]), () => at))),
        outOfMemory)))

/**
 * The release arena: `alloc` moves the pointer, and asks `grown` where the
 * region is full; `grown` grows the memory, and `taken` takes its new pages
 * into the region or starts a new one, then allocates there again.
 *
 * @type {Module}
 */
export const module = {
    imports: [memory],
    constants: [['state', { type: stateAt, value: started }]],
    functions: [
        ['alloc', fn([['t', type], ['n', size]], address, (t, k) =>
            let_('size', and(add(k, n(7n)), n(0xFFFF_FFF8n)), s =>
                let_('top', memoryOf('load32', [state]), top =>
                    let_('next', add(top, s), next =>
                        if_(le(next, memoryOf('load32', [endAt])),
                            let_('moved', memoryOf('store32', [state, next]), () => top),
                            call('self', 'grown', [t, s]))))))],
        // A full region: the memory grows by the larger of the request and a chunk, or by the request alone, where
        // a chunk would end past the last page or the memory cannot grow by one.
        ['grown', fn([['t', type], ['size', size]], address, (t, s) =>
            let_('need', shr(add(s, n(0xFFFFn)), n(16n)), need =>
                let_('chunk', if_(lt(need, n(chunk)), if_(le(add(memoryOf('size', []), n(chunk)), n(lastPage)), n(chunk), need), need), k =>
                    let_('before', memoryOf('grow', [k]), g =>
                        if_(eq(g, n(-1n)),
                            let_('exact', memoryOf('grow', [need]), h =>
                                if_(eq(h, n(-1n)), outOfMemory, call('self', 'taken', [t, s, h, need]))),
                            call('self', 'taken', [t, s, g, k]))))))],
        // `k` new pages from page `g` on: they extend the region where they follow it, and start a new one elsewhere.
        ['taken', fn([['t', type], ['size', size], ['g', pages], ['k', pages]], address, (t, s, g, k) =>
            let_('last', add(g, k), last =>
                if_(lt(g, n(lastPage)), if_(le(last, n(lastPage)),
                    let_('at', mul(g, n(0x1_0000n)), at =>
                        let_('stop', mul(last, n(0x1_0000n)), stop =>
                            let_('placed', if_(eq(at, memoryOf('load32', [endAt])),
                                memoryOf('store32', [endAt, stop]),
                                let_('restart', memoryOf('store32', [state, at]), () => memoryOf('store32', [endAt, stop]))),
                                () => call('self', 'alloc', [t, s])))),
                    outOfMemory), outOfMemory)))],
        ['dup', fn([['p', address]], unit, () => make([]))],
        ['drop', fn([['p', address]], bool, () => false_)],
        ['free', fn([['p', address]], unit, () => misuse('free in the release arena, where no drop releases a block'))],
    ],
    exports: ['alloc', 'dup', 'drop', 'free'],
}
