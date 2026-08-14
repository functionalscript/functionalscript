/**
 * 256-bit content-addressed identifiers for SUL values.
 * Every identifier is one of three variants: a level-3 literal (inline), a raw bit vector (inline),
 * or a SHA2-based hash, selected automatically by `compress` based on size and input type.
 * See `./types.ts` for the `Id` type.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Point2D } from '../../crypto/secp/types.ts'
 * @import { V8 } from '../../crypto/sha2/types.ts'
 * @import { Id } from './types.ts'
 */

import { toArray } from '../../types/list/module.f.mjs'
import { length, msb, uint, uintChunkList, unpack, vec } from '../../types/bit_vec/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { secp256r1 } from '../../crypto/secp/module.f.mjs'
import { base32 } from '../../crypto/sha2/module.f.mjs'
import { literal3ToVec } from '../level/literal/module.f.mjs'
import { log2 } from '../../types/bigint/module.f.mjs'
import { asBase, asNominal } from '../../types/nominal/module.f.mjs'

// 32 bytes = 256 bits.
//
//              0               1
//              0123456789ABCDEF0123456789ABCDEF
const ivSeed = "Synthetic Universal Language 001"

const utf8IvSeed = utf8(ivSeed)

const c = secp256r1

/** @type {bigint} */
const ivUint = /** @type {Point2D} */ (c.mul(uint(utf8IvSeed))(c.g))[0]

// 64 hex = 256 bits = 32 bytes:
assertEq(
    ivUint,
//    0                 1                 2                 3
//    01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF
    0x325d5666_573eb118_f32191de_20d17f64_33392ba3_291ae46c_1474a5ed_a5383f25n
)

const iv = /** @type {V8} */ (toArray(uintChunkList(msb)(32n)({ length: 256n, uint: ivUint })))

assertEq(iv.length, 8)

/**
 * Note: no need to add a prefix.
 *
 * @type {(v: bigint) => Id}
 */
export const level3Id =
    asNominal

const rawPrefixOffset = 0xFEn

const rawPrefix = 1n << rawPrefixOffset

assertEq(
    rawPrefix,
//    0                 1                 2                 3
//    01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF
    0x40000000_00000000_00000000_00000000_00000000_00000000_00000000_00000000n
)

// 253
const rawLenMax = 0xFDn

/**
 * Note: length(symbol) <= 253n
 *
 * @param {Vec} symbol
 * @returns {Id}
 */
export const rawId = symbol => {
    const { length, uint } = unpack(symbol)
    return asNominal(rawPrefix | uint | (1n << length))
}

/** @type {(v: Id) => boolean} */
export const isRaw = v =>
    asBase(v) >> rawPrefixOffset === 1n

/** @type {(a: Id) => Vec} */
const toRaw = a => {
    if (!isRaw(a)) {
        return literal3ToVec(asBase(a))
    }
    const raw = asBase(a) ^ rawPrefix
    const len = log2(raw)
    return vec(len)(raw ^ (1n << len))
}

const hashPrefixOffset = 0xFFn

const hashPrefix = 1n << hashPrefixOffset

assertEq(
    hashPrefix,
//    0                 1                 2                 3
//    01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF
    0x80000000_00000000_00000000_00000000_00000000_00000000_00000000_00000000n
)

/** @type {(v: Id) => boolean} */
export const isHash = v =>
    asBase(v) >> hashPrefixOffset === 1n

/**
 * Note: we don't need to remove the prefix bits from the hash because
 * the prefix equals the prefix mask (`1n << 0xFFn`).
 *
 * @param {bigint} hash
 * @returns {Id}
 */
export const hashId = hash =>
    asNominal(hashPrefix | hash)

const hash2 = base32.compress(iv)

const vecX20 = vec(0x20n)

const { concat, listToVec } = msb

/** @type {(a: Id, b: Id) => Id} */
const hashMerge = (a, b) =>
    hashId(uint(listToVec(hash2((asBase(a) << 0x100n) | asBase(b)).map(vecX20))))

/** @type {(a: Id, b: Id) => Id} */
export const compress = (a, b) => {
    if (isHash(a) || isHash(b)) {
        return hashMerge(a, b)
    }
    const ra = toRaw(a)
    const rb = toRaw(b)
    const len = length(ra) + length(rb)
    if (len > rawLenMax) {
        return hashMerge(a, b)
    }
    return rawId(concat(ra)(rb))
}
