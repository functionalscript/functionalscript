/**
 * Proofs of the arena's model: the pointer moves by sizes rounded to 8, a
 * full region grows the memory by 16 pages or by the request, new pages
 * extend the region where they follow it and start one elsewhere, and the
 * arena runs out of memory where the host refuses or past `0xFFFF_0000`.
 *
 * @import { Arena } from './types.ts'
 */

import { assert, assertEq, assertNotNullish } from '../../../../asserts/module.f.js'
import { alloc, other, round, start } from './module.f.js'

/** The arena and the address of a block that fits. @type {(a: Arena, n: number) => readonly [Arena, number]} */
const allocated = (a, n) => assertNotNullish(alloc(a, n))

export const proof = {
    round: () => {
        assertEq([0, 1, 7, 8, 9, 0xFFFF_FFF1, 0xFFFF_FFF8].map(round).join(), '0,8,8,8,16,4294967288,4294967288')
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
    // A block is its size rounded up to 8, at the pointer, which moves past it.
    alloc: () => {
        const a = assertNotNullish(start(1, 0x1_0000))
        const [b, p] = allocated(a, 5)
        const [c, q] = allocated(b, 0)
        const [d, r] = allocated(c, 16)
        assertEq(`${p} ${q} ${r} ${d.top}`, '65552 65560 65560 65576')
        // the rest of the region holds exactly one more block that ends at its end
        const [e, s] = allocated(d, d.end - d.top)
        assertEq(`${s} ${e.top === e.end} ${e.pages}`, '65576 true 2')
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
}
