import { assertEq } from '../asserts/module.f.ts'
import { empty, vec, repeat, vec8, type Vec } from "../types/bit_vec/module.f.ts"
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
    // `encode` is quadratic in the input size, not linear: `baseN`'s
    // `vecToString` (`fs/base_n/module.f.ts`) pops one 6-bit chunk off the
    // front at a time via `popFront`, and each `popFront` re-masks the entire
    // remaining bigint through `vec()`'s `m & ui` — O(remaining length) — so
    // encoding a vector of `n` bits costs O(n²) instead of the O(n log n) the
    // balanced `chunkList` helper already achieves for the equivalent
    // byte-unpacking direction (`u8List`, used by `cas_get`'s streaming type
    // detector) and for concatenation (`msb.concat` / `unpackListToVec`,
    // optimized in PR #1192).
    //
    // This single call takes ~5.6s on Node and ~18.4s on Bun (Bun's `bigint`
    // has a much higher per-operation constant, see `fs/types/bigint/todo` /
    // PR #1190) for a 90,000-byte input — the same 720,000-bit vector that
    // made `cas_get content:true` on a comparably-sized binary blob time out
    // under `bun test`'s 5s per-test limit in CI (PR #1201). Not a correctness
    // bug — `encode` still returns the right answer — so this test only
    // exercises the call and lets the test runner's own per-test timing
    // report the cost; it intentionally has no timing assertion, since the
    // duration is many seconds and varies by engine/machine.
    encodeLargeVecIsSlow: () => {
        const big = repeat(90_000n)(vec8(0xffn))
        const result = encode(big)
        assertEq(result?.length, 120_000)
    },
}
