## `utf8ToString` costs more than reading the file it decodes

**Priority:** P2
**Status:** open

### Problem

[`../module.f.mjs`](../module.f.mjs)'s `utf8ToString` is the slow half of
reading text through the effect system, by more than an order of magnitude over
the read itself. Measured on this repository's own `.f.mjs` files, node 22:

| | 100 files | per file |
| --- | --- | --- |
| `fs.readFile(path, 'utf8')` — native, for scale | 111 ms | ~1.1 ms |
| `readFile` operation, bytes to a `Vec` | 566 ms | ~5.7 ms |
| **`utf8ToString` on those `Vec`s** | **2,259 ms** | **~22.6 ms** |

The consequence is visible in a command: `npm run website` walks the tree and
reads every authored module, and it takes **42 s** where the plain-JavaScript
script it replaced took **1.65 s** (functionalscript#1827). Reading is 0.1 s of
that. Nothing else in the program is close.

**Concurrency is not the answer, and that is worth stating because it is the
first thing suggested.** The cost is CPU inside one decoder, not waiting on a
disk: fanning the reads out with `allOk` recovers approximately nothing, and it
would put back the concurrency the proof runners
[spent several PRs removing](../../emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost).

### Where it goes

`utf8ToString` is `codePointListToString(toCodePointList(u8List(msb)(msbV)))`:
a bit vector becomes a lazy byte list, the bytes become a code-point list
through a state machine one byte at a time, and the code points become a string.
Every byte of a 30 KB module travels that path as an individual `List` cell and
a state transition.

`fromCodePointList` — the encoding direction — is the same shape and is not
measured here; a fix probably wants to look at both.

### Proposal

Not decided. What a fix has to keep is the decoder's *behaviour*: the state
machine is what makes a malformed sequence an error value rather than a
replacement character, and `text/utf8`'s proofs pin that. Directions worth
measuring, cheapest first:

- **Chunk the traversal.** The list is walked one cell per byte; a decoder that
  reads a whole `Vec` word at a time does the same work with a fraction of the
  cells.
- **Build the string in blocks.** `codePointListToString` accumulates a string;
  joining an array of chunks is the usual FunctionalScript answer to that shape
  (catalog item 9's argument, applied to characters).
- **Let the host decode.** `readUtf8File` could hand bytes to a `TextDecoder`
  in `effects/node`'s impure shell. It is the smallest change and the least
  useful one: it fixes one operation on one host and leaves the pure decoder
  exactly as slow for everyone else.

Whatever is chosen, it is a change to `fjs/text` with its own proofs and its
own measurement, not something to fold into a caller.

### Tasks

- [ ] Measure where the time goes inside `toCodePointList` and
      `codePointListToString` separately, so the fix is aimed rather than
      guessed.
- [ ] Make the decoder fast enough that `npm run website` is not dominated by
      it, keeping every existing `text/utf8` proof green.
- [ ] Re-measure `npm run website` and record the number in
      [`../../website/module.f.mjs`](../../website/module.f.mjs)'s header, which
      names this issue today.

### Related

- functionalscript#1827 — where the cost surfaced: the website generator moved
  from `fs.readFile` to the `readFile` operation and the build went 1.65 s to
  42 s.
