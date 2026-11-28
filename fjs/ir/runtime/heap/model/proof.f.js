/**
 * Proofs of the arena's model: the pointer moves by sizes rounded to 8, a
 * full region grows the memory by 16 pages or by the request, new pages
 * extend the region where they follow it and start one elsewhere, and the
 * arena runs out of memory where the host refuses or past `0xFFFF_0000`.
 * The debug arena keeps 16 bytes before each block and counts in a map
 * from offset to block, and refuses what its WASM traps on; its `init`
 * takes five pages, and each of its regions is new and ends where the
 * bitmaps in its tail start.
 *
 * @import { Arena, Counted } from './types.ts'
 */

import { assert, assertEq, assertNotNullish } from '../../../../asserts/module.f.js'
import { alloc, allocCounted, block, drop, dup, free, other, round, start, startCounted } from './module.f.js'

/** The arena and the address of a block that fits. @type {(a: Arena, n: number) => readonly [Arena, number]} */
const allocated = (a, n) => assertNotNullish(alloc(a, n))

/** The debug arena and the address of a block of type `t` that fits. @type {(c: Counted, t: number, n: number) => readonly [Counted, number]} */
const counted = (c, t, n) => assertNotNullish(allocCounted(c, t, n))

/** The block at `p` as its size, type, count and whether it was freed. @type {(c: Counted, p: number) => string} */
const shown = (c, p) => {
    const b = block(c, p)
    return b === null ? 'none' : `${b.n} ${b.t} ${b.count} ${b.freed}`
}

export const proof = {
    round: () => {
        assertEq([0, 1, 7, 8, 9, 0xFFFF_FFF1, 0xFFFF_FFF8].map(round).join(), '8,8,8,8,16,4294967288,4294967288')
    },
    // `init` takes the next page: the state words, then the first region's blocks from 16 bytes in.
    start: () => {
        const a = assertNotNullish(start(1, 0x1_0000))
        assertEq(`${a.pages} ${a.state} ${a.top} ${a.end}`, '2 65536 65552 131072')
        // a host that lets the memory grow no more, and a memory whose next page is the last, give no arena
        assertEq(start(1, 1), null)
        assertEq(start(0xFFFF, 0x1_0000), null)
        assertEq(assertNotNullish(start(0xFFFE, 0x1_0000)).state, 0xFFFE_0000)
    },
    // A block is its size rounded up to 8, at the pointer, which moves past it. A block of 0 bytes takes 8 too, so
    // that it has an address of its own.
    alloc: () => {
        const a = assertNotNullish(start(1, 0x1_0000))
        const [b, p] = allocated(a, 5)
        const [c, q] = allocated(b, 0)
        const [d, r] = allocated(c, 16)
        assertEq(`${p} ${q} ${r} ${d.top}`, '65552 65560 65568 65584')
        // the rest of the region holds exactly one more block that ends at its end
        const [e, s] = allocated(d, d.end - d.top)
        assertEq(`${s} ${e.top === e.end} ${e.pages}`, '65584 true 2')
    },
    // A full region grows the memory by 16 pages, or by the pages for the bytes past its end where that is more,
    // and new pages that follow the region extend it.
    grown: () => {
        const a = assertNotNullish(start(1, 0x1_0000))
        const [b, p] = allocated(a, 0x1_0000)
        assertEq(`${p} ${b.pages} ${b.end} ${b.top}`, '65552 18 1179648 131088')
        const [c, q] = allocated(b, 0x20_0000)
        assertEq(`${q} ${c.pages} ${c.end}`, '131088 35 2293760')
    },
    // Where 16 pages would end past the last page, a full region grows by the request alone: after `init` on
    // 65,519 pages, a block of 8 bytes past a full region takes one page, which ends at 65,521.
    nearLastPage: () => {
        const a = assertNotNullish(start(65_519, 0x1_0000))
        const [b, p] = allocated(a, 0xFFF0)
        const [c, q] = allocated(b, 8)
        assertEq(`${q - p} ${c.pages} ${c.end / 0x1_0000} ${c.top - q}`, '65520 65521 65521 8')
    },
    // A region that ends where the memory does counts its tail: on a memory that may grow to 3 pages, a block of
    // 0x1_0008 bytes after `init` runs 24 bytes past the region, so one page holds it where 16 are refused.
    tail: () => {
        const [b, p] = allocated(assertNotNullish(start(1, 3)), 0x1_0008)
        assertEq(`${p} ${b.pages} ${b.top} ${b.end}`, '65552 3 131096 196608')
    },
    // Pages that another allocator took first leave the region's tail, and the block starts a new region.
    elsewhere: () => {
        const a = other(assertNotNullish(start(1, 0x1_0000)), 3)
        assertEq(a.pages, 5)
        const [b, p] = allocated(a, 0x1_0000)
        assertEq(`${p} ${b.top} ${b.end} ${b.pages}`, '327680 393216 1376256 21')
        // a host that refuses leaves the memory as it was
        assertEq(other(b, 0x1_0000).pages, 21)
    },
    // Where the host refuses 16 pages, the request alone may still fit; where it refuses that too, or the pages
    // reach past the last, the arena is out of memory.
    refused: () => {
        const a = assertNotNullish(start(1, 4))
        const [b, p] = allocated(a, 0x1_0000)
        assertEq(`${p} ${b.pages} ${b.end}`, '65552 3 196608')
        assertEq(alloc(b, 0x4_0000), null)
        const last = assertNotNullish(start(0xFFFD, 0x1_0000))
        assertEq(alloc(last, 0x2_0000), null)
        assertEq(assertNotNullish(alloc(last, 0x1_0000))[0].end, 0xFFFF_0000)
        assert(alloc(last, 0x8000) !== null)
        const full = assertNotNullish(start(0xFFFE, 0x1_0000))
        assertEq(alloc(full, 0x1_0000), null)
    },
    // The debug arena's `init` takes five pages, the state's and four of directory, and its first region ends where
    // the state page's bitmap starts, a KiB before the page's end.
    countedStart: () => {
        const c = assertNotNullish(startCounted(1, 0x1_0000))
        assertEq(`${c.arena.pages} ${c.arena.state} ${c.arena.top} ${c.arena.end}`, '6 65536 65552 130048')
        // five pages that the host does not let the memory grow by, or that reach past the last page, give no arena
        assertEq(`${startCounted(1, 5)} ${startCounted(0xFFFB, 0x1_0000)}`, 'null null')
        assertEq(assertNotNullish(startCounted(1, 6)).arena.pages, 6)
        assertEq(assertNotNullish(startCounted(0xFFFA, 0x1_0000)).arena.state, 0xFFFA_0000)
    },
    // The debug arena's first block starts 32 bytes into the state's page, after its size word and header, and the
    // pointer moves past both and the rounded size, 8 for a block of 0 bytes.
    counted: () => {
        const c = assertNotNullish(startCounted(1, 0x1_0000))
        assertEq(`${c.live} ${c.arena.top}`, '0 65552')
        const [d, p] = counted(c, 7, 5)
        const [e, q] = counted(d, 9, 0)
        assertEq(`${p} ${d.arena.top} ${q} ${e.arena.top} ${e.live}`, '65568 65576 65592 65600 2')
        assertEq(`${shown(e, p)}, ${shown(e, q)}, ${shown(e, p + 8)}`, '5 7 1 false, 0 9 1 false, none')
        assertEq(startCounted(1, 1), null)
    },
    // dup adds 1, drop takes 1 and answers whether the count reached 0, and only a block at 0 takes a free, once.
    counts: () => {
        const [c, p] = counted(assertNotNullish(startCounted(1, 0x1_0000)), 3, 8)
        const [d, first] = assertNotNullish(drop(assertNotNullish(dup(c, p)), p))
        const [e, last] = assertNotNullish(drop(d, p))
        assertEq(`${shown(d, p)}, ${first}, ${shown(e, p)}, ${last}, ${d.live} ${e.live}`, '8 3 1 false, false, 8 3 0 false, true, 1 0')
        assertEq(shown(assertNotNullish(free(e, p)), p), '8 3 0 true')
        // a count of 0 takes no dup and no drop, a count above 0 no free, and a freed block no second free
        assertEq(`${dup(e, p)} ${drop(e, p)} ${free(c, p)} ${free(assertNotNullish(free(e, p)), p)}`, 'null null null null')
        // nor does an address that no block has
        assertEq(`${dup(c, p + 8)} ${drop(c, p - 16)} ${free(e, 0)}`, 'null null null')
    },
    // A block's 16 bytes count toward the region: a full region grows for a block of none, past the directory's
    // pages, and a request that with them needs more pages than any region holds is out of memory.
    headers: () => {
        const c = assertNotNullish(startCounted(1, 0x1_0000))
        const [d] = counted(c, 0, c.arena.end - c.arena.top - 16)
        assertEq(d.arena.top, d.arena.end)
        const [e, q] = counted(d, 0, 0)
        assertEq(`${q} ${e.arena.pages} ${e.arena.end}`, '393232 22 1425408')
        assertEq(allocCounted(c, 0, 0xFFFF_FFF8), null)
        assertEq(alloc(assertNotNullish(start(1, 0x1_0000)), 0xFFFF_FFF8), null)
    },
    // A debug region takes a page more for each 32 that its block needs, for the bitmaps in its tail, ends where
    // they start, and is always new, though its pages follow the last region's.
    countedRegions: () => {
        const c = assertNotNullish(startCounted(1, 0x1_0000))
        // 2 MiB and 16 bytes take 33 pages, and their bitmaps 2 more
        const [d, p] = counted(c, 0, 0x20_0000)
        assertEq(`${p} ${d.arena.pages} ${d.arena.end} ${d.arena.end - p >= 0x20_0000}`, '393232 41 2651136 true')
        const [e, q] = counted(d, 0, 0x20_0000)
        assertEq(`${q} ${e.arena.pages} ${e.arena.end}`, '2686992 76 4944896')
        // a region that would reach past the last page, or start there, is out of memory, as in release
        assertEq(allocCounted(assertNotNullish(startCounted(0xFFF8, 0x1_0000)), 0, 0x1_0000), null)
        assertEq(allocCounted(assertNotNullish(startCounted(0xFFFA, 0x2_0000)), 0, 0x1_0000), null)
    },
}
