# Contributing to FunctionalScript

This repository is a monorepo with two code bases: `fjs/` (the FunctionalScript
language, its standard modules, and the `fjs` CLI) and `nanvm/lib/` (NaNVM, the
native FunctionalScript VM, in Rust).

**Coding style, testing rules, design principles, and pull request requirements
start in [AGENTS.md](./AGENTS.md).** Read it before opening a pull request — it
applies to human and AI contributors alike. That file is a map: the
repository-wide design principles are in [DESIGN.md](./doc/DESIGN.md), the
FunctionalScript and TypeScript rules in [fjs/AGENTS.md](./fjs/AGENTS.md), the
Rust ones in [nanvm/lib/AGENTS.md](./nanvm/lib/AGENTS.md), and what to do with
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

Install mise; see the development environment below for initialization.

| Tool    | Version              | Required for                                                     |
| ------- | -------------------- | ---------------------------------------------------------------- |
| [Node.js](https://nodejs.org/en/download) | selected exact pin | Everything.                                                     |
| [TypeScript/TSGO](https://github.com/microsoft/typescript-go) | selected exact pin | Type-checking, `npm test`, `npm pack`.                           |
| [Rust](https://www.rust-lang.org/tools/install) | selected exact pin | NaNVM (`nanvm-lib`) development only.                            |
| Deno    | selected exact pin | Updating dependencies; an alternative test runtime.               |
| Bun     | selected exact pin | Updating dependencies; an alternative test runtime.               |
| Wasmtime / Wasmer | selected exact pins | WASM tests.                                                |

Select recent stable versions that the project can build and test reliably,
following [the version-update acceptance procedure](./fjs/ci/update-versions.md).
An accepted update replaces the previous pin for the next release. Each
release preserves its configuration and generated locks, and records its
tested toolset in its release notes or a linked release document as required
by [the release procedure](./changelog/RELEASE.md#tested-toolset).

If you need an older tool, choose an older FunctionalScript release whose
recorded toolset includes it, then install that release, for example
`npm install -g functionalscript@<release>`. Consult that release's record;
today's pins do not establish what earlier releases supported. Additional
tool-version support after release remains subject to actual demand.

TypeScript is **not** an npm dependency of this package, so `npm ci` does not
install it: the mise environment provides the exact supported compiler on every
platform. Do not reach for `npx tsc`: with
nothing to resolve in `node_modules` it downloads whatever the registry calls
latest, which is not the compiler CI runs.

### Development environment

Install [mise](https://mise.jdx.dev) and follow
[the platform setup guide](./doc/mise-trial/README.md).

```sh
mise trust
mise install --locked
./dev.sh node --version
./dev.sh npm ci
```

`./dev.sh <command>` uses mise; without arguments it opens a shell. On Windows
PowerShell, use `.\dev.ps1 <command>` or `.\dev.ps1` for an interactive shell.
The six native CI hosts use the same manager.

Host prerequisites remain necessary: Linux needs a C compiler, Linux x64 also
needs `gcc-multilib libc6-dev-i386`; macOS needs Command Line Tools; Windows
needs the MSVC build tools and SDK. See the platform guide for runtime gaps.

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
cargo clippy -- -D warnings
cargo fmt -- --check
```

#### Ways to run the FunctionalScript test suite

The built-in runner selects authored `.f.mjs` and `.f.js` proofs. Native
runners discover the combined FJS and host-JS entry by default. For selective
native invocations, see [the runner documentation](./fjs/emergent_testing/README.md#selecting-fjs-or-host-js-with-a-native-runner).

| Command                                 | Runtime  | Needs internet | Notes                                    |
| --------------------------------------- | -------- | -------------- | ---------------------------------------- |
| `npm test`                              | Node pin | no             | `tsc` + the repo's runner; needs `tsc`.  |
| `npm start test`                        | Node pin | no             | Authored FJS, no type-check step.   |
| `node --test`                           | Node pin | no             | Combined FJS and host-JS proofs.               |
| `npm run cov`                           | Node pin | no             | FJS-only Node tests plus coverage.             |
| `npm start compile`                     | Node pin | no             | Every authored `.f.js` still compiles.   |
| `deno task fjs test`                    | Deno     | no             | The repo's runner under Deno.            |
| `deno task test` / `deno task cov`      | Deno     | no             | Deno's native test runner / coverage.    |
| `bun fjs/module.mjs test`                | Bun      | no             | The repo's runner under Bun.             |
| `bun test`                              | Bun      | no             | Bun's native test runner.                |
| `npm run sm t`                          | SpiderMonkey | no         | The repo's runner, authored proofs only. |
| `fjs test`                              | Node pin | to install     | After `npm install -g functionalscript`. |
| `npx functionalscript test`             | Node pin | yes            | No install step.                         |
| `deno run -A npm:functionalscript test` | Deno     | yes            | No install step.                         |
| `bunx functionalscript test`            | Bun      | yes            | No install step.                         |

The last four rows run a **published** FunctionalScript rather than this working
tree's version. Use the toolset recorded for the release you select. The
unversioned `npx`, `deno run`, and `bunx` examples resolve the latest release;
`fjs` runs the release installed globally. Specify `functionalscript@<release>`
when selecting an older release and its recorded toolset.

Deno needs explicit permissions: `-A` is the short form, or pass the same set as
the `fjs` task in [deno.json](./deno.json) (`--allow-read --allow-write
--allow-env --allow-net --allow-sys`). Deno also holds back very recently
published versions; add `--minimum-dependency-age=0` to force the newest.

CI exercises these same combinations — see the `node26`,
`deno`, and `bun` jobs, and `ubuntu-arm` for SpiderMonkey, in
[.github/workflows/gen.ci.yml](./.github/workflows/gen.ci.yml) for the exact commands
and pinned runtime versions.

#### Running tests under a subtree

Module discovery starts at the directory the runner is invoked from — `npm`
hands it over as `INIT_CWD` — so to test one directory, `cd` into it and run
the runner there; results are reported per test:

```bash
cd fjs/basen
npm start test           # this directory's proofs
npm test                 # the same, after a whole-tree tsc
```

Coverage scopes the same way, at the thresholds `npm run cov` sets, with the
report kept to the directory's own modules. This one runs from the repository
root, where `node --test` finds the suite's entry file; `cd` back first if the
block above left you in the directory:

```bash
d=fjs/basen              # at the repository root
INIT_CWD=$d node --test --experimental-test-coverage \
  --test-coverage-include="$d/**/module.f.mjs" \
  --test-coverage-include="$d/**/module.f.js" \
  --test-coverage-include="$d/**/demo.f.mjs" \
  --test-coverage-lines=100 \
  --test-coverage-branches=100 \
  --test-coverage-functions=100
```

The includes matter: what the directory imports from elsewhere runs too, only
partly covered by these proofs, and the thresholds would fail on it. A scoped
run takes seconds where the full suite takes minutes, and it is what
[AGENTS.md](./AGENTS.md) asks of a change under one directory; the full
`npm run cov` is CI's. The block is POSIX shell; on bare Windows, `npm run cov`
measures the whole tree, and the command this stands in for is proposed in
[`fjs/emergent_testing/todo/per-module-coverage.md`](./fjs/emergent_testing/todo/per-module-coverage.md).

Node's `npm run cov` and Deno's `cov` and `cov-html` reports measure
`module.f.mjs`, `module.f.js` and `demo.f.mjs`. Bun's `bun test --coverage`
already includes imported demos without a filename filter; CI uses Node's
100% line, branch and function thresholds as the coverage gate.

`npm run cov` reports through
[`fjs/emergent_testing/node/module.mjs`](./fjs/emergent_testing/node/module.mjs):
Node's `spec` reporter with the passed tests and the fully covered files
filtered out, so a green run prints its summary — the test counts and the
`all files` coverage row — and a red one prints each failure and each file
under a threshold. The block above uses Node's default reporter, which lists
every test; add the same `--test-reporter` for the same output.

To validate the packed npm package itself against clean Node, Deno, and Bun
consumers — for example after changing `prepack`, `files`, or anything that
affects emitted declarations — follow
[`fjs/ci/packed-consumer-validation.md`](./fjs/ci/packed-consumer-validation.md).

New `.f.mjs` and `.f.js` modules need a co-located proof with 100% proof
coverage — see [fjs/AGENTS.md §1](./fjs/AGENTS.md#1-testing-and-proof-coverage).
Authored FunctionalScript is JavaScript with JSDoc: a `module.f.mjs` is
accompanied by a `proof.f.mjs`, and a separately useful type-level API may live
in a sibling `types.ts`. Compiler support is not required of a `.f.mjs`;
a module the current compiler accepts whole is renamed `module.f.js` in the same
pull request, which promises it and keeps a `proof.f.mjs` too.

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

`gen` starts by deleting every generated output through `fjs/dev/clean`. An output no generator writes any more shows up as a
deletion, and every source generator runs again. CI's drift check runs `gen` and then
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
  with one `#[path]`, as `nanvm/harness/src/lib.rs` does for
  `gen.fixtures/`. A dotted name cannot be a Cargo target root.
- A committed output must not use a name `.gitignore` hides (`*.d.ts`,
  `*.d.mts`, `index.html`, `_*`), or the drift check cannot see it.
- A generator creates its output directory, and imports nothing generated —
  the `fjs` CLI that runs it included.
- `gen:clean` walks the tree with the same test, skipping dot-names other
  than `.github`, `node_modules` and `target`. It removes files only; the
  emptied directories are invisible to git.

### Updating dependencies

Update exact accepted versions in `fjs/ci/config/module.f.js` and the mise
manifest together. Keep `.node-version`, the package engine and the root lockfile
engine synchronized. Refresh the manager lock, including every supported
platform and any npm sidecars, then run scoped checks and `./dev.sh npm run gen`.
`./dev.sh npm run lock-update` refreshes manager and package dependency locks.

## Opening a pull request

A pull request implements only one feature or improvement, with minimal code
changes. Before submitting, ensure every check above passes and delete the
`todo/` issue file it fixes, if there is one. It adds **no changelog file**: the
changelog is written once per release from the pull requests that shipped in it,
by the release's notes pull request after the version publishes
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

An LLM agent creating or updating a pull request must include a link to its
working session in the description, including for draft pull requests. Put
`Session: [link](URL)` in the trailer block at the end of the description and
preserve existing session links on updates. Use the actual session URL; if it
is not available to the agent, ask the task owner rather than inventing a link.
Developers working without an LLM agent are not required to provide a session
link.

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
  appends, and never write a `(#NNN)` of your own. A release's bump pull
  request is titled `Release X.Y.Z`, and its notes pull request
  `changelog: write the X.Y.Z notes`.
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

  The section is raw material: the notes pull request rewrites entries over the
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

Install mise in the environment setup and initialize this trusted checkout:

```sh
mise trust
mise install --locked
./dev.sh npm ci
./dev.sh cargo fetch
```

Each command runs in a fresh process. Use `./dev.sh <command>` so the selected
tools are available every time. Verify `./dev.sh node --version` against the
exact central pin before editing. Do not run untrusted review hooks with broader
permissions.
