import { assertEq } from '../../asserts/module.f.mjs'
import { startsWith, u32be, u64be } from './module.f.mjs'

export const proof = {
    // Most significant byte first, at any offset.
    u32be: () => {
        assertEq(u32be([0, 0, 0, 0], 0), 0)
        assertEq(u32be([0x12, 0x34, 0x56, 0x78], 0), 0x1234_5678)
        assertEq(u32be([0xAA, 0, 0, 1, 2], 1), 0x102)
    },
    // The top bit set stays unsigned — the case `<<` gets wrong:
    // `0x80 << 24` is -2147483648.
    u32beTopBit: () => {
        assertEq(u32be([0x80, 0, 0, 0], 0), 0x8000_0000)
        assertEq(u32be([0xFF, 0xFF, 0xFF, 0xFF], 0), 0xFFFF_FFFF)
    },
    // Up to the largest safe integer, and refused one past it.
    u64be: () => {
        assertEq(u64be([0, 0, 0, 1, 0, 0, 0, 2], 0), 0x1_0000_0002)
        assertEq(u64be([0xAA, 0, 0, 0, 0, 0x80, 0, 0, 0], 1), 0x8000_0000)
        assertEq(u64be([0, 0x1F, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], 0), Number.MAX_SAFE_INTEGER)
        assertEq(u64be([0, 0x20, 0, 0, 0, 0, 0, 0], 0), null)
        assertEq(u64be([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], 0), null)
    },
    // A match, a mismatch at the last byte, and an input shorter than the
    // prefix; the empty prefix starts everything.
    startsWith: () => {
        const pack = startsWith([0x50, 0x41, 0x43, 0x4B])
        assertEq(pack([0x50, 0x41, 0x43, 0x4B, 0, 0, 0, 2]), true)
        assertEq(pack([0x50, 0x41, 0x43, 0x4B]), true)
        assertEq(pack([0x50, 0x41, 0x43, 0x4C]), false)
        assertEq(pack([0x50, 0x41, 0x43]), false)
        assertEq(startsWith([])([]), true)
    },
}
