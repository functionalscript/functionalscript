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

---

## 1. Workflow

Find or file the issue in `todo/` first, next to the code it describes; for
anything non-trivial make sure it contains a concrete design before writing
code. Write the code plus its proof, run `npm run update` after changing source,
run the check set above, and delete the `todo/` issue file in the same PR that
fixes it.

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

Every new `.f.mjs` module ships a co-located `proof.f.mjs` with **100% proof
coverage** — every export called, every line executed, every branch taken.
Values are immutable (no in-place mutation, no `.push`/`Map#set`/index
assignment), there is no `try`/`catch` and no regular expressions, and types are
written in JSDoc with a sibling `types.ts` for a type-level API.

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

Answer a review, don't absorb it. A reviewer who asks a **design document** (a
`todo/` file) to spell out an implementation is told the choice belongs to the
implementer — and that answer goes **into the design document**, not only into
the review thread. A reviewer who asks an **implementation** for another feature
gets a new `todo/` issue to investigate it and a link to that issue, never a
wider diff. A comment saying the change is wrong is neither: fix it in this PR.

Commit-message format, the PR checklist, and addressing review comments:
[CONTRIBUTING.md](./CONTRIBUTING.md#opening-a-pull-request).
Changelog entry rules, breaking changes, and versioning:
[changelog/README.md](./changelog/README.md).
