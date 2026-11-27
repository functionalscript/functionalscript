/**
 * Heap written in the IR, the bump arena
 * ([heap.md](../../../../doc/sasha-gil/ir/heap.md#the-bump-arena)): the
 * Heap interface, {@link iface}, and two variants of it, which a runtime
 * picks when it links. {@link module}, for release builds, keeps no
 * header, counts nothing and frees nothing, so that a block costs a bump
 * of a pointer; {@link counted}, for debug builds, counts in a header
 * before each block and traps on misuse. Both read and write L0's
 * `Memory`, whose calls the emitter writes as instructions, and a plain
 * FunctionalScript [model](./model/module.f.js) answers the same addresses
 * and counts.
 *
 * - **The state lives in the first region.** The constant `state`, which
 *   `init` evaluates, grows the memory by a page and keeps where it
 *   starts. Its first words hold the pointer, `top`, the end of the region
 *   that the pointer is in, `end`, and in debug the count of live blocks,
 *   `live`. The first region's blocks start 16 bytes in, 8-aligned.
 * - **A block is its size rounded up to 8**, at the pointer, which moves
 *   past it, after the 16 bytes that debug keeps before it. A size is at
 *   most `0xFFFF_FFF8`, so the rounding stays below 4 GiB.
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
 * - **Debug counts in a header**
 *   ([What every counting variant shares](../../../../doc/sasha-gil/ir/heap.md#what-every-counting-variant-shares)).
 *   A size word before the block holds the size that `alloc` was asked for
 *   in its low half, so that a region can be walked in birth order, and 1
 *   in its high half once the block is freed. The header word after it
 *   holds the count, 1 at first, in bits 0 to 31 and the type `t` in bits
 *   40 to 47; the class and the tag stay 0, since no block is reused.
 *   `dup` adds 1, `drop` takes 1 and answers `true` at 0, and `free` marks
 *   a block whose count is 0. No block is reused, so a stale reference
 *   finds a count of 0 and traps. `live()` answers how many blocks have a
 *   count above 0, for balance checks.
 * - **Debug refuses what no block has.** `dup`, `drop` and `free` trap on
 *   an address that is not 8-aligned, is below the first block or is past
 *   the pointer. `dup` and `drop` trap on a count of 0, and `free` on a
 *   count above 0 and on a block that it freed before. An address inside a
 *   block passes the first checks, and only a walk of the region would
 *   catch it.
 * - **Debug tells a block's type**, for a checked Any: `type_of(p)` answers
 *   the type `t` of a block whose count is above 0, and traps where the
 *   address names no block or the count is 0, as NaNVM's `kind_ref` checks
 *   a handle ({@link debugIface}).
 *
 * @module
 *
 * @import { Fn, Interface, Module, Term } from '../../types.ts'
 */

import { memory } from '../../l0/module.f.js'
import { add, and, bool, call, constant, eq, false_, fn, if_, int, le, let_, lt, make, misuse, mul, n, or, shl, shr, signature, sub, true_, u, unit } from '../../module.f.js'

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
const lastPage = 0xFFFFn

/** The pages that a full region asks for at least: 1 MiB. */
const chunk = 16n

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

/**
 * The debug arena's interface: the Heap interface, `live()`, how many
 * blocks have a count above 0, and `type_of(p)`, the type of a block whose
 * count is above 0, which traps on any other address. A checked Any asks
 * it the kind of a reference into the IR heap
 * ([long-strings.md, choice 3](../../../../doc/sasha-gil/ir/long-strings.md#3-the-box-of-a-reference-into-the-ir-heap)).
 *
 * @type {Interface}
 */
export const debugIface = {
    ...iface,
    functions: [
        ...iface.functions,
        ['live', signature([], u(32))],
        ['type_of', signature([['p', address]], type)],
    ],
}

/** L0's `Memory`'s function `name` of `args`, which the emitter writes as an instruction. @type {(name: string, args: readonly Term[]) => Term} */
const memoryOf = (name, args) => call('Memory', name, args)

/** The state, which `init` evaluates once. */
const state = constant('self', 'state')

/** Where the state keeps the end of the pointer's region. */
const endAt = add(state, n(4n))

/** Where the debug arena's state keeps the count of live blocks. */
const liveAt = add(state, n(8n))

/** Memory that cannot hold one more block. */
const outOfMemory = misuse('out of memory')

/** `k` bytes rounded up to 8, the bytes of a block. @type {(k: Term) => Term} */
const rounded = k => and(add(k, n(7n)), n(0xFFFF_FFF8n))

/**
 * The state that `init` evaluates: a page that the memory grows by, whose
 * first words hold the pointer, past them, and the end of the page; `more`
 * writes a variant's own words at the page's start, `at`, and answers it.
 *
 * @type {(more: (at: Term) => Term) => Term}
 */
const startedWith = more => let_('first', memoryOf('grow', [n(1n)]), g =>
    if_(eq(g, n(-1n)), outOfMemory, if_(lt(g, n(lastPage)),
        let_('at', mul(g, n(0x1_0000n)), at =>
            let_('top.set', memoryOf('store32', [at, add(at, n(16n))]), () =>
                let_('end.set', memoryOf('store32', [add(at, n(4n)), add(at, n(0x1_0000n))]), () => more(at)))),
        outOfMemory)))

/**
 * How a full region grows, in an arena whose blocks take `header` bytes
 * before them: `grown` grows the memory by the larger of the request and a
 * chunk, or by the request alone, and `taken` takes `k` new pages from page
 * `g` on into the region where they follow it, or starts a new region
 * elsewhere, then asks `alloc` again, where the block now fits.
 *
 * @type {(header: bigint) => readonly (readonly [string, Fn])[]}
 */
const growth = header => [
    ['grown', fn([['t', type], ['n', size]], address, (t, k) =>
        let_('need', shr(add(rounded(k), n(header + 0xFFFFn)), n(16n)), need =>
            // no region holds more pages than the last page's index, and a header can take a request past it
            if_(le(need, n(lastPage)),
                let_('chunk', if_(lt(need, n(chunk)), n(chunk), need), c =>
                    let_('before', memoryOf('grow', [c]), g =>
                        if_(eq(g, n(-1n)),
                            let_('exact', memoryOf('grow', [need]), h =>
                                if_(eq(h, n(-1n)), outOfMemory, call('self', 'taken', [t, k, h, need]))),
                            call('self', 'taken', [t, k, g, c])))),
                outOfMemory)))],
    ['taken', fn([['t', type], ['n', size], ['g', pages], ['k', pages]], address, (t, k, g, c) =>
        let_('last', add(g, c), last =>
            if_(lt(g, n(lastPage)), if_(le(last, n(lastPage)),
                let_('at', mul(g, n(0x1_0000n)), at =>
                    let_('stop', mul(last, n(0x1_0000n)), stop =>
                        let_('placed', if_(eq(at, memoryOf('load32', [endAt])),
                            memoryOf('store32', [endAt, stop]),
                            let_('restart', memoryOf('store32', [state, at]), () => memoryOf('store32', [endAt, stop]))),
                            () => call('self', 'alloc', [t, k])))),
                outOfMemory), outOfMemory)))],
]

/**
 * The release arena: `alloc` moves the pointer, and asks `grown` where the
 * region is full; `dup` does nothing, `drop` answers `false`, and a `free`
 * is a misuse.
 *
 * @type {Module}
 */
export const module = {
    imports: [memory],
    constants: [['state', { type: stateAt, value: startedWith(at => at) }]],
    functions: [
        ['alloc', fn([['t', type], ['n', size]], address, (t, k) =>
            let_('size', rounded(k), s =>
                let_('top', memoryOf('load32', [state]), top =>
                    let_('next', add(top, s), next =>
                        if_(le(next, memoryOf('load32', [endAt])),
                            let_('moved', memoryOf('store32', [state, next]), () => top),
                            call('self', 'grown', [t, k]))))))],
        ...growth(0n),
        ['dup', fn([['p', address]], unit, () => make([]))],
        ['drop', fn([['p', address]], bool, () => false_)],
        ['free', fn([['p', address]], unit, () => misuse('free in the release arena, where no drop releases a block'))],
    ],
    exports: ['alloc', 'dup', 'drop', 'free'],
}

/** An address that no block of the debug arena has. */
const notBlock = misuse('not a block')

/**
 * `body` of where block `p`'s header word is, where `p` is an address that
 * a block of the debug arena may have: 8-aligned, at or past the first
 * block, 32 bytes into the state's page, and at or below the pointer, since
 * every region is above the one before. Elsewhere a misuse.
 *
 * @type {(p: Term, body: (at: Term) => Term) => Term}
 */
const headerOf = (p, body) =>
    if_(eq(and(p, n(7n)), n(0n)),
        if_(lt(p, add(state, n(32n))), notBlock,
            if_(lt(memoryOf('load32', [state]), p), notBlock,
                let_('header', sub(p, n(8n)), body))),
        notBlock)

/** A block whose count reached 0: one live block less, and the caller releases it. */
const released = let_('live', memoryOf('load32', [liveAt]), live =>
    if_(eq(live, n(0n)), misuse('no live block'),
        let_('counted', memoryOf('store32', [liveAt, sub(live, n(1n))]), () => true_)))

/**
 * The debug arena: `alloc` writes the size word and a header with a count
 * of 1 before each block, `dup` and `drop` count in the header and trap on
 * misuse, `free` marks a released block in its size word, `live` answers
 * how many blocks have a count above 0, and `type_of` the type of a block
 * whose count is above 0.
 *
 * @type {Module}
 */
export const counted = {
    imports: [memory],
    constants: [['state', { type: stateAt, value: startedWith(at =>
        let_('live.set', memoryOf('store32', [add(at, n(8n)), n(0n)]), () => at)) }]],
    functions: [
        ['alloc', fn([['t', type], ['n', size]], address, (t, k) =>
            let_('size', rounded(k), s =>
                let_('top', memoryOf('load32', [state]), top =>
                    // the pointer is never past the arena's last byte, so the block after its 16 bytes is a `u(32)`
                    if_(le(top, n(0xFFFF_0000n)),
                        let_('next', add(add(top, n(16n)), s), next =>
                            if_(le(next, memoryOf('load32', [endAt])),
                                let_('moved', memoryOf('store32', [state, next]), () =>
                                    let_('sized', memoryOf('store64', [top, k]), () =>
                                        let_('headed', memoryOf('store64', [add(top, n(8n)), or(n(1n), shl(t, n(40n)))]), () =>
                                            let_('live', memoryOf('load32', [liveAt]), live =>
                                                if_(lt(live, n(0xFFFF_FFFFn)),
                                                    let_('counted', memoryOf('store32', [liveAt, add(live, n(1n))]), () => add(top, n(16n))),
                                                    misuse('a count past 32 bits')))))),
                                call('self', 'grown', [t, k]))),
                        misuse('a pointer past the arena')))))],
        ...growth(16n),
        ['dup', fn([['p', address]], unit, p => headerOf(p, at =>
            let_('count', memoryOf('load32', [at]), count =>
                if_(eq(count, n(0n)), misuse('count of 0'),
                    if_(eq(count, n(0xFFFF_FFFFn)), misuse('a count past 32 bits'),
                        memoryOf('store32', [at, add(count, n(1n))]))))))],
        ['drop', fn([['p', address]], bool, p => headerOf(p, at =>
            let_('count', memoryOf('load32', [at]), count =>
                if_(eq(count, n(0n)), misuse('count of 0'),
                    let_('dropped', memoryOf('store32', [at, sub(count, n(1n))]), () =>
                        if_(eq(count, n(1n)), released, false_))))))],
        ['free', fn([['p', address]], unit, p => headerOf(p, at =>
            if_(eq(memoryOf('load32', [at]), n(0n)),
                let_('mark', sub(at, n(4n)), mark =>
                    if_(eq(memoryOf('load32', [mark]), n(0n)), memoryOf('store32', [mark, n(1n)]), misuse('a second free'))),
                misuse('free of a live block'))))],
        ['live', fn([], u(32), () => memoryOf('load32', [liveAt]))],
        // the type is the header word's sixth byte, bits 40 to 47
        ['type_of', fn([['p', address]], type, p => headerOf(p, at =>
            if_(eq(memoryOf('load32', [at]), n(0n)), misuse('count of 0'), memoryOf('load8', [add(at, n(5n))]))))],
    ],
    exports: ['alloc', 'dup', 'drop', 'free', 'live', 'type_of'],
}
