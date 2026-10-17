## A FunctionalScript inflater

**Priority:** P3
**Status:** wip

### Problem

A loose Git object is one zlib stream ([RFC 1950](https://www.rfc-editor.org/rfc/rfc1950)
over [RFC 1951](https://www.rfc-editor.org/rfc/rfc1951)), and a packfile
holds one per object. The decoder for Git objects
([`fjs/git`](../fjs/git/README.md)) is pure over the inflated
bytes, and today the inflating is the host's: `inflate` in
[`fjs/effects/node`](../fjs/effects/node/module.f.mjs) hands a `Vec` to
`node:zlib` and gets a `Vec` back. Two modules call it:
[`fjs/git/loose`](../fjs/git/loose/module.f.mjs) for the one stream a loose
object is, and [`fjs/git/packstore`](../fjs/git/packstore/module.f.mjs) for each
entry of a pack — a base and every delta above it, one call per link of a chain.

That is the right first step and the wrong last one, for two reasons:

- **The bound.** A `Vec` holds 128 KiB, so a loose object that inflates to
  more is refused at the boundary, where a decoder over a byte list would
  read it as it is. The objects the design types as unbounded — a message,
  a blob — are exactly the ones that reach the bound. And the bound binds
  twice: the file goes in through `readFile` as a `Vec` too, so an object
  whose zlib stream is over 128 KiB is refused before it is inflated, even
  where its inflated bytes would fit — an incompressible blob near the
  bound is larger compressed than plain. A decoder fed a window at a time
  through `readBytes` lifts the input side as the byte list lifts the
  output side.

  A third place now holds the same ceiling on purpose:
  [`fjs/git/pack`](../fjs/git/pack/module.f.mjs)'s `tryApplyDelta` refuses a
  delta whose declared target is over 128 KiB. A delta is the one reader here
  whose *output* is not bounded by what the host handed it — a hundred bytes of
  copy instructions against a 64 KiB base can truthfully name 6.5 MB, which is
  arithmetic on the format rather than a measurement. What that costs is the
  measurement, and it is an order of magnitude more heap than bytes: at
  `fe723022` (a commit of #2026's branch) on node 22, 20,000 byte values held
  as a list of numbers cost about 156 KiB of heap, eight bytes per byte — so
  such an object is tens of megabytes live, and the build peaks well above it
  while it is joined. Without
  the ceiling the delta path would build objects the loose path beside it cannot
  read. So this issue lifts three bounds at once, and the delta's is the one
  that also wants a representation cheaper than a number per byte.
- **The host.** Every other reader in `fjs/git` runs anywhere
  FunctionalScript runs, the virtual runner included, which answers
  `inflate` with `notImplemented`. A repository cannot be read under it.

### Proposal

A DEFLATE decoder in FunctionalScript, in the style of
[`fjs/asn.1`](../fjs/asn.1/module.f.mjs): length-framed and bit-level, a
hand-written decoder and not a grammar, since a grammar over the byte
alphabet reads delimiters and DEFLATE has none — the table in
`fjs/git/README.md` says which side of that line each format falls on.

- Input a byte list, output a byte list, lazily where the format allows:
  stored blocks are copies, and the two Huffman block kinds need the
  32 KiB window and no more.
- The zlib wrapper (a two-byte header, an Adler-32 trailer) over it, and
  the Adler-32 check as its own small module.
- `fjs/git/loose` and `fjs/git/packstore` then read through it, and the
  `inflate` operation stays, exported as it is, for a host that would rather
  spend the native decoder. Both callers have to change together: changing one
  moves the bound off that path and leaves it on the other, and the other is
  the packed path, which is the one a real clone reads through. The decoder and
  the operation are not one type. The decoder is a pure
  `Bytes → Nullable<Bytes>`, refusing a malformed stream with `null` and
  nothing else, since it has no host to fail; the operation is
  `Vec → IoResult<Vec>` through `IoChannel`, where a malformed stream, a
  missing capability and the 128 KiB `Vec` bound are all the channel's
  errors. Neither replaces the other. `fjs/git/loose` is where they meet:
  its `tryRead` folds the operation's result through the channel today,
  and reading through the decoder is the same fold with the decoder's
  `null` mapped to the refusal the channel already carries for a stream
  that is no zlib, so a caller sees one error either way.

The inverse, a deflater, is not needed to read a repository and is not
part of this issue: a writer that must produce a stream can emit stored
blocks, which is a framing and not a compression.

### Design (proposed; the representation is the question for review)

**The bytes are `Vec` chunks, in and out.** A `Vec` is a bigint, about a byte
per byte, where a list of numbers is eight (the measurement above). One `Vec`
is the bound this issue lifts, but a *list* of them has none, and it is already
the shape the repository's byte consumers take: a hash is a `Fold<Vec, S>`
(`computeSync(hash)(list)` in [`fjs/crypto/sha2`](../fjs/crypto/sha2/module.f.mjs)),
the object reader parses `u8ListMsb(v)`, and `readBytes` hands back a `Vec` a
window at a time. Rejected: a `List<number>` per byte, for its cost; one `Vec`,
for its bound.

**A decoder is a machine fed chunks, as a hash is.** `init`, `append` of an
input chunk and `end`, in the shape of `sha2`, and not a function from a whole
input to a whole output:

- a lazy list of output chunks cannot report a stream that goes bad *after* it
  has yielded some, and a `null` for the whole answer would force the whole
  output to be held before any of it is read, which is the heap this avoids.
  `append` answers the output chunks it can now give and the next state, or
  `null` for a stream that is malformed, so the refusal comes where the bad
  byte is;
- the input is pushed a window at a time, as the host's `readBytes` gives it, so
  nothing asks for the whole compressed stream at once;
- `end` answers what is left of the last chunk once the stream has closed, and
  that is what removes the exact-window rule of
  [`fjs/git/packstore`](../fjs/git/packstore/module.f.mjs): the decoder knows
  where a stream ends, so a generous window is read to its end and the rest
  handed back, where `inflate` refuses the bytes after it.

**The 32 KiB window is a short reversed list and a few frozen arrays.** A
back-reference reads up to 32 KiB behind the output, and a persistent structure
cannot append to an array. The recent output is a reversed cons list, whose
append is constant, flushed into a frozen array of 4,096 bytes when it fills,
and only the arrays the window still reaches are kept. A reference to the
near past walks the list, and one further back indexes an array. A prototype in
plain JavaScript (not committed, and not FunctionalScript) decoded
4 MB of output with matches at 5.7 MB/s with the heap flat at 4 MB, so the
shape is workable; its speed is no promise for the FunctionalScript version,
which is measured in step 3.

**Where it lives.** `fjs/zlib/`: `adler32/` (this step), then `inflate/`.

### Tasks

- [x] The design above, for review; the representation is the decision.
- [x] [`fjs/zlib/adler32`](../fjs/zlib/adler32/module.f.mjs): the checksum that
      closes a stream, in the shape of a hash, with its proof against the
      trailer of Node's `zlib.deflateSync`.
- [ ] The zlib framing and the stored blocks; a malformed stream is `null`.
- [ ] Fixed and dynamic Huffman blocks with the 32 KiB window, proven against
      Node's `zlib` and the native decoder of `nanvm-effects-node` on corrupted
      streams, as that decoder was.
- [ ] `fjs/git/loose` and `fjs/git/packstore` read through it together, with
      `readBytes` windows in; lift the delta ceiling in `fjs/git/pack`.

### Related

- [`fjs/git/README.md`](../fjs/git/README.md), the design this serves,
  and its note on what a grammar does not do.
- `fjs/git/loose` and `fjs/git/packstore`, the two modules that would
  change.
