## Write each sample's marked Rust when the site is built, not into Git

**Priority:** P4
**Status:** open

### Problem

A WASM demo page draws its sample's Rust coloured from
`nanvm/demos/gen.samples/<name>.rs.marked`: the same runs as the committed
`<name>.rs`, each word's kind in a tag
([`text/marked`](../../../text/marked/README.md)'s `toTagged`).
[`generate`](../module.f.mjs) writes both files from one compile, and both are
committed, so `npm run gen` and CI's drift check keep them fresh.

The marked files are read by the page alone. Committing them doubles the
generated Rust in the tree, about 176K for 40 samples today, and every
change to the Rust printer or a sample shows up twice in a diff. The WAT the
same pages show takes the other path: the deploy's build script writes each
sample's `.wat.marked` into the ignored `nanvm/demos/wasm/`
([`publish`](../publish/module.f.mjs)), and nothing of it is committed.

### Proposal

Write the marked Rust where the WAT is written, when the site is built:

- `generate` writes only `<name>.rs`, as it did before the marked files, so
  the committed tree holds what `cargo` builds and nothing else.
- The deploy writes each sample's `<name>.rs.marked` into
  `nanvm/demos/wasm/`, beside its `.wat.marked`. The build script,
  `gen.build.sh`, already runs one FunctionalScript step there, `publish`; the
  marked Rust can join it or be a step of its own beside it. It compiles each
  listed sample once through `_compileMarked(noRuntime)`, as `generate` does.
- The page fetches the Rust from the build directory, as it fetches the WAT:
  `rustMarkedPath` names a file under `buildDirectory`.
- A local website build already runs `./dev.sh sh ./nanvm/demos/gen.build.sh`
  first ([`../README.md`](../README.md)), so it gets the files the same way.

Before building it, check:

- **The deploy's time.** Compiling every sample is the cost `npm run gen`
  pays today; the deploy would pay it once more. Measure it on the deploy's
  image before choosing.
- **What proves the marked files.** Today the generate proof holds a marked
  file to its `.rs`, and the drift check holds the committed pair to the
  sources. A build artifact has no drift check, so the proof of whatever
  writes it carries that alone, as `publish`'s proof does for the WAT.

The committed `.rs` stays out of scope: `cargo test` builds the
`nanvm-demos` crate from it, and CI runs that without a deploy.

### Related

- [functionalscript/functionalscript#3563](https://github.com/functionalscript/functionalscript/pull/3563)
  committed the marked Rust; this issue was asked for in its review.
- [functionalscript/functionalscript#3561](https://github.com/functionalscript/functionalscript/pull/3561)
  wrote the WAT's marked file at build time, the path proposed here.
