## write-utf8-file-limit. `writeUtf8File` crashes on text over 128 KiB

**Priority:** P2
**Status:** wip

### Problem

`writeUtf8File(path, content)` encodes the whole text into one `Vec` with
`utf8`, and a `Vec` holds at most `maxLengthBytes` bytes (2^17,
[`fjs/types/bit_vec`](../../../types/bit_vec/module.f.mjs)). Past that, `utf8`
answers `null`, and the `unwrap` over it throws a bare `assertion failed`, as
a panic that escapes the effect's `IoChannel` and ends the process with no
message:

```sh
$ node -e "console.log('export default [' + Array.from({length: 5000}, (_, i) => i) + '];')" > a.f.js
$ fjs compile a.f.js a.rs
assertion failed
```

The same module compiles to `a.rs` at 4,500 elements and fails at 4,900, where
the generated text passes 128 KiB. Every output of `fjs compile` goes through
this write, so any program whose output is larger fails: a data module, and
above all the Rust the self-hosted `nanvm` crate is made of
([console-program](../../../../nanvm-lib/todo/console-program.md)), which is
megabytes. The read side has the same limit and reports it as a missing file
([large-source-file-not-found](../../../compiler/todo/large-source-file-not-found.md));
this is the write side, and worse, since it reports nothing.

### Proposal

Write the text in chunks, the way `readWholeBytes` reads a whole file in
chunks without the single-`Vec` cap: split `content` at code point boundaries
into pieces that encode to at most `maxLengthBytes`, and write them through one
open, as `writeExclusive` writes its chunks. A host then holds the file as it
holds any other, and a failure to write is an `IoChannel` error like every
other, never a panic.

Two things to settle in the first step:

- Which effect carries the chunks. `writeExclusive` fails with `EEXIST` where
  the name is taken, which `fjs compile` must not, since it overwrites its
  output; `writeFile` takes one `Vec`. Either a chunked `writeFile` is
  added next to them, or `writeUtf8File` is a sequence of `write` and
  `writeBytes` effects, the loop `writeLoop` already is.
- A split never lands inside a surrogate pair: the unit is the code point, so
  each chunk is well-formed UTF-8 on its own, and a lone surrogate in the
  text is refused as `utf8` refuses it today, as an `IoChannel` error rather
  than a panic.

### Tasks

- [ ] Reproduce in a proof: a text of `maxLengthBytes + 1` bytes written
      through the virtual runner and read back whole.
- [ ] Settle the effect that carries the chunks, and chunk at code point
      boundaries.
- [ ] `writeUtf8File` over the chunks, answering an `IoChannel` error, never a
      panic, for text it cannot encode.
- [ ] The Node runner and the virtual runner agree on a file written in
      several chunks.
- [ ] A `fjs compile` proof over an output past 128 KiB.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%, `npm run gen`.

### Related

- [mvp-roadmap](../../../../nanvm-lib/todo/mvp-roadmap.md) — the gap analysis
  this comes from.
- [large-source-file-not-found](../../../compiler/todo/large-source-file-not-found.md)
  — the same limit on the read side.
