import { toArray, type List } from '../../../list/module.f.ts'
import type { StateScan } from '../../../function/operator/module.f.ts'
import { msb, uint, uintChunkList, unpack, vec, type Vec } from '../../../bit_vec/module.f.ts'
import type { Effect, Operation } from '../../../effects/module.f.ts'
import { assert, todo } from '../../../../dev/module.f.ts'
import { utf8 } from '../../../../text/module.f.ts'
import { secp256r1, type Point2D } from '../../../../crypto/secp/module.f.ts'
import { base32, type V8 } from '../../../../crypto/sha2/module.f.ts'

export type HashState = List<Vec>

export type HashLevel<T extends Operation> = {
    /**
     * Note: Currently we return an effect of a list of bit vectors.
     *       This way, we have to read the complete list into memory.
     *
     * TODO: Return an asynchronous (effect) list.
     *
     * @param v a symbol from the next level.
     * @returns
     */
    readonly decode: (v: Vec) => Effect<T, List<Vec>>
    readonly encode: StateScan<Vec, HashState, Vec|undefined>
}

// 32 bytes = 256 bits.
//
//              0               1
//              0123456789ABCDEF0123456789ABCDEF
const ivSeed = "Synthetic Universal Language 001"

const utf8IvSeed = utf8(ivSeed)

const c = secp256r1


// 0x325d5666573eb118f32191de20d17f6433392ba3291ae46c1474a5eda5383f25
const ivUint: bigint = (c.mul(uint(utf8IvSeed))(c.g) as Point2D)[0]

// 64 hex = 256 bits = 32 bytes:
//                  0               1               2               3
//                  0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF
assert(ivUint === 0x325d5666573eb118f32191de20d17f6433392ba3291ae46c1474a5eda5383f25n)

const iv = toArray(uintChunkList(msb)(32n)({ length: 256n, uint: ivUint })) as V8

const hash = base32.compress(iv)

const vecX100 = vec(0x100n)

const level3Id = vecX100

const rawPrefix = 1n << 254n

assert(rawPrefix ===
    0x4000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n)

/**
 * Note: length(symbol) <= 253n
 *
 * @param symbol
 * @returns
 */
const rawId = (symbol: Vec): Vec => {
    const { length, uint } = unpack(symbol)
    return vecX100(rawPrefix | uint | (1n << length))
}

const hashPrefix = 1n << 0xFFn

assert(hashPrefix ===
    0x8000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n)

/**
 * Note: we don't need to remove the prefix bits from the hash because
 * the prefix equals the prefix mask (`1n << 0xFFn`).
 *
 * @param symbol
 * @returns
 */
const hashId = (hash: Vec): Vec =>
    vecX100(hashPrefix | unpack(hash).uint)

export const hashLevel = <T extends Operation>(get: (hash: Vec) => Effect<T, Vec>): HashLevel<T> =>
    todo()
