# Agent Instructions

This repository is a monorepo with two code bases:

| Directory    | Language                                | Notes                                       |
| ------------ | --------------------------------------- | ------------------------------------------- |
| `fjs/`       | FunctionalScript (`.f.mjs`) / TypeScript (`types.ts`) | The language, its standard modules, and the `fjs` CLI |
| `nanvm-lib/` | Rust                                    | NaNVM, the native FunctionalScript VM       |

Issues live in `todo/` directories, **not** on GitHub. Check them for existing
work before starting.

Run the full check set before submitting:

```bash
npx tsc                  # type-check with the repo's TypeScript
fjs test                 # or any equivalent runner
cargo test               # only if you touched Rust
cargo clippy
cargo fmt -- --check
```

Three principles outrank everything else. **Always prefer simplicity and quality
over optimization** — never optimize prematurely, and never at the cost of
simplicity. **Maximize signal-to-noise** — make the high-level structure obvious;
put details and edge cases at the leaves, not in the main flow. **The API is the
most important part of quality** — if a new version can have a better, simpler
API, change it; breaking changes are the right call whenever they improve the
API. The full set, which governs both code bases, is [DESIGN.md](./DESIGN.md).

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

Find or file the issue in `todo/` first, next to the code it describes; for
anything non-trivial make sure it contains a concrete design before writing
code. Deviating from that design later is fine; deviating silently is not, and
a design that cannot be built as written is rewritten rather than forced
through ([DESIGN.md §3](./DESIGN.md#3-design-before-implementation)). Write the
code plus its proof, run `npm run update` after changing source, run the check
set above, and delete the `todo/` issue file in the same PR that fixes it.

Format, priorities, where each issue file belongs, and how GitHub-reported bugs
become `todo/` files: [todo/README.md](./todo/README.md).

## 2. Environment and running tests

`npm ci` installs Node dependencies and `cargo fetch` the Rust ones. `npm test`
runs `tsc` plus the FunctionalScript suite; `fjs test` and its Deno, Bun, and
published-CLI equivalents run the same suite. To run only the tests under a
subtree, `cd` into it and run the runner from there.

Required tool versions, every equivalent way to run the suite, and the
dependency-update procedure: [CONTRIBUTING.md](./CONTRIBUTING.md).

## 3. FunctionalScript and TypeScript (`fjs/`)

Business logic under `fjs/` belongs in FunctionalScript: write it in `.f.mjs`.
Use plain `.mjs` only where code must perform effects or depend on host JavaScript
behavior; effect implementations, platform adapters, runners, test harnesses,
and host-specific proofs are examples, not a closed list of exceptions. Keep
such `.mjs` files thin: isolate the impure or host-specific boundary there and
move business logic into `.f.mjs`. Existing `.mjs` files that violate this rule
are migration debt, not precedent: find or file a co-located `todo/` to extract
the business logic as soon as possible.

Every new `.f.mjs` module ships a co-located `proof.f.mjs` with **100% proof
coverage** — every export called, every line executed, every branch taken.
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
every check above passing. Its title and description become the squash commit
on `main`, so write them as one: a `<topic>: <short description>` title and a
description. A PR that changes behavior or the public API adds
`changelog/unreleased/<PR>.md`, named by the real PR number once the PR exists,
and repeats it in a matching `Changelog:` section — the last section of the
description before any trailer block; a PR that doesn't — internal refactors,
test-only changes, and PRs that only touch `todo/`, `AGENTS.md`, or other
documentation — needs neither. Breaking changes are welcome when they improve
the API — prefix the entry with `**BREAKING CHANGES:**` and update every
importer in the same PR.

**Merge the knowledge.** A small step merged with what was learned written down
beats two hundred iterations of a PR that never lands. Answer a review, don't
absorb it — and never only in the thread, which is the one place the answer
will not survive. A crash may be deferred behind a `todo/` naming the input
that breaks it; a **regression** may not, and neither may **silence** — an
unsupported input is refused, never answered with a plausible wrong value
([DESIGN.md §10](./DESIGN.md#10-refuse-what-you-cannot-handle)).

Which comments to fix, which to push back on, and what a push-back leaves
behind: [REVIEW.md](./REVIEW.md).
Commit-message format and the PR checklist:
[CONTRIBUTING.md](./CONTRIBUTING.md#opening-a-pull-request).
Changelog entry rules, breaking changes, and versioning:
[changelog/README.md](./changelog/README.md).

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

`.github/workflows/ci.yml` is generated: change `fjs/ci`, run
`npm run ci-update`, and commit the result. Never edit it by hand.
