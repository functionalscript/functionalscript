## one-fixture-list. A harness fixture is named in three places

**Priority:** P4
**Status:** open

### Problem

The set of harness fixtures is the directory `fixtures/`, and nothing reads
it as one. Adding a fixture means writing its name into three lists by
hand, in two languages and two spellings:

- `package.json`'s `gen` script: one `fjs compile
  nanvm-harness/fixtures/<name>.mjs nanvm-harness/gen.fixtures/<name>.rs`
  per fixture, about thirty of them, joined by `&&` into one line. The
  hyphen-to-underscore rename (`function-scope.mjs` →
  `function_scope.rs`) is done by hand in each pair.
- `src/lib.rs`'s `fixtures` module: one `pub mod <name>;` per fixture,
  under the single `#[path]` that names `gen.fixtures/`.
- `src/lib.rs`'s test module: one `use crate::fixtures::{…}` list naming
  every fixture again.

The first two lists are the same list twice, and both are copies of the
directory listing. [document-nanvm-harness](./document-nanvm-harness.md)
records what the copying already cost — two fixtures committed as
generated that no list named, so they were neither regenerated nor built —
and proposes to *document* the two edits. Documenting a manual
synchronisation makes it known, not unnecessary; the list still drifts.

The `gen` script is also the one place in the repository where a generator
is a shell chain rather than a program: every other output `npm run gen`
writes has an `.f.mjs` owner — `fjs/ci`, `fjs/nanvm/update`,
`fjs/media/datajs/vectors/matrix` — that `fjs run` invokes as one command,
and the fixture chain is longer than all of them together.

### Proposal

One generator owns the fixtures: an effectful program in
`fjs/nanvm/harness/module.f.mjs`, beside `fjs/nanvm/update`, in the same
thin shape. It walks `nanvm-harness/fixtures/` with `fjs/dev`'s `walk`,
compiles every `.mjs` there to `gen.fixtures/<snake>.rs` through the
compiler the `compile` command already calls, and writes a fourth output,
`gen.fixtures/mod.rs`, holding the `pub mod` line for each. `src/lib.rs`
keeps a single line:

```rust
#[path = "../gen.fixtures/mod.rs"]
pub mod fixtures;
```

and `package.json`'s `gen` runs it as one command, as it runs the others:

```
node ./fjs/module.mjs r ./fjs/nanvm/harness/module.f.mjs
```

The `.mjs` → `.rs` name rule (`-` → `_`) lives in the generator once, as
a pure export with a proof, instead of thirty times in the script. The
directory is then the list: a new fixture is one file, and the drift check
already fails when its outputs are not committed.

The test module's `use` list stays. It names what the tests reach for, not
what exists, and a module rarely uses every fixture.

`named-imports-math.mjs` is today a helper imported by `named-imports.mjs`
and not a fixture in either list. Compiling it too is the simpler rule —
the generator compiles what is in the directory — and costs one more small
`.rs`; a convention that excludes helpers (a subdirectory, say) is the
alternative if the extra output is unwanted.

### Tasks

- [ ] `fjs/nanvm/harness/module.f.mjs`: the name rule as a pure export with
      a proof; a `main` that walks the fixtures, compiles each, and writes
      `gen.fixtures/mod.rs`.
- [ ] `src/lib.rs`: replace the `pub mod` list with the one `#[path]` line.
- [ ] `package.json`: replace the compile chain with the one `fjs run`.
- [ ] `npm run gen`, `node --test`, `cargo test`: the committed
      `gen.fixtures/` regenerates byte-identical, plus `mod.rs`.

### Related

- [document-nanvm-harness](./document-nanvm-harness.md) — names the two
  manual edits this issue removes; its README task should then describe
  one edit, adding the file, not three.
- [`fjs/nanvm/update/module.f.mjs`](../../fjs/nanvm/update/module.f.mjs)
  — the generator shape to copy.
