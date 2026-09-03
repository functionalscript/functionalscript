# Contributing to FunctionalScript

This repository is a monorepo with two code bases: `fjs/` (the FunctionalScript
language, its standard modules, and the `fjs` CLI) and `nanvm-lib/` (NaNVM, the
native FunctionalScript VM, in Rust).

**Coding style, testing rules, design principles, and pull request requirements
start in [AGENTS.md](./AGENTS.md).** Read it before opening a pull request — it
applies to human and AI contributors alike. That file is a map: the
repository-wide design principles are in [DESIGN.md](./doc/DESIGN.md), the
FunctionalScript and TypeScript rules in [fjs/AGENTS.md](./fjs/AGENTS.md), the
Rust ones in [nanvm-lib/AGENTS.md](./nanvm-lib/AGENTS.md), and what to do with
the comments a review leaves on your pull request in
[REVIEW.md](./doc/REVIEW.md). This file covers getting a working environment and
opening a pull request; every document links to the others rather than
restating them, so they cannot drift apart.

## Issues

Issues are tracked in `todo/` directories inside the repository, **not** on
GitHub. Check [todo/README.md](./todo/README.md) for existing work before you
start, and for the format to use when filing a new one.

To **file** an issue yourself, add its `todo/` file in a pull request. Note that
a pull request that **fixes** an issue does the opposite — it deletes that
issue's `todo/` file; see [AGENTS.md §1](./AGENTS.md#1-workflow).

To report a bug, request a feature, or ask a question without opening a pull
request — the normal case for an external contributor, who cannot add a `todo/`
file directly — open a
[GitHub issue](https://github.com/functionalscript/functionalscript/issues)
instead. A maintainer will create the corresponding `todo/` file and link it to
your issue. GitHub issues are the intake channel; `todo/` files are where the
work is tracked from then on.

## Requirements

| Tool    | Version              | Required for                                                     |
| ------- | -------------------- | ---------------------------------------------------------------- |
| [Node.js](https://nodejs.org/en/download) | **latest** (22 min.) | Everything.                                                     |
| [TypeScript](https://www.typescriptlang.org/) | the pinned version   | Type-checking, `npm test`, `npm pack`.                           |
| [Rust](https://www.rust-lang.org/tools/install)    | **latest**           | NaNVM (`nanvm-lib`) development only.                            |
| Deno    | latest               | Updating dependencies; an alternative test runtime.               |
| Bun     | latest               | Updating dependencies; an alternative test runtime.               |

TypeScript is the one row that is not simply "latest", and the only one that is
**not** an npm dependency of this package, so `npm ci` does not install it: it
is a tool the environment provides, like the others in this table.
[`fjs/ci/config/module.f.mjs`](./fjs/ci/config/module.f.mjs) pins the version CI
uses — install exactly that one globally, or take the Nix shell below and skip
the question. Either way, do not reach for `npx tsc`: with nothing to resolve in
`node_modules` it downloads whatever the registry calls latest, which is not the
compiler CI runs.

### Or one Nix shell

If you have Nix, `nix/` is a development environment carrying every tool in that
table at the versions CI uses. It is not a convenience built alongside CI: most
jobs run their commands inside this very shell, so what passes here is what
passes there.

```bash
./dev.sh                   # an interactive shell
./nix/run npm run cov      # or one command in it
```

[`dev.sh`](./dev.sh) opens the shell; [`nix/run`](./nix/run) hands it a single
command, and is what a CI step names. Nix does not run natively on Windows, so a
Windows contributor either works through WSL2 or installs the table above —
nothing in this repository requires Nix.

[`nix/README.md`](./nix/README.md) explains the shell and how it is generated.

### Node test-runner compatibility

External test registration automatically uses an inline compatibility strategy
below Node `26.0.0`, so `node --test` and `npm run cov` correctly handle
`throw`-tagged tests on Node 22. Node `26.0.0` and later use the native
`expectFailure` strategy and remain the fully supported native baseline.

### Installing dependencies

```bash
npm ci        # Node dependencies
cargo fetch   # Rust dependencies
```

### Running tests

```bash
tsc                      # type-check
npm test                 # tsc + the FunctionalScript test suite
cargo test               # only if you touched Rust
cargo clippy
cargo fmt -- --check
```

Both of the first two need `tsc` on `PATH` — from the Nix shell, or from the
global install described under [Requirements](#requirements).

#### Ways to run the FunctionalScript test suite

Every row below runs the same suite; pick the first one that fits your
environment.

| Command                                 | Runtime  | Needs internet | Notes                                    |
| --------------------------------------- | -------- | -------------- | ---------------------------------------- |
| `npm test`                              | Node 22+ | no             | `tsc` + the repo's runner; needs `tsc`.  |
| `npm start test`                        | Node 22+ | no             | The repo's runner, no type-check step.   |
| `node --test`                           | Node 22+ | no             | Node's native test runner.               |
| `npm run cov`                           | Node 22+ | no             | `node --test` plus coverage.             |
| `deno task fjs test`                    | Deno     | no             | The repo's runner under Deno.            |
| `deno task test` / `deno task cov`      | Deno     | no             | Deno's native test runner / coverage.    |
| `bun fjs/module.mjs test`                | Bun      | no             | The repo's runner under Bun.             |
| `bun test`                              | Bun      | no             | Bun's native test runner.                |
| `fjs test`                              | Node 22+ | to install     | After `npm install -g functionalscript`. |
| `npx functionalscript test`             | Node 22+ | yes            | No install step.                         |
| `deno run -A npm:functionalscript test` | Deno     | yes            | No install step.                         |
| `bunx functionalscript test`            | Bun      | yes            | No install step.                         |

The last four rows run a **published** FunctionalScript rather than this working
tree's version. `npx`, `deno run`, and `bunx` resolve the latest release each
time; `fjs` runs whatever you installed globally, which goes stale as new
versions ship — re-run `npm install -g functionalscript` to update it.

Deno needs explicit permissions: `-A` is the short form, or pass the same set as
the `fjs` task in [deno.json](./deno.json) (`--allow-read --allow-write
--allow-env --allow-net --allow-sys`). Deno also holds back very recently
published versions; add `--minimum-dependency-age=0` to force the newest.

CI exercises these same combinations — see the `node22`, `node24`, `node26`,
`deno`, and `bun` jobs in
[.github/workflows/ci.yml](./.github/workflows/ci.yml) for the exact commands
and pinned runtime versions.

To run only the tests under a subtree, `cd` into that directory and run the
runner from there (e.g. `cd fjs/base64 && fjs test`). Module discovery starts at
the current working directory, and results are reported per test.

To validate the packed npm package itself against clean Node, Deno, and Bun
consumers — for example after changing `prepack`, `files`, or anything that
affects emitted declarations — follow
[`fjs/ci/packed-consumer-validation.md`](./fjs/ci/packed-consumer-validation.md).

New `.f.mjs` modules need a co-located proof with 100% proof coverage — see
[fjs/AGENTS.md §1](./fjs/AGENTS.md#1-testing-and-proof-coverage). Authored
FunctionalScript is JavaScript with JSDoc: a `module.f.mjs` is accompanied by a
`proof.f.mjs`, and a separately useful type-level API may live in a sibling
`types.ts`. Current FunctionalScript compiler support is not required for either
file.

`types.ts` and an optional sibling `private.ts` are the only authored
TypeScript in the repository, and both are permanent rather than migration debt
— authored implementation and proof `.f.ts` is gone. No authored `.mjs` carries a file-scope JSDoc `@typedef`, so a named
type lives in `types.ts` when it belongs to the module's public declaration
closure, in an optional sibling `private.ts` when it does not, inline in the
annotation that uses it, or function-local in a proof. Only `types.d.ts` ships:
`package.json`'s `files` negates `**/private.d.ts`. `.f.js` is not authored
today; it is reserved for the stage-2 compiler-compatibility marker described in
[`fjs/fsc/README.md`](./fjs/fsc/README.md).

### Regenerating after a source change

```bash
npm run gen
```

Run this after changing anything a generator reads — `fjs/ci`'s workflows and
Nix flakes, `fjs/nanvm`'s Rust test data. It needs nothing beyond Node, runs on
Windows, and never touches a lockfile of any kind — CI's drift check runs the
same command and fails if the committed tree no longer matches its output.

### Updating dependencies

To bump an npm devDependency version, edit `package.json` by hand first (there
is no `npm-check-updates` step anymore). To move a pinned Nixpkgs or
`rust-overlay` commit, edit `fjs/ci/config/module.f.mjs`. Either way, then run:

```bash
npm run lock-update
```

This is a maintainer action, not something to run after an ordinary source
change — `gen` above covers that. It requires Node, Deno, Bun, Cargo, and Nix
all installed (so it does not run on Windows): it runs `gen` first, then
refreshes `package-lock.json`, `deno.lock`, `bun.lock`, and `Cargo.lock`, and
runs the generated `nix/lock-update.sh` to refresh every `flake.lock` through
real Nix — see [`nix/README.md`](./nix/README.md).

## Opening a pull request

A pull request implements only one feature or improvement, with minimal code
changes. Before submitting, ensure every check above passes and delete the
`todo/` issue file in the same pull request. It adds **no changelog file**: the
changelog is written once per release from the pull requests that shipped in it
([changelog/RELEASE.md](./changelog/RELEASE.md)). What a pull request owes
instead is a declaration in its description, below. The everyday workflow around
this is [AGENTS.md §1](./AGENTS.md#1-workflow).

### Commit messages

A pull request lands on `main` as a merge commit titled `<PR title> (#NNN)`,
with the pull request description as its body. Both halves are reviewed text
that outlives the pull request page, and the release that collects the changelog
reads them ([changelog/RELEASE.md](./changelog/RELEASE.md)), so write the title
and the description as the commit message they become.

The branch's own commits land with it, reachable through the merge's second
parent and printed by an ordinary `git log`. They are not discarded, so their
messages are not working notes: write each one for a reader who meets it on
`main` with no pull request open.

- **Title.** `<topic>: <short description>` — `<topic>` is the module path
  (`types/bit_vec`, `djs/tokenizer`) or an area (`ci`, `docs`, `changelog`,
  `AGENTS.md`), the same topic the CHANGELOG entry starts with; the
  description is imperative, lower-case after the colon, and has no trailing
  period. Keep it within 72 characters **including** the ` (#NNN)` GitHub
  appends, and never write a `(#NNN)` of your own. A release pull request's
  title is `Release X.Y.Z`.
- **Description.** Free prose — motivation, design, measurements, alternatives
  considered — then, when the pull request **breaks the public API**, a
  `Changelog:` section, the last section before an optional trailer block
  (`Co-Authored-By:`, generated-with lines, session links):

  ```
  <free prose>

  Changelog:
  - **BREAKING CHANGES:** `bnf`: `repeat` moved to `types/array` and returns a
    fixed-length tuple; the `Repeat` type is gone
  ```

  A `**BREAKING CHANGES:**` declaration is **required**, and is the reason the
  section exists. Nothing derives it from a diff — a `readonly` added to an
  exported tuple breaks consumers and looks like noise in a patch — and the
  release reads it to decide which version number moves
  ([changelog/README.md](./changelog/README.md#breaking-changes-and-versioning)).
  Getting it wrong ships a break as a patch release, which is the one mistake
  here that reaches users.

  For everything else the section is **optional**, and useful: a non-breaking
  change worth a release note can leave one, in the same
  [entry style](./changelog/README.md#entries), and the release author starts
  from it instead of from the diff. It is raw material, not published text — the
  release rewrites entries over the whole window, so several pull requests that
  moved one thing become one entry
  ([changelog/RELEASE.md](./changelog/RELEASE.md)). A pull request that changes
  no observable behavior omits the section entirely.
- **How it lands.** Create a merge commit, always — **squash and rebase are not
  used in this repository**, because the branch's real history is worth keeping.
  The merge box offers the reviewed title and description as the default
  message; don't edit it there, where nobody reviews the result. The branch's
  commits come along through the merge's second parent: a squash would drop
  them, and a rebase would replay them onto `main` with no `(#NNN)` and no commit
  carrying the description, which is also what the release's
  `git log --first-parent` listing relies on. Nothing lands on `main` outside a
  pull request.

### Addressing review comments

Once the pull request is open, which comments to fix, which to push back on,
and what a push-back has to leave behind: [REVIEW.md](./doc/REVIEW.md).

## OpenAI Codex environment

Set Node.js to 22. Both `npm test` and `npm run cov` work in this environment;
the latter uses the automatic inline test-registration fallback.

Setup script:

```sh
rustup component add clippy
rustup component add rustfmt

# Install Node.js dependencies.
npm ci

# Install Rust dependencies.
cargo fetch

rustup show
node -v
```
