/**
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { ObjectType } from '../../git/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { commitPayload, mergePayload, modesTree, rootTree, sha256Commit, sha256Tree, tagPayload } from '../../git/testlib.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { msb, repeat, u8ListToVec, uint, vec } from '../../types/bit_vec/module.f.mjs'
import { flip } from '../../types/function/module.f.mjs'
import { map, toArray } from '../../types/list/module.f.mjs'
import { computeSync, sha256 } from '../sha2/module.f.mjs'
import { sha1 } from './module.f.mjs'

const compute = computeSync(sha1)

/** @type {(s: string) => bigint} */
const of = s => uint(compute([utf8(s)]))

/** @type {(n: bigint) => bigint} */
const as = n => uint(compute([flip(repeat)(vec(8n)(0x61n))(n)]))

const toVec = u8ListToVec(msb)

/**
 * The id Git gives an object: the hash of the envelope ahead of the
 * payload, as {@link writeEnvelope} lays them out.
 *
 * @type {(hash: (list: List<Vec>) => Vec) => (type: ObjectType, payload: readonly number[]) => bigint}
 */
const idOf = hash => (type, payload) => uint(hash([toVec(toArray(writeEnvelope(type, payload)))]))

const gitId = idOf(compute)

const gitId256 = idOf(computeSync(sha256))

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
        // A million `a`: sixteen thousand blocks, and RFC 3174's last vector.
        million: () => assertEq(as(1_000_000n), 0x34aa973cd4c4daa4f61eeb2bdbad27316534016fn),
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
        const parts = ['The', ' quick', ' brown', ' fox', ' jumps', ' over', ' the', ' lazy', ' dog']
        assertEq(uint(compute(map(utf8)(parts))), whole)
        const state = sha1.append(utf8('The quick brown fox'))(sha1.init)
        assertEq(uint(sha1.end(sha1.append(utf8(' jumps over the lazy dog'))(state))), whole)
    },
    // The checked-in Git objects, each with the id Git computed over
    // `<type> SP <size> NUL <payload>`: the hash gives Git's answer.
    git: {
        commit: () => assertEq(gitId('commit', commitPayload), 0xd2bc56a53b2d6d7c1dc0860dec10435ed479b22dn),
        merge: () => assertEq(gitId('commit', mergePayload), 0x9880b6949363a320bb2a534e6de86d72d2206a14n),
        tag: () => assertEq(gitId('tag', tagPayload), 0xb79a8e25df6a75ef83c047b329e730d92ad59decn),
        rootTree: () => assertEq(gitId('tree', rootTree), 0xb007dac9ff840a9f5f9eaa68747d0c91b44c556bn),
        modesTree: () => assertEq(gitId('tree', modesTree), 0x5c1f5cdc3637a09fa100a2055ed273b7d91f3d80n),
        // The other width, from `sha2`, over the objects a SHA-256
        // repository wrote: the same envelope, the same fold, the other hash.
        sha256Commit: () => assertEq(gitId256('commit', sha256Commit), 0x8031c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27fn),
        sha256Tree: () => assertEq(gitId256('tree', sha256Tree), 0x2f1e8b790adef60b1b58a9fe37ff415972da0e5abd333e171a4f999484eb42b0n),
    },
}
