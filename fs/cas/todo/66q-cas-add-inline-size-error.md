## 66Q-cas-add-inline-size-error. Reject oversized `cas_add` inline content gracefully

**Priority:** P3
**Status:** open
**Blocked by:** —

### Problem

`cas_add` with `type: 'text'` or `type: 'base64'` resolves `content` into a single
`Vec`, which caps at `maxLength` bits (128 KiB). For content larger than that, there
is no graceful error: the failure happens *before* the `cas_add` handler can react,
inside the conversion step itself —

- `type: 'text'` → `utf8(content)` (`fs/text/module.f.ts`)
- `type: 'base64'` → `decode(content)` (`fs/base64/module.f.ts`)

Both build an over-`maxLength` `bigint`, which **`bun` throws on** (see the
`maxLength` notes in `fs/types/bigint/module.f.ts`). So a size guard placed in the
`cas_add` handler after the conversion (e.g. `if (bitVecLength(value) > maxLength)`)
is too late — `bun` has already failed in `utf8` / `decode`. On `node` the same input
does not throw and would instead be **silently stored** as an over-`maxLength` blob,
which then cannot be read back inline via `cas_get` `content: true`.

The MCP tool descriptions for `cas_add` and `cas_get` already document the 128 KiB
inline limit and steer callers to `type: 'url'` (no size limit), but the runtime
behaviour at the limit is inconsistent across runtimes and not a clean tool error.

### Proposal

Make the conversion functions report the size failure as data instead of throwing,
so the `cas_add` handler can turn it into a normal `isError` tool result that names
the byte size and points at `type: 'url'`.

1. **`fs/base64/module.f.ts` `decode`** — already returns `Nullable<Vec>`. Extend the
   contract so input that would exceed `maxLength` bits returns a distinguished error
   rather than throwing in `bun`. Either a dedicated error variant (preferred, so the
   handler can tell "too large" from "malformed base64") or, at minimum, a non-throwing
   `null`.
2. **`fs/text/module.f.ts` `utf8`** — currently returns `Utf8` (`Vec`) and cannot fail.
   Give it a fallible variant that returns a distinguished "too large" error when the
   encoded byte length would exceed `maxLength` bits, instead of building an
   over-`maxLength` `bigint` that throws in `bun`.
3. **`cas_add` handler (`fs/cas/mcp/module.f.ts`)** — on the "too large" error from
   either conversion, return `errorResult(...)` with a message naming the byte size and
   limit and pointing at `type: 'url'` (mirroring the existing oversized-blob guard in
   the `cas_get` `content: true` path).

Reuse the byte-aligned limit constants already exported from
`fs/types/bit_vec/module.f.ts` (`maxLength`, `maxLengthBytes`).

### Tasks

- [ ] Add a distinguished "too large" result to `fs/base64` `decode` (no throw in `bun`).
- [ ] Add a fallible `utf8` variant in `fs/text` that returns a "too large" error.
- [ ] Handle the "too large" error in the `cas_add` handler → `isError` result that
      names the size/limit and recommends `type: 'url'`.
- [ ] Add proof tests in `fs/cas/mcp/proof.f.ts`: inline `text` and `base64` content at
      `maxLengthBytes` (stored) and just above (clean `isError`, not a thrown crash and
      not a silently-stored over-`maxLength` blob).
- [ ] Confirm the documented inline limit in `fs/cas/mcp/README.md` and the `cas_add`
      tool description match the implemented behaviour.

### Related

- `fs/cas/mcp/module.f.ts` — `cas_add` handler and the `cas_get` `content: true`
  oversized-blob guard it should mirror.
- `fs/types/bigint/module.f.ts` — `maxLength` notes on `bun` throwing near the ceiling.
- `fs/cas/mcp/README.md` — documents the 128 KiB inline limit and the `type: 'url'`
  alternative.
