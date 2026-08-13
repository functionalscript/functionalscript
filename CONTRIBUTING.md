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

To **file** an issue yourself, add its `todo/` file in a pull request. Note that
a pull request that **fixes** an issue does the opposite — it deletes that
issue's `todo/` file; see [AGENTS.md §2](./AGENTS.md#2-everyday-workflow).

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
| [Rust](https://www.rust-lang.org/tools/install)    | **latest**           | NaNVM (`nanvm-lib`) development only.                            |
| Deno    | latest               | Updating dependencies; an alternative test runtime.               |
| Bun     | latest               | Updating dependencies; an alternative test runtime.               |

You may also use the [Dockerfile](./docker/Dockerfile), which sets all of this up
and is the easiest way to get a known-good environment.

Node 22 also supports `node --test` and `npm run cov`: external test
registration automatically uses an inline compatibility strategy below Node
`26.0.0`.

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

To validate the packed npm package itself against clean Node, Deno, and Bun
consumers — for example after changing `prepack`, `files`, or anything that
affects emitted declarations — follow
[`fjs/ci/packed-consumer-validation.md`](./fjs/ci/packed-consumer-validation.md).

New `.f.mjs` modules need a co-located proof with 100% proof coverage — see
[AGENTS.md §3](./AGENTS.md#3-testing-and-proof-coverage). Authored
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

The full workflow is in [AGENTS.md §2](./AGENTS.md#2-everyday-workflow) and
[AGENTS.md §8](./AGENTS.md#8-pull-requests). In short: one feature or improvement
per pull request, every check above passing, the `todo/` issue deleted in the
same pull request, and — for code changes — a [CHANGELOG.md](./CHANGELOG.md)
entry added with the real pull request number once the pull request exists.

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
