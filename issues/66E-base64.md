# 66E-base64. Implement base64 encoding/decoding

**Priority:** P2
**Status:** done

## Problem

FunctionalScript has no base64 implementation. Base64 is the standard
binary-to-text encoding used by MCP and most web protocols. Without it we
cannot represent arbitrary binary content in MCP tool results without reaching
for the project-specific cBase32 encoding, which is not understood by external
tools or LLMs.

## Proposal

New module `fs/base64/module.f.ts` exporting:

- `encode: (input: Vec) => string` — encodes a bit vector to a standard base64
  string (RFC 4648, `A–Z a–z 0–9 + /`, `=` padding).
- `decode: (input: string) => Vec | null` — decodes a base64 string back to a
  bit vector; returns `null` on invalid input.

Keep the alphabet and padding handling pure and table-driven so the codec is
easy to audit. Export from `fs/base64/module.f.ts`; proof in
`fs/base64/proof.f.ts`.

## Tasks

- [x] Add `fs/base64/module.f.ts` with `encode` and `decode`
- [x] Add `fs/base64/proof.f.ts` with round-trip tests and edge cases
      (empty input, single byte, two bytes, padding variants `==` / `=`, invalid
      characters, wrong padding length)

## Related

- [i66E-cas-mcp-base64-content](./66E-cas-mcp-base64-content.md) — uses this
  module to encode CAS MCP file content
- `fs/cbase32/module.f.ts` — existing binary-to-text codec; hashes stay cBase32
