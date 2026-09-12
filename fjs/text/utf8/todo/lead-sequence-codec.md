## lead-sequence-codec. The lead-tag byte layout is re-derived at every site

**Priority:** P3
**Status:** open

### Problem

The header table in `module.f.mjs` claims encoder and decoder "both read
their bit patterns from this single set of definitions" — but only the
tag/mask *constants* are shared. The layout itself — shift by `6*k`, OR
the tag, emit `k` continuation bytes, and the inverse fold — is written
out at every site: eight emit sites in `codePointToUtf8` (`:118-163`),
three accumulate arms in `utf8ByteToCodePointOp` plus three in
`utf8StateToError` (`:195-260`). Two of many:

```js
// :126-130 (emit, 3-byte)
return [input >> 12 | lead3Tag, contByte(input >> 6), contByte(input)]
// :252-255 (accumulate, 3-byte)
((s0 & lead3Mask) << 12) + (contPayload(s1) << 6) + contPayload(byte)
```

These are two families — `emit(tag, mask, k)` and `accumulate(mask,
bytes)` — instantiated with hand-written shift counts that must agree
pairwise as exact inverses. A wrong shift or mask in any one is a silent
mis-decode, and the tree already carries the symptom, inert only by
luck: the one emit site whose mask was open-coded instead of named,

```js
// :120
return [input & 0b01111_1111]
```

is a **nine**-bit mask (`=== 255`), not the 7-bit `0b0111_1111` the
branch means; the guard above happens to bound `input` to `0..0x7f`, so
nothing catches it, and no proof pins that mask independently of the
guard. (`isLeadByte` at `:93` similarly open-codes a range two lines
after the named `contains` form the neighbouring modules use.)

### Proposal

Two private helpers beside the tag/mask table: a builder
`seq = (tag, mask, k) => value => […]` producing the lead byte
(`value >> 6*k & mask | tag`) followed by `k` `contByte(value >> 6*j)`
bytes, and its inverse `payload = mask => bytes => …` folding
`((b0 & mask) << 6*n) + Σ contPayload(bi) << 6*j`. The eight emit
returns become `seq` calls (the one-byte case becomes `seq(0, asciiMask,
0)`, which forces the mask to be named and fixes `:120`'s spelling), and
the six accumulate arms become `payload` calls plus the error flag.
Prove byte-identical output against the existing proof corpus first.

### Tasks

- [ ] Add `seq`/`payload`; rewrite the fourteen sites; name the 7-bit
      ASCII mask.
- [ ] Pin the ASCII mask in the proof independently of the range guard.
- [ ] `tsc`, `fjs test`.

### Related

- [error-tag-layout-constants.md](./error-tag-layout-constants.md) —
  names the error/partial-state *flag* addends; this names the
  shift/mask structure they are added to. Either order works.
