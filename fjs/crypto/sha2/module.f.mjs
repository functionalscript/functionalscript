/**
 * See https://www.rfc-editor.org/rfc/rfc6234
 *
 * @module
 *
 * @import { FixedArray } from '../../types/array/types.ts'
 * @import { Reduce } from '../../types/bigint/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Fold } from '../../types/function/operator/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Base, Framed, Framing, FramingInit, Hash, Sha2, V16, V8 } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { divUp8, mask } from '../../types/bigint/module.f.mjs'
import {
    vec,
    length,
    empty,
    msb,
    chunkList,
    uint,
} from '../../types/bit_vec/module.f.mjs'
import { fold } from '../../types/list/module.f.mjs'

const { concat, front, removeFront } = msb

// `chunkList(msb)` depends on neither `chunkLength` nor `v`/`state` — shared
// across every `base(...)` config (32-bit and 64-bit SHA-2 variants).
const chunkListMsb = chunkList(msb)

/** @type {Vec} */
const lastOne = vec(1n)(1n)

/**
 * Folds one block, or the final leftover shorter than a block, into the
 * state: the chunks come `chunkLength` bits long except possibly the
 * last, so `remainder` only ever holds that last one, and `empty`
 * otherwise.
 *
 * @type {<H>(chunkLength: bigint, compress: (hash: H) => (block: bigint) => H) => Fold<Vec, Framed<H>>}
 */
const appendChunk = (chunkLength, compress) => chunk => state =>
    length(chunk) === chunkLength
        ? { hash: compress(state.hash)(uint(chunk)), len: state.len + chunkLength, remainder: empty }
        : { ...state, remainder: chunk }

/**
 * The Merkle–Damgård framing SHA-1 and SHA-2 share, over a compression it
 * is given: data folded into the state a block at a time, and the last
 * block padded with a `1` bit, zeros, and the message length. SHA-2's
 * `base` is built on it, and so is [`fjs/crypto/sha1`](../sha1/module.f.mjs),
 * whose compression alone differs; a fix to the framing is made once.
 * SHA-3 is not one of them: it is a sponge, absorbing and squeezing a
 * state rather than folding blocks into a hash value, and a hash built
 * that way is no caller of this.
 *
 * `append` never joins the remainder it holds to the new `Vec`, which may
 * be as long as a `Vec` may be: with no remainder it chunks the new data
 * as it is; with one, and the data too short to fill the block, it joins
 * the two, which is short; otherwise it completes the block as one
 * integer from the front of the data, compresses it, and chunks the rest
 * on its own, so no `Vec` longer than the longer input is built.
 *
 * @type {<H>(init: FramingInit<H>) => Framing<H>}
 */
export const framing = ({ chunkLength, lengthLength, digestLength, compress, digest }) => {
    const chunks = chunkListMsb(chunkLength)

    const foldChunks = fold(appendChunk(chunkLength, compress))

    // See https://www.rfc-editor.org/rfc/rfc6234#section-4
    const lastChunkLength = chunkLength - 1n - lengthLength

    return {
        append: v => state => {
            const { remainder } = state
            const rLen = length(remainder)
            if (rLen === 0n) { return foldChunks(state)(chunks(v)) }
            const need = chunkLength - rLen
            if (length(v) < need) { return { ...state, remainder: concat(remainder)(v) } }
            const block = uint(remainder) << need | front(need)(v)
            return foldChunks({ hash: compress(state.hash)(block), len: state.len + chunkLength, remainder: empty })(chunks(removeFront(need)(v)))
        },
        end: hashLength => {
            const offset = digestLength - hashLength
            const result = vec(hashLength)
            return ({ hash, len, remainder }) => {
                const rLen = length(remainder)
                const u = front(chunkLength)(concat(remainder)(lastOne))
                // last chunk overflow
                const [h, last] = rLen > lastChunkLength ? [compress(hash)(u), 0n] : [hash, u]
                return result(digest(compress(h)(last | (len + rLen))) >> offset)
            }
        },
    }
}

/**
 * The `Hash` over the framing of `init`, starting from the hash value
 * `hash` and answering `hashLength` bits: the one place the
 * `hashBytes`/`blockBytes` rounding and the initial state are spelled.
 * Every SHA-2 variant is one, and so is
 * [`fjs/crypto/sha1`](../sha1/module.f.mjs).
 *
 * It takes the `FramingInit` rather than a built `Framing` so that the
 * block length it advertises is the one its `append` and `end` were
 * built for: there is no value in which the two exist separately.
 *
 * `hashLength` must be positive and at most `init.digestLength`, since
 * `end` answers the high `hashLength` bits of the digest and a longer
 * hash has no bits to answer with. A violation is a caller error no data
 * can cause, so it throws.
 *
 * @type {<H>(init: FramingInit<H>, hash: H, hashLength: bigint) => Hash<Framed<H>>}
 */
export const framed = (init, hash, hashLength) => {
    const { chunkLength, digestLength } = init
    assert(0n < hashLength && hashLength <= digestLength, 'hashLength out of range')
    const { append, end } = framing(init)
    return {
        hashLength,
        blockLength: chunkLength,
        hashBytes: divUp8(hashLength),
        blockBytes: divUp8(chunkLength),
        init: { hash, len: 0n, remainder: empty },
        append,
        end: end(hashLength),
    }
}

/**
 * The number `words` spell, most significant first, each `wordLength`
 * bits wide: how a hash value of words becomes its digest. `[]` spells
 * `0n`.
 *
 * `wordLength` must be positive and every word must fit in it, or two
 * words could spell what no run of words that wide can. The words are
 * hash state, masked by the compression, so a violation is a caller
 * error no data can cause, and it throws.
 *
 * @type {(wordLength: bigint) => (words: readonly bigint[]) => bigint}
 */
export const fromWords = wordLength => {
    assert(0n < wordLength, 'wordLength must be positive')
    const limit = 1n << wordLength
    return words => words.reduce(
        (p, v) => {
            assert(0n <= v && v < limit, 'word out of range')
            return p << wordLength | v
        },
        0n)
}

/**
 * The choice function SHA-1 and SHA-2 share: each bit of `x` picks the
 * bit of `y` or of `z`.
 *
 * @type {(x: bigint, y: bigint, z: bigint) => bigint}
 */
export const ch = (x, y, z) => x & y ^ ~x & z

/**
 * The majority function SHA-1 and SHA-2 share: each bit is the one at
 * least two of `x`, `y` and `z` hold.
 *
 * @type {(x: bigint, y: bigint, z: bigint) => bigint}
 */
export const maj = (x, y, z) => x & y ^ x & z ^ y & z

/** @type {(init: {
 *   readonly logBitLen: bigint,
 *   readonly k: readonly V16[],
 *   readonly bs0: FixedArray<3, bigint>,
 *   readonly bs1: FixedArray<3, bigint>,
 *   readonly ss0: FixedArray<3, bigint>,
 *   readonly ss1: FixedArray<3, bigint>,
 * }) => FramingInit<V8>} */
const framingInit = ({ logBitLen, k, bs0, bs1, ss0, ss1 }) => {

    const bitLength = 1n << logBitLen

    /** @type {Reduce} */
    const rotr = d => {
        const r = bitLength - d
        return n => n >> d | n << r
    }

    /** @type {(third: Reduce) => (..._: FixedArray<3, bigint>) => (x: bigint) => bigint} */
    const sigma = third => (a, b, c) => {
        const ra = rotr(a)
        const rb = rotr(b)
        const rc = third(c)
        return x => ra(x) ^ rb(x) ^ rc(x)
    }

    const bigSigma = sigma(rotr)

    const smallSigma = sigma(c => x => x >> c)

    const bigSigma0 = bigSigma(...bs0)

    const bigSigma1 = bigSigma(...bs1)

    const smallSigma0 = smallSigma(...ss0)

    const smallSigma1 = smallSigma(...ss1)

    const m = mask(bitLength)

    /** @type {(..._: FixedArray<4, bigint>) => bigint} */
    const wi = (a0, a1, a2, a3) =>
        (smallSigma1(a0) + a1 + smallSigma0(a2) + a3) & m

    /** @type {(...w: V16) => V16} */
    const nextW
    = (w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, wA, wB, wC, wD, wE, wF) => {
        w0 = wi(wE, w9, w1, w0)
        w1 = wi(wF, wA, w2, w1)
        w2 = wi(w0, wB, w3, w2)
        w3 = wi(w1, wC, w4, w3)
        w4 = wi(w2, wD, w5, w4)
        w5 = wi(w3, wE, w6, w5)
        w6 = wi(w4, wF, w7, w6)
        w7 = wi(w5, w0, w8, w7)
        w8 = wi(w6, w1, w9, w8)
        w9 = wi(w7, w2, wA, w9)
        wA = wi(w8, w3, wB, wA)
        wB = wi(w9, w4, wC, wB)
        wC = wi(wA, w5, wD, wC)
        wD = wi(wB, w6, wE, wD)
        wE = wi(wC, w7, wF, wE)
        wF = wi(wD, w8, w0, wF)
        return [w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, wA, wB, wC, wD, wE, wF]
    }

    const kLength = k.length

    /** @type {(..._: V8) => (_: V16) => V8} */
    const compressV16 = (a0, b0, c0, d0, e0, f0, g0, h0) => w => {
        let a = a0
        let b = b0
        let c = c0
        let d = d0
        let e = e0
        let f = f0
        let g = g0
        let h = h0

        let i = 0
        while (true) {
            const ki = k[i]
            for (let j = 0; j < 16; ++j) {
                const t1 = h + bigSigma1(e) + ch(e, f, g) + ki[j] + w[j]
                const t2 = bigSigma0(a) + maj(a, b, c)
                h = g
                g = f
                f = e
                e = (d + t1) & m
                d = c
                c = b
                b = a
                a = (t1 + t2) & m
            }
            ++i
            if (i === kLength) { break }
            w = nextW(...w)
        }

        return [
            (a0 + a) & m,
            (b0 + b) & m,
            (c0 + c) & m,
            (d0 + d) & m,
            (e0 + e) & m,
            (f0 + f) & m,
            (g0 + g) & m,
            (h0 + h) & m,
        ]
    }

    /** @type {Reduce} */
    const at = u => i =>
        (u >> (i << logBitLen)) & m

    /** @type {(i: V8) => (u: bigint) => V8} */
    const compress = i => u => {
        const a = at(u)
        return compressV16(...i)([
            a(15n),
            a(14n),
            a(13n),
            a(12n),
            a(11n),
            a(10n),
            a(9n),
            a(8n),
            a(7n),
            a(6n),
            a(5n),
            a(4n),
            a(3n),
            a(2n),
            a(1n),
            a(0n),
        ])
    }

    // A block is sixteen words, the length closing the last block is two
    // words wide, and the digest the eight words spell is eight; see RFC
    // 6234 section 4.
    return {
        chunkLength: bitLength << 4n,
        lengthLength: bitLength << 1n,
        digestLength: bitLength << 3n,
        compress,
        digest: fromWords(bitLength),
    }
}

/**
 * The exported view of a width's `FramingInit`.
 *
 * @type {(init: FramingInit<V8>) => Base}
 */
const base = init => {
    const { chunkLength, compress, digest } = init
    const { append, end } = framing(init)
    // A block is sixteen words.
    return { bitLength: chunkLength >> 4n, chunkLength, compress, fromV8: digest, append, end }
}

/**
 * Computes a hash from a list of message chunks: any SHA-2 variant, or
 * SHA-1 from [`fjs/crypto/sha1`](../sha1/module.f.mjs), which has the
 * same shape over a state of its own, answering what the hash's `end`
 * answers.
 *
 * @type {<S, R>(hash: Hash<S, R>) => (list: List<Vec>) => R}
 */
export const computeSync = ({ append, init, end }) => {
    const f = fold(append)(init)
    return list => end(f(list))
}

/** The framing of the 32-bit SHA-2 variants, SHA-224 and SHA-256. */
const init32 = framingInit({
    logBitLen: 5n,
    k: [
        [
            0x428a_2f98n, 0x7137_4491n, 0xb5c0_fbcfn, 0xe9b5_dba5n, 0x3956_c25bn, 0x59f1_11f1n, 0x923f_82a4n, 0xab1c_5ed5n,
            0xd807_aa98n, 0x1283_5b01n, 0x2431_85ben, 0x550c_7dc3n, 0x72be_5d74n, 0x80de_b1fen, 0x9bdc_06a7n, 0xc19b_f174n,
        ],
        [
            0xe49b_69c1n, 0xefbe_4786n, 0x0fc1_9dc6n, 0x240c_a1ccn, 0x2de9_2c6fn, 0x4a74_84aan, 0x5cb0_a9dcn, 0x76f9_88dan,
            0x983e_5152n, 0xa831_c66dn, 0xb003_27c8n, 0xbf59_7fc7n, 0xc6e0_0bf3n, 0xd5a7_9147n, 0x06ca_6351n, 0x1429_2967n,
        ],
        [
            0x27b7_0a85n, 0x2e1b_2138n, 0x4d2c_6dfcn, 0x5338_0d13n, 0x650a_7354n, 0x766a_0abbn, 0x81c2_c92en, 0x9272_2c85n,
            0xa2bf_e8a1n, 0xa81a_664bn, 0xc24b_8b70n, 0xc76c_51a3n, 0xd192_e819n, 0xd699_0624n, 0xf40e_3585n, 0x106a_a070n,
        ],
        [
            0x19a4_c116n, 0x1e37_6c08n, 0x2748_774cn, 0x34b0_bcb5n, 0x391c_0cb3n, 0x4ed8_aa4an, 0x5b9c_ca4fn, 0x682e_6ff3n,
            0x748f_82een, 0x78a5_636fn, 0x84c8_7814n, 0x8cc7_0208n, 0x90be_fffan, 0xa450_6cebn, 0xbef9_a3f7n, 0xc671_78f2n,
        ],
    ],
    bs0: [2n, 13n, 22n],
    bs1: [6n, 11n, 25n],
    ss0: [7n, 18n, 3n],
    ss1: [17n, 19n, 10n],
})

/**
 * 32-bit SHA-2 base configuration shared by SHA-224 and SHA-256.
 *
 * @type {Base}
 */
export const base32 = base(init32)

/** The framing of the 64-bit SHA-2 variants: SHA-384, SHA-512, SHA-512/224 and SHA-512/256. */
const init64 = framingInit({
    logBitLen: 6n,
    k: [
        [
            0x428a_2f98_d728_ae22n, 0x7137_4491_23ef_65cdn, 0xb5c0_fbcf_ec4d_3b2fn, 0xe9b5_dba5_8189_dbbcn,
            0x3956_c25b_f348_b538n, 0x59f1_11f1_b605_d019n, 0x923f_82a4_af19_4f9bn, 0xab1c_5ed5_da6d_8118n,
            0xd807_aa98_a303_0242n, 0x1283_5b01_4570_6fben, 0x2431_85be_4ee4_b28cn, 0x550c_7dc3_d5ff_b4e2n,
            0x72be_5d74_f27b_896fn, 0x80de_b1fe_3b16_96b1n, 0x9bdc_06a7_25c7_1235n, 0xc19b_f174_cf69_2694n,
        ],
        [
            0xe49b_69c1_9ef1_4ad2n, 0xefbe_4786_384f_25e3n, 0x0fc1_9dc6_8b8c_d5b5n, 0x240c_a1cc_77ac_9c65n,
            0x2de9_2c6f_592b_0275n, 0x4a74_84aa_6ea6_e483n, 0x5cb0_a9dc_bd41_fbd4n, 0x76f9_88da_8311_53b5n,
            0x983e_5152_ee66_dfabn, 0xa831_c66d_2db4_3210n, 0xb003_27c8_98fb_213fn, 0xbf59_7fc7_beef_0ee4n,
            0xc6e0_0bf3_3da8_8fc2n, 0xd5a7_9147_930a_a725n, 0x06ca_6351_e003_826fn, 0x1429_2967_0a0e_6e70n,
        ],
        [
            0x27b7_0a85_46d2_2ffcn, 0x2e1b_2138_5c26_c926n, 0x4d2c_6dfc_5ac4_2aedn, 0x5338_0d13_9d95_b3dfn,
            0x650a_7354_8baf_63den, 0x766a_0abb_3c77_b2a8n, 0x81c2_c92e_47ed_aee6n, 0x9272_2c85_1482_353bn,
            0xa2bf_e8a1_4cf1_0364n, 0xa81a_664b_bc42_3001n, 0xc24b_8b70_d0f8_9791n, 0xc76c_51a3_0654_be30n,
            0xd192_e819_d6ef_5218n, 0xd699_0624_5565_a910n, 0xf40e_3585_5771_202an, 0x106a_a070_32bb_d1b8n,
        ],
        [
            0x19a4_c116_b8d2_d0c8n, 0x1e37_6c08_5141_ab53n, 0x2748_774c_df8e_eb99n, 0x34b0_bcb5_e19b_48a8n,
            0x391c_0cb3_c5c9_5a63n, 0x4ed8_aa4a_e341_8acbn, 0x5b9c_ca4f_7763_e373n, 0x682e_6ff3_d6b2_b8a3n,
            0x748f_82ee_5def_b2fcn, 0x78a5_636f_4317_2f60n, 0x84c8_7814_a1f0_ab72n, 0x8cc7_0208_1a64_39ecn,
            0x90be_fffa_2363_1e28n, 0xa450_6ceb_de82_bde9n, 0xbef9_a3f7_b2c6_7915n, 0xc671_78f2_e372_532bn,
        ],
        [
            0xca27_3ece_ea26_619cn, 0xd186_b8c7_21c0_c207n, 0xeada_7dd6_cde0_eb1en, 0xf57d_4f7f_ee6e_d178n,
            0x06f0_67aa_7217_6fban, 0x0a63_7dc5_a2c8_98a6n, 0x113f_9804_bef9_0daen, 0x1b71_0b35_131c_471bn,
            0x28db_77f5_2304_7d84n, 0x32ca_ab7b_40c7_2493n, 0x3c9e_be0a_15c9_bebcn, 0x431d_67c4_9c10_0d4cn,
            0x4cc5_d4be_cb3e_42b6n, 0x597f_299c_fc65_7e2an, 0x5fcb_6fab_3ad6_faecn, 0x6c44_198c_4a47_5817n,
        ],
    ],
    bs0: [28n, 34n, 39n],
    bs1: [14n, 18n, 41n],
    ss0: [1n, 8n, 7n],
    ss1: [19n, 61n, 6n],
})

/**
 * 64-bit SHA-2 base configuration shared by SHA-384, SHA-512, SHA-512/224 and SHA-512/256.
 *
 * @type {Base}
 */
export const base64 = base(init64)

/**
 * SHA-256
 *
 * @type {Sha2}
 */
export const sha256 = framed(
    init32,
    [0x6a09_e667n, 0xbb67_ae85n, 0x3c6e_f372n, 0xa54f_f53an, 0x510e_527fn, 0x9b05_688cn, 0x1f83_d9abn, 0x5be0_cd19n],
    256n,
)

/**
 * SHA-224
 *
 * @type {Sha2}
 */
export const sha224 = framed(
    init32,
    [0xc105_9ed8n, 0x367c_d507n, 0x3070_dd17n, 0xf70e_5939n, 0xffc0_0b31n, 0x6858_1511n, 0x64f9_8fa7n, 0xbefa_4fa4n],
    224n,
)

/**
 * SHA-512
 *
 * @type {Sha2}
 */
export const sha512 = framed(
    init64,
    [
        0x6a09_e667_f3bc_c908n, 0xbb67_ae85_84ca_a73bn, 0x3c6e_f372_fe94_f82bn, 0xa54f_f53a_5f1d_36f1n,
        0x510e_527f_ade6_82d1n, 0x9b05_688c_2b3e_6c1fn, 0x1f83_d9ab_fb41_bd6bn, 0x5be0_cd19_137e_2179n,
    ],
    512n,
)

/**
 * SHA-384
 *
 * @type {Sha2}
 */
export const sha384 = framed(
    init64,
    [
        0xcbbb_9d5d_c105_9ed8n, 0x629a_292a_367c_d507n, 0x9159_015a_3070_dd17n, 0x152f_ecd8_f70e_5939n,
        0x6733_2667_ffc0_0b31n, 0x8eb4_4a87_6858_1511n, 0xdb0c_2e0d_64f9_8fa7n, 0x47b5_481d_befa_4fa4n,
    ],
    384n,
)

/**
 * SHA-512/256
 *
 * @type {Sha2}
 */
export const sha512x256 = framed(
    init64,
    [
        0x2231_2194_fc2b_f72cn, 0x9f55_5fa3_c84c_64c2n, 0x2393_b86b_6f53_b151n, 0x9638_7719_5940_eabdn,
        0x9628_3ee2_a88e_ffe3n, 0xbe5e_1e25_5386_3992n, 0x2b01_99fc_2c85_b8aan, 0x0eb7_2ddC_81c5_2ca2n,
    ],
    256n,
)

/**
 * SHA-512/224
 *
 * @type {Sha2}
 */
export const sha512x224 = framed(
    init64,
    [
        0x8c3d_37c8_1954_4da2n, 0x73e1_9966_89dc_d4d6n, 0x1dfa_b7ae_32ff_9c82n, 0x679d_d514_582f_9fcfn,
        0x0f6d_2b69_7bd4_4da8n, 0x77e3_6f73_04C4_8942n, 0x3f9d_85a8_6a1d_36C8n, 0x1112_e6ad_91d6_92a1n,
    ],
    224n,
)
