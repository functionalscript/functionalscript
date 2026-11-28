/**
 * A plain FunctionalScript model of the IR heap's bump arena
 * ([heap.md](../../../../../doc/sasha-gil/ir/heap.md#how-misuse-and-leaks-are-caught)),
 * which the host proof runs beside the arena's WASM on the same
 * operations: every address that the arena answers must be the model's,
 * and in debug every count. It keeps what the arena keeps in its state
 * words, and the memory's size in pages, which the arena reads by growing
 * it.
 *
 * - **`start`** is `init`: it grows the memory by a page, where the state
 *   words come first and the first region's blocks start 16 bytes in.
 * - **`alloc`** rounds a size up to 8 bytes and moves the pointer past the
 *   block. Where the region is full, the memory grows by the larger of the
 *   request and 16 pages, or by the request alone where the host refuses
 *   that. New pages that follow the region extend it; elsewhere they start
 *   a new region, and the old one's tail is left.
 * - **`other`** is another allocator that grows the memory, as NaNVM does,
 *   so that the arena's next pages do not follow its region.
 * - **The arena uses no byte past `0xFFFF_0000`**, and a growth that the
 *   host refuses or that reaches past it is out of memory, `null`.
 * - **The debug arena**, {@link Counted}, keeps 16 bytes before each block,
 *   and each block by its address, a map from offset to block: the size
 *   that `alloc` was asked for, the type, the count and whether a `free`
 *   took it, with how many blocks have a count above 0. `dup`, `drop` and
 *   `free` answer `null` where the debug arena traps, which is wherever no
 *   block starts.
 * - **The debug arena's pages.** Its `init` takes five pages: the state's,
 *   whose last KiB is the bitmap of block starts of the first region, and
 *   four for the directory of bitmaps. Each later region keeps a KiB of
 *   bitmap per page in its tail, so it takes a page more for each 32 that
 *   its block needs, ends where the bitmaps start, and is always new.
 *
 * @module
 *
 * @import { Arena, Block, Counted } from './types.ts'
 */

import { at as entryAt, empty, setReplace } from '../../../../types/ordered_map/module.f.js'

/** The bytes of a page. */
const page = /** @type {const} */ (0x1_0000)

/** The page at which the arena's last region must end: no byte of the arena is past `0xFFFF_0000`. */
const lastPage = /** @type {const} */ (0xFFFF)

/** The pages that a full region asks for at least: 1 MiB. */
const chunk = /** @type {const} */ (16)

/** The bytes that the debug arena keeps before each block: the size word, then the header. */
const header = /** @type {const} */ (16)

/** The pages that the debug arena's `init` takes: the state's, and four for the directory. */
const countedPages = /** @type {const} */ (5)

/** The bytes of a page's bitmap of block starts, which the debug arena keeps in the tail of the page's region. */
const bitmap = /** @type {const} */ (0x400)

/** `n` rounded up to 8. @type {(n: number) => number} */
export const round = n => n + 7 - (n + 7) % 8

/** The pages that hold `n` bytes. @type {(n: number) => number} */
const pagesOf = n => (n + page - 1 - (n + page - 1) % page) / page

/**
 * The memory of `pages` pages, of which the host lets `most`, grown by `k`
 * pages: the size before, and the memory after, or `null` where the host
 * refuses, as `memory.grow` answers `-1`.
 *
 * @type {(pages: number, most: number, k: number) => number | null}
 */
const grow = (pages, most, k) => pages + k <= most ? pages : null

/**
 * The arena that `init` makes in a memory of `pages` pages, which the host
 * lets grow to `most`: its state at the start of a new page, and its first
 * region the rest of that page. `null` where the memory cannot grow.
 *
 * @type {(pages: number, most: number) => Arena | null}
 */
export const start = (pages, most) => {
    const g = grow(pages, most, 1)
    if (g === null || g >= lastPage) { return null }
    const state = g * page
    return { pages: pages + 1, most, state, top: state + 16, end: state + page }
}

/**
 * The arena with a block of `size` bytes at its pointer, and where the
 * block starts, or `null` where the region cannot hold it.
 *
 * @type {(a: Arena, size: number) => readonly [Arena, number] | null}
 */
const fit = (a, size) => {
    const next = a.top + size
    return next <= a.end ? [{ ...a, top: next }, a.top] : null
}

/**
 * The arena after a full region took `k` new pages from page `g` on: they
 * extend the region where they follow it, and start a new one elsewhere.
 * `null` where they reach past the last page.
 *
 * @type {(a: Arena, g: number, k: number) => Arena | null}
 */
const taken = (a, g, k) => {
    const last = g + k
    if (g >= lastPage || last > lastPage) { return null }
    const at = g * page
    const end = last * page
    return at === a.end ? { ...a, end } : { ...a, top: at, end }
}

/**
 * The arena whose region cannot hold `size` more bytes, after the memory
 * grew by the larger of the pages that `need` answers for the request and
 * {@link chunk}, or by those alone where a chunk would end past
 * {@link lastPage} or the host refuses it, and `taken` made a region of
 * them; or
 * `null` where the host refuses both, or where no region could hold the
 * request.
 *
 * @type {(need: (a: Arena, size: number) => number, taken: (a: Arena, g: number, k: number) => Arena | null) => (a: Arena, size: number) => Arena | null}
 */
const grownBy = (need, taken) => (a, size) => {
    const pages = need(a, size)
    if (pages > lastPage) { return null }
    const k = pages < chunk && a.pages + chunk <= lastPage ? chunk : pages
    const g = grow(a.pages, a.most, k)
    if (g !== null) { return taken({ ...a, pages: a.pages + k }, g, k) }
    const h = grow(a.pages, a.most, pages)
    return h === null ? null : taken({ ...a, pages: a.pages + pages }, h, pages)
}

/**
 * The arena with a block of `size` bytes, and where the block starts, or
 * `null` where it is out of memory. A region that `grown` made holds the
 * block.
 *
 * @type {(grown: (a: Arena, size: number) => Arena | null) => (a: Arena, size: number) => readonly [Arena, number] | null}
 */
const placedBy = grown => (a, size) => {
    const p = fit(a, size)
    if (p !== null) { return p }
    const b = grown(a, size)
    return b === null ? null : fit(b, size)
}

/**
 * The pages that a full region of the release arena takes for `size`
 * bytes: those that hold them, or, where the region ends where the memory
 * does, those that hold the bytes past its end, since new pages extend it.
 *
 * @type {(a: Arena, size: number) => number}
 */
const releaseNeed = (a, size) => pagesOf(a.end === a.pages * page ? a.top + size - a.end : size)

/** The release arena's {@link placedBy}. */
const placed = placedBy(grownBy(releaseNeed, taken))

/**
 * The pages that a region of the debug arena takes for `size` bytes: those
 * that hold them, and one more for each 32 of those, for the bitmaps in its
 * tail.
 *
 * @type {(size: number) => number}
 */
const countedNeed = size => {
    const k = pagesOf(size)
    return k + (k + 31 - (k + 31) % 32) / 32
}

/**
 * The debug arena after a full region took `k` new pages from page `g` on:
 * always a new region, which ends where the bitmaps of its pages start, a
 * KiB each. `null` where they reach past the last page.
 *
 * @type {(a: Arena, g: number, k: number) => Arena | null}
 */
const countedTaken = (a, g, k) => {
    const last = g + k
    if (g >= lastPage || last > lastPage) { return null }
    return { ...a, top: g * page, end: last * page - k * bitmap }
}

/** The debug arena's {@link placedBy}. */
const placedCounted = placedBy(grownBy((_, size) => countedNeed(size), countedTaken))

/**
 * The arena with its next block of `n` bytes, and the block's address, or
 * `null` where it is out of memory.
 *
 * @type {(a: Arena, n: number) => readonly [Arena, number] | null}
 */
export const alloc = (a, n) => placed(a, round(n))

/**
 * The arena after another allocator grew the memory by `k` pages, which
 * the arena's next region then does not follow, or as it was where the
 * host refused.
 *
 * @type {(a: Arena, k: number) => Arena}
 */
export const other = (a, k) => grow(a.pages, a.most, k) === null ? a : { ...a, pages: a.pages + k }

/**
 * The debug arena that `init` makes in a memory of `pages` pages, which the
 * host lets grow to `most`, with no blocks: its state at the start of the
 * first of five new pages, its first region the rest of that page but for
 * the page's bitmap, and its directory the other four. `null` where the
 * memory cannot grow by five pages before the last.
 *
 * @type {(pages: number, most: number) => Counted | null}
 */
export const startCounted = (pages, most) => {
    const g = grow(pages, most, countedPages)
    if (g === null || g + countedPages > lastPage) { return null }
    const state = g * page
    return { arena: { pages: pages + countedPages, most, state, top: state + 16, end: state + page - bitmap }, live: 0, blocks: empty }
}

/**
 * The debug arena with its next block of `n` bytes for an object of type
 * `t`, after the size word and the header, with a count of 1, and the
 * block's address, or `null` where it is out of memory.
 *
 * @type {(c: Counted, t: number, n: number) => readonly [Counted, number] | null}
 */
export const allocCounted = (c, t, n) => {
    const r = placedCounted(c.arena, header + round(n))
    if (r === null) { return null }
    const [arena, at] = r
    const p = at + header
    return [{ arena, live: c.live + 1, blocks: setReplace(`${p}`)({ n, t, count: 1, freed: false })(c.blocks) }, p]
}

/** The block at `p`, or `null` where none is. @type {(c: Counted, p: number) => Block | null} */
export const block = (c, p) => entryAt(`${p}`)(c.blocks)

/** The debug arena where block `p` is `b`. @type {(c: Counted, p: number, b: Block) => Counted} */
const withBlock = (c, p, b) => ({ ...c, blocks: setReplace(`${p}`)(b)(c.blocks) })

/**
 * The debug arena after a `dup` of `p`: one owner more, or `null` where no
 * block is at `p` or its count is 0.
 *
 * @type {(c: Counted, p: number) => Counted | null}
 */
export const dup = (c, p) => {
    const b = block(c, p)
    return b === null || b.count === 0 ? null : withBlock(c, p, { ...b, count: b.count + 1 })
}

/**
 * The debug arena after a `drop` of `p`, and whether its count reached 0,
 * or `null` where no block is at `p` or its count is 0.
 *
 * @type {(c: Counted, p: number) => readonly [Counted, boolean] | null}
 */
export const drop = (c, p) => {
    const b = block(c, p)
    if (b === null || b.count === 0) { return null }
    const d = withBlock(c, p, { ...b, count: b.count - 1 })
    return b.count === 1 ? [{ ...d, live: d.live - 1 }, true] : [d, false]
}

/**
 * The debug arena after a `free` of `p`, or `null` where no block is at
 * `p`, its count is above 0, or a `free` took it before.
 *
 * @type {(c: Counted, p: number) => Counted | null}
 */
export const free = (c, p) => {
    const b = block(c, p)
    return b === null || b.count !== 0 || b.freed ? null : withBlock(c, p, { ...b, freed: true })
}
