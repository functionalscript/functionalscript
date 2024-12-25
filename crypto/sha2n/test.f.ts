import { compress32, compress64, sha224, sha256, sha384, sha512, sha512x224, sha512x256, type V16, type V8 } from './module.f.ts'

const empty32: V16 = [0x8000_0000n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]

const empty64: V16 = [0x8000_0000_0000_0000n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]

const f32 = (a: V8) => a.reduce((p, v) => (p << 32n) | v)

const f64 = (a: V8) => a.reduce((p, v) => (p << 64n) | v)

// https://en.wikipedia.org/wiki/SHA-2#Test_vectors
export default {
    s224: () => {
        const result = f32(compress32(sha224)(empty32)) >> 32n
        const x = 0xd14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42fn
        if(result !== x) { throw [result, x] }
    },
    s256: () => {
        const result = f32(compress32(sha256)(empty32))
        const x = 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855n
        if(result !== x) { throw [result, x] }
    },
    s385: () => {
        const result = f64(compress64(sha384)(empty64)) >> 128n
        const x = 0x38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95bn
        if(result !== x) { throw [result, x] }
    },
    s512: () => {
        const result = f64(compress64(sha512)(empty64))
        const x = 0xcf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3en
        if(result !== x) { throw [result, x] }
    },
    s512x224: () => {
        const result = f64(compress64(sha512x224)(empty64)) >> 288n
        const x = 0x6ed0dd02806fa89e25de060c19d3ac86cabb87d6a0ddd05c333b84f4n
        if(result !== x) { throw [result, x] }
    },
    s512x256: () => {
        const result = f64(compress64(sha512x256)(empty64)) >> 256n
        const x = 0xc672b8d1ef56ed28ab87c3622c5114069bdd3ad7b8f9737498d0c01ecef0967an
        if(result !== x) { throw [result, x] }
    },
}
