## `append` joins the remainder and the new data into one `Vec`

**Priority:** P3
**Status:** open

### Problem

`append` in [`module.f.mjs`](../module.f.mjs) begins with
`concat(state.remainder)(v)`: the block fragment held from the last call,
joined to the whole of the new `Vec`, then chunked. A `Vec` holds 128 KiB
(`maxLength`, 1,048,576 bits, the bound every host honours), and `v` may be
exactly that long, so a state with a remainder of one byte and a `v` of
the full length asks for a `Vec` of 1,048,584 bits, which is over the
bound: on Bun the BigInt behind it throws `RangeError: BigInt generated
from this operation is too big` before any block is compressed. Both
inputs were valid; only the intermediate is not. A consumer that hashes a
long input in pieces of the full length, with anything in between, can
hit it.

### Proposal

What [`fjs/crypto/sha1`](../../sha1/module.f.mjs)'s `append` does: with
no remainder, chunk `v` as it is; with one, and `v` too short to complete
its block, join the two, which is short; otherwise complete the block as
one integer, `uint(remainder) << need | front(need)(v)`, compress it, and
chunk `removeFront(need)(v)` on its own. No `Vec` longer than the longer
input is built. `base`'s `append` is shared by every variant, so the
change is one place, and the proof is the sha1 proof's `remainderThenFull`
over `sha256`: one byte appended, then a `Vec` of `maxLength`, against the
same bytes as one list.

### Tasks

- [ ] `append` in `base` completes a held block as an integer rather than
      joining the two `Vec`s.
- [ ] A proof with a remainder and then a full-length `Vec`, for one
      variant of each word size.

### Related

- [`fjs/crypto/sha1`](../../sha1/module.f.mjs) — the same framing, with
  the fix.
