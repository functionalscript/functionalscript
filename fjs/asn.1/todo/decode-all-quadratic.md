## decode-all-quadratic. `decodeAll` is quadratic in the bit vector

**Priority:** P4
**Status:** open
**Blocked by:** —

### Problem

`decodeAll` (`fjs/asn.1/module.f.mjs`) drains a bit vector by repeatedly
applying `step` until it's empty. It backs `decodeSequence` / `decodeSet` and
the arcs after the first byte of `decodeObjectIdentifier`. Two independent
O(n) costs stacked per iteration:

1. `step` (→ `decodeRaw` → `lenDecode`/`tagDecode` → `pop(len)(v2)`) costs
   O(remaining `length(v)`) per call: a `Vec` is one `bigint`, so every
   `popFront` shifts and masks the whole remaining vector — the same shape
   as the `baseN.vecToString` bug fixed in PR #1202 and the `sha2.append` bug
   (since fixed in `fjs/crypto/sha2/module.f.mjs`), just with variable-length
   ASN.1 fields instead of fixed-size chunks.
2. `result = [...result, item]` rebuilt the whole array every iteration — a
   plain JS quadratic array build, unrelated to `bit_vec`. **Fixed:**
   `decodeAll` now collects the items into a lazy `List` (`decodeList`) and
   converts it to an array once.

Total cost is O(n²) in the number of top-level elements of a SEQUENCE/SET.
The second cost was the smaller one. At `93ed6ba`, decoding a SEQUENCE of
small INTEGERs on Node took about 45 ms for 1,000 elements, 0.45 s for 4,000
and 8 s for 16,000. At `b4f3ae5`, the commit of
[#2480](https://github.com/functionalscript/functionalscript/pull/2480) that
fixed the array build, the 16,000-element case took about 7 s, so the `pop`
cost is what remains.

This is **latent**: nothing outside `fjs/asn.1` calls `decodeSequence` /
`decodeSet` yet (not `fjs/crypto/sign` or anything else), and an OBJECT
IDENTIFIER has a handful of arcs. Filing this so it's known before someone
decodes a `SEQUENCE OF` with many elements (e.g. a certificate chain or a
CRL's revoked-certificate list) and hits it.

### Proposal

The balanced-split approach of `baseN.vecToString` isn't a direct fit
(ASN.1 fields are variable-length TLVs, not fixed-size chunks, so the next
boundary is only known after the current header is read). Removing the `pop`
cost means not re-slicing the remaining `bigint` per field — for example,
unpacking the payload into bytes once and decoding TLVs over the bytes. That
is a rewrite of the decoder's `Vec`-based internals, worth doing only if the
expected element counts call for it.

### Tasks

- [x] Fix the `[...result, item]` quadratic array rebuild regardless of the
      `Vec`-side decision (cheap, no known downside).
- [ ] Decide whether the `pop`-per-field cost needs its own fix, or is
      acceptable given ASN.1 structures in this codebase's actual usage
      (RFC 3161 timestamp requests/responses) are small.
- [ ] If fixed, add a proof test with a `SEQUENCE OF` containing many
      elements, timed the same way as `fjs/basen/base64/proof.f.mjs`
      `encodeLargeVecIsSlow` (no timing assertion).

### Related

- `fjs/basen/module.f.mjs` `vecToString` / `unpackToString` — the fixed
  sibling bug, PR #1202.
- `fjs/crypto/sha2/module.f.mjs` — the hot sibling bug (`append`), since fixed:
  the per-chunk fold is hoisted out of the per-`append` path.
