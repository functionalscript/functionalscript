# Contributing to FunctionalScript

This repository is a monorepo with two code bases: `fjs/` (the FunctionalScript
language, its standard modules, and the `fjs` CLI) and `nanvm-lib/` (NaNVM, the
native FunctionalScript VM, in Rust).

**Coding style, testing rules, design principles, and pull request requirements
start in [AGENTS.md](./AGENTS.md).** Read it before opening a pull request — it
applies to human and AI contributors alike. That file is a map: the
repository-wide design principles are in [DESIGN.md](./DESIGN.md), the
FunctionalScript and TypeScript rules in [fjs/AGENTS.md](./fjs/AGENTS.md), the
Rust ones in [nanvm-lib/AGENTS.md](./nanvm-lib/AGENTS.md), and what to do with
the comments a review leaves on your pull request in
[REVIEW.md](./REVIEW.md). This file covers getting a working environment and
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
**not** an npm dependency of this package. `npm ci` does not install it: it is a
tool the environment provides, like the others in this table, so a runtime job
that only runs the suite does not download a compiler it never opens.

The version is pinned in
[`fjs/ci/config/module.f.mjs`](./fjs/ci/config/module.f.mjs) — the same constant
the generated CI uses, in the Nix shells and in the packed-package check — so
install exactly that one:

```bash
npm install -g typescript@7.0.2   # or whatever that file pins today
```

Or take the Nix shell below and skip the question. Either way, do not reach for
`npx tsc`: with nothing to resolve in `node_modules` it downloads whatever the
registry calls latest, which is not the compiler CI runs.

### Or one Nix shell

If you have Nix, `nix/` is a generated development environment carrying every
tool in that table at the exact versions CI uses — Node, Deno, Bun, TypeScript,
a Rust toolchain with the WASM targets, Wasmtime, Wasmer and `git`. It is not a
convenience built alongside CI: every job but the two older Node ones runs its
commands inside this very shell, so what passes here is what passes there.

```bash
./dev.sh                   # an interactive shell
```

It covers `aarch64-linux`, `x86_64-linux`, `aarch64-darwin` and `x86_64-darwin`;
`nix develop` picks the one for your machine. Nix does not run natively on
Windows, so a Windows contributor either works through WSL2 or installs the
table above — nothing in this repository requires Nix.

`nix/README.md` explains what the shell contains and why.

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

### Updating dependencies

To bump an npm devDependency version, edit `package.json` by hand first (there
is no `npm-check-updates` step anymore). Then run:

```bash
npm run update
```

Run this after changing source code. It requires Node, Deno, and Bun to all be
installed: `package-lock.json`, `deno.lock`, and `bun.lock` are all under Git
control, and the update refreshes each of them (plus the generated CI workflow)
to match whatever versions are currently declared in `package.json`.

## Using MCP with VS Code

This repository keeps `.copilot/mcp.json` as the source of truth. VS Code
auto-discovers `.vscode/mcp.json`; that file is **not committed** — generate it
in your local clone with:

```bash
npm run dev-update
```

After editing `.copilot/mcp.json`, run `npm run dev-update` again. The
cross-platform FunctionalScript updater also accommodates future local
development configuration generators.

To use the MCP tools in Copilot Chat, open it (`Ctrl+Alt+I` on Windows/Linux,
`Cmd+Option+I` on macOS), select **Agent**, then use **Configure Tools** to
enable them. For example:

> "Add a short text blob to CAS: 'Hello from FunctionalScript'"

The `cas_add`, `cas_get`, and `cas_list` tools appear in the agent's tool panel.
For tool details and package-consumer setup for Claude and Codex, see
[`fjs/mcp/README.md`](fjs/mcp/README.md).

## Opening a pull request

A pull request implements only one feature or improvement, with minimal code
changes. Before submitting, ensure every check above passes, delete the `todo/`
issue file in the same pull request, and — when the change affects behavior or
the public API — add a changelog entry as `changelog/unreleased/<PR>.md`, named
by the real pull request number once the pull request exists (see
[changelog/README.md](./changelog/README.md)). The everyday workflow around
this is [AGENTS.md §1](./AGENTS.md#1-workflow).

### Commit messages

A pull request lands on `main` as a merge commit titled `<PR title> (#NNN)`,
with the pull request description as its body. Both halves are reviewed text
that outlives the pull request page, and a changelog generated from Git history
reads them, so write the title and the description as the commit message they
become.

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
  title is the bare version: `0.45.0`.
- **Description.** Free prose — motivation, design, measurements, alternatives
  considered — then, when the change affects behavior or the public API, a
  `Changelog:` section, the last section before an optional trailer block
  (`Co-Authored-By:`, generated-with lines, session links):

  ```
  <free prose>

  Changelog:
  - `types/bit_vec`: `tryListToVec` reuses the shared balanced fold, at the
    same cost as the accumulator it replaces
  ```

  The section holds exactly the list items of `changelog/unreleased/<PR>.md` —
  same Markdown subset, same `**BREAKING CHANGES:**` prefix where it applies,
  no PR link ([changelog/README.md](./changelog/README.md#entries)). A pull
  request that doesn't change behavior or the public API needs no entry and
  omits the section entirely.

  It duplicates the entry file on purpose: the file is what today's release
  process reads, the section is what a generator reading Git history would
  read. Neither is derived from the other, so keep them identical.
- **How it lands.** Create a merge commit, always. The merge box offers the
  reviewed title and description as the default message — don't edit it there,
  where nobody reviews the result. The branch's commits come along with it: a
  squash would drop them, and a rebase would replay them onto `main` with no
  `(#NNN)` and no commit carrying the description. Nothing lands on `main`
  outside a pull request.

### Addressing review comments

Once the pull request is open, which comments to fix, which to push back on,
and what a push-back has to leave behind: [REVIEW.md](./REVIEW.md).

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
