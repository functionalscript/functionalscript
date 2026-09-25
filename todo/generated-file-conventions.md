## Name generated files `gen.*` and check drift from scratch

**Priority:** P3
**Status:** open

### Problem

Generated files are mixed with handwritten sources, and their names do not
distinguish them. Most are not marked anywhere: `git check-attr` reports
`linguist-generated` unspecified for `fjs/edag/callable/table.f.mjs`,
`spec/datajs/vectors/matrix.md`, `nix/flake.nix`, `nix/run`, and both workflow
files. Only `nanvm-lib/tests/test/generated.rs` and
`nanvm-harness/fixtures/*.rs` are marked in `.gitattributes`.

CI runs `npm run gen` over the checkout and then compares. An output its
generator stopped writing survives, and a generator can silently depend on a
previous output. Regenerating over existing scripts also hides missing
executable-bit support.

### Proposal

#### One naming rule

**A file or directory whose name starts with `gen.` is generated.** Everything
inside a `gen.*` directory is generated; no handwritten file lives there. The
stem `gen` is reserved: a handwritten `gen.sh` or `gen.f.mjs` is not allowed.

| Situation | Convention | Example |
| --- | --- | --- |
| Generated file | `gen.` prefix, suffix untouched | `gen.matrix.md`, `gen.operators.rs`, `gen.types.ts` |
| Generated FunctionalScript module | `gen.{name}/` directory with the usual names | `fjs/edag/callable/gen.table/module.f.mjs`, `…/gen.table/proof.f.mjs` |
| Whole directory of outputs | `gen.{name}/` | `nanvm-harness/gen.fixtures/*.rs` |
| Path fixed by another tool | Keep the path; list it as an exception | `.github/workflows/npm-publish.yml` |

The prefix replaces a `.gen` infix and a `generated/` directory, both proposed
here earlier:

- **One test for files and directories:** `name.startsWith('gen.')`. The infix
  needed a definition of the "complete language suffix" (`.f.mjs`, `.d.ts`,
  `.d.mts`); a misplaced infix changes behavior silently — `table.f.gen.mjs`
  is not loaded by the test runner
  ([`shouldLoad`](../fjs/dev/module.f.mjs)).
- **Suffixes stay intact,** so every tool that selects files by suffix — the
  proof runner, coverage, `tsc`, npm `files`, `fjs compile` — works unchanged.
- **The dot matters.** `gen*` would match the handwritten generator
  `fjs/edag/callable/generate/` and several `todo/generated-*.md` files; the
  cleanup below would delete them. No tracked path starts with `gen.` today.
- **Not a bare `gen/`.** Rust edition 2024, which both crates use, reserves
  `gen`: `mod gen;` is a parse error.

Mark generated paths in `.gitattributes`. Two lines are needed, because an
attribute on a directory does not reach the files inside it (`gen.*/**`
matches only at the root; `gen.*/` matches nothing):

```gitattributes
gen.* linguist-generated=true
**/gen.*/** linguist-generated=true
```

Fixed-path exceptions get their own lines.

Where the format permits comments, generators write a header naming the source
and the regeneration command, with "Do not edit". Put script headers after the
shebang.

#### Consequences per language

- **FunctionalScript.** A generated module is `gen.{name}/module.f.mjs`, with
  its proof at `gen.{name}/proof.f.mjs`. Coverage includes every
  `**/module.f.mjs` (`package.json` `cov`), so a generated module is held to
  100% coverage like any other. Open question: a proof written by the same
  generator checks the generator against itself; decide whether a generated
  module's proof is generated, handwritten outside the directory (as
  `fjs/edag/callable/proof.f.mjs` proves `table.f.mjs` today), or both.
- **Rust.** A dotted name is never an identifier: load generated modules with
  `#[path = "…"]` (as `nanvm-harness/src/lib.rs` already does) and keep
  them out of `cargo fmt -- --check` with `#[rustfmt::skip]` on the `mod`
  declaration — stable rustfmt has no glob to skip them. A dotted name cannot
  be a Cargo target root: `tests/gen.foo.rs` fails with `invalid character
  '.' in crate name`, but only under `cargo test` or
  `cargo clippy --all-targets`. Give such a target an explicit
  `[[test]] name = …`. No current output is a target root.
- **TypeScript declarations.** `.gitignore` ignores `**/*.d.ts` and
  `**/*.d.mts`, and `tsc` resolves a declaration only next to its source with
  the same basename. A committed generated type file is `gen.types.ts`, not a
  `.d.ts`. Emitted declarations stay outside this convention.
- **Ignored names.** `.gitignore` also ignores `index.html` and `_*`. A
  committed output must not use an ignored name, or the drift check cannot see
  it.

#### Fixed-path exceptions

Kept in place, marked by an explicit `.gitattributes` line, and not deleted by
the cleanup below:

- `.github/workflows/npm-publish.yml` — npm trusted publishing is bound to the
  exact workflow filename, and a mismatch fails only at publish time. GitHub
  reads workflows only from `.github/workflows/`.
- `.github/workflows/ci.yml` — could be `gen.ci.yml`, but stays next to
  `npm-publish.yml`.
- The generated files in `nix/` — Nix requires `flake.nix` and `flake.lock`,
  `./nix` is used by CI steps, `dev.sh` and `package.json`, and `nix/` holds a
  handwritten `README.md`. The regeneration step itself runs through
  `./nix/run`.

Not generated outputs, so neither marked nor deleted: the dependency lockfiles
(`package-lock.json`, `Cargo.lock`, `deno.lock`, `bun.lock`, refreshed by
`npm run lock-update`), and gitignored build output (`npm pack` tarballs,
emitted declarations, the website's `_*` and `index.html`).

#### CI: delete, regenerate, compare

At the end of the existing generation-check job:

1. Establish the pinned runtime before anything is deleted.
2. Delete every `gen.*` file and directory in the project, tracked, untracked
   and ignored. Skip `.git`, `node_modules` and `target`, which can contain
   third-party `gen.*` names. The deletion is a `fjs` command using the same
   `startsWith('gen.')` test, not `find`/`rm`
   ([AGENTS.md §6](../AGENTS.md#6-external-tools)).
3. Regenerate. Fail immediately if any generator fails; restore file modes as
   well as contents.
4. Run the existing `git add -A && git diff --cached --exit-code`. It catches
   additions, modifications, deletions (a stale output that nothing
   regenerates), and executable-bit changes.

Keep the three steps separately reportable, per
[AGENTS.md §7](../AGENTS.md#7-continuous-integration). Fixed-path exceptions
are not deleted; the comparison still catches their modifications, but not an
obsolete one.

#### Blockers found

Deleting all `gen.*` paths and regenerating fails today, for these reasons:

1. **The CLI imports a generated module.** Every `npm run gen` step runs
   `fjs/module.mjs`, which imports
   `fjs/module.f.mjs → fsc → fsc/edag → edag/analysis → edag/callable →
   edag/callable/table.f.mjs`. With `table.f.mjs` deleted,
   `node ./fjs/module.mjs r ./fjs/edag/callable/generate/module.f.mjs` fails
   with `ERR_MODULE_NOT_FOUND`. Rule: no generator's import closure — the
   runner included — may contain a generated path. Options: a thin generator
   runner that does not import `fsc`, lazy command loading in the CLI, or
   building the table at run time in `edag/callable`.
2. **`fjs compile` does not create its output directory.** Writing into a
   deleted `gen.fixtures/` fails with `ENOENT`. Generators create their output
   directories.
3. **Two tracked fixtures have no generator.**
   `nanvm-harness/fixtures/function.rs` and `rest-function.rs` are not written
   by `npm run gen` and are not built. Wire them in or delete them with their
   `.mjs` sources.
4. **Nix.** Deleting `nix/run` and `nix/flake.nix` would stop the next step
   from starting, which is why they are exceptions. `flake.lock` files are
   written by `nix/lock-update.sh`, not `npm run gen`; do not use
   `npm run lock-update` for the drift check, which also updates unrelated
   dependencies.
5. **Executable modes.** Recreating a script must not rely on its old inode;
   [generated-run-script-mode](../fjs/ci/todo/generated-run-script-mode.md)
   owns that and must land before deletion is enabled.

#### Migration

| Output | New path | Notes |
| --- | --- | --- |
| `fjs/edag/callable/table.f.mjs` | `fjs/edag/callable/gen.table/module.f.mjs` | Published (`files` includes `**/*.mjs`, no `exports`): `**BREAKING CHANGES:**` |
| `spec/datajs/vectors/matrix.md` | `spec/datajs/vectors/gen.matrix.md` | |
| `nanvm-lib/tests/test/generated.rs` | `nanvm-lib/tests/test/gen.operators.rs` | `#[path]` on `mod generated;` |
| `nanvm-harness/fixtures/*.rs` | `nanvm-harness/gen.fixtures/*.rs` or `fixtures/gen.*.rs` | 30 `#[path]` lines; 30 `compile` outputs in `package.json` `gen` |

A scratch rename of the Rust outputs passed `cargo test`, `cargo fmt -- --check`
and `cargo clippy --all-targets -- -D warnings`; renaming `table.f.mjs` kept
the `edag/callable` and `fsc/parameters` proofs green and regenerated it
byte-identically. The `.gitattributes` lines above marked all 47 generated
tracked files of that rename and no handwritten file.

Each migration updates every importer, doc and `todo/` naming the old path, and
removes the old path's `.gitattributes` line.

### Tasks

- [ ] Remove generated paths from the generators' import closure, the CLI
      included (blocker 1).
- [ ] Make generators create their output directories (blocker 2).
- [ ] Decide the two orphan fixtures (blocker 3).
- [ ] Decide how a generated FunctionalScript module is proven.
- [ ] Document the rule in AGENTS.md and CONTRIBUTING.md; add the two
      `.gitattributes` lines and the fixed-path exceptions.
- [ ] Migrate each output in the table, one pull request each, with headers
      where the format permits.
- [ ] Add the `fjs` cleanup command, skipping `.git`, `node_modules` and
      `target`.
- [ ] Update the CI generator under `fjs/ci/` to establish the runtime,
      delete, regenerate and compare as separate steps; regenerate the
      workflow.
- [ ] Verify: a clean regeneration passes; a stale `gen.*` output fails drift;
      a new or changed output fails drift; generation failures fail CI;
      executable modes are restored; handwritten files survive cleanup.

### Related

- [CI generator](../fjs/ci/README.md) — current generation and drift-check flow.
- [Nix environments](../nix/README.md) — generated files and lock regeneration.
- [Generated script modes](../fjs/ci/todo/generated-run-script-mode.md) —
  prerequisite for deleting and recreating executable outputs.
- [Nix integration](../fjs/ci/todo/65z-ci-nix.md) — existing stale-directory task;
  use the shared cleanup convention when implementing it.
- [rustfmt skip for generated Rust](../nanvm-lib/todo/generated-rust-module-rustfmt-skip.md)
  — the `#[rustfmt::skip]` on the `mod` declaration.
