## `decode` rejects valid, exactly-`maxLength`-sized input

**Priority:** P4
**Status:** open

### Problem

`base64.decode`'s fix (see Resolution below) leaves one related exposure
unaudited: `fjs/basen/cbase32/module.f.ts`'s `cBase32ToVec` builds its decoded `Vec`
the same way `base64.decode` used to — via `cBase32ToVec5x` (`baseN`'s
`stringToVec`), which accumulates the *entire* raw body before any padding is
stripped. cbase32's sentinel-bit padding differs from base64's zero-padding
in a way that makes this **worse**, not just "the same bug elsewhere":

- `vecToCBase32`'s `extraLen = 5n - len % 5n` always adds a padding block,
  even when `len % 5n === 0n` — in that case `extraLen` is a full 5-bit
  sentinel chunk, not a partial one. So a `maxLength`-sized payload can
  encode to a body that's up to 5 bits (not base64's fixed 2 or 4) over
  `maxLength` before trimming.
- `cBase32ToVec`'s trim isn't a fixed-width slice off one known character
  like base64's — it walks bit-by-bit from the end via `popBack1` looking
  for the sentinel `1` bit, so the trim point isn't known statically before
  decoding.

### Tasks

- [ ] Confirm whether `cBase32ToVec` actually rejects a legitimate
      `maxLength`-boundary payload today (mirror
      `decodeAtMaxLengthSucceeds`/`encodeAtMaxLengthSucceeds` in
      `fjs/basen/base64/proof.f.ts` for cbase32, using `fjs/basen/cbase32/proof.f.ts`).
- [ ] If confirmed, design a fix that never builds an intermediate `Vec`
      over `maxLength` while decoding — the sentinel scan makes base64's
      "decode the last character separately" approach not directly
      applicable, so this needs its own design pass before implementing.
- [ ] In practice cbase32 only decodes short, fixed-length CAS hashes
      (`fjs/cas/mcp/module.f.ts`), never `maxLength`-scale payloads, so this
      is lower priority than the base64 case was — downgrade further or
      close as irrelevant if no real call site can hit the boundary.

### Resolution (base64)

`base64.decode` (`fjs/basen/base64/module.f.ts`) now decodes every body character
but the last through `stringToVec` as before, then decodes and trims the
last character (which always holds the encoding's 2 or 4 zero-padding bits,
per RFC 4648 — padding never spans more than one base64 character)
separately, checking the combined length against `maxLength` only *after*
trimming. No intermediate `Vec` built while decoding is ever wider than the
final, post-trim result, so an exactly-`maxLength`-sized payload now decodes
instead of being rejected. See `decodeAtMaxLengthSucceeds` in
`fjs/basen/base64/proof.f.ts` and `addBase64AtLimitSucceeds` in
`fjs/cas/mcp/proof.f.ts` (flipped from `addBase64AtLimitIsError`).
