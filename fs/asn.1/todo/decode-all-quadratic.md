## decode-all-quadratic. `decodeAll` is quadratic in both the bit vector and the result array

**Priority:** P4
**Status:** open
**Blocked by:** —

### Problem

`decodeAll` (`fs/asn.1/module.f.ts`) drains a bit vector by repeatedly
applying `step` until it's empty:

```ts
const decodeAll = <T>(step: (v: Vec) => readonly [T, Vec]) => (v: Vec): readonly T[] => {
    let result: readonly T[] = []
    while (length(v) !== 0n) {
        const [item, rest] = step(v)
        result = [...result, item]
        v = rest
    }
    return result
}
```

Backs `decodeSequence` / `decodeSet`. Two independent O(n) costs stack per
iteration:

1. `step` (→ `decodeRaw` → `lenDecode`/`tagDecode` → `pop(len)(v2)`) costs
   O(remaining `length(v)`) per call — same `popFront`/`vec()` masking shape
   as the `baseN.vecToString` bug fixed in PR #1202 and the `sha2.append` bug
   (`fs/crypto/sha2/todo.md`), just with variable-length ASN.1 fields instead
   of fixed-size chunks.
2. `result = [...result, item]` rebuilds the whole array every iteration —
   a plain JS quadratic-array-build, unrelated to `bit_vec`.

Total cost is O(n²) in the number of top-level elements of a SEQUENCE/SET,
where n = element count (not `Vec` bit length directly, since a `SEQUENCE OF`
with N similarly-sized elements shrinks `v` roughly linearly per step, same
as the popFront-loop shape elsewhere).

Unlike `sha2.append` and `vecToString`, this is currently **latent**: a repo
grep turned up no callers of `decodeSequence` / `decodeSet` / `decodeAll`
outside `fs/asn.1/module.f.ts` itself (not wired into `fs/crypto/sign` or
anywhere else yet). Filing this so it's known before someone decodes a
`SEQUENCE OF` with many elements (e.g. a certificate chain or a CRL's
revoked-certificate list) and hits it.

### Proposal

- For the `pop`/`Vec` side: same balanced-split approach as
  `baseN.vecToString` isn't a direct fit here (ASN.1 fields are
  variable-length TLVs, not fixed-size chunks), but `decodeAll` could at
  least avoid the O(n) `[...result, item]` rebuild by pushing into a mutable
  array and returning it read-only at the end, or by building a `List<T>` and
  converting once. The `pop`-per-field cost may be acceptable if this is only
  ever used for small SEQUENCEs (few certs, one TSTInfo) — worth confirming
  the expected element counts before investing in a bigger rewrite.

### Tasks

- [ ] Fix the `[...result, item]` quadratic array rebuild regardless of the
      `Vec`-side decision (cheap, no known downside).
- [ ] Decide whether the `pop`-per-field cost needs its own fix, or is
      acceptable given ASN.1 structures in this codebase's actual usage
      (RFC 3161 timestamp requests/responses) are small.
- [ ] If fixed, add a proof test with a `SEQUENCE OF` containing many
      elements, timed the same way as `fs/basen/base64/proof.f.ts`
      `encodeLargeVecIsSlow` (no timing assertion).

### Related

- `fs/base_n/module.f.ts` `vecToString` / `unpackToString` — the fixed
  sibling bug, PR #1202.
- `fs/crypto/sha2/todo.md` — the hot sibling bug (`append`).
