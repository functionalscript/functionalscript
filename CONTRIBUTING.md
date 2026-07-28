# Contributing to FunctionalScript

This repository is a monorepo with two code bases: `fjs/` (the FunctionalScript
language, its standard modules, and the `fjs` CLI) and `nanvm-lib/` (NaNVM, the
native FunctionalScript VM, in Rust).

**Coding style, testing rules, design principles, and pull request requirements
all live in [AGENTS.md](./AGENTS.md).** Read it before opening a pull request —
it applies to human and AI contributors alike. This file covers only getting a
working environment; it links to `AGENTS.md` rather than restating it, so the two
cannot drift apart.

## Issues

Issues are tracked in `todo/` directories inside the repository, **not** on
GitHub. Check [todo/README.md](./todo/README.md) for existing work before you
start, and for the format to use when filing a new one.

To report a bug or ask a question without opening a pull request, feel free to
use [GitHub issues](https://github.com/functionalscript/functionalscript/issues).

## Requirements

| Tool    | Version              | Required for                                                     |
| ------- | -------------------- | ---------------------------------------------------------------- |
| [Node.js](https://nodejs.org/en/download) | **latest** (22 min.) | Everything. Node 24+ for `node --test` and `npm run cov`.        |
| [Rust](https://www.rust-lang.org/tools/install)    | **latest**           | NaNVM (`nanvm-lib`) development only.                            |
| Deno    | latest               | Updating dependencies; an alternative test runtime.               |
| Bun     | latest               | Updating dependencies; an alternative test runtime.               |

You may also use the [Dockerfile](./docker/Dockerfile), which sets all of this up
and is the easiest way to get a known-good environment.

Node 22 is enough for `npm test` and the repository's own test runner, but on
Node 22 `node --test` reports every `throw`-tagged test as a failure, so a clean
tree looks broken — see
[AGENTS.md §1.3](./AGENTS.md#13-the-node-version-caveat).

### Installing dependencies

```bash
npm ci        # Node dependencies
cargo fetch   # Rust dependencies
```

### Running tests

```bash
npx tsc                  # type-check with the repository's TypeScript
npm test                 # tsc + the FunctionalScript test suite
cargo test               # only if you touched Rust
cargo clippy
cargo fmt -- --check
```

`npm test` is one of several ways to run the FunctionalScript suite; the Deno,
Bun, and published-CLI equivalents are listed in
[AGENTS.md §1.4](./AGENTS.md#14-ways-to-run-the-functionalscript-test-suite).

New `.f.ts` modules need a co-located `proof.f.ts` with 100% proof coverage —
see [AGENTS.md §3](./AGENTS.md#3-testing-and-proof-coverage).

### Updating dependencies

```bash
npm run update
```

Run this after changing source code. It requires Node, Deno, and Bun to all be
installed: `package-lock.json`, `deno.lock`, and `bun.lock` are all under Git
control, and the update refreshes each of them (plus the generated CI workflow).

## Opening a pull request

The full workflow is in [AGENTS.md §2](./AGENTS.md#2-everyday-workflow) and
[AGENTS.md §8](./AGENTS.md#8-pull-requests). In short: one feature or improvement
per pull request, every check above passing, the `todo/` issue deleted in the
same pull request, and — for code changes — a [CHANGELOG.md](./CHANGELOG.md)
entry added with the real pull request number once the pull request exists.

## OpenAI Codex environment

Set Node.js to 22. Use `npm test` rather than `npm run cov` there, per the Node
version caveat above.

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
