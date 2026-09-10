## A FunctionalScript inflater

**Priority:** P3
**Status:** open

### Problem

A loose Git object is one zlib stream ([RFC 1950](https://www.rfc-editor.org/rfc/rfc1950)
over [RFC 1951](https://www.rfc-editor.org/rfc/rfc1951)), and a packfile
holds one per object. The decoder for Git objects
([`todo/git-objects.md`](./git-objects.md)) is pure over the inflated
bytes, and today the inflating is the host's: `inflate` in
[`fjs/effects/node`](../fjs/effects/node/module.f.mjs) hands a `Vec` to
`node:zlib` and gets a `Vec` back, and
[`fjs/git/loose`](../fjs/git/loose/module.f.mjs) is the one caller.

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
- **The host.** Every other reader in `fjs/git` runs anywhere
  FunctionalScript runs, the virtual runner included, which answers
  `inflate` with `notImplemented`. A repository cannot be read under it.

### Proposal

A DEFLATE decoder in FunctionalScript, in the style of
[`fjs/asn.1`](../fjs/asn.1/module.f.mjs): length-framed and bit-level, a
hand-written decoder and not a grammar, since a grammar over the byte
alphabet reads delimiters and DEFLATE has none — the design's table in
`git-objects.md` says which side of that line each format falls on.

- Input a byte list, output a byte list, lazily where the format allows:
  stored blocks are copies, and the two Huffman block kinds need the
  32 KiB window and no more.
- The zlib wrapper (a two-byte header, an Adler-32 trailer) over it, and
  the Adler-32 check as its own small module.
- `fjs/git/loose` then reads through it, and the `inflate` operation
  stays, exported as it is, for a host that would rather spend the native
  decoder. They are not one type: the decoder is a pure
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

### Related

- [`todo/git-objects.md`](./git-objects.md), the design this serves, and
  its note on what a grammar does not do.
- `fjs/git/loose`, the module that would change.
