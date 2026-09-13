## lead-sequence-codec. The lead-tag byte layout is re-derived at every site

**Priority:** P3
**Status:** open

### Problem

The header table in `module.f.mjs` claims encoder and decoder "both read
their bit patterns from this single set of definitions" — but only the
tag/mask *constants* are shared. The layout itself — shift by `6*k`, OR
the tag, emit `k` continuation bytes, and the inverse fold — is written
out at every site: several emit sites in `codePointToUtf8`, and several
accumulate arms each in `utf8ByteToCodePointOp` and `utf8StateToError`.
Two of many:

```js
// codePointToUtf8 (emit, 3-byte)
return [input >> 12 | lead3Tag, contByte(input >> 6), contByte(input)]
// utf8StateToError (accumulate, 3-byte)
((s0 & lead3Mask) << 12) + (contPayload(s1) << 6) + contPayload(byte)
```

These are two families — `emit(tag, mask, k)` and `accumulate(mask,
bytes)` — instantiated with hand-written shift counts that must agree
pairwise as exact inverses. A wrong shift or mask in any one is a silent
mis-decode, and the tree already carries the symptom, inert only by
luck: the one emit site whose mask was open-coded instead of named,

```js
// codePointToUtf8 (emit, 1-byte)
return [input & 0b01111_1111]
```

is written with nine digits but has **eight** one-bits — it is `255`,
an eight-bit mask with one excess payload bit — where the branch means
the seven-bit `0b0111_1111`. The guard above bounds `input` to `0..0x7f`, so the two
masks are indistinguishable through every public path — which is exactly
why no proof caught it, and why none can: the defect is unobservable by
construction. What the tree is missing is not a proof but a *name*, so
that the constant reads as what it means. (`isLeadByte` similarly
open-codes a range beside the named `contains` form the neighbouring
modules use.)

### Proposal

Two private helpers beside the tag/mask table: a builder
`seq = (tag, mask, k) => value => […]` producing the lead byte
(`value >> 6*k & mask | tag`) followed by `k` `contByte(value >> 6*j)`
bytes, and its inverse `payload = mask => bytes => …` folding
`((b0 & mask) << 6*n) + Σ contPayload(bi) << 6*j`. The emit returns
become `seq` calls (the one-byte case becomes `seq(0, asciiMask,
0)` with `asciiMask = 0b0111_1111` named in the tag/mask table, which is
where the one-byte spelling is corrected), and the accumulate arms become
`payload` calls plus the error flag. Both helpers stay private: the
existing proof corpus pins their output through the public codec, and
that is the proof this change owes — byte-identical encoding and decoding
before and after. The ASCII mask could be exported for linkage as
`_asciiMask` and pinned by the proof — the `_` prefix is exactly what
the repository permits that for — but this issue chooses not to: the
mask is unobservable through the codec, so a proof that the constant is
`0x7f` pins the spelling and nothing about the encoder, and a reader of
the module doc is better served by the correct name than by a row
asserting a literal equals itself. If a later change makes the mask
observable, that is when the row earns its place.

### Tasks

- [ ] Add `seq`/`payload` as private helpers; rewrite every site;
      name `asciiMask` at its correct 7-bit width.
- [ ] `tsc`, `fjs test` — the existing corpus is the byte-identity proof.

### Related

- [error-tag-layout-constants.md](./error-tag-layout-constants.md) —
  names the error/partial-state *flag* addends; this names the
  shift/mask structure they are added to. Either order works.
