## Separate nominal types for MSB and LSB bit vectors

**Priority:** P3
**Status:** open

### Problem

`fjs/types/bit_vec` has one vector type, `Vec`, and two bit orders over it:
`msb` and `lsb` are both a `BitOrder`, whose every operation takes and answers
`Vec`. So a vector built most-significant-bit first can be handed to an
`lsb` operation — `lsb.popFront`, `lsb.concat` — and the type checker says
nothing; the answer is simply the bits read in the other order.

### Proposal

Give each bit order its own nominal type, so `msb` operations take and answer
an MSB vector and `lsb` ones an LSB vector, and a conversion between them is
an explicit call. Operations that do not depend on the order (`length`, `vec`,
`empty`) stay over the common base.

### Tasks

- [ ] Decide the representation: two brands over the same `bigint`, or a
      common `Vec` with an order parameter.
- [ ] Retype `BitOrder`, `msb`, `lsb`, and their importers.

### Related

- [byte-aligned-vec.md](./byte-aligned-vec.md) — another type distinct from
  `Vec` over the same representation, facing the same "branded `Vec` or a
  separate type" decision.
