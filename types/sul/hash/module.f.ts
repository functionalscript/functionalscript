import { toArray } from '../../list/module.f.ts'
import {
    length,
    listToVec,
    msb,
    uint,
    uintChunkList,
    unpack,
    vec,
    type Vec
} from '../../bit_vec/module.f.ts'
import { assertEq } from '../../../dev/module.f.ts'
import { utf8 } from '../../../text/module.f.ts'
import { secp256r1, type Point2D } from '../../../crypto/secp/module.f.ts'
import { base32, type V8 } from '../../../crypto/sha2/module.f.ts'
import { identity } from '../../function/module.f.ts'
import { literal3ToVec } from '../level/literal/module.f.ts'
import { log2 } from '../../bigint/module.f.ts'

// 32 bytes = 256 bits.
//
//              0               1
//              0123456789ABCDEF0123456789ABCDEF
const ivSeed = "Synthetic Universal Language 001"

const utf8IvSeed = utf8(ivSeed)

const c = secp256r1

const ivUint: bigint = (c.mul(uint(utf8IvSeed))(c.g) as Point2D)[0]

// 64 hex = 256 bits = 32 bytes:
assertEq(
    ivUint,
//    0                 1                 2                 3
//    01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF
    0x325d5666_573eb118_f32191de_20d17f64_33392ba3_291ae46c_1474a5ed_a5383f25n
)

const iv = toArray(uintChunkList(msb)(32n)({ length: 256n, uint: ivUint })) as V8

/**
 * Note: no need to add a prefix.
 */
const level3Id: (v: bigint) => bigint = identity

const rawPrefix = 1n << 0xFEn

assertEq(
    rawPrefix,
//    0                 1                 2                 3
//    01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF
    0x40000000_00000000_00000000_00000000_00000000_00000000_00000000_00000000n
)

/**
 * Note: length(symbol) <= 253n
 *
 * @param symbol
 * @returns
 */
export const rawId = (symbol: Vec): bigint => {
    const { length, uint } = unpack(symbol)
    return rawPrefix | uint | (1n << length)
}

// 253
const rawLenMax = 0xFDn

const isRaw = (v: bigint) => v >> 0xFEn === 1n

const toRaw = (a: bigint): Vec => {
    if (!isRaw(a)) {
        return literal3ToVec(a)
    }
    const raw = a ^ rawPrefix
    const len = log2(raw)
    return vec(len)(raw ^ (1n << len))
}

export const hashPrefix = 1n << 0xFFn

assertEq(
    hashPrefix,
//    0                 1                 2                 3
//    01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF_01234567_89ABCDEF
    0x80000000_00000000_00000000_00000000_00000000_00000000_00000000_00000000n
)

const isHash = (v: bigint) => v >> 0xFFn === 1n

/**
 * Note: we don't need to remove the prefix bits from the hash because
 * the prefix equals the prefix mask (`1n << 0xFFn`).
 *
 * @param symbol
 * @returns
 */
const hashId = (hash: bigint): bigint =>
    hashPrefix | hash

const hash2 = base32.compress(iv)

const vecX20 = vec(0x20n)

const hashMerge = (a: bigint, b: bigint): bigint =>
    uint(listToVec(msb)(hash2((a << 0x100n) | b).map(vecX20)))

const { concat } = msb

export const compress = (a: bigint, b: bigint): bigint => {
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
