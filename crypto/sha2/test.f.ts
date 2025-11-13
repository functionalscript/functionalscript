import { utf8 } from "../../text/module.f.ts";
import { empty, msb, uint, vec } from "../../types/bit_vec/module.f.ts"
import { flip } from "../../types/function/module.f.ts"
import { map } from '../../types/list/module.f.ts'
import { repeat } from "../../types/monoid/module.f.ts";
import {
    base32,
    base64,
    computeSync,
    type Sha2,
    sha224,
    sha256,
    sha384,
    sha512,
    sha512x224,
    sha512x256,
} from './module.f.ts'

const { concat: beConcat } = msb

const checkEmpty = ({ init, end, hashLength }: Sha2) => (x: bigint) => {
    const result = end(init)
    if (result !== vec(hashLength)(x)) { throw [result, x] }
}

// https://en.wikipedia.org/wiki/SHA-2#Test_vectors
//
// https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Secure-Hashing
export default {
    base: {
        b32: () => {
            const { fromV8, compress, chunkLength } = base32
            const e = 1n << (chunkLength - 1n)
            return {
                s256: () => {
                    const result = fromV8(compress(sha256.init.hash)(e))
                    const x = 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855n
                    if (result !== x) { throw [result.toString(16), x.toString(16)] }
                },
                s224: () => {
                    const result = fromV8(compress(sha224.init.hash)(e)) >> 32n
                    const x = 0xd14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42fn
                    if (result !== x) { throw [result, x] }
                },
            }
        },
        b64: () => {
            const { fromV8, compress, chunkLength } = base64
            const e = 1n << (chunkLength - 1n)
            return {
                s512: () => {
                    const result = fromV8(compress(sha512.init.hash)(e))
                    const x = 0xcf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3en
                    if (result !== x) { throw [result, x] }
                },
                s385: () => {
                    const result = fromV8(compress(sha384.init.hash)(e)) >> 128n
                    const x = 0x38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95bn
                    if (result !== x) { throw [result, x] }
                },
                s512x256: () => {
                    const result = fromV8(base64.compress(sha512x256.init.hash)(e)) >> 256n
                    const x = 0xc672b8d1ef56ed28ab87c3622c5114069bdd3ad7b8f9737498d0c01ecef0967an
                    if (result !== x) { throw [result, x] }
                },
                s512x224: () => {
                    const result = fromV8(compress(sha512x224.init.hash)(e)) >> 288n
                    const x = 0x6ed0dd02806fa89e25de060c19d3ac86cabb87d6a0ddd05c333b84f4n
                    if (result !== x) { throw [result, x] }
                },
            }
        }
    },
    sha2: {
        sha256: () => checkEmpty(sha256)(0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855n),
        sha224: () => checkEmpty(sha224)(0xd14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42fn),
        sha512: () => checkEmpty(sha512)(0xcf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3en),
        sha384: () => checkEmpty(sha384)(0x38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95bn),
        sha512x256: () => checkEmpty(sha512x256)(0xc672b8d1ef56ed28ab87c3622c5114069bdd3ad7b8f9737498d0c01ecef0967an),
        sha512x224: () => checkEmpty(sha512x224)(0x6ed0dd02806fa89e25de060c19d3ac86cabb87d6a0ddd05c333b84f4n),
    },
    utf8: [
        () => {
            const e = 0x730e109bd7a8a32b1cb9d9a09aa2325d2430587ddbc0c38bad911525n
            {
                const s = utf8("The quick brown fox jumps over the lazy dog")
                const h = computeSync(sha224)([s])
                if (uint(h) !== e) { throw h }
            }
            {
                const s = ['The', ' quick', ' brown', ' fox', ' jumps', ' over', ' the', ' lazy', ' dog']
                const h = computeSync(sha224)(map(utf8)(s))
                if (uint(h) !== e) { throw h }
            }
        },
        () => {
            const s = utf8("The quick brown fox jumps over the lazy dog.")
            const h = computeSync(sha224)([s])
            if (uint(h) !== 0x619cba8e8e05826e9b8c519c0a5c68f4fb653e8a3d8aa04bb2c8cd4cn) { throw h }
        },
        () => {
            const s = utf8("hello world")
            if (uint(s) !== 0x68656C6C_6F20776F_726C64n) { throw s }
            let state = sha256.init
            state = sha256.append(s)(state)
            const h = sha256.end(state)
            if (uint(h) !== 0xb94d27b9_934d3e08_a52e52d7_da7dabfa_c484efe3_7a5380ee_9088f7ac_e2efcde9n) { throw h }
        }
    ],
    fill: () => {
        const times = flip(repeat({ identity: empty, operation: beConcat }))(vec(32n)(0x31313131n))
        return {
            8: () => {
                const r = times(8n)
                let state = sha256.init
                state = sha256.append(r)(state)
                const h = uint(sha256.end(state))
                if (h >> 224n !== 0x8a83665fn) { throw h }
            },
            16: () => {
                const r = times(16n)
                let state = sha256.init
                state = sha256.append(r)(state)
                const h = sha256.end(state)
                if (uint(h) !== 0x3138bb9b_c78df27c_473ecfd1_410f7bd4_5ebac1f5_9cf3ff9c_fe4db77a_ab7aedd3n) { throw h }
            }
        }
    }
}
