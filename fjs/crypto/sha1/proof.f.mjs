import { assertEq } from '../../asserts/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { maxLength, repeat, uint, vec } from '../../types/bit_vec/module.f.mjs'
import { flip } from '../../types/function/module.f.mjs'
import { map } from '../../types/list/module.f.mjs'
import { computeSync } from '../sha2/module.f.mjs'
import { sha1 } from './module.f.mjs'

const compute = computeSync(sha1)

/** @type {(s: string) => bigint} */
const of = s => uint(compute([utf8(s)]))

const a = vec(8n)(0x61n)

/** @type {(n: bigint) => bigint} */
const as = n => uint(compute([flip(repeat)(a)(n)]))

export const proof = {
    // The byte counts a consumer reads, pinned against the bit lengths.
    lengths: () => {
        assertEq(sha1.hashLength, 160n)
        assertEq(sha1.blockLength, 512n)
        assertEq(sha1.hashBytes, 20n)
        assertEq(sha1.blockBytes, 64n)
    },
    // FIPS 180-4 and RFC 3174 section 7.3, and the vectors every
    // implementation quotes.
    vectors: {
        empty: () => assertEq(of(''), 0xda39a3ee5e6b4b0d3255bfef95601890afd80709n),
        abc: () => assertEq(of('abc'), 0xa9993e364706816aba3e25717850c26c9cd0d89dn),
        // Fifty-six bytes: the `1` bit fits the first block and the length
        // does not, so the padding overflows into a second.
        twoBlocks: () => assertEq(of('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), 0x84983e441c3bd26ebaae4aa1f95129e5e54670f1n),
        fourBlocks: () => assertEq(of('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu'), 0xa49b2446a02c645bf419f995b67091253a04a259n),
        fox: () => assertEq(of('The quick brown fox jumps over the lazy dog'), 0x2fd4e1c67a2d28fced849ee1bb76e7391b93eb12n),
        // A million `a`: sixteen thousand blocks, and RFC 3174's last
        // vector, given as a hundred `Vec`s of ten thousand bytes, since one
        // `Vec` of a million is over the ceiling a `Vec` has on every host.
        million: () => {
            const piece = repeat(10_000n)(a)
            assertEq(uint(compute(Array.from({ length: 100 }, () => piece))), 0x34aa973cd4c4daa4f61eeb2bdbad27316534016fn)
        },
    },
    // Either side of the padding's edge: fifty-five bytes leave room for the
    // length in the first block, sixty-four leave none and fill it.
    padding: {
        fits: () => assertEq(as(55n), 0xc1c8bbdc22796e28c0e15163d20899b65621d65an),
        fills: () => assertEq(as(64n), 0x0098ba824b5c16427bd7a1122a5a442a25ec644dn),
    },
    // The state carried between appends: a message in pieces hashes as the
    // message whole, whatever the pieces' lengths.
    pieces: () => {
        const whole = of('The quick brown fox jumps over the lazy dog')
        const parts = /** @type {readonly string[]} */ (['The', ' quick', ' brown', ' fox', ' jumps', ' over', ' the', ' lazy', ' dog'])
        assertEq(uint(compute(map(utf8)(parts))), whole)
        const state = sha1.append(utf8('The quick brown fox'))(sha1.init)
        assertEq(uint(sha1.end(sha1.append(utf8(' jumps over the lazy dog'))(state))), whole)
        // A remainder completed from the front of the next piece, the rest
        // of the piece chunked on its own: one byte, then a hundred.
        const one = sha1.append(a)(sha1.init)
        assertEq(uint(sha1.end(sha1.append(repeat(100n)(a))(one))), as(101n))
    },
    // A remainder held, then a `Vec` as long as a `Vec` may be: the two are
    // never joined into one, which would be over the ceiling.
    remainderThenFull: () => {
        const full = repeat(maxLength >> 3n)(a)
        const state = sha1.append(a)(sha1.init)
        assertEq(uint(sha1.end(sha1.append(full)(state))), uint(compute([a, full])))
        assertEq(uint(compute([a, full])), uint(compute([full, a])))
    },
    // The checked-in Git objects, with the ids Git computed, are the proof
    // of `fjs/git/oid`'s `of`, which is where this hash meets an object.
}
