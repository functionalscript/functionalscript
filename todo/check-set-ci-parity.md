## Local check set misses CI's checks

**Priority:** P2
**Status:** open

### Problem

The checks a contributor is told to run before submitting are listed in three
places — [AGENTS.md](../AGENTS.md), [CONTRIBUTING.md](../CONTRIBUTING.md) and
[nanvm-lib/AGENTS.md](../nanvm-lib/AGENTS.md) — and all three are weaker than
what the generated [CI workflow](../.github/workflows/ci.yml) enforces. A pull
request that passes every documented check can still fail CI.

- **Clippy warnings.** Every list says `cargo clippy`. CI runs
  `cargo clippy -- -D warnings`, and a `--release` variant, on every platform
  job. Nothing in `Cargo.toml`, `.cargo/config.toml` or `nanvm-lib/src/lib.rs`
  denies warnings, so a warning exits zero locally and fails CI.
- **Proof coverage.** The `node26` job runs `npm run cov`, whose
  `package.json` script sets 100% line, branch and function thresholds over
  `**/module.f.mjs`. No list includes it, and `node --test` has no threshold,
  so a new uncovered branch passes locally and fails CI.
- **`node --test`.** AGENTS.md makes it mandatory before committing, pushing or
  opening a pull request. CONTRIBUTING.md's
  [Opening a pull request](../CONTRIBUTING.md#opening-a-pull-request) asks for
  "every check above", and the list above it — `tsc`, `npm test`, the cargo
  commands — does not contain it.
- **Generated Rust.** "`cargo test` — only if you touched Rust" misses Rust
  that `npm run gen` writes from FunctionalScript source: the
  `nanvm-harness/gen.fixtures/*.rs` modules `fjs/fsc/rust` compiles, and
  `nanvm-lib/tests/test/gen.corpus/` and `nanvm-lib/src/vm/lambda/gen.methods.rs` from `fjs/nanvm`. A change to either
  generator changes Rust without touching a `.rs` file by hand.
- **Which runner.** AGENTS.md's list starts with `fjs test`, and its §2 sets
  `fjs test` apart from the "published-CLI equivalents". CONTRIBUTING.md's
  runner table counts `fjs test` among the rows that "run a **published**
  FunctionalScript rather than this working tree's version".

### Proposal

One list, in one document, that matches what CI runs, with the other two
linking to it. What belongs on it, and whether a slow check such as
`npm run cov` is required or recommended locally, is the owner's decision.

### Tasks

- [ ] Choose the one document that owns the pre-submit check set and link the
      other two to it
- [ ] Spell Clippy as CI does, `cargo clippy -- -D warnings`
- [ ] Decide whether `npm run cov` is part of the local set, and say so
- [ ] Make `node --test` part of CONTRIBUTING.md's pull-request checklist, as
      AGENTS.md requires
- [ ] Say that a change to a Rust generator (`fjs/fsc/rust`, `fjs/nanvm`)
      needs `cargo test` after `npm run gen`
- [ ] Reconcile how AGENTS.md and CONTRIBUTING.md classify `fjs test`

### Related

- [contributor-doc-duplication](./contributor-doc-duplication.md) — the check
  set is one of the rules restated across documents; this is the copy that
  has already drifted
- [`fjs/ci/README.md`](../fjs/ci/README.md) — what the generated jobs run
- [strict-static-analysis](./strict-static-analysis.md) — adding checks to
  CI; each one added is another the local set has to name
