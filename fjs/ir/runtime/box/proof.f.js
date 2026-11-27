/**
 * Proofs of the NaN box's constants: the values spelled out as Sergey's
 * README lays them out, and the patterns as `bigint` tests and IR terms.
 */

import { assert, assertEq } from '../../../asserts/module.f.js'
import { bitsOf } from '../../../types/number/module.f.js'
import { and, eq, equal, if_, n, true_ } from '../../module.f.js'
import {
    BLOCK, DYN_REF, EMPTY, EXP, FALSE, IR_STRING, KIND, NAN, NULL, REF_TAG, SCALAR, TAG2, TAG8, TRUE, UNDEFINED,
    blockTerm, isIrStringBits, isIrStringTerm, isNumberBits, isNumberTerm, isRefBits, isRefTerm,
} from './module.f.js'

/** Unsigned bits as the `i64` that the WebAssembly JavaScript API passes. @type {(b: bigint) => bigint} */
const i64 = b => b < 1n << 63n ? b : b - (1n << 64n)

export const proof = {
    // The values, spelled out: a change here is a change of the box's layout.
    values: () => {
        assertEq(EXP, 0x7FF0_0000_0000_0000n)
        assertEq(TAG8, 0x7FF0_0000_0000_00FFn)
        assertEq(TAG2, 0x7FF0_0000_0000_0003n)
        assertEq(SCALAR, 0x7FF0_0000_0000_0000n)
        assertEq(REF_TAG, 0xFFF0_0000_0000_0003n)
        assertEq(DYN_REF, 0x7FF0_0000_0000_0002n)
        assertEq(NAN, 0x7FF8_0000_0000_0000n)
        assertEq(FALSE, 0x7FF0_0000_0000_0010n)
        assertEq(TRUE, 0xFFF0_0000_0000_0010n)
        assertEq(UNDEFINED, 0x7FF0_0000_0000_0020n)
        assertEq(NULL, 0x7FF0_0000_0000_0030n)
        assertEq(EMPTY, 0x7FF0_0000_0000_0008n)
        assertEq(KIND, 0x000F_0000_0000_0000n)
        assertEq(IR_STRING, 0x7FF9_0000_0000_0002n)
        assertEq(BLOCK, 0xFFFF_FFF8n)
        // The one NaN is the NaN that FunctionalScript's numbers have.
        assertEq(bitsOf(NaN), NAN)
    },
    // Numbers, finite or not, against the other boxes, as an i64 or unsigned.
    isNumberBits: () => {
        assert(isNumberBits(bitsOf(1.5)))
        assert(isNumberBits(bitsOf(-0)))
        assert(isNumberBits(bitsOf(Infinity)))
        assert(isNumberBits(i64(bitsOf(-Infinity))))
        assert(isNumberBits(NAN))
        assert(!isNumberBits(UNDEFINED))
        assert(!isNumberBits(i64(TRUE)))
        assert(!isNumberBits(EMPTY))
        assert(!isNumberBits(DYN_REF | (6n << 48n)))
    },
    // A dynamic reference whatever its kind and handle; no scalar is one.
    isRefBits: () => {
        assert(isRefBits(DYN_REF))
        assert(isRefBits(i64(DYN_REF | (6n << 48n) | (5n << 2n))))
        assert(!isRefBits(UNDEFINED))
        assert(!isRefBits(TRUE))
        assert(!isRefBits(EMPTY))
        assert(!isRefBits(bitsOf(2)))
        // a long string in the IR heap is a reference too, whose kind nibble is 9 and whose low bits name its block
        assert(isRefBits(IR_STRING | 0x1_0010n))
        assertEq((IR_STRING | 0x1_0010n) & KIND, 9n << 48n)
        assertEq((IR_STRING | 0x1_0010n) & BLOCK, 0x1_0010n)
    },
    // A long string in the IR heap, as an i64 or unsigned; NaNVM's references and the scalars are none.
    isIrStringBits: () => {
        assert(isIrStringBits(IR_STRING | 0x1_0010n))
        assert(isIrStringBits(i64(IR_STRING | 0xFFFF_FFF8n)))
        assert(!isIrStringBits(DYN_REF | (4n << 48n) | (5n << 2n)))
        assert(!isIrStringBits(DYN_REF | (8n << 48n)))
        assert(!isIrStringBits(i64(TRUE)))
        assert(!isIrStringBits(0x7FF9_0000_0000_0000n))
    },
    // The IR terms test the same masks as the bigint tests.
    terms: () => {
        const b = n(1n)
        assert(equal(isRefTerm(b), eq(and(b, n(REF_TAG)), n(DYN_REF))))
        assert(equal(isNumberTerm(b), if_(eq(and(b, n(EXP)), n(EXP)), eq(and(b, n(TAG8)), n(EXP)), true_)))
        assert(equal(isIrStringTerm(b), eq(and(b, n(0x000F_0000_0000_0000n)), n(0x0009_0000_0000_0000n))))
        assert(equal(blockTerm(b), and(b, n(0xFFFF_FFF8n))))
    },
}
