## Apply a delta without a number a byte

**Priority:** P3
**Status:** open

### Problem

`tryApplyDelta` in [`../module.f.mjs`](../module.f.mjs) reads its base and delta
as dense arrays and builds its target as one, and a number in an array costs
about eight bytes of heap (measured over 20 000 byte values: about 156 KiB). So
[`packstore`](../../packstore/module.f.mjs) holds a delta chain to
`maxDeltaBytes`, 8 MiB, by the size its entries declare — about 64 MiB of heap for
the target, as much for the base, and the delta beside them. An object stored
whole is a list over the `Vec` chunks it inflated to, about a byte a byte, and has
no ceiling, so a delta is the one path that can be refused for its length, and an
object a repository holds as a delta against a base of a few MiB is.

Git has no such limit; it is what this layer can hold without asking a hostile
pack for gigabytes.

### Proposal

Keep the base and the target as the chunks the inflater makes (`Vec`s, a byte a
byte), and name a copy's bytes by slicing them: a copy instruction names an
offset and a size in the base, which is a few chunks, and an insert's bytes come
out of the delta. The delta's own instructions are read sequentially and are the
small part. The target is then built as chunks, and the same representation is
the base of the next link of a chain.

The ceiling goes when the representation does, or becomes a number about memory
and not about this representation.

### Tasks

- [ ] A base and a target as `Vec` chunks, with the copy and the insert on them,
      proven against `tryApplyDelta`'s results on the same deltas.
- [ ] `packstore` chains through it; `maxDeltaBytes` goes or is restated.
