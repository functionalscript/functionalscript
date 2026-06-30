import { assertEq } from '../asserts/module.f.ts'
import { empty, vec, type Vec } from "../types/bit_vec/module.f.ts"
import { encode, decode } from "./module.f.ts"

const check = (s: string, v: Vec) => {
    assertEq(encode(v), s)
    assertEq(decode(s), v)
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
        assertEq(encode(vec(1n)(0n)), null)
        assertEq(encode(vec(6n)(0n)), null)
        assertEq(encode(vec(12n)(0n)), null)
    },
    invalidInput: () => {
        assertEq(decode('!'), null)
        assertEq(decode('A!AA'), null)
        assertEq(decode('A==='), null)
        assertEq(decode('A'), null)
        assertEq(decode('AA'), null)
        assertEq(decode('AAA'), null)
        assertEq(decode('=AAA'), null)
        // Non-zero padding bits must be rejected (RFC 4648 §3.5)
        assertEq(decode('AB=='), null)
        assertEq(decode('AAB='), null)
    },
    validPadding: () => {
        // "==" padding
        assertEq(decode('AA=='), vec(8n)(0n))
        // "=" padding
        assertEq(decode('AAA='), vec(16n)(0n))
        // No padding
        assertEq(decode('AAAA'), vec(24n)(0n))
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
    decodeOverflow: () => {
        // 174_764 base64 chars decode to 1_048_584 bits, 8 over `maxLength`;
        // `decode` should return `null` instead of throwing on (or hanging
        // while building) an oversized `bigint`.
        const oversized = 'A'.repeat(174_764)
        assertEq(decode(oversized), null)
    },
}
