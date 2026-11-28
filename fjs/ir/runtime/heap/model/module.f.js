/**
 * A plain FunctionalScript model of the IR heap's bump arena
 * ([heap.md](../../../../../doc/sasha-gil/ir/heap.md#how-misuse-and-leaks-are-caught)),
 * which the host proof runs beside the arena's WASM on the same
 * operations: every address that the arena answers must be the model's.
 * It keeps what the arena keeps in its state words, and the memory's size
 * in pages, which the arena reads by growing it.
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
 *
 * @module
 *
 * @import { Arena } from './types.ts'
 */

/** The bytes of a page. */
const page = /** @type {const} */ (0x1_0000)

/** The page at which the arena's last region must end: no byte of the arena is past `0xFFFF_0000`. */
const lastPage = /** @type {const} */ (0xFFFF)

/** The pages that a full region asks for at least: 1 MiB. */
const chunk = /** @type {const} */ (16)

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
 * grew by the larger of the request and {@link chunk} pages, or by the
 * request alone where a chunk would end past {@link lastPage} or the host
 * refuses it, or `null` where the host refuses both. A region that ends
 * where the memory does asks only for the bytes past its end, since the
 * new pages extend it.
 *
 * @type {(a: Arena, size: number) => Arena | null}
 */
const grown = (a, size) => {
    // a region that ends where the memory does needs only the pages for the bytes past its end
    const need = pagesOf(a.end === a.pages * page ? a.top + size - a.end : size)
    const k = need < chunk && a.pages + chunk <= lastPage ? chunk : need
    const g = grow(a.pages, a.most, k)
    if (g !== null) { return taken({ ...a, pages: a.pages + k }, g, k) }
    const h = grow(a.pages, a.most, need)
    return h === null ? null : taken({ ...a, pages: a.pages + need }, h, need)
}

/**
 * The arena with its next block of `n` bytes, and the block's address, or
 * `null` where it is out of memory. A region that grew holds the block.
 *
 * @type {(a: Arena, n: number) => readonly [Arena, number] | null}
 */
export const alloc = (a, n) => {
    const size = round(n)
    const placed = fit(a, size)
    if (placed !== null) { return placed }
    const b = grown(a, size)
    return b === null ? null : fit(b, size)
}

/**
 * The arena after another allocator grew the memory by `k` pages, which
 * the arena's next region then does not follow, or as it was where the
 * host refused.
 *
 * @type {(a: Arena, k: number) => Arena}
 */
export const other = (a, k) => grow(a.pages, a.most, k) === null ? a : { ...a, pages: a.pages + k }
