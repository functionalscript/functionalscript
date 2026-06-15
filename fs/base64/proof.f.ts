import { empty, vec, type Vec } from "../types/bit_vec/module.f.ts"
import { encode, decode } from "./module.f.ts"

const check = (s: string, v: Vec) => {
    const sr = encode(v)
    if (sr !== s) { throw ['encode', sr, s] }
    const vr = decode(s)
    if (vr !== v) { throw ['decode', vr, v] }
}

export const proof = {
    empty: () => {
        check('', empty)
    },
    oneByte: () => {
        // 0x00 → 0b00000000, padded to 12 bits → AA==
        check('AA==', vec(8n)(0b00000000n))
        // 0x48 'H' → 0b01001000 → SA==
        check('SA==', vec(8n)(0b01001000n))
        // 0xFF → 0b11111111, padded 12: 111111110000 → /w==
        check('/w==', vec(8n)(0b11111111n))
    },
    twoBytes: () => {
        // 0x0000 → AAAA with == stripped → 16 bits: AA==? No: 16 bits → 18 bits with 2 pad → 3 chars + =
        // 0b0000000000000000 padded 2 bits → 18 bits: 000000 000000 000000 → AAA=
        check('AAA=', vec(16n)(0n))
        // 0xFFFF → 0b1111111111111111 padded 2 bits → 111111 111111 111100 → //8=
        check('//8=', vec(16n)(0b1111111111111111n))
    },
    threeBytes: () => {
        // 24 bits, no padding
        check('AAAA', vec(24n)(0n))
        check('////', vec(24n)(0b111111111111111111111111n))
    },
    roundtrip: () => {
        // Various bit lengths
        check('AA==', vec(8n)(0n))
        check('AAA=', vec(16n)(0n))
        check('AAAA', vec(24n)(0n))
        // 32 bits
        check('AAAAAA==', vec(32n)(0n))
        // 40 bits (5 bytes: AAAA + AAA=)
        check('AAAAAAA=', vec(40n)(0n))
    },
    nonOctet: () => {
        // encode rejects bit vectors whose length is not a multiple of 8
        if (encode(vec(1n)(0n)) !== null) { throw '1-bit input should return null' }
        if (encode(vec(6n)(0n)) !== null) { throw '6-bit input should return null' }
        if (encode(vec(12n)(0n)) !== null) { throw '12-bit input should return null' }
    },
    invalidInput: () => {
        if (decode('!') !== null) { throw 'invalid char should return null' }
        if (decode('A!AA') !== null) { throw 'invalid char mid-string should return null' }
        if (decode('A===') !== null) { throw 'three equals signs should return null' }
        if (decode('A') !== null) { throw 'length 1 (not multiple of 4) should return null' }
        if (decode('AA') !== null) { throw 'length 2 (no padding) should return null' }
        if (decode('AAA') !== null) { throw 'length 3 (no padding) should return null' }
        if (decode('=AAA') !== null) { throw 'padding not at end should return null' }
        // Non-zero padding bits must be rejected (RFC 4648 §3.5)
        if (decode('AB==') !== null) { throw 'non-zero 4-pad-bit should return null' }
        if (decode('AAB=') !== null) { throw 'non-zero 2-pad-bit should return null' }
    },
    validPadding: () => {
        // "==" padding
        const v2 = decode('AA==')
        if (v2 !== vec(8n)(0n)) { throw ['AA== should decode to 8-bit zero', v2] }
        // "=" padding
        const v1 = decode('AAA=')
        if (v1 !== vec(16n)(0n)) { throw ['AAA= should decode to 16-bit zero', v1] }
        // No padding
        const v0 = decode('AAAA')
        if (v0 !== vec(24n)(0n)) { throw ['AAAA should decode to 24-bit zero', v0] }
    },
    knownVectors: () => {
        // RFC 4648 §10 test vectors (byte-aligned, treating bytes as 8-bit MSB vectors)
        // '' → ''
        check('', empty)
        // 0x66 ('f') → Zg==
        check('Zg==', vec(8n)(0x66n))
        // 0x66 0x6f ('fo') → Zm8=
        check('Zm8=', vec(16n)(0x666fn))
        // 0x66 0x6f 0x6f ('foo') → Zm9v
        check('Zm9v', vec(24n)(0x666f6fn))
    },
}
