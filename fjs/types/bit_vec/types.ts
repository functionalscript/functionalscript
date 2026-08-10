/**
 * Types for bit vectors normalized on the most-significant bit.
 *
 * @module
 */
import type { Sign } from '../function/compare/types.ts'
import type {
    Binary,
    Reduce as OpReduce,
} from '../function/operator/types.ts'
import type { List } from '../list/types.ts'
import type { Nominal } from '../nominal/types.ts'
import type { Nullable } from '../nullable/types.ts'

type _Revision =
    '1a23a4336197e6158b6936cad34e90d146cd84b9b40ff7ab75a17c6d79e31d89'

/**
 * A vector of bits represented as a signed `bigint`.
 */
export type Vec = Nominal<'bit_vec', _Revision, bigint>

/**
 * Structure describing the unpacked view of a vector.
 */
export type Unpacked = {
    readonly length: bigint
    readonly uint: bigint
}

export type _Norm = (len: bigint) => {
    readonly a: bigint
    readonly b: bigint
}

export type _NormOp = Binary<Unpacked, Unpacked, _Norm>

export type _UnpackConcat = (a: Unpacked) => (b: Unpacked) => Unpacked

export type Reduce = OpReduce<Vec>

export type PopFront<T> = (len: bigint) => (u: T) => readonly [bigint, T]

/**
 * Represents operations for handling bit vectors with a specific bit order.
 *
 * https://en.wikipedia.org/wiki/Bit_numbering
 */
export type BitOrder = {
    readonly front: (len: bigint) => (v: Vec) => bigint
    readonly removeFront: (len: bigint) => (v: Vec) => Vec
    readonly popFront: PopFront<Vec>
    readonly concat: Reduce
    readonly tryListToVec: (list: List<Vec>) => Nullable<Vec>
    readonly listToVec: (list: List<Vec>) => Vec
    readonly xor: Reduce
    readonly unpackPopFront: PopFront<Unpacked>
    readonly norm: _NormOp
    readonly cmp: (a: Vec) => (b: Vec) => Sign
    readonly unpackSplit: (len: bigint) => (u: Unpacked) => readonly [bigint, bigint]
    readonly unpackConcat: _UnpackConcat
    readonly startsWith: (prefix: Vec) => (v: Vec) => boolean
}
