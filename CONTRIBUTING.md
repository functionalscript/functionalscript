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
[REVIEW.md](./doc/REVIEW.md), and how to review someone else's in
[REVIEWING.md](./doc/REVIEWING.md), and how one session carries one task through
a stack of pull requests in [SESSION.md](./doc/SESSION.md). This file covers getting a working environment and
opening a pull request; every document links to the others rather than
restating them, so they cannot drift apart.

## Issues

Issues are tracked in `todo/` directories inside the repository, **not** on
GitHub. Check [todo/README.md](./todo/README.md) for existing work before you
start, and for the format to use when filing a new one. Before taking a `todo/`,
also check that no open pull request, draft or not, already works on it, and
claim it by opening a draft pull request at once
([SESSION.md](./doc/SESSION.md#claim-the-task)).

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

[Nix](https://nixos.org/download/). The repository's developer shell, below,
provides every tool in this table at the version CI uses — install Nix, enter
the shell, and nothing else is a question. The table says what the shell
carries and what each tool is for. It is a list to install by hand in one case
only: bare Windows, where Nix does not run, and a developer who wants to work
there installs these tools themselves. The table's `latest` is the floor; the
exact versions, the ones CI's Windows jobs install, are the pins in
[`fjs/ci/config/module.f.js`](./fjs/ci/config/module.f.js).

| Tool    | Version              | Required for                                                     |
| ------- | -------------------- | ---------------------------------------------------------------- |
| [Node.js](https://nodejs.org/en/download) | **latest** (22 min.) | Everything.                                                     |
| [TypeScript](https://www.typescriptlang.org/) | the pinned version   | Type-checking, `npm test`, `npm pack`.                           |
| [Rust](https://www.rust-lang.org/tools/install)    | **latest**           | NaNVM (`nanvm-lib`) development only.                            |
| Deno    | latest               | Updating dependencies; an alternative test runtime.               |
| Bun     | latest               | Updating dependencies; an alternative test runtime.               |

TypeScript is the one row that is not simply "latest", and the only one that is
**not** an npm dependency of this package, so `npm ci` does not install it: it
is a tool the shell provides, like the others in this table, at the version
[`fjs/ci/config/module.f.js`](./fjs/ci/config/module.f.js) pins for CI; on bare
Windows, install exactly that version globally. Do not reach for `npx tsc`: with
nothing to resolve in `node_modules` it downloads whatever the registry calls
latest, which is not the compiler CI runs.

### The Nix shell

`gen.nix/` is a development environment carrying every tool in that table at
the versions CI uses. It is not a convenience built alongside CI: every job runs
its commands inside this very shell, so what passes here is what passes there,
except the Node 22 and Node 24 compatibility jobs, each on a flake of its own,
the two Windows platform jobs, which run without Nix, and the publishing
workflow, which runs on the Node `setup-node` installs. The packed-package
check that closes `node26` stays out of it too, by design: it installs the
published tarball with `setup-node`'s Node and npm, as a consumer would. So a
change that leans on Node 26 passes the shell and still fails CI. Every
developer and every agent works inside the shell.

```bash
./dev.sh                   # an interactive shell
./dev.sh npm run cov       # or one command in it
```

[`dev.sh`](./dev.sh) opens the shell, or runs the command given to it, and
enables flakes itself, so a stock Nix install needs no configuration;
[`gen.nix/run`](./gen.nix/run) is the generated form of the latter, and is what
a CI step names. On macOS and Linux, install Nix on the host; VS Code's offer
to reopen in a container is a slower detour there, and declining it changes
nothing. Nix does not run natively on Windows: a Windows contributor opens the
repository in that container —
[`.devcontainer/devcontainer.json`](./.devcontainer/devcontainer.json) builds
a Debian image with Nix and runs `npm ci` in the shell on any devcontainer
host; in VS Code and Codespaces it also opens every terminal inside the shell,
through a terminal profile only those two hosts read, which runs `./dev.sh`
and so expects a terminal opened at the workspace root, VS Code's default — so
on another host such
as IntelliJ or the devcontainer CLI run `./dev.sh` yourself — or works in WSL2
with Nix installed there. The shell is the same either way; only the VS Code
devcontainer enters it for you, so everywhere else run `./dev.sh` yourself or
set your own terminal profile to it. Bare Windows, outside both,
means installing the [Requirements](#requirements) table by hand at the
versions `fjs/ci/config/module.f.js` pins, as CI's Windows jobs do.

One build runs outside it: Cloudflare's Workers Builds generates the website on
its own image and reads its Node version from `.node-version`, which is why that
file exists ([fjs/website/README.md](./fjs/website/README.md#the-site-is-the-repository-served)).

[`fjs/ci/nix/README.md`](./fjs/ci/nix/README.md) explains the shell and how it is generated.

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

Both of the first two need `tsc` on `PATH`, which the Nix shell provides.

#### Ways to run the FunctionalScript test suite

Every row below runs the same suite; pick the first one that fits your
environment.

| Command                                 | Runtime  | Needs internet | Notes                                    |
| --------------------------------------- | -------- | -------------- | ---------------------------------------- |
| `npm test`                              | Node 22+ | no             | `tsc` + the repo's runner; needs `tsc`.  |
| `npm start test`                        | Node 22+ | no             | The repo's runner, no type-check step.   |
| `node --test`                           | Node 22+ | no             | Node's native test runner.               |
| `npm run cov`                           | Node 22+ | no             | `node --test` plus coverage.             |
| `npm start compile`                     | Node 22+ | no             | Every authored `.f.js` still compiles.   |
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
[.github/workflows/gen.ci.yml](./.github/workflows/gen.ci.yml) for the exact commands
and pinned runtime versions.

To run only the tests under a subtree, `cd` into that directory and run the
runner from there (e.g. `cd fjs/base64 && fjs test`). Module discovery starts at
the current working directory, and results are reported per test.

To validate the packed npm package itself against clean Node, Deno, and Bun
consumers — for example after changing `prepack`, `files`, or anything that
affects emitted declarations — follow
[`fjs/ci/packed-consumer-validation.md`](./fjs/ci/packed-consumer-validation.md).

New `.f.mjs` and `.f.js` modules need a co-located proof with 100% proof
coverage — see [fjs/AGENTS.md §1](./fjs/AGENTS.md#1-testing-and-proof-coverage).
Authored FunctionalScript is JavaScript with JSDoc: a `module.f.mjs` is
accompanied by a `proof.f.mjs`, and a separately useful type-level API may live
in a sibling `types.ts`. Current FunctionalScript compiler support is not
required for either file; a `module.f.js` is the one that promises it, and keeps
a `proof.f.mjs` too.

`types.ts` and an optional sibling `private.ts` are the only authored
TypeScript in the repository, and both are permanent rather than migration debt
— authored implementation and proof `.f.ts` is gone. No authored `.mjs` carries a file-scope JSDoc `@typedef`, so a named
type lives in `types.ts` when it belongs to the module's public declaration
closure, in an optional sibling `private.ts` when it does not, inline in the
annotation that uses it, or function-local in a proof. Only `types.d.ts` ships:
`package.json`'s `files` negates `**/private.d.ts`. `.f.js` is the stage-2
compiler-compatibility marker described in
[`fjs/compiler/README.md`](./fjs/compiler/README.md): authored FunctionalScript the current
compiler accepts, [`fjs/js/prototype`](./fjs/js/prototype/module.f.js) and
[`fjs/types/range`](./fjs/types/range/module.f.js) among them.

### Website demos

When a change affects a module with a website demo, or a demo's dependencies
or shared website code, make sure the affected demos still work. Run
`npm run website`, serve the repository root over HTTP, and open the affected
module pages in a browser. Check that each demo appears, its controls work,
and its output is correct for representative inputs. Passing proofs alone does
not verify the browser interaction. Fix demo regressions in the same PR, and
record which demos you checked and the results in its description. If you
cannot run a browser check, say so explicitly.

**Include a direct link to each affected, new, or updated demo in the PR
description**, using the PR branch's preview. The URL format is:

```text
https://${normalize(branchName)}-functionalscript.functionalscript.workers.dev/${path}
```

Here `normalize(branchName)` is Cloudflare's generated branch alias, and `path`
is the module directory relative to the repository root, with a trailing `/`.
Copy the **Branch Preview URL** from Cloudflare's deployment comment on the PR
and append the path; Cloudflare can
[shorten long branch aliases](https://developers.cloudflare.com/changelog/post/2025-08-08-support-long-branch-names-preview-aliases/).
Verify that the link opens the intended demo.

For example, [PR #2339](https://github.com/functionalscript/functionalscript/pull/2339)
uses branch `claude/blissful-newton-hpbsnx` and path `fjs/types/bigint/`:
[bigint demo](https://claude-blissful-newton-hpbsnx-functionalscript.functionalscript.workers.dev/fjs/types/bigint/).

Contributors may add demos or update existing ones to illustrate a module's
behavior. Follow the [demo contract](./fjs/website/README.md#a-demo-shows-what-a-module-does)
and the usual proof requirements, then check the new or updated demo in the
browser. A module without a demo does not need one merely because it changes.

### Regenerating after a source change

```bash
npm run gen
```

Run this after changing anything a generator reads — `fjs/ci`'s workflows and
Nix flakes, `fjs/nanvm`'s Rust test data, a `nanvm-harness` fixture. `gen` is
one program, [`fjs/dev/gen/module.f.mjs`](./fjs/dev/gen/module.f.mjs): its
`generators` list is every generator in the order regeneration needs, the
reason for each position beside it, and a new generated output is a new entry
there. It needs Node and Nix: its last step runs the generated
`gen.nix/lock-update.sh` on the terminal, which locks each flake from its
pinned commit after the cleanup below emptied `gen.nix/`, so on Windows it
runs where Nix does: in WSL2 or a container. The dependency lockfiles it never
touches.

`gen` starts by deleting every generated output — the same module as
`npm run gen:clean`, `fjs/dev/clean` — so regeneration starts from nothing: an output no
generator writes any more shows up as a deletion, and a generator that needs
a previous output — its own or another's — fails. The `flake.lock` files are
held to the same standard by the lock script `gen` ends with: deleted, then
locked again from the pinned commit, so a committed lock is byte-identical to
what that commit produces from nothing. CI's drift check runs `gen` and then
`git add -A && git diff --cached --exit-code`; run the same two commands to
see what CI will. The cleanup lives in `gen` rather than in its own CI step
because the workflow `fjs ci` generates is shared with downstream projects,
whose contract is only `cov` and `gen`.

#### Naming generated files

**A file or directory whose name starts with `gen.` is generated**, and so is
everything inside a `gen.*` directory. Never edit one by hand — change its
generator — and never give a handwritten file that name: `gen:clean` deletes
it. The dot matters: `generated-*.md` and `generic-operation-signatures.md`
are handwritten.

- The prefix leaves the suffix alone (`gen.matrix.md`, `gen.methods.rs`), so
  every tool that picks files by suffix works unchanged. A generated
  FunctionalScript module is `gen.{name}/module.f.mjs`, held to the same proof
  coverage as any other.
- A `gen.` name is never a Rust identifier: load a generated file or directory
  with one `#[path]`, as `nanvm-harness/src/lib.rs` does for
  `gen.fixtures/`. A dotted name cannot be a Cargo target root.
- A committed output must not use a name `.gitignore` hides (`*.d.ts`,
  `*.d.mts`, `index.html`, `_*`), or the drift check cannot see it.
- A generator creates its output directory, and imports nothing generated —
  the `fjs` CLI that runs it included.
- `gen:clean` walks the tree with the same test, skipping dot-names other
  than `.github`, `node_modules` and `target`. It removes files only; the
  emptied directories are invisible to git.

`.gitattributes` marks the `gen.*` names with two lines — an attribute on a
directory does not reach the files inside it — and nothing else: no committed
output keeps a name outside the rule. Nix needs `flake.nix` and `flake.lock`,
so the whole environment directory is `gen.nix/`, entered as
`nix develop ./gen.nix` and, from a CI step, `sh ./gen.nix/run <command>` —
through `sh`, because a script regenerated from nothing has no executable bit
and nothing may depend on one. The two workflows keep their suffix under the
prefix, since GitHub reads any name in `.github/workflows/`; npm trusted
publishing is bound to `gen.npm-publish.yml`'s exact name, so a project that
renames it updates its trusted publisher on npm as well
([fjs/ci/README.md](./fjs/ci/README.md#the-publishing-workflow)). The
dependency lockfiles are not generated outputs: `npm run lock-update`
refreshes them, not `gen`. The `flake.lock` files are: `gen:clean` deletes
them with the rest of `gen.nix/`, and `gen.nix/lock-update.sh` writes them
back from the pinned commits.

### Updating dependencies

To bump an npm devDependency version, edit `package.json` by hand first (there
is no `npm-check-updates` step anymore). To move a pinned Nixpkgs or
`rust-overlay` commit, edit `fjs/ci/config/module.f.js`; a Nixpkgs commit must
first pass the binary-cache check in
[`fjs/ci/update-versions.md`](./fjs/ci/update-versions.md), the procedure the
daily version-update routine follows. Either way, then run:

```bash
npm run lock-update
```

This is a maintainer action, not something to run after an ordinary source
change — `gen` above covers that, the `flake.lock` files included. It requires
Node, Deno, Bun, Cargo, and Nix all installed: it runs `gen` first, then
refreshes `package-lock.json`, `deno.lock`, `bun.lock`, `Cargo.lock` and
`.devcontainer/devcontainer-lock.json` — see
[`nix/README.md`](./fjs/ci/nix/README.md). The last one pins the devcontainer's
Nix feature to the version and digest the registry serves, and is written by
the devcontainer CLI, which the script runs through `npx` at a version pinned
in the command rather than as a dependency of this package — an external tool
called from a repository script, approved by the maintainer for this step
([AGENTS.md §6](./AGENTS.md#6-external-tools)). An agent session
needs the registry's content host, `pkg-containers.githubusercontent.com`,
allowed in its network policy for that step.

## Opening a pull request

A pull request implements only one feature or improvement, with minimal code
changes. Before submitting, ensure every check above passes and delete the
`todo/` issue file it fixes, if there is one. It adds **no changelog file**: the
changelog is written once per release from the pull requests that shipped in it
([changelog/RELEASE.md](./changelog/RELEASE.md)). Before 1.0, a pull request may
leave optional release-note material in its description, as described below.
The everyday workflow around this is [AGENTS.md §1](./AGENTS.md#1-workflow).

A pull request that works on a `todo/` is opened as a **draft** as soon as the
branch has a commit, and names that `todo/` file in its description, so anyone
about to start the same task finds it taken
([SESSION.md](./doc/SESSION.md#claim-the-task)). It is marked ready for review
once it carries its change and every check passes. A pull request with no
`todo/` behind it has nothing to claim.

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
  (`types/bit_vec`, `compiler/tokenizer`) or an area (`ci`, `docs`, `changelog`,
  `AGENTS.md`), the same topic the CHANGELOG entry starts with; the
  description is imperative, lower-case after the colon, and has no trailing
  period. Keep it within 72 characters **including** the ` (#NNN)` GitHub
  appends, and never write a `(#NNN)` of your own. A release pull request's
  title is `Release X.Y.Z`.
- **Description.** Free prose — motivation, design, measurements, alternatives
  considered. A change worth a release note may add an optional `Changelog:`
  section, last before any trailer block (`Co-Authored-By:`, generated-with
  lines, session links), with list items in the [entry style](./changelog/README.md#entries).
  Before 1.0, `**BREAKING CHANGES:**` notices are optional: regular releases
  always advance the minor to `0.X.0`, and urgent fixes use the corresponding
  release line ([changelog/README.md](./changelog/README.md#breaking-changes-and-versioning)).
  Explain API changes and update every importer in the same PR.

  The release policy after 1.0, including whether mandatory notices return,
  remains [undecided](./todo/post-1.0-release-policy.md). An optional notice
  before 1.0 can look like this:

  ```
  Changelog:
  - **BREAKING CHANGES:** `bnf`: `repeat` moved to `types/array` and returns a
    fixed-length tuple; the `Repeat` type is gone
  ```

  The section is raw material: the release author rewrites entries over the
  whole window, grouping related pull requests into one entry
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
Reviewing someone else's pull request: [REVIEWING.md](./doc/REVIEWING.md).

## OpenAI Codex environment

The same shell. The environment's setup script installs Nix and fetches both
dependency sets inside it, so every later command finds the toolchain CI uses
and the dependencies it needs — the container's network is open during setup
only, so a `cargo fetch` left for later would fail there. Codex runs the script
as root in a container without an init system, which the official installer
refuses in both of its modes, so the script uses the Determinate installer,
which supports exactly that. The shells Codex opens for the task afterwards do
not carry the setup shell's `PATH`, and `--init none` writes no startup
integration, so the environment's own settings must put Nix on the task's
`PATH`: set the `PATH` environment variable there to begin with
`/nix/var/nix/profiles/default/bin`. The setup script sources the same profile
for its own commands.

```sh
curl -fsSL https://install.determinate.systems/nix | sh -s -- install linux --init none --no-confirm
. /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
./dev.sh npm ci
./dev.sh cargo fetch
```

`npm test`, `npm run cov` and every other check then run as
`./dev.sh <command>`.
