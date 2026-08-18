## proof-crockford-copy. `basen/proof.f.mjs` copies cbase32's alphabet and normalizer

**Priority:** P4
**Status:** open

### Problem

`fjs/basen/proof.f.mjs:7-15` re-declares the Crockford Base32 codec —
character-for-character the alphabet and fold table that
`fjs/basen/cbase32/module.f.mjs` owns:

```js
// fjs/basen/proof.f.mjs:7-15
const cb32 = baseN(5n, '0123456789abcdefghjkmnpqrstvwxyz', c => {
    const lower = c.toLowerCase()
    switch (lower) {
        case 'i': { return '1' }
        case 'l': { return '1' }
        case 'o': { return '0' }
        default: { return lower }
    }
})

// fjs/basen/cbase32/module.f.mjs:14, :21-29 — the owner
const m = '0123456789abcdefghjkmnpqrstvwxyz'
const normalizeChar = c => {
    const lower = c.toLowerCase()
    switch (lower) {
        case 'i': { return '1' }
        ...
```

The Crockford i/l→1, o→0 rule now has two definitions. If `cbase32` changes,
`basen`'s `normalizeHit`/`normalizeMiss` proofs keep silently testing the old
one and stay green.

### Proposal

Either direction works; pick one:

1. Export the codec parameters (`alphabet`, `normalizeChar`) from `cbase32`
   and build `basen/proof`'s `cb32` from the imports. Note the layering: a
   lower module's proof importing from a child package — acceptable for a
   proof, since `cbase32` already depends on `basen` only at runtime, not the
   reverse.
2. If that layering is unwanted: replace the copy with a deliberately
   synthetic normalizing alphabet (e.g. 4-bit with one fold rule) so the
   `basen` normalization proofs test the *mechanism* without mirroring a real
   codec's data.

Option 2 is simpler and keeps `basen`'s proof self-contained; the proof only
needs *a* normalizer, not Crockford's.

### Tasks

- [ ] Replace `basen/proof.f.mjs`'s `cb32` per one of the options above.
- [ ] `fjs t` — basen and cbase32 proofs pass.
