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
(`fs/types/bit_vec/module.f.ts:48`), the documented max payload size.
`encode` of that input produces `'A'.repeat(174_763) + '='` (verified: 131,072
bytes = 1,048,576 bits = `maxLength`; padded to a 6-bit boundary adds 2 bits →
1,048,578 bits → 174,763 base64 chars → one `=` to reach a multiple of 4).

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
pre-trim raw length. Candidate approaches (no design chosen yet):

- Make the `tryListToVec` / `unpackListToVec` cap parameterizable per call, so
  `base64`/`cbase32` can pass `maxLength + (bits - 1)` slack (the maximum
  padding any single partial trailing chunk can add) and let the caller
  validate/trim the *final* length itself.
- Have `decode` mask off the known pad bits from the last character *before*
  building (so the builder never sees more than `maxLength` raw bits), rather
  than building first and trimming after.
- Compute the target length analytically up front
  (`body.length * 6n - removeBits`) and special-case the build when that
  target lands exactly at `maxLength` with the raw length one chunk-width
  over.

### Tasks

- [ ] Pick a fix approach (see Proposal) and confirm it doesn't reopen the
      silent-overflow gap tracked in `encode-padding-overflow.md`.
- [ ] Fix `decode` in `fs/base64/module.f.ts` so exactly-`maxLength`-sized
      payloads round-trip.
- [ ] Add a proof case: `decode(encode(vec(maxLength)(...)))` round-trips for
      an exactly-`maxLength`-sized vector (the boundary the existing
      `decodeOverflow` test in `fs/base64/proof.f.ts` doesn't cover).
- [ ] Check `fs/cbase32/module.f.ts` for the same exposure — its sentinel-bit
      padding (`fs/cbase32/module.f.ts:37-38`) also adds bits before trimming,
      and cbase32 *always* emits a sentinel block even when aligned, so its
      boundary case differs from base64's and needs its own check.

### Related

- `fs/base64/todo/encode-padding-overflow.md` — the opposite-direction gap:
  `encode` has no `maxLength` check at all on the padded output.
- `fs/types/bit_vec/todo/u8-list-to-vec-call-sites.md` — related overflow
  handling work on the `tryU8ListToVec`/`u8ListToVec` consumers.
