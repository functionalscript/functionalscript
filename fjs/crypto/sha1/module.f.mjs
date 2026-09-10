/**
 * SHA-1, as FIPS 180-4 and RFC 3174 define it. It is here because Git
 * names objects by it in the repository format it defaults to, which is
 * nearly every repository in use today — GitHub, GitLab and Radicle among
 * the hosts — and for no other reason; a SHA-256 repository, which Git
 * can make since 2.29, is the exception [`fjs/crypto/sha2`](../sha2/module.f.mjs)
 * covers. SHA-1's collision
 * resistance is broken, by an identical-prefix attack in 2017 (SHAttered)
 * and a chosen-prefix one in 2020, so nothing that vouches for an object
 * may rest on this hash alone. What a trust layer does about that is
 * [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md);
 * what Git itself does, refusing an input the known attack shaped, is
 * `sha1dc`, a task in [`todo/sha1.md`](../todo/sha1.md).
 *
 * In the shape of [`fjs/crypto/sha2`](../sha2/module.f.mjs): `init`,
 * `append` and `end` over a `State`, so `computeSync` there computes it.
 * The framing is SHA-256's — 512-bit blocks, a `1` bit, zeros, and the
 * message length in 64 bits — and is written out again here, since
 * `sha2`'s `base` closes over its own compression; only the compression
 * differs, five words through eighty rounds in four twenties, on a
 * schedule that rotates. See RFC 3174 section 6.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Fold } from '../../types/function/operator/types.ts'
 * @import { Sha1, State, V5 } from './types.ts'
 */

import { divUp8, mask } from '../../types/bigint/module.f.mjs'
import { chunkList, empty, length, msb, uint, vec } from '../../types/bit_vec/module.f.mjs'
import { fold } from '../../types/list/module.f.mjs'

const { concat, front, removeFront } = msb

const wordLength = /** @type {const} */ (32n)

const m = mask(wordLength)

const hashLength = /** @type {const} */ (160n)

/** Sixteen words a block. */
const chunkLength = /** @type {const} */ (512n)

/** The message length closes the last block, in this many bits. */
const lengthLength = /** @type {const} */ (64n)

const chunks = chunkList(msb)(chunkLength)

/** @type {Vec} */
const lastOne = vec(1n)(1n)

/** @type {(d: bigint) => (n: bigint) => bigint} */
const rotl = d => {
    const r = wordLength - d
    return n => (n << d | n >> r) & m
}

const rotl1 = rotl(1n)

const rotl5 = rotl(5n)

const rotl30 = rotl(30n)

/** @type {(b: bigint, c: bigint, d: bigint) => bigint} */
const ch = (b, c, d) => b & c ^ ~b & d

/** @type {(b: bigint, c: bigint, d: bigint) => bigint} */
const parity = (b, c, d) => b ^ c ^ d

/** @type {(b: bigint, c: bigint, d: bigint) => bigint} */
const maj = (b, c, d) => b & c ^ b & d ^ c & d

/**
 * The four twenties of rounds: each its function of `b`, `c` and `d`, and
 * its constant.
 *
 * @type {readonly (readonly [(b: bigint, c: bigint, d: bigint) => bigint, bigint])[]}
 */
const stages = [
    [ch, 0x5a827999n],
    [parity, 0x6ed9eba1n],
    [maj, 0x8f1bbcdcn],
    [parity, 0xca62c1d6n],
]

const roundsPerStage = /** @type {const} */ (20)

/**
 * The schedule's next sixteen words from the last sixteen: `W[t]` is
 * `W[t-3] ^ W[t-8] ^ W[t-14] ^ W[t-16]` rotated left by one, so each new
 * word reads three old ones and, from the fourth on, one just made.
 *
 * @type {(...w: readonly bigint[]) => readonly bigint[]}
 */
const nextW = (w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, wA, wB, wC, wD, wE, wF) => {
    const n0 = rotl1(wD ^ w8 ^ w2 ^ w0)
    const n1 = rotl1(wE ^ w9 ^ w3 ^ w1)
    const n2 = rotl1(wF ^ wA ^ w4 ^ w2)
    const n3 = rotl1(n0 ^ wB ^ w5 ^ w3)
    const n4 = rotl1(n1 ^ wC ^ w6 ^ w4)
    const n5 = rotl1(n2 ^ wD ^ w7 ^ w5)
    const n6 = rotl1(n3 ^ wE ^ w8 ^ w6)
    const n7 = rotl1(n4 ^ wF ^ w9 ^ w7)
    const n8 = rotl1(n5 ^ n0 ^ wA ^ w8)
    const n9 = rotl1(n6 ^ n1 ^ wB ^ w9)
    const nA = rotl1(n7 ^ n2 ^ wC ^ wA)
    const nB = rotl1(n8 ^ n3 ^ wD ^ wB)
    const nC = rotl1(n9 ^ n4 ^ wE ^ wC)
    const nD = rotl1(nA ^ n5 ^ wF ^ wD)
    const nE = rotl1(nB ^ n6 ^ n0 ^ wE)
    const nF = rotl1(nC ^ n7 ^ n1 ^ wF)
    return [n0, n1, n2, n3, n4, n5, n6, n7, n8, n9, nA, nB, nC, nD, nE, nF]
}

/**
 * The sixteen words of a block, most significant first: the block is one
 * unsigned integer of `chunkLength` bits, and word `i` sits `15 - i` words
 * from its low end.
 *
 * @type {(u: bigint) => readonly bigint[]}
 */
const words = u => Array.from({ length: 16 }, (_, i) => u >> BigInt(15 - i) * wordLength & m)

/**
 * One block folded into the state: RFC 3174 section 6.1, steps b to e.
 *
 * @type {(hash: V5) => (u: bigint) => V5}
 */
const compress = ([h0, h1, h2, h3, h4]) => u => {
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let w = words(u)
    for (let t = 0; t < 80; t += 16) {
        for (let j = 0; j < 16; ++j) {
            const [f, k] = stages[Math.trunc((t + j) / roundsPerStage)]
            const temp = (rotl5(a) + f(b, c, d) + e + k + w[j]) & m
            e = d
            d = c
            c = rotl30(b)
            b = a
            a = temp
        }
        w = nextW(...w)
    }
    return [
        (h0 + a) & m,
        (h1 + b) & m,
        (h2 + c) & m,
        (h3 + d) & m,
        (h4 + e) & m,
    ]
}

/** @type {(a: V5) => bigint} */
const fromV5 = a => a.reduce((p, v) => p << wordLength | v)

/**
 * Folds one block, or the final shorter leftover, into the state: `chunks`
 * yields blocks of exactly `chunkLength` bits except possibly the last, so
 * `remainder` only ever holds that last one.
 *
 * @type {Fold<Vec, State>}
 */
const appendChunk = chunk => state =>
    length(chunk) === chunkLength
        ? { hash: compress(state.hash)(uint(chunk)), len: state.len + chunkLength, remainder: empty }
        : { ...state, remainder: chunk }

const foldChunks = fold(appendChunk)

/**
 * Data appended to the state, a block folded as soon as one is whole. A
 * remainder already held is completed from the front of the new data as
 * one block's integer, never as a `Vec` of the two joined: a `Vec` holds
 * 128 KiB and `v` may be one, so the two joined would not fit, and the
 * rest of `v` is chunked on its own.
 *
 * @type {Fold<Vec, State>}
 */
const append = v => state => {
    const { remainder } = state
    const rLen = length(remainder)
    if (rLen === 0n) { return foldChunks(state)(chunks(v)) }
    const need = chunkLength - rLen
    if (length(v) < need) { return { ...state, remainder: concat(remainder)(v) } }
    const block = uint(remainder) << need | front(need)(v)
    return foldChunks({ hash: compress(state.hash)(block), len: state.len + chunkLength, remainder: empty })(chunks(removeFront(need)(v)))
}

/**
 * The most a last block holds and still has room for the `1` bit and the
 * length; a longer remainder pads into a block of its own first.
 */
const lastChunkLength = chunkLength - 1n - lengthLength

const result = vec(hashLength)

/** @type {(state: State) => Vec} */
const end = ({ hash, len, remainder }) => {
    const rLen = length(remainder)
    const u = front(chunkLength)(concat(remainder)(lastOne))
    const [h, last] = rLen > lastChunkLength ? [compress(hash)(u), 0n] : [hash, u]
    return result(fromV5(compress(h)(last | (len + rLen))))
}

/**
 * SHA-1.
 *
 * @example
 *
 * ```js
 * const h = computeSync(sha1)([utf8('abc')])
 * // h === vec(160n)(0xa9993e364706816aba3e25717850c26c9cd0d89dn)
 * ```
 *
 * @type {Sha1}
 */
export const sha1 = {
    hashLength,
    blockLength: chunkLength,
    hashBytes: divUp8(hashLength),
    blockBytes: divUp8(chunkLength),
    init: {
        hash: [0x67452301n, 0xefcdab89n, 0x98badcfen, 0x10325476n, 0xc3d2e1f0n],
        len: 0n,
        remainder: empty,
    },
    append,
    end,
}
