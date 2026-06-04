import { utf8 } from '../../text/module.f.ts'
import { empty, uint } from '../../types/bit_vec/module.f.ts'
import { computeSync, sha224, sha256 } from '../sha2/module.f.ts'
import { genesisNBits, genesisTarget, pow, targetFromNBits } from './module.f.ts'

const p256 = pow(sha256)
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

const expectThrow = (message: string) => (f: () => unknown) => {
    try {
        f()
        throw `expected ${message}`
    } catch (e) {
        if (e === `expected ${message}`) { throw e }
        if (e !== message) { throw e }
    }
}

export const proof = {
    targetFromNBits: {
        genesis: () => {
            if (targetFromNBits(genesisNBits) !== genesisTarget) { throw 'genesis target' }
        },
        block0HashWithinGenesisTarget: () => {
            if (block0Hash > genesisTarget) { throw 'block0 hash exceeds genesis target' }
        },
        exponent3: () => {
            if (targetFromNBits(0x030000ffn) !== 0xffn) { throw 'exponent 3' }
        },
        exponent2: () => {
            if (targetFromNBits(0x02008000n) !== 0x80n) { throw 'exponent 2' }
        },
        hardTargetOne: () => {
            if (targetFromNBits(hardNBits) !== 1n) { throw 'hard target' }
        },
        zero: () => {
            if (targetFromNBits(0n) !== 0n) { throw 'zero nBits' }
        },
        negative: () => {
            expectThrow('negative nBits')(() => targetFromNBits(0x01800001n))
        },
        negativeHighMantissa: () => {
            expectThrow('negative nBits')(() => targetFromNBits(0x22ffffffn))
        },
        overflowExponent: () => {
            expectThrow('overflow nBits')(() => targetFromNBits(0x23000001n))
        },
        exceeds256: () => {
            expectThrow('target exceeds 256 bits')(() => targetFromNBits(0x227fffffn))
        },
    },
    meets: {
        easy: () => {
            if (!p256.meets(easyNBits)(sample)) { throw 'easy nBits should pass' }
        },
        hard: () => {
            if (p256.meets(hardNBits)(sample)) { throw 'target 1 should fail' }
        },
        genesisFailsSample: () => {
            if (p256.meets(genesisNBits)(sample)) { throw 'genesis target too hard for sample' }
        },
        zeroTargetRejectsSample: () => {
            if (p256.meets(0n)(sample)) { throw 'non-zero hash vs zero target' }
        },
        hashLeqTarget: () => {
            const h = p256.hashInt(sample)
            const target = targetFromNBits(easyNBits)
            if (h > target) { throw 'hash above easy target' }
            if (!(h <= target)) { throw 'hash <= target' }
        },
    },
    hashInt: {
        sha256Sample: () => {
            const digest = computeSync(sha256)([sample])
            if (p256.hashInt(sample) !== uint(digest)) { throw 'sha256 sample' }
        },
        sha256Empty: () => {
            if (p256.hashInt(emptyData) !== sha256EmptyHash) { throw 'sha256 empty constant' }
            const digest = computeSync(sha256)([emptyData])
            if (p256.hashInt(emptyData) !== uint(digest)) { throw 'sha256 empty' }
        },
        sha224: () => {
            const digest = computeSync(sha224)([sample])
            if (p224.hashInt(sample) !== uint(digest)) { throw 'sha224' }
        },
        stable: () => {
            if (p256.hashInt(sample) !== p256.hashInt(sample)) { throw 'stable' }
        },
    },
    pow: {
        independentInstances: () => {
            const a = pow(sha256)
            const b = pow(sha256)
            if (a.hashInt(sample) !== b.hashInt(sample)) { throw 'hashInt' }
            if (a.meets(easyNBits)(sample) !== b.meets(easyNBits)(sample)) { throw 'meets' }
        },
    },
}
