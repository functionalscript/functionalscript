## A byte-aligned vector type for data that is bytes

**Priority:** P4
**Status:** open

### Problem

A file, a zlib stream and a CAS shard hold bytes, and a `Vec` holds bits. So
every operation that takes a `Vec` as data rather than as a bit string refuses
one that is not whole bytes at run time, with `isWholeBytes` and the shared
`invalid buffer size` refusal in
[`../../../effects/node/module.f.mjs`](../../../effects/node/module.f.mjs):
`writeFile`, `writeBytes`, `writeExclusive` and `inflate` — and
`writeFromStream` and `fjs/cas`'s `write` through `writeBytes`. The refusal is
correct, but it is the type that admits the input in the first place.

### Proposal

A `Vec` whose length is a multiple of eight, distinct in the type from `Vec`,
built by the constructors that already only make whole bytes (`utf8`,
`u8ListToVec`, the host's `toVec`) and checked once where a bit string becomes
bytes. Operations on bytes would then take it, and the guards above would go.

### Tasks

- [ ] Decide the representation: a branded `Vec`, or a separate type.
- [ ] Move the byte operations onto it and drop their run-time guards.
