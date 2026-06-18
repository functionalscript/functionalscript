# 66H-limit-readfile-by-bun-bigint. Limit ReadFile by Bun's bigint size constraint

**Priority:** P3
**Status:** open

## Problem

Bun has a `bigint` size limitation of 1,048,575 bits (1024² bits) or 131,072 bytes. This is the minimal limit across all runtime environments supported by FunctionalScript.

Reading large files via `ReadFile` effect can produce `Vec` (represented as `bigint`-based bit vectors) that exceed Bun's limits, causing operations to fail silently or with cryptic errors on Bun while working on Node/Deno.

This was discovered during proofs in `fs/types/bigint/proof.f.ts` where test cases are commented as "max for Bun (131_072 Bytes)".

## Proposal

Implement a limit on `ReadFile` that caps file size at 131,072 bytes (128 KiB) to ensure cross-runtime compatibility. This should be:

1. Documented in the `ReadFile` type and module documentation
2. Enforced at the `readFile` function level or at the call site
3. Validated with tests that verify files exceeding the limit are rejected
4. Referenced in `fs/types/bigint/README.md` alongside the existing Bun limit documentation

## Tasks

- [ ] Document the 131,072 byte limit in `fs/effects/node/module.f.ts` (`ReadFile` type and `readFile` function JSDoc)
- [ ] Add validation to enforce the limit at file read time
- [ ] Create test cases verifying that files at the limit work and oversized files fail appropriately
- [ ] Update `fs/types/bigint/README.md` with cross-reference to this limit
- [ ] Verify no proof files or internal code reads files larger than 131,072 bytes

## Related

- `fs/types/bigint/README.md` — documents the 1,048,575 bit (131,072 byte) Bun limit
- `fs/types/bigint/proof.f.ts:289, 301` — marks max Bun test cases
- `fs/asn.1/proof.f.ts:157` — comment about Bun's smaller bigint limit
