# nanvm-harness

The walking skeleton of the [MVP](../nanvm-lib/todo/mvp-roadmap.md): it proves
that FunctionalScript source, compiled to Rust by `fjs compile`, builds against
[`nanvm-lib`](../nanvm-lib/README.md) and computes what the source means.

```
fixtures/<name>.mjs ──(npm run gen: fjs compile)──> gen.fixtures/<name>.rs ──(cargo test)──> JSON
```

[fjs-nanvm-integration](../todo/fjs-nanvm-integration.md) tracks what the
pipeline covers so far.

## What it runs

[`run(module, export, action)`](./src/lib.rs) evaluates a compiled module once,
selects one of its exports by name, reads it (`Action::Read`) or calls it with
`nanvm-lib` arguments (`Action::Call`), and renders that one value as JSON.
When there is none, `RunError` says why: the module or the call threw, the
export is absent, the value is not callable, or it has no JSON.

The tests in [`src/lib.rs`](./src/lib.rs) run every fixture on `nanvm-lib`'s
`Naive` VM. `cargo run -p nanvm-harness` runs one, `number`, and prints `42`.
There is no CLI.

## Layout

| Path                | What it is                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| `fixtures/*.mjs`    | Handwritten source: ordinary JavaScript modules, checked by `tsc`       |
| `gen.fixtures/*.rs` | Generated from `fixtures/` by `npm run gen`; never edit one by hand     |
| `src/lib.rs`        | `run`, the `fixtures` module that loads `gen.fixtures/`, and the tests  |
| `src/main.rs`       | The binary behind `cargo run`                                           |

`gen.fixtures/` follows the repository's
[naming rule for generated files](../CONTRIBUTING.md#naming-generated-files).

## Adding a fixture

1. Write `fixtures/<name>.mjs`, using only what `fjs compile` accepts; `gen`
   fails on anything else. A module that is only imported by another fixture,
   as `named-imports-math.mjs` is by `named-imports.mjs`, is compiled into its
   importer's Rust and needs neither step 2 nor step 3.
2. Add its compile to the `gen` script in [`package.json`](../package.json):
   `node ./fjs/module.mjs compile nanvm-harness/fixtures/<name>.mjs nanvm-harness/gen.fixtures/<rust_name>.rs`.
   `<rust_name>` is `<name>` with each `-` turned into `_`, since the file is a
   Rust module.
3. Add `pub mod <rust_name>;` to the `fixtures` module in `src/lib.rs`.
4. Run `npm run gen`, then add a test to `src/lib.rs`'s `tests` that checks
   what `run` answers.

Skip step 2 and no `.rs` is written — `npm run gen` starts by deleting every
generated file — so the `pub mod` line fails to build. Skip step 3 and the
file is generated but never compiled, so nothing fails. Commit
the fixture, its generated `.rs` and both edits; CI reruns `npm run gen` and
fails on any difference.

A test's expected JSON is what a JavaScript engine gives the same source.
Nothing checks that automatically, so check it by hand; this prints the
`default` export:

```bash
node --input-type=module -e 'import m from "./nanvm-harness/fixtures/<name>.mjs"; console.log(JSON.stringify(m))'
```

## Checks

The Rust rules are [nanvm-lib/AGENTS.md](../nanvm-lib/AGENTS.md)'s, which
cover the whole workspace. A change to a fixture, or to the compiler's Rust
output (`fjs/edag/rust`, `fjs/fsc/rust`), changes generated Rust without
touching a `.rs` file by hand: run `npm run gen`, then `cargo test`.
