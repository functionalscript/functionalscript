/**
 * The NaN box's constants, as
 * [Sergey's README](../../../../doc/sergey-shandar/nanvm/README.md) and
 * [nan-box-patterns.md](../../../../doc/sasha-gil/ir/nan-box-patterns.md)
 * lay it out: one JavaScript copy for Any's and String's IR modules, the
 * short-string helpers and the counting host. Each pattern comes as a
 * `bigint` test for hosts and as an IR term for modules. NaNVM's Rust side
 * (`abi.rs`, `abi/short.rs`) keeps its own copy. Proofs spell the values
 * out, so that they check these rather than repeat them.
 *
 * @module
 *
 * @import { Term } from '../../types.ts'
 */

import { and, eq, if_, n, true_ } from '../../module.f.js'

/** The exponent's bits: a float whose exponent is not all ones is finite. */
export const EXP = 0x7FF0_0000_0000_0000n

/** The bits that tell a non-finite number from the other scalars. */
export const TAG8 = 0x7FF0_0000_0000_00FFn

/** The low two tag bits with the exponent: non-finite scalars against references. */
export const TAG2 = 0x7FF0_0000_0000_0003n

/** The scalar family under {@link TAG2}: the exponent all ones, the low two bits clear. */
export const SCALAR = 0x7FF0_0000_0000_0000n

/** The mask and pattern of a dynamic reference. */
export const REF_TAG = 0xFFF0_0000_0000_0003n
export const DYN_REF = 0x7FF0_0000_0000_0002n

/** The one NaN that a number is boxed as. */
export const NAN = 0x7FF8_0000_0000_0000n

/** The NaN box of `false`. */
export const FALSE = 0x7FF0_0000_0000_0010n

/** The NaN box of `true`. */
export const TRUE = 0xFFF0_0000_0000_0010n

/** The NaN box of `undefined`. */
export const UNDEFINED = 0x7FF0_0000_0000_0020n

/** The NaN box of `null`. */
export const NULL = 0x7FF0_0000_0000_0030n

/** The NaN box of the empty string. */
export const EMPTY = 0x7FF0_0000_0000_0008n

/** All 64 bits: `b & U64` reads an `i64` as unsigned. */
const U64 = 0xFFFF_FFFF_FFFF_FFFFn

/** Whether bits, as an `i64` or as unsigned, are a number: finite, or non-finite with the number's tag. @type {(b: bigint) => boolean} */
export const isNumberBits = b => {
    const x = b & U64
    return (x & EXP) !== EXP || (x & TAG8) === EXP
}

/** Whether bits, as an `i64` or as unsigned, are a dynamic reference. @type {(b: bigint) => boolean} */
export const isRefBits = b => (b & U64 & REF_TAG) === DYN_REF

/** {@link isNumberBits} as an IR term over `u64` bits. @type {(b: Term) => Term} */
export const isNumberTerm = b => if_(eq(and(b, n(EXP)), n(EXP)), eq(and(b, n(TAG8)), n(EXP)), true_)

/** {@link isRefBits} as an IR term over `u64` bits. @type {(b: Term) => Term} */
export const isRefTerm = b => eq(and(b, n(REF_TAG)), n(DYN_REF))
