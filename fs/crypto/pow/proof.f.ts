import { utf8 } from '../../text/module.f.ts'
import { empty, uint } from '../../types/bit_vec/module.f.ts'
import { computeSync, sha224, sha256 } from '../sha2/module.f.ts'
import { bitcoinPow, genesisNBits, genesisTarget, pow, sha256Pow, targetFromNBits } from './module.f.ts'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.ts'

const p256 = sha256Pow
const p224 = pow(sha224)
const sample = utf8('functionalscript pow proof')
const emptyData = empty

/** Target large enough for {@link sample} under SHA-256 (`0x207fffff`). */
const easyNBits = 0x207fffffn

/** Compact encoding for target `1` (`0x03000001`). */
const hardNBits = 0x03000001n

/** SHA-256 of the empty message (NIST / Bitcoin block merkle uses this primitive). */
const sha256EmptyHash =
    0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855n

/** Bitcoin block #0 header hash as big-endian uint256. */
const block0Hash =
    0x000000000019d6689c085ae165831e934ff763ae46a2a6cffb388491c27dc990n

const expectNull = (nBits: bigint) => {
    assertEq(targetFromNBits(nBits), null, nBits)
}

export const proof = {
    targetFromNBits: {
        genesis: () => {
            assertEq(targetFromNBits(genesisNBits), genesisTarget, 'genesis target')
        },
        block0HashWithinGenesisTarget: () => {
            assert(!(block0Hash > genesisTarget), 'block0 hash exceeds genesis target')
        },
        exponent3: () => {
            assertEq(targetFromNBits(0x030000ffn), 0xffn, 'exponent 3')
        },
        exponent2: () => {
            assertEq(targetFromNBits(0x02008000n), 0x80n, 'exponent 2')
        },
        hardTargetOne: () => {
            assertEq(targetFromNBits(hardNBits), 1n, 'hard target')
        },
        zero: () => {
            assertEq(targetFromNBits(0n), 0n, 'zero nBits')
        },
        negative: () => {
            expectNull(0x01800001n)
        },
        negativeHighMantissa: () => {
            expectNull(0x22ffffffn)
        },
        overflowExponent: () => {
            expectNull(0x23000001n)
        },
        exceeds256: () => {
            expectNull(0x227fffffn)
        },
    },
    meets: {
        easy: () => {
            assert(p256.meets(easyNBits)(sample), 'easy nBits should pass')
        },
        hard: () => {
            assert(!(p256.meets(hardNBits)(sample)), 'target 1 should fail')
        },
        genesisFailsSample: () => {
            assert(!(p256.meets(genesisNBits)(sample)), 'genesis target too hard for sample')
        },
        zeroTargetRejectsSample: () => {
            assert(!(p256.meets(0n)(sample)), 'non-zero hash vs zero target')
        },
        invalidNBits: () => {
            assert(!(p256.meets(0x01800001n)(sample)), 'invalid nBits should not pass')
        },
        hashLeqTarget: () => {
            const h = p256.hashInt(sample)
            const target = assertNotNullish(targetFromNBits(easyNBits), 'easy nBits decode')
            assert(!(h > target), 'hash above easy target')
            assert(h <= target, 'hash <= target')
        },
    },
    hashInt: {
        sha256Sample: () => {
            const digest = computeSync(sha256)([sample])
            assertEq(p256.hashInt(sample), uint(digest), 'sha256 sample')
        },
        sha256Empty: () => {
            assertEq(p256.hashInt(emptyData), sha256EmptyHash, 'sha256 empty constant')
            const digest = computeSync(sha256)([emptyData])
            assertEq(p256.hashInt(emptyData), uint(digest), 'sha256 empty')
        },
        sha224: () => {
            const digest = computeSync(sha224)([sample])
            assertEq(p224.hashInt(sample), uint(digest), 'sha224')
        },
        stable: () => {
            assertEq(p256.hashInt(sample), p256.hashInt(sample), 'stable')
        },
    },
    pow: {
        sha256Pow: () => {
            const built = pow(sha256)
            assertEq(sha256Pow.hashInt(sample), built.hashInt(sample), 'hashInt')
            assertEq(sha256Pow.meets(easyNBits)(sample), built.meets(easyNBits)(sample), 'meets')
        },
        bitcoinPow: () => {
            assertEq(bitcoinPow.hashInt(sample), sha256Pow.hashInt(sample), 'bitcoinPow')
        },
        independentInstances: () => {
            const a = pow(sha256)
            const b = pow(sha256)
            assertEq(a.hashInt(sample), b.hashInt(sample), 'hashInt')
            assertEq(a.meets(easyNBits)(sample), b.meets(easyNBits)(sample), 'meets')
        },
    },
}
