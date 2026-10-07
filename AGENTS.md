# Agent Instructions

This repository is a monorepo with two code bases:

| Directory    | Language                                | Notes                                       |
| ------------ | --------------------------------------- | ------------------------------------------- |
| `fjs/`       | FunctionalScript (`.f.mjs`, `.f.js`) / TypeScript (`types.ts`) | The language, its standard modules, and the `fjs` CLI |
| `nanvm-lib/` | Rust                                    | NaNVM, the native FunctionalScript VM       |

Issues live in `todo/` directories, **not** on GitHub. Check them for existing
work before starting, and check that no open pull request, draft or not, already
works on the same `todo/`. Claim a task by opening a draft pull request for it
at once ([SESSION.md](./doc/SESSION.md#claim-the-task)).

Develop inside the Nix shell `./dev.sh` opens — every developer and every
agent, on every platform ([§2](#2-environment-and-running-tests)). It carries
every tool below at the version CI uses; nothing is installed by hand.

Run the full check set before submitting:

```bash
tsc                      # type-check; the shell's compiler
fjs test                 # or any equivalent runner
npm start compile        # every authored .f.js still compiles; the working tree's compiler
cargo test               # only if you touched Rust
cargo clippy
cargo fmt -- --check
```

Before committing, pushing, or opening a behavior-changing PR, run the same
Node suite CI runs:

```bash
node --test
```

It must complete with exit code 0 and an observed final pass/fail summary. A
targeted suite, partial output, or interrupted run does not satisfy this check.
After `npm run gen`, rerun `node --test` and every relevant check above
before publishing. If a check's tool is unavailable, you are outside the shell:
enter it, or report the PR as unready; do not treat an unavailable required
check as passing. `tsc` in particular is not a dependency of this package, and
`npx tsc` does not run the repository's compiler: with nothing to resolve in
`node_modules` it fetches whatever the registry calls latest.

Three principles outrank everything else. **Always prefer simplicity and quality
over optimization** — never optimize prematurely, and never at the cost of
simplicity. **Maximize signal-to-noise** — make the high-level structure obvious;
put details and edge cases at the leaves, not in the main flow. **The API is the
most important part of quality** — if a new version can have a better, simpler
API, change it; breaking changes are the right call whenever they improve the
API. The full set, which governs both code bases, is [DESIGN.md](./doc/DESIGN.md).

Before proposing changes to FunctionalScript syntax or semantics, read
[DESIGN.md §12](./doc/DESIGN.md#12-preserve-harmless-javascript-conventions).
Preserve harmless JavaScript conventions and justify restrictions. A new
language feature must start with a `todo/` proposal explaining its benefits and
drawbacks, and receive formal, explicit approval from another language designer
before implementation.

This file is a map: each section below holds the facts you must not violate and
links to the document that holds the rest. Read a linked document when the task
actually touches its subject.

## Contents

1. [Workflow](#1-workflow)
2. [Environment and running tests](#2-environment-and-running-tests)
3. [FunctionalScript and TypeScript (`fjs/`)](#3-functionalscript-and-typescript-fjs)
4. [Rust (`nanvm-lib/`)](#4-rust-nanvm-lib)
5. [Pull requests and releases](#5-pull-requests-and-releases)
6. [External tools](#6-external-tools)
7. [Continuous integration](#7-continuous-integration)

---

## 1. Workflow

These habits come before the procedure:

- **Be proactive.** If you see something that would improve or simplify the
  task — a better API, a step that makes another unnecessary, a design the
  request did not ask for but would be better served by — propose it and ask,
  rather than silently doing what was asked or silently doing something else.
- **Reuse code; export what you need.** Do not hesitate to make something in
  another module public when the task needs it: export it and import it,
  rather than copying it or working around it. A copy is a second
  implementation that will drift; an export is one. The same goes for a value
  held inline that a consumer needs a handle on — a rule a grammar writes
  inside another, say — export it under a name.
- **Use the actual input contract.** FJS immutability guarantees acyclic
  constructed container graphs. Do not add cycle checks or host-mutation
  fixtures for FJS APIs. Compiler and VM output preserves its invariants by
  construction; validate separately supplied EDAG data once where it enters.
  Outbound conversion to `unknown` does not create a reverse-admission
  requirement. A speculative host contract written into a TODO does not
  authorize new validation machinery or tests; an actual requested host
  boundary needs its own scoped contract.

File an issue in `todo/`, next to the code it describes, when the work is worth
tracking — a problem statement is enough. Except for
[new language features](./doc/DESIGN.md#12-preserve-harmless-javascript-conventions),
a design is not a gate: it grows one pull request at a time — an
underspecified `todo/`, then details and ideas, then an implementation — and
none of them waits on the document being complete. What every step owes is
direction and consistency: a `todo/` that contradicts the code or another
`todo/` is corrected, not built on, and deviating from a design is fine where
deviating silently is not
([DESIGN.md §3](./doc/DESIGN.md#3-design-before-implementation)). Write the
code plus its proof, run `npm run gen` after changing source, run the check
set above, and delete the `todo/` issue file the PR fixes, if there is one.

A file or directory whose name starts with `gen.` is generated, and so is
everything inside a `gen.*` directory: change its generator, never the output,
and never give a handwritten file that name. Every committed generated file
follows it; `.gitattributes` marks the names
([CONTRIBUTING.md](./CONTRIBUTING.md#naming-generated-files)).

Format, priorities, where each issue file belongs, and how GitHub-reported bugs
become `todo/` files: [todo/README.md](./todo/README.md). How one session takes
one task from its `todo/` to the last pull request merged — a stack of small
pull requests, and a question at every step: [SESSION.md](./doc/SESSION.md).

## 2. Environment and running tests

Install [Nix](https://nixos.org/download/) and work inside the repository's
shell. `gen.nix/` is a flake carrying every tool the project builds and tests
with — Node, TypeScript, Rust with its WASM targets, Deno, Bun, the WASM
runtimes — at the versions CI uses. Every CI job runs inside this very shell, so
what passes in it is what passes there, except the Node 22 and Node 24
compatibility jobs, each on a flake of its own, the two Windows platform jobs,
which run without Nix, and the publishing workflow, which runs on the Node
`setup-node` installs. The packed-package check that closes `node26` stays out
of it too, by design: it installs the published tarball with `setup-node`'s
Node and npm, as a consumer would. Do not install those tools by hand or pick
their versions; the shell is the one environment.

```bash
./dev.sh                      # an interactive shell
./dev.sh <command>            # one command in it; CI steps run the generated sh ./gen.nix/run <command>
```

`dev.sh` enables flakes itself, so a stock Nix install needs no configuration.
On macOS and Linux, install Nix on the host. Nix does not run natively on
Windows: open the repository in the devcontainer —
[`.devcontainer/`](./.devcontainer/devcontainer.json) builds a Debian image
with Nix and runs `npm ci` in the shell on any host, and VS Code and Codespaces
also open every terminal inside the shell — or work in WSL2 with Nix installed
there. The shell is the same either way. Bare Windows, outside both, is on your
own: install the tools [CONTRIBUTING.md](./CONTRIBUTING.md#requirements)'s table
names yourself, at the exact versions `fjs/ci/config/module.f.js` pins, which
are what CI's Windows jobs install. A Claude Code cloud session runs `npm ci` in
the shell and puts the shell's tools on its `PATH` before its first command,
from [`.claude/hooks/session-start.sh`](./.claude/hooks/session-start.sh).

Inside the shell, `npm ci` installs Node dependencies and `cargo fetch` the
Rust ones. `npm test` runs `tsc` plus the FunctionalScript suite; `fjs test`
and its Deno, Bun, and published-CLI equivalents run the same suite. To run
only the tests under a subtree, `cd` into it and run the runner from there.

Every equivalent way to run the suite and the dependency-update procedure:
[CONTRIBUTING.md](./CONTRIBUTING.md). How the shell is generated and why it
looks the way it does: [fjs/ci/nix/README.md](./fjs/ci/nix/README.md).

Keep any website demos affected by the change working. Contributors may add or
update demos; check them in the browser and include their preview links in the
PR description as described in
[CONTRIBUTING.md](./CONTRIBUTING.md#website-demos).

## 3. FunctionalScript and TypeScript (`fjs/`)

Business logic under `fjs/` belongs in FunctionalScript: write it in `.f.mjs`,
or `.f.js` once the current compiler accepts it. Use plain `.mjs` only where code
must perform effects or depend on host JavaScript behavior; effect
implementations, platform adapters, runners, test harnesses, and host-specific
proofs are examples, not a closed list of exceptions. Keep such `.mjs` files
thin: isolate the impure or host-specific boundary there and move business logic
into FunctionalScript. Existing `.mjs` files that violate this rule are
migration debt, not precedent: find or file a co-located `todo/` to extract the
business logic as soon as possible.

Every new `.f.mjs` or `.f.js` module ships a co-located `proof.f.mjs` with
**100% proof coverage** — every export called, every line executed, every branch
taken.
Values are immutable (no in-place mutation, no `.push`/`Map#set`/index
assignment), there is no `try`/`catch` and no regular expressions, and types are
written in JSDoc with a sibling `types.ts` for a type-level API. No authored
`.mjs` anywhere in the repository — `fjs/` or not — may contain a **file-scope**
JSDoc `@typedef`; function-local typedefs are allowed. Named types live in
`types.ts` (the public declaration closure) or an optional `private.ts`.

Testing, documentation, and the full coding style: [fjs/AGENTS.md](./fjs/AGENTS.md).

## 4. Rust (`nanvm-lib/`)

`cargo test`, `cargo clippy`, and `cargo fmt -- --check` all have to pass. Avoid
`macro_rules!` — declarative macros hide types from tooling and contradict this
repository's preference for explicit, locally-readable code.

Commands and Rust coding style: [nanvm-lib/AGENTS.md](./nanvm-lib/AGENTS.md).

## 5. Pull requests and releases

A PR implements only one feature or improvement, with minimal code changes, and
every check above passing. Its title and description become the merge commit
on `main`, so write them as one: a `<topic>: <short description>` title and a
description. **A PR adds no changelog file** — the changelog is written once per
release, from the PRs that shipped in it. What a PR owes is one declaration:
when it **breaks the public API**, a `Changelog:` section — the last section of
the description before any trailer block — with an item prefixed
`**BREAKING CHANGES:**`. That is required, because nothing derives a break from
a diff and the release reads it to pick the version number. For a non-breaking
change the section is optional raw material for the release author, and a PR
that changes no observable behavior omits it. Breaking changes are welcome when
they improve the API — declare it and update every importer in the same PR.

**Merge the knowledge.** A small step merged with what was learned written down
beats two hundred iterations of a PR that never lands. Answer a review, don't
absorb it — and never only in the thread, which is the one place the answer
will not survive. A crash may be deferred behind a `todo/` naming the input
that breaks it; a **regression** may not, and neither may **silence** — an
unsupported input is refused, never answered with a plausible wrong value
([DESIGN.md §10](./doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

Which comments to fix, which to push back on, and what a push-back leaves
behind: [REVIEW.md](./doc/REVIEW.md). What to raise when reviewing, what to ask
for, and when to approve: [REVIEWING.md](./doc/REVIEWING.md).
Commit-message format and the PR checklist:
[CONTRIBUTING.md](./CONTRIBUTING.md#opening-a-pull-request).
Changelog entry rules, breaking changes, and versioning:
[changelog/README.md](./changelog/README.md).
How a release collects its entries: [changelog/RELEASE.md](./changelog/RELEASE.md).

## 6. External tools

**Do not call an external tool from our code — a CI step, a script, a
generator — without approval first.** `grep`, `sed`, `awk` and their kin
included.

Text matching is not analysis. A pattern over source text cannot tell a JSDoc
tag from the same characters inside a string or a comment, so a check built on
one returns confident answers it has no basis for. A `grep` guard for `@module`
placement flagged the very file whose assertions named the guard, and its
companion could not have seen a missing tag in any file that mentioned the tag
anywhere — a check that cannot fail is indistinguishable from one that passes.
Where a rule needs real analysis, the answer is an established tool that parses
what it checks — ESLint for JavaScript, Clippy for Rust — proposed and approved
before it is added, never a pattern that approximates one.

**Leaving the check undone is the better trade against that complexity.** A
rule no available tool can express stays written down and unenforced. That is
honest, and cheaper than machinery whose failures are silent.

Keep simple tasks simple; a script earns its place only where the task genuinely
is not. Instances predating this rule are not precedent for new ones.

## 7. Continuous integration

**A CI step runs one command.** Never bundle a job's command sequence into a
single shell invocation — no `bash -c 'a && b && c'` wrapper, and one
`nix develop --command` per step rather than one invocation carrying the whole
job. The step is the unit CI reports on: a bundle collapses to one red result
naming the wrapper rather than the command that failed, and hides which of the
commands ran at all.

Two commands are one step only when the second is meaningless alone and neither
is separately reportable. Both such pairs in the generated workflow qualify:
`git add -A && git diff --cached --exit-code` stages so the comparison has
something to compare, and `sudo apt-get update && sudo apt-get install -y …`
refreshes indices the install then reads — split, the update's exit status
reports nothing anyone acts on.

Repeating a wrapper per step costs nothing that matters. Entering a Nix
development shell re-runs that shell's `shellHook`, so a job-local environment
is re-established for every step instead of being exported across them.

Both workflows are generated — `.github/workflows/gen.ci.yml` and
`.github/workflows/gen.npm-publish.yml`. Change `fjs/ci`, run `npm run gen`,
and commit the result. Never edit either by hand.
