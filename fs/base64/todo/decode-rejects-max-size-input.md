## `decode` rejects valid, exactly-`maxLength`-sized input

**Priority:** P2
**Status:** open

### Problem

The `maxLength` cap added to `tryListToVec` (`fs/types/bit_vec/module.f.ts:301-369`)
is checked against the *raw* accumulated chunk length while `base_n`'s
`stringToVec` is still building the vector — before `base64.decode` has a
chance to strip the trailing zero-padding bits the encoding added to reach a
6-bit boundary. This makes `decode` reject input whose actual decoded payload
is exactly at the documented `maxLength` limit.

Concretely: 131,072 zero bytes is exactly `maxLengthBytes`
(`fs/types/bit_vec/module.f.ts:48`), the documented max payload size, and its
base64 form is `'A'.repeat(174_763) + '='` (verified: 131,072 bytes =
1,048,576 bits = `maxLength`; padded to a 6-bit boundary adds 2 bits →
1,048,578 bits → 174,763 base64 chars → one `=` to reach a multiple of 4).
`encode` itself now refuses to produce this string — its own padding-overflow
guard rejects any padded intermediate that would exceed `maxLength`, so
`encode(vec(maxLength)(...))` returns `null` — but the string is still valid
base64 that a caller (or another encoder) can hand to `decode` directly, and
`decode` must still handle it correctly — the bug described below.

`decode` of that string strips the one `=`, leaving a 174,763-char body, and
calls `stringToVec(body)`. That body decodes to 174,763 × 6 = 1,048,578 raw
bits — 2 over `maxLength` — so `tryListToVec` bails with `null` on the last
chunk, even though `decode` would have trimmed exactly those 2 padding bits
afterward to land back at `maxLength`. `decode` returns `null` for legitimate,
spec-sized input. (This is the same string surfaced in the existing
`decodeOverflow` proof test, except that test's input is *actually* over the
limit — `174_764` chars vs. the `174_763`-char boundary case here — so it
didn't catch this.)

This directly contradicts the documented capability: a maximally-sized
(128 KiB / `maxLengthBytes`) base64 payload — the same size CAS's inline
content limit is built around (`fs/cas/`'s 128 KiB inline limit, #1187/#1193)
— cannot be read back.

### Proposal

`decode` needs to know the final (post-trim) bit length before — or
independently of — the raw chunk-accumulation cap, so a payload that is
exactly at `maxLength` after trimming doesn't get measured against the
pre-trim raw length.

**Constraint that rules out the obvious fix:** `maxLength`
(`fs/types/bit_vec/module.f.ts:41-46`) is not an arbitrary logical limit —
its doc comment says it's set to stay under *Bun's actual `bigint` size
constraint*, the tightest limit across FunctionalScript's supported
runtimes. A `Vec` is a signed `bigint` (`fs/types/bit_vec/module.f.ts:36-39`),
so any intermediate value built while decoding — not just the final
returned `Vec` — is subject to that same runtime ceiling. This means
**loosening `tryListToVec`'s cap to admit a raw pre-trim length above
`maxLength` (e.g. `maxLength + slack`) is not a valid fix**, even though the
final trimmed result would be in range: `unpackListToVec`
(`fs/types/bit_vec/module.f.ts:319-374`) actually constructs that
over-`maxLength` intermediate `Unpacked`/`bigint` before any trimming
happens, so the fix would just move the crash from "`decode` returns `null`"
to "`decode` throws/hangs building an over-sized `bigint` on Bun" for
`maxLength`-boundary input — worse, not better. Any fix must guarantee no
single `bigint` involved in decoding ever exceeds `maxLength`, even
transiently.

Candidate approaches that respect that constraint (no design chosen yet):

- Mask off the known pad bits from the *last character* before building —
  i.e. decode all but the last chunk normally, then combine the last
  (partial) chunk pre-trimmed, so the accumulator never holds more than
  `maxLength` bits at any point, not just at the end.
- Compute the target length analytically up front
  (`body.length * 6n - removeBits`) and, when it lands exactly at
  `maxLength`, decode in a way that never forms the intermediate
  `maxLength + removeBits`-bit value — e.g. split `body` into a prefix that
  decodes to a `maxLength`-sized `Vec` and a separate last-chunk step that
  only ever contributes its post-trim bits.
- Avoid building a single `Vec` for the whole payload at all: have `decode`
  (and the `stringToVec` it's built on) return multiple `Vec` chunks — a
  `List<Vec>` — instead of one, each individually within `maxLength`, and
  push concatenation-into-one-`bigint` to whichever caller actually needs a
  single `Vec` (who then has to reckon with the same `maxLength` ceiling
  explicitly, rather than `decode` hiding a false promise that it always
  produces one). This is a bigger, more invasive change to `BaseN`'s and
  `base64`/`cbase32`'s public shape and needs its own design pass before
  starting.

### Tasks

- [ ] Pick a fix approach (see Proposal) that never constructs a `bigint`
      over `maxLength` at any intermediate step — confirm this explicitly
      before implementing, e.g. with a proof case using a real Bun run, not
      just Node.
- [ ] Fix `decode` in `fs/base64/module.f.ts` so exactly-`maxLength`-sized
      payloads round-trip.
- [ ] Add a proof case decoding a manually-constructed, exactly-`maxLength`-sized
      base64 string back to a `maxLength`-sized `Vec` (the boundary the existing
      `decodeOverflow` test in `fs/base64/proof.f.ts` doesn't cover). The string
      must be built without calling `encode` — `encode` now rejects this exact
      input (see Problem) — e.g. the direct char-arithmetic approach `base64OfA`
      in `fs/cas/mcp/proof.f.ts` already uses for the same boundary.
- [ ] Check `fs/cbase32/module.f.ts` for the same exposure — its sentinel-bit
      padding (`fs/cbase32/module.f.ts:37-38`) also adds bits before trimming,
      and cbase32 *always* emits a sentinel block even when aligned, so its
      boundary case differs from base64's and needs its own check.

### Related

- `fs/types/bit_vec/todo/u8-list-to-vec-call-sites.md` — related overflow
  handling work on the `tryU8ListToVec`/`u8ListToVec` consumers.
- `fs/cas/mcp/proof.f.ts`'s `addBase64AtLimitIsError` — the CAS-level proof
  case that currently documents this bug's failing behavior; flip it to a
  success assertion once this issue is fixed.
