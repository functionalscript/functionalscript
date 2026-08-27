# Contributing to FunctionalScript

This repository is a monorepo with two code bases: `fjs/` (the FunctionalScript
language, its standard modules, and the `fjs` CLI) and `nanvm-lib/` (NaNVM, the
native FunctionalScript VM, in Rust).

**Coding style, testing rules, design principles, and pull request requirements
start in [AGENTS.md](./AGENTS.md).** Read it before opening a pull request — it
applies to human and AI contributors alike. That file is a map: the
repository-wide design principles are in [DESIGN.md](./DESIGN.md), the
FunctionalScript and TypeScript rules in [fjs/AGENTS.md](./fjs/AGENTS.md), and
the Rust ones in [nanvm-lib/AGENTS.md](./nanvm-lib/AGENTS.md). This file covers
getting a working environment and opening a pull request; every document links
to the others rather than restating them, so they cannot drift apart.

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
| [Rust](https://www.rust-lang.org/tools/install)    | **latest**           | NaNVM (`nanvm-lib`) development only.                            |
| Deno    | latest               | Updating dependencies; an alternative test runtime.               |
| Bun     | latest               | Updating dependencies; an alternative test runtime.               |

You may also use the [Dockerfile](./docker/Dockerfile), which sets all of this up
and is the easiest way to get a known-good environment.

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
npx tsc                  # type-check with the repository's TypeScript
npm test                 # tsc + the FunctionalScript test suite
cargo test               # only if you touched Rust
cargo clippy
cargo fmt -- --check
```

#### Ways to run the FunctionalScript test suite

Every row below runs the same suite; pick the first one that fits your
environment.

| Command                                 | Runtime  | Needs internet | Notes                                    |
| --------------------------------------- | -------- | -------------- | ---------------------------------------- |
| `npm test`                              | Node 22+ | no             | `tsc` + the repo's runner.               |
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

`main` takes exactly one commit per pull request: the squash merge, titled
`<PR title> (#NNN)` with the pull request description as its body. Both halves
are reviewed text that outlives the pull request page, and a changelog generated
from Git history could read nothing else, so write the title and the description
as the commit message they become. Commits on the branch are discarded by the
squash, so their messages are working notes.

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
- **How it lands.** Squash and merge, always. The merge box offers the reviewed
  title and description as the default message — don't edit it there, where
  nobody reviews the result. A rebase merge would replay the branch's commits
  with their working-note messages and no `(#NNN)`; a merge commit would bury
  the pull request in a two-parent graph. Nothing lands on `main` outside a
  pull request.

### Addressing review comments

One criterion decides all of this. Working on a pull request teaches you
something — about the design, about the runtime, about the shape the code wants
to take — and that knowledge is the part worth keeping. **Merge the
knowledge.** A small step merged with what was learned written down beats two
hundred iterations of a pull request that never lands: the merged step is a
result somebody can build on, and the abandoned pull request is nothing at all,
however much understanding went into it.

Most review comments are therefore simply right and simply fixed: the bug, the
simpler expression, the answer to the question. The rest ask the pull request
to grow rather than to improve, and an author may push back on those — but a
push-back is never a dismissal. Each one leaves something behind in the
repository, because a reason that lives only in a review thread is gone the
moment the pull request is merged.

- **A design document asked for implementation detail.** A pull request whose
  diff is a `todo/` file — or a design section of a `README.md` — settles *what*
  is being built and *why*, not *how*. The data structures, the helper split,
  the order of the passes, and the names inside the module belong to whoever
  implements it; pinning them in the design either freezes a decision nobody yet
  has the information to make, or is quietly ignored once the code exists. So
  when a reviewer asks the design to spell out an implementation, say that the
  choice is left to the implementer — and **write that answer into the design
  document**, not only into the review thread. The next reader of the issue then
  finds the question already asked and already answered instead of asking it
  again. If the answer turns out to constrain the implementation after all — a
  bound the rest of the document depends on, an API its other sections assume —
  then it was design and not detail: record the constraint, and leave everything
  it does not decide open.

  Pushing back is not refusing to look. When the reviewer's question is
  genuinely open — nobody yet knows whether the shape works — **write a
  prototype**, and put what it *uncovered* into the design document: the gray
  area it exposed, the constraint that turned out to be real, the approach that
  could not be made to work. Say in the document that it came from a prototype
  and does not bind the implementation. The prototype's job is to find the
  unknowns, not to become the code that ships, and it will usually be thrown
  away; a design recording "we tried X, and Y stops working" is worth more than
  one that specifies X.

- **An implementation asked for another feature.** A pull request implements one
  feature or improvement, with minimal code changes ([AGENTS.md
  §5](./AGENTS.md#5-pull-requests-and-releases)); a reviewer's "while you're
  here, it should also …" is a second one. Do not fold it in, and do not drop
  it: **file a `todo/` issue to investigate the feature**, next to the code it
  describes ([todo/README.md](./todo/README.md)), and reply with a link to it.
  That issue is the honest answer — the request is worth considering, it has not
  been considered yet, and the investigation is what decides whether it ships at
  all. Adding the file to the pull request under review is fine when the file is
  all that it adds; otherwise file it separately, so this pull request stays one
  change.

A comment saying the change is **wrong** is not automatically this pull
request's work either. Even a known edge case that crashes the program may be
deferred, and by the criterion above it often should be: a pull request that
grows a fix for every defect a reviewer can name stops converging, and
everything it learned goes with it when it is abandoned.

What makes that push-back legitimate is the same thing as in the two cases
above — **the `todo/` issue must be filed**, and it must carry the knowledge
rather than a shrug: what crashes, the input that triggers it, and whatever the
reviewer or the author already knows about why. A crash recorded that precisely
is a scoped next step someone can pick up; the same crash left in a review
thread is a bug nobody can find again. What may not be deferred is a
**regression** — something that worked before this pull request and does not
after. A step forward that carries a known limitation is progress; a step that
takes working behavior away is not, whatever is filed alongside it.

How far a crash may be deferred depends on **what the software is and whether
the input is real** — not on whether the crash falls inside what the change
claims to do. An internal script that generates our own website, found not to
handle a file above 128 KB, is a documented limit and a `todo/`: the only
people who can hand it a file are the people who maintain it, no such file
exists, and the day one does is the day the issue gets picked up. [DESIGN.md
§1](./DESIGN.md#1-simplicity-first) already treats a limit a later generic
improvement can lift as an acceptable interim answer, and this is one. A module
that ships in the published package is the opposite case: the input belongs to
someone we have never met, "no such input exists" is not something we are in a
position to know, and a crash inside what the module claims to support is fixed
before it lands. In between, ask who runs this, what they can hand it, and what
it costs them when it breaks — then write that answer into the `todo/`, so the
deferral is a judgement on record rather than an omission.

So the question to ask about a review comment is not "is this in scope" but
**"where does this knowledge live once the pull request is merged?"** In the
diff — then fix it here. In the design document, or in a new `todo/` issue —
then write it there, and reply with the link. Only "in the review thread" is
the wrong answer; that is the one place it will not survive.

And when the honest answer is "nowhere, because this pull request is never
going to land" — the design was wrong, the approach does not work, the review
turned up more than the change can carry — then **change what the pull request
is**. Drop the code and keep what it taught: a rewritten `todo/`, a design
document recording the approach that failed and why, a note in the module's
`README.md`. Merge that. A pull request that lands three paragraphs nobody has
to rediscover has done more than one that closes after a hundred comments with
no diff at all.

The same holds once a design leaves review and someone implements it: a `todo/`
that cannot be implemented the way it describes is rewritten, never forced
through ([DESIGN.md §3](./DESIGN.md#3-design-before-implementation)). A
reviewer holding the code to that design is answered with what does not work,
not with a workaround.

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
