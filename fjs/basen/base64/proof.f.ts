import { assertEq } from '../../asserts/module.f.ts'
import { empty, vec, repeat, vec8, maxLength, type Vec } from "../../types/bit_vec/module.f.ts"
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
    decodePaddedTailRejections: () => {
        // These all take the padded branch of `decode` (`padChars > 0`,
        // i.e. the `head`/`lastChunk` split), unlike `decodeOverflow` above
        // which takes the unpadded fast path. An invalid character before
        // the final char must be rejected via the `head` decode...
        assertEq(decode('!A=='), null)
        // ...and an invalid final character (the one holding the padding
        // bits) must be rejected via the last-character decode.
        assertEq(decode('A!=='), null)
        // Same as `decodeOverflow`, but with a padded tail so it's the
        // padded branch that measures the result against `maxLength` and
        // rejects it.
        assertEq(decode('A'.repeat(174_764) + '='), null)
    },
    encodeAtMaxLengthSucceeds: () => {
        // A `maxLength`-sized vector's trailing partial 6-bit chunk is
        // left-padded by `vecToString` itself (see `baseN`), so `encode`
        // never needs to build an over-`maxLength` intermediate and must not
        // reject this boundary input.
        assertEq(encode(vec(maxLength)(0n)), 'A'.repeat(174_763) + '=')
    },
    decodeAtMaxLengthSucceeds: () => {
        // Companion to `encodeAtMaxLengthSucceeds`: the encoded string's raw,
        // pre-trim bit count (1_048_578) is 2 over `maxLength` even though
        // the payload it decodes to is exactly `maxLength`. `decode` must
        // trim the last character's 2 zero-padding bits before — not after —
        // measuring the result against `maxLength`.
        check('A'.repeat(174_763) + '=', vec(maxLength)(0n))
    },
    // Regression guard: `encode` used to be quadratic in the input size, not
    // linear. `baseN`'s `vecToString` (`fjs/base_n/module.f.ts`) popped one
    // 6-bit chunk off the front at a time via `popFront`, and each `popFront`
    // re-masked the entire remaining bigint through `vec()`'s `m & ui` —
    // O(remaining length) — so encoding a vector of `n` bits cost O(n²). A
    // 90,000-byte input took ~5.6s on Node and ~18.4s on Bun (Bun's `bigint`
    // has a much higher per-operation constant, see PR #1190), reliably
    // blowing `bun test`'s 5s per-test timeout — the same class of failure
    // that hit `cas_get content:true` on a comparably-sized binary blob in CI
    // (PR #1201).
    //
    // Fixed by rewriting `vecToString` as a balanced recursive split
    // (`unpackToString`), mirroring the `chunkList`/`unpackChunkList`
    // divide-and-conquer already used by `u8List` and by concatenation
    // (`msb.concat` / `unpackListToVec`, PR #1192) — true O(n log n) now,
    // since each half is masked to its own length before recursing. The same
    // call now takes ~50ms on Node and ~225ms on Bun. No timing assertion
    // (duration varies by engine/machine) — this just exercises the call and
    // relies on the test runner's own per-test timing to catch a regression.
    encodeLargeVecIsSlow: () => {
        const big = repeat(90_000n)(vec8(0xffn))
        const result = encode(big)
        assertEq(result?.length, 120_000)
    },
}
