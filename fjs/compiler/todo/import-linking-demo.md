## Show import linking on the compiler's demo pages

**Priority:** P3
**Status:** open

### Problem

The [compiler's output demos](./output-demos.md) accept one module's source.
A program that imports another module is refused on every output of the
side-by-side page ([`../demo.f.mjs`](../demo.f.mjs)): its in-memory file system
holds only the input, so the compiler reports the dependency it cannot read.
The source and Rust stage demos refuse the same programs as unbound reads, and
the EDAG demo draws them as unresolved dependency reads.

So the pages cannot show what linking does, though it is one of the main
things FunctionalScript is meant to show: a module imported twice is one value,
shared in the output, as the root README's "Compiling a module" section
describes in prose. The import examples in the shared list
([`spec/modules`](../../../spec/modules/module.f.js)'s "An import" and "A named
import and a call") parse and lower, but no page can link them.

### Proposal

Let the side-by-side page compile a program of several files. Its in-memory
file system ([`fjs/effects/node/virtual`](../../effects/node/virtual/module.f.mjs)'s
`virtualAt`) already holds any number of files, and `_outputMarked` already
resolves imports through it, so no output logic changes.

What has to be decided is how a reader supplies the other files:

- **Fixed dependencies per example.** An example in the shared list carries
  its dependency files with it, and the page writes them beside the input. The
  reader edits the input only. Smallest change, and the proofs pin each
  example's output as they do now.
- **Editable files.** The page gets a text box, or a tab, per file, and the
  reader can add and edit them. More to learn from, and more interface and
  state.

The stage pages keep compiling one module: their stages run before
resolution.

### Tasks

- [ ] Decide between fixed and editable dependency files.
- [ ] Let an example in [`../examples/module.f.js`](../examples/module.f.js)
      carry its dependency files, and write them into the page's file system.
- [ ] Add an example that imports one module twice, so the linked outputs show
      it shared.
- [ ] Extend the side-by-side [`../proof.f.mjs`](../proof.f.mjs) table to the
      import examples.

### Related

- [Demo pages for the compiler's outputs](./output-demos.md) — the pages this
  extends; this question was one of its open questions.
- [`spec/modules`](../../../spec/modules/module.f.js) — the import examples.
