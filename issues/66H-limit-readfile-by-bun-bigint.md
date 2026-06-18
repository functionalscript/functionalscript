# 66H-limit-readfile-by-bun-bigint. Limit ReadFile by Bun's bigint size constraint

**Priority:** P3
**Status:** closed

## Problem

Bun has a `bigint` size limitation of 1,048,576 bits (1024² bits) or 131,072 bytes (`0x20000`). This is the minimal limit across all runtime environments supported by FunctionalScript.

Reading large files via `ReadFile` effect can produce `Vec` (represented as `bigint`-based bit vectors) that exceed Bun's limits, causing operations to fail silently or with cryptic errors on Bun while working on Node/Deno.

This was discovered during proofs in `fs/types/bigint/proof.f.ts` where test cases are commented as "max for Bun (131_072 Bytes)".

## Solution

Implemented a limit on `ReadFile` that caps file size at 131,072 bytes (128 KiB) to ensure cross-runtime compatibility across Bun, Node, and Deno. The implementation:

1. **Constants**: Added `maxLength = 1_048_576n` to `fs/types/bigint/module.f.ts` (computed as `0x80000n << 1n` = 2^20 bits), and exported `maxLengthBytes = maxLength >> 3n` from `fs/types/bit_vec/module.f.ts` for convenience
2. **Node.js validation**: File size checked before reading via `stat()` to avoid loading oversized files into memory; uses `maxLengthBytes` constant (camelCase, consistent with FunctionalScript style)
3. **Virtual validation**: Vector length validated in bits against `maxLength` in the in-memory test interpreter
4. **Documentation**: `ReadFile` type JSDoc documents the 131,072 byte limit; `fs/types/bigint/README.md` updated with cross-reference
5. **Test coverage**: Added `withinLimit` test to verify small files work; `exceedsLimit` test validates the constant value and notes practical limitations on creating test vectors at the boundary

All existing proof files (ASN.1, bit_vec, bigint) remain below the limit. The implementation is verified by 1,853 passing tests.

## Related

- `fs/types/bigint/README.md` — documents the 1,048,575 bit (131,072 byte) Bun limit
- `fs/types/bigint/proof.f.ts:289, 301` — marks max Bun test cases
- `fs/asn.1/proof.f.ts:157` — comment about Bun's smaller bigint limit
