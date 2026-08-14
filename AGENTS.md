# Agent Instructions

This repository is a monorepo with two code bases:

| Directory    | Language                                | Notes                                       |
| ------------ | --------------------------------------- | ------------------------------------------- |
| `fjs/`       | FunctionalScript (`.f.mjs`) / TypeScript (`types.ts`) | The language, its standard modules, and the `fjs` CLI |
| `nanvm-lib/` | Rust                                    | NaNVM, the native FunctionalScript VM       |

Issues live in `todo/` directories, **not** on GitHub. Check them for existing
work before starting — see [todo/README.md](./todo/README.md).

## Contents

1. [Development environment](#1-development-environment)
2. [Everyday workflow](#2-everyday-workflow)
3. [Testing and proof coverage](#3-testing-and-proof-coverage)
4. [Documentation](#4-documentation)
5. [Design principles](#5-design-principles)
6. [Coding style](#6-coding-style)
7. [Issues (`todo/`)](#7-issues-todo)
8. [Pull requests](#8-pull-requests)

---

## 1. Development environment

### 1.1 What to install

| Tool     | Version              | Required for                                                       |
| -------- | -------------------- | ------------------------------------------------------------------ |
| Node.js  | **latest** (22 min.) | Everything.                                                         |
| Rust     | **latest**           | NaNVM (`nanvm-lib`) development only.                              |
| Deno     | latest               | Updating dependencies; an alternative test runtime.                |
| Bun      | latest               | Updating dependencies; an alternative test runtime.                |

[docker/Dockerfile](./docker/Dockerfile) sets all of this up and is the easiest
way to get a known-good environment.

### 1.2 Installing dependencies

```bash
npm ci        # Node dependencies
cargo fetch   # Rust dependencies
```

### 1.3 Node test-runner compatibility

External test registration automatically uses an inline compatibility strategy
below Node `26.0.0`, so `node --test` and `npm run cov` correctly handle
`throw`-tagged tests on Node 22. Node `26.0.0` and later use the native
`expectFailure` strategy and remain the fully supported native baseline.

### 1.4 Ways to run the FunctionalScript test suite

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

### 1.5 Updating dependencies

To bump an npm devDependency version, edit `package.json` by hand first (there
is no `npm-check-updates` step anymore). Then run:

```bash
npm run update
```

This requires **Node, Deno, and Bun to all be installed**: `package-lock.json`,
`deno.lock`, and `bun.lock` are all under Git control, and the update refreshes
each of them (plus the generated CI workflow) to match whatever versions are
currently declared in `package.json`.

### 1.6 Rust commands

```bash
cargo test               # test the nanvm-lib crate
cargo clippy             # lint
cargo fmt -- --check     # verify formatting
```

---

## 2. Everyday workflow

1. Find or file the issue in `todo/` ([§7](#7-issues-todo)). For anything
   non-trivial, make sure it contains a concrete design first.
2. Write the code, plus a co-located proof for every new `.f.mjs` module
   ([§3](#3-testing-and-proof-coverage)).
3. Run `npm run update` after changing source code.
4. Run the full check set before submitting:
   ```bash
   npx tsc                  # type-check with the repo's TypeScript
   fjs test                 # or any equivalent from §1.4
   cargo test               # only if you touched Rust
   cargo clippy
   cargo fmt -- --check
   ```
5. Delete the `todo/` issue file in the same PR that fixes it.
6. Open the PR. If it changes code, add the CHANGELOG entry using the real PR
   number ([§8.3](#83-changelog)) — PRs that only touch `todo/`, `AGENTS.md`, or
   other documentation don't need one.

---

## 3. Testing and proof coverage

### 3.1 Commands

- `npx tsc` — type-check using the repository's version of TypeScript.
- `fjs test` (or any equivalent from [§1.4](#14-ways-to-run-the-functionalscript-test-suite))
  — test FunctionalScript (`.f.mjs`) files.
- `cargo test`, `cargo clippy`, `cargo fmt -- --check` — the Rust crate.

### 3.2 Proof coverage is mandatory

New FunctionalScript modules and functions must have **100% proof coverage**
across every dimension: every exported function called, every line executed, and
every branch (both sides of each conditional) taken. This applies to authored
FunctionalScript source, `.f.mjs`
([`fjs/fsc/README.md`](./fjs/fsc/README.md) defines the extensions). A new
implementation module ships with a co-located proof (its `proof` export) that
exercises all of its exports along all code paths — partial coverage of new code
is not acceptable. If a line or branch genuinely cannot be reached, restructure
the code so it isn't there rather than leaving it uncovered.

An implementation is `module.f.mjs` and its proof is `proof.f.mjs`. Stage 1 of
the TypeScript-to-JavaScript migration is complete: no authored implementation or
proof `.f.ts` remains, so write both files as JavaScript with JSDoc. Authored
`types.ts` companions may remain permanently and hold the type-level API.

Proof discovery and coverage follow the same extension: `shouldLoad` in
[`fjs/dev/module.f.mjs`](./fjs/dev/module.f.mjs) matches authored
FunctionalScript source, and both `npm run cov` and `deno task cov` include
`module.f.mjs`. Ordinary (non-FunctionalScript) `.mjs` files stay opt-in through
the `proof.mjs` filename convention.

A `proof.f.mjs` is authored `.f.mjs` like any other. Its relative **runtime**
imports must target `.f.mjs` modules. Type-only APIs may live in an authored
`types.ts` companion and are referenced directly through that real source path.
Its leading module JSDoc block may include, for example:

```js
/**
 * ...
 *
 * @module
 *
 * @import { Phantom } from '../phantom/types.ts'
 */
```

JSDoc `@import` introduces no runtime dependency; a `types.ts` file naming the
same path from TypeScript uses `import type` instead. A type that several modules
need independently of one implementation belongs in `types.ts`, not in a JSDoc
typedef that consumers would have to reach into the implementation for. Never add
a runtime value for a TypeScript-only declaration such as `declare const`.
Compiler support remains independent of this JavaScript/JSDoc rule. See
[`fjs/fsc/README.md`](./fjs/fsc/README.md) for the extension contract and module
policy.

### 3.3 Use `assert` / `assertEq`, never a hand-written `if`/`throw`

Assert results in `proof` code with `assert`/`assertEq` from
[`fjs/asserts/module.f.mjs`](./fjs/asserts/module.f.mjs), not a hand-written
`if (cond) { throw ... }`.

A local `if`/`throw` in a test is itself a new branch for the coverage tool to
track, and its failure side is normally never exercised (the test is expected to
pass), so it lands as a permanently-uncovered branch in the very module meant to
close coverage gaps. `assert`/`assertEq` push that branch into a shared helper
whose own branches are already fully covered elsewhere, so the call site adds no
new uncovered branch.

### 3.4 Assert type-level facts with `Assert<Equal<…>>`

To prove that a type resolves to what you claim, write
`type _Name = Assert<Equal<Actual, Expected>>` — `Assert` from
`fjs/asserts/types.ts`, `Equal` from `fjs/types/ts/types.ts`. A wrong
claim is then a compile error (TS2344, "Type 'false' does not satisfy the
constraint 'true'"), and the check costs nothing at runtime.

Do **not** state the claim as `true as _Predicate`, where `_Predicate` is a
conditional type resolving to `true` or `false`. That proves nothing:
TypeScript compares an assertion against the *widened* type of its operand, so
`true as false` — and `true as never` — are both legal, and the assertion
compiles no matter what the predicate resolved to. Such an entry in a `proof`
object is doubly inert: the runner only invokes functions, so a boolean leaf is
never counted as a test either.

### 3.5 Never use `try`/`catch`; test throwing with the `throw` key

Never use `try`/`catch` in `.f.mjs` files — FunctionalScript itself has no
`try`/`catch` and isn't planning to add it soon. To test that a call throws,
nest the test function under a `throw` property key instead of wrapping it in
`try`/`catch` (see `fjs/asserts/proof.f.mjs`).

The test runner (`fjs/emergent_testing/module.f.mjs`) treats `throw` as a
structural marker: any function reachable under a `throw` key gets
`throws: true`, and the runner inverts the sandboxed result so a thrown error
counts as a pass — with no manual `caught`/`threw` flag or `assert` needed.

Treat `throw` in FunctionalScript as a panic (like Rust's `panic!`, Go's
`panic`, or Java/C#'s unchecked `RuntimeException`), not as a language-level
`Result`/checked-exception value: nothing in FunctionalScript can catch it, so a
thrown payload is never pattern-matched or branched on by other FunctionalScript
code, and a correctly working program should never throw at all. Recoverable
failure belongs in `Result` (`fjs/types/result`), which callers actually
destructure and is worth asserting on precisely; a `throw`'s payload is read
only by a human or external tooling after something has already gone wrong, so
don't over-invest proof effort in checking its exact value — whether it threw is
normally the part of the contract that matters.

---

## 4. Documentation

Use JSDoc for module documentation in both JavaScript and TypeScript source.
The `@module` tag belongs only to a package's entry-point file — `module.f.mjs` /
`module.mjs` — not to `proof.f.mjs`, `types.ts`, or any other file. A `module.*`
file starts with one module JSDoc block carrying `@module`, followed by one blank
line before the first source-level import or declaration. A `proof.*` or other
non-`module.*` file has no `@module` tag and no required leading documentation
block; one is still needed if the file has `@import` tags to hold, per below.

Group all module-level `@import` tags into one leading JSDoc comment block — the
same block as `@module` in a `module.*` file, or a standalone block at the top of
the file otherwise — then put one blank line before runtime imports. Do not
scatter `@import` tags as separate comments between or after individual `import`
statements. External or built-in runtime imports come first, followed by
repository-owned relative `.mjs` runtime imports, with one blank line between the
groups:

```js
/**
 * <...Module documentation...>
 *
 * @module
 *
 * @import ...
 * @import ...
 */

import ... from 'node:...'
import ... from 'package'

import ... from '...mjs'
import ... from '...mjs'
```

A non-`module.*` file (e.g. `proof.f.mjs`) with `@import` tags but no `@module`
uses the same grouping without the tag:

```js
/**
 * @import ...
 * @import ...
 */

import ... from 'node:...'
import ... from 'package'

import ... from '...mjs'
import ... from '...mjs'
```

Authored TypeScript you write is `types.ts`. Its imports are all type-only, so it
needs no grouping: `import type` names the same real source paths, whether the
type comes from another `types.ts` or from a `.f.mjs` module.

```ts
import type ... from '../other/types.ts'
import type ... from './module.f.mjs'
```

There are no exceptions left: `types.ts` is the only authored TypeScript in
the repository. The former exception — the `fjs/emergent_testing/scenarios`
fixtures and the `all.test.ts` entry, whose `.ts` extension proved that Node,
Bun and Deno execute a TypeScript proof natively — was retired in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520): the
scenario suite never ran in CI and is deleted, with recreation documented in
[`fjs/emergent_testing/scenarios.md`](./fjs/emergent_testing/scenarios.md),
and the test entry is authored `all.test.mjs`.

The runtime-import grouping applies to repository-owned relative imports, not to
external or built-in modules: a FunctionalScript module may depend at runtime on
external modules and on repository `.mjs`, and there is no relative runtime `.ts`
import group at all. The blank line after the leading JSDoc block is required
in every file that has one — `module.*` (even with no `@import` tags),
`types.ts`, and `proof.*` alike; it keeps the header detached from the first
import/declaration and preserves it through declaration emit. `types.ts` is
the most easily missed case, since its emitted `types.d.ts` is the published
documentation for the whole type-level API.

Where each kind of documentation belongs:

| Content                                          | Home                                      |
| ------------------------------------------------ | ----------------------------------------- |
| API shape and invariants                         | JSDoc on `module.f.*` exports or `types.ts` |
| Architectural choices, *why this / why not that* | the relevant `README.md`                  |
| What changed in a release                        | `changelog/` (short, see §8.3)            |
| Rationale, measurements, alternatives considered | the PR description                        |

---

## 5. Design principles

### 5.1 Simplicity first

**Always prefer simplicity and quality over optimization.** Never optimize
prematurely, and especially never at the cost of simplicity. A simple, correct,
generic solution comes first; optimization work starts only after confirming it
is actually needed (a measured problem or a real limit being hit, not a hunch),
and even then it is a **separate task**: file it as its own `todo/` issue instead
of folding it into the current change.

When that task is taken up, still solve the problem in a generic way — improve
the algorithm, the data structure, or the API — instead of hacking special cases
into an otherwise general design (byte-prefix sniffing instead of real parsing,
key-order assumptions, hardcoded fast paths). A documented implementation limit
that a later generic improvement can lift (e.g. a size bound on a buffering
parser) is an acceptable interim answer; a semantic assumption baked into a
format or contract for speed is not.

### 5.2 The API is the most important part of quality

**Quality is the main priority, and the API is the most important part of it.**
A clean, readable, simple API for the modules that consume it is worth more than
any existing API's shape. **If the new version can have a better, simpler API,
change it — never hesitate.** An API kept only because something already calls it
is how a codebase ends up with a heap of legacy nobody is allowed to modify, and
every later design is then bent around it. Never cut corners, hack, or bend a
caller's input/output to fit an existing API's shape just to avoid touching that
API.

When the existing design is the obstacle, **fix the design**: rewrite the API and
make a breaking change, updating every importer in the same PR (see
[§8.4](#84-breaking-changes-and-versioning)). Every consumer inside this
repository is visible and updatable, so a hard cutover is nearly always
available — take it. Adjusting a call site to work around a poor API, instead of
improving the API, is the wrong trade-off here.

Keeping the old API alongside the new one is a **last resort**, not the
convenient middle path: two shapes for one concept doubles what a reader has to
understand and, in practice, the old one never leaves. If a rewrite is genuinely
too large for one PR, split it by **scope** — module by module, each step its own
complete breaking change — rather than by **time**. If a transitional API is
still unavoidable, file a `todo/` issue for removing the old one as part of the
same change; the work isn't done until that issue is deleted.

**If you see a way to improve an API — or a new API that would make consuming
modules simpler and more readable — propose it as soon as you notice it.** Don't
defer or silently work around it. File a `todo/` issue with a concrete design
(see [§7](#7-issues-todo) and [todo/README.md](./todo/README.md)) so it can be
reviewed promptly; if the improvement is in scope for what you're already doing,
raise it before building on top of the weaker design.

### 5.3 Design before implementation

- Before implementing a non-trivial feature, ensure the corresponding issue
  document in `todo/` contains a concrete design. If the issue exists but the
  design is absent, vague, or contradicts the codebase or runtime behavior,
  update the issue first and wait for review — do not write code against an
  incomplete or incorrect design.
- When a discrepancy is found between an issue's design and reality (a missing
  API, a wrong environment variable, an incompatible type), correct the design
  document and surface the problem rather than silently working around it.
- Before relying on an undocumented or assumed runtime behavior (environment
  variable names, API shape, framework detection), verify it with a small test or
  source check rather than assuming.

### 5.4 Reuse, DRY, and separation of concerns

- **Reuse code.**
- **Don't Repeat Yourself (DRY)** — a core principle of FunctionalScript, not
  just a stylistic preference. When two or more modules share an algorithm and
  differ only in constants, alphabets, or small helpers, extract a parameterized
  factory into a shared module rather than copy-pasting. Combined with the
  previous point: only extract once the second real consumer exists.
- **Separation of concerns** — move logic to its natural module even with a
  single consumer when the logic is conceptually distinct (e.g. path manipulation
  belongs in `fjs/path`, not inline in a loader). First search for an appropriate
  existing module; create a new one only if no good fit exists. This is different
  from DRY extraction: it is always appropriate.
- **Avoid side effects and mutability.**

#### Exception to DRY: performance measurement

Time measurement must capture immediately after an operation completes to avoid
measuring the wrapper code itself. This naturally leads to duplication when both
success and error paths must measure. Readability is more important than
eliminating the duplication — keep each measurement explicit and close to its
operation:

```ts
sandbox: async <T>(f: () => T) => {
    let result: Result<T, unknown>
    let after: number
    const before = performance.now()
    try {
        const value = await f()
        after = performance.now()
        result = ok(value)
    } catch (e) {
        after = performance.now()
        result = error(e)
    }
    return { result, duration: after - before }
}
```

Why this pattern is good:

- The two `after = performance.now()` calls are necessary on the critical path —
  extracting them into a helper would measure the helper function's overhead
  instead of just the operation.
- TypeScript tracks uninitialized values: declaring `let after: number` without
  initialization lets the type checker verify that `after` is assigned in all
  code paths before the final `return` statement.
- We still avoid duplication of non-critical computations: the return value of
  the function (`{ result, duration: after - before }`) is formed once, not
  duplicated. Only the timing capture (which must be immediate) appears twice.

### 5.5 Declarative over imperative

**Prefer declarative style over imperative.** When defining tools, handlers,
dispatchers, or similar abstractions, favor data-driven definitions (metadata +
schema + handler together in an array or registry) over imperative switch
statements or hardcoded conditionals. Declarative patterns are easier to extend,
test, and reason about. For example: define tools as an array of
self-descriptive objects (name, description, schema, handler) and dispatch
generically over them, rather than hardcoding a switch on tool name.

### 5.6 Never precompute a size to predict whether something fits

**Never precompute or estimate an encoding/decoding size to predict whether it
will fit a limit.** Attempt the real decode/encode and branch on its result
instead. Size estimates (string-length lower bounds, base64's 3/4 ratio,
JSON-escaping multipliers, …) are easy to get subtly wrong — and a
wrong-in-the-unsafe-direction estimate reintroduces the exact crash the check was
meant to prevent — while the real operation is always exactly right.

Express the fallible operation as a `try*` function returning `Nullable<T>` (see
`tryUtf8`, `tryListToVec`, `tryU8ListToVec`, `base64Decode` in `fjs/text`,
`fjs/types/bit_vec`, `fjs/base64`), add a new `try*` variant if one doesn't exist
yet for the operation you need (including effect primitives like `write`), and
have the caller check the `null` result rather than a precomputed bound.

### 5.7 CLI parameters over environment variables

CLI parameters are preferred over environment variables when adding new
features.

### 5.8 Embedded DSLs should reuse host-language syntax

**An embedded DSL should reuse JavaScript / FunctionalScript values and syntax
whenever their existing meaning is exactly the meaning the DSL needs.** Prefer
ordinary numbers, strings, arrays, and objects over wrapping the same information
in tagged syntax. For example, prefer `3.14`, `'abc'`, `[1, 2]`, and `{ x: 1 }`
over representations such as `['number', 3.14]` or an object/array tag whose only
purpose is to say what the host value already says.

Introduce a constructor, function, tag, or other DSL-specific form only for a
concept the host language cannot express directly and unambiguously. RTTI follows
this pattern: constants can describe themselves, while constructions such as
`array(number)` need DSL syntax because an array *value* and the type "array of
numbers" are different concepts. The proposed NaNVM operator-test data eDSL applies the same principle: ordinary
operands and expected results should be ordinary JavaScript values, while
references, function values, and expected throws need special forms.

Do not expose a tagged-union AST as the authoring API merely because it is
convenient for the implementation. The ergonomic eDSL and its normalized
machine-oriented representation may be different layers: a parser/compiler may
normalize an author-friendly value into explicit tagged nodes for pattern
matching, serialization, hashing, or code generation. Prefer the simplest representation that preserves the required semantics. Avoid
redundant DSL syntax: less representational noise benefits people, AI systems,
deterministic computation, hashing, serialization, storage, and code generation
alike. Use a more explicit normalized representation only when that extra
structure provides actual semantic or processing value.

Apply this principle to new eDSLs and when improving existing ones, including the
future FunctionalScript function AST. That AST should reuse FunctionalScript's
own literals, arrays, objects, and other language constructions wherever their
meaning coincides with the syntax being represented, and introduce explicit AST
nodes only where the host-language value would be ambiguous or insufficient.

---

## 6. Coding style

### 6.1 Immutability and purity

- Don't mutate arrays, sets, maps, or objects in place. Avoid `.push`, `.pop`,
  `.shift`, `.unshift`, `.splice`, `.sort`, `.reverse`, `Set#add`, `Set#delete`,
  `Map#set`, `Map#delete`, and index/property assignment on accumulators. Build
  new values with `.map`, `.filter`, `.flatMap`, spread, `new Set([...prev, x])`,
  `new Map([...prev, [k, v]])`, and `Object.fromEntries(entries.map(...))`.
- Use `let` variables only within the function body where they are declared.

#### No regular expressions

Do not use regular expressions. Express lexical checks and transformations with
ordinary typed functions so their structure, supported characters, and edge
cases remain explicit and independently testable.

### 6.2 Types

#### JavaScript/JSDoc type declarations

Authored `.mjs` / `.f.mjs` files must remain valid JavaScript. Put named and
generic static types in JSDoc rather than TypeScript syntax, and keep public
assignability and declaration-emission behavior intact when a type's spelling
changes. A separately useful type-level API may live in an authored sibling
`types.ts`; that file remains TypeScript type source and holds no runtime
implementation.

Name implementation-only JSDoc typedefs with a leading `_`
(`/** @typedef {number} _Type */`). Declaration emit cannot strip them yet, so
the underscore — not the emitted `.d.ts` — is what marks a name private,
and renaming or removing a `_`-prefixed alias is not by itself a breaking
change. The public contract still governs transitive effects. See
[Private JSDoc typedefs](./fjs/fsc/README.md#private-jsdoc-typedefs) for the
full rule and examples.

Use `@typedef` for a named type and `@template` for its type parameters. A
constraint goes in braces before the parameter name:

```js
/**
 * @template {Operation} O
 * @template T
 * @typedef {(_: Pr<O, O[0]>[1]) => Effect<O, T>} Cont
 */
```

TypeScript 7 also supports variance modifiers on JSDoc type-alias parameters.
Translate TypeScript `in` / `out` directly on `@template` instead of dropping
the variance annotation. For example:

```ts
export type Cont<out O extends Operation, T> =
    (_: Pr<O, O[0]>[1]) => Effect<O, T>
```

becomes:

```js
/**
 * @template {Operation} out O
 * @template T
 * @typedef {(_: Pr<O, O[0]>[1]) => Effect<O, T>} Cont
 */
```

The supported forms are `@template out T`, `@template in T`, and constrained
forms such as `@template {Operation} out O`. Variance modifiers belong to type
parameters of a JSDoc type alias (`@typedef`); do not put `in` / `out` on an
ordinary function's `@template`, where TypeScript rejects them.

When JavaScript needs a type from an authored `types.ts`, put JSDoc `@import`
with that real source path in the leading module JSDoc block; do not create a
separate `@import` comment. For example:

```js
/**
 * ...
 *
 * @module
 *
 * @import { Types } from './types.ts'
 */
```

Another `types.ts` referring to the same file uses `import type` with that same
path:

```ts
import type { Types } from './types.ts'
```

Both forms are type-only and introduce no runtime import. The `types.ts` file
itself exists and is checked as ordinary TypeScript source, so this convention
does not rely on `.d.ts` substitution and works with Deno's source resolver.

The fully erased forms are the only permitted ones — for package consumers as
well as repository code. The published package ships `types.d.ts` but no
`types.js` runtime module, and under `verbatimModuleSyntax` only `import type
{ X }` (and JSDoc `@import`) erase the whole statement: the inline form
`import { type X } from '…/types.js'` compiles to a retained `import {}`, as do
`import * as` and bare side-effect imports, and fails at runtime with
`ERR_MODULE_NOT_FOUND`.

A declaration-only module belongs in `types.ts` rather than acquiring an
artificial JavaScript runtime representation. See [§4](#4-documentation)
for the complete module-header and import-order convention.

Decide where a type lives by who needs it: one that must survive independently of
a single implementation goes in `types.ts`, while one that is naturally
implementation-local and expressible in JSDoc stays beside the code it describes.
Never invent a runtime import, export, `Symbol()`, or other value solely to
represent a TypeScript-only declaration such as `declare const`.

When a public type is written in JSDoc, verify both normal type checking and the
emitted `.d.ts` / `.d.mts` declarations. The JSDoc spelling may differ from the
TypeScript one, but the public type contract must not become weaker for being
written in JavaScript. Types authored in `types.ts` use ordinary TypeScript
syntax and declaration emit.

#### Prefer inference

Let TypeScript infer the type of private constants, local variables, and return
types of non-exported functions — write `const f = () => () => null` rather than
`const f: TailReduce<unknown, unknown> = () => () => null`. Add an explicit
annotation only when inference gives the wrong type (e.g. a literal that would
widen — covered below), when the inferred type is not precise enough for a call
site, or on `export`ed declarations where the annotation documents the intended
public contract. Annotating things TypeScript already knows correctly adds noise,
couples the annotation to the implementation, and can introduce `as` casts to
paper over mismatches.

#### Pin literal `const`s

A `const` with a **literal** initializer (string / number / bigint / boolean /
array / object literal) must pin its type — either an explicit annotation
(`const a: T = …`) or a trailing `as const`. Never rely on TypeScript's default
widening.

FunctionalScript data is immutable, but stock `tsc` widens literals by default
(`'2.0'` → `string`, `42n` → `bigint`, `[1, 2]` → `number[]`, dropping
`readonly`), which both misrepresents immutable data and silently breaks literal-
and tuple-dependent typing (`Ts<>` over an rtti schema, tagged-tuple
discriminants in the effect system). The rule scopes to literals because a const
assertion is only legal on a literal or enum member (TS1355) — calls,
conditionals, and references (`or(...)`, `option(...)`, a bare `string`) already
carry precise, non-widening types and are exempt. The mistake is invisible at
runtime (the value is correct; only the type widens), which is exactly why it
must be a style rule.

Example: `const jsonrpc = '2.0' as const` and
`const request = { jsonrpc, method } as const`, but
`const id = or(string, number, null)` needs nothing.

#### Avoid `as` type assertions

Avoid `as` type assertions (except `as const`). Treat them like `unsafe` in Rust
— a last resort that bypasses the type system's safety guarantees and must be
justified. They silence the type checker and hide real bugs; if a cast is needed,
it usually means the types or the code structure should be improved instead.

The JSDoc equivalent, an inline `/** @type {T} */ (expr)` cast, carries the same
hazard and the same rule: avoid it. Prefer annotating a separate `const`
declaration instead of casting an expression inline —

```js
/** @type {ReadonlyMap<string, number>} */
const empty = new Map()
```

rather than

```js
mapSet(/** @type {ReadonlyMap<string, number>} */ (new Map()), 'a', 1)
```

— because the declaration form documents the variable's intended type and lets
the compiler check the initializer against it (closer to `satisfies`), while the
inline form silently overrides whatever the compiler inferred, exactly like `as`.
Inline `@type` casts carried over from `as` assertions during the
TypeScript-to-JavaScript migration still exist in the tree; converting one to the
declaration form is a welcome cleanup wherever the rewrite is straightforward.

When the value being narrowed is an invariant a comment would otherwise have to
assert on trust — "this is never `undefined`/`null` because the caller already
guaranteed X" — prefer `assert`/`assertNotNullish` from
[`fjs/asserts/module.f.mjs`](./fjs/asserts/module.f.mjs) over a cast:

```js
const refCounter = assertNotNullish(refs.get(entry))
```

rather than

```js
const refCounter = /** @type {_RefCounter} */ (refs.get(entry))
```

A cast is a claim the compiler takes on faith and erases at runtime: if the
invariant it documents ever breaks — a future edit to the code it depends on,
a case the original reasoning missed — the narrowed value is silently wrong
instead of the assertion failing where the break actually happened.
`assert`/`assertNotNullish` narrow exactly the same way (via `asserts v` /
a checked return type) but also check the claim every time, so a broken
invariant throws immediately at the point that assumed it, not later at
some unrelated crash site. Reach for a cast only when there is truly no
runtime check to perform — e.g. `@type {const}` below, or narrowing across a
boundary the type system cannot express at all.

`@type {const}` (the JSDoc equivalent of `as const`, see "Pin literal
`const`s" above) is the one case where this preference inverts: it **must**
stay an inline cast on the expression —
`export const x = /** @type {const} */({ ... })` — and cannot be hoisted to a
leading declaration annotation. `/** @type {const} */` directly above
`export const x = { ... }` makes TypeScript try to resolve `const` as an
ordinary type name and fail with `TS2304: Cannot find name 'const'`; only the
inline-cast position gives it the special const-assertion meaning. This is
unlike every other `@type` cast, which works in both positions — don't
"clean up" a `@type {const}` inline cast into the declaration form.

#### Prefer `@satisfies` over `@type` when checking, not overriding

When the goal is to *verify* that an expression matches a shape — not to
*declare* what the compiler should treat it as — use an inline
`/** @satisfies {T} */ (expr)` cast instead of `/** @type {T} */ (expr)`.
`@satisfies` (mirroring TypeScript's `expr satisfies T`) checks assignability
against `T` while keeping the expression's own inferred type; `@type` discards
the inferred type and substitutes `T`, silently absorbing any mismatch instead
of reporting it. If the original TypeScript source used `satisfies`, migrate it
to `@satisfies`, not `@type` — the two are not interchangeable, and swapping one
for the other changes what gets checked.

This matters most for an expression handed to a generic function, where an
enclosing `@type` cast can strip the very context the function relies on to
check its argument. A cast around a big object literal passed to a
`ToAsyncOperationMap<O>`-shaped parameter, for example, blocks TypeScript from
checking each operation's implementation against `O` — the object literal is no
longer contextually typed by the call site, so a drifted handler shape is
absorbed by the cast instead of flagged. Prefer no cast at all when the callee
already supplies enough context (as `asyncRun(map)` does here) so the object
literal is checked structurally on its own; reach for `@satisfies` only where a
check without adopting the target type is actually wanted, e.g. a value that
must additionally be nominal-branded — `asNominal(x) satisfies T` becomes
`/** @satisfies {T} */ (asNominal(x))`, not `@type`.

#### Mutually recursive constants: cross-reference with `typeof`

When exported constants refer to each other in a cycle — the usual shape for a
recursive rtti schema, where `unknown` names `object` and `array` and both are
built from `unknown` — pin them with an explicit `@type` whose element types are
`typeof` references to the other constants, **not** with `@type {const}`:

```js
/** @type {() => readonly['or', typeof primitive, typeof object, typeof array]} */
export const unknown = () => ['or', primitive, object, array]

export const object = record(unknown)
export const array = rttiArray(unknown)
```

Forward references are fine: `unknown` is annotated in terms of `object` and
`array`, declared below it.

`@type {const}` is wrong here even though it compiles. It pins the tuple, so
`npx tsc` and `fjs t` both pass — but it gives declaration emit no *name* for
the recursive positions, so the emitter inlines the structure, gives up at
depth, and writes `/*elided*/ any`. On `fjs/media/json/rtti/module.f.mjs` the
const cast emitted 4 `any` and 2 `/*elided*/`; the `typeof` form emitted
neither. Only a consumer type-checking against the published `.d.mts` sees the
difference, which is why this needs to be a rule rather than something review
catches. Omitting the annotation entirely is a third, louder failure: the array
literal widens to `(string | …)[]` and fails `TS2345` outright (see "Pin literal
`const`s" above).

Pair the annotation with a round-trip assert so it stays checked rather than
merely claimed — `fjs/media/json/types.ts` holds
`Assert<Equal<Unknown, Ts<typeof unknown>>>`. An explicit `@type` on a constant
whose type the compiler would otherwise infer is only as trustworthy as what
verifies it.

#### Avoid type predicates

Avoid TypeScript type predicates (`(x: T): x is U`). They are error-prone: the
compiler trusts the annotation unconditionally, so if the runtime check diverges
from the declared type the error is silent. Use `instanceof` for
class/constructor discrimination, or restructure the union so a structural check
(e.g. `instanceof Array`) narrows correctly without a predicate.

**Exception:** a type predicate is acceptable when every alternative is
materially worse — in particular when the only other way to narrow is an `as`
cast (which is *unsafe*, strictly worse). Use it only where the predicate body
**is** exactly the structural check that defines membership in `U` (e.g.
`(e: Entity): e is readonly Vec[] => e instanceof Array`), so there is nothing
for the compiler to trust beyond what it could verify itself. Be careful: this
safety is not enforced — if the type definition of `T` or `U` changes later (a
member added to the union, a field's shape changed), the predicate's body can
silently stop matching its asserted type and narrow incorrectly with no compile
error. Keep such predicates next to the type they discriminate, and revisit them
whenever that type changes.

#### `StringMap` / `RequiredMap` / `OptionalMap` for string-keyed records

Use the record types from `fjs/types/object/types.ts` for all string-keyed
record types. The key set picks the type:

- **Open key set:** `StringMap<T>` is `{ readonly[k in string]?: T }` — any
  key, every value optional, because "the key may be missing" is what an open
  key set means at runtime.
- **Finite key set:** `RequiredMap<'a' | 'b', T>` is
  `{ readonly a: T; readonly b: T }`, and `OptionalMap<'a' | 'b', T>` is that
  same record with optional values.

`RequiredMap<string, T>` is `never`: no object can carry every string as a
required key, so an open key set fails to compile there. Reach for
`StringMap<T>` instead. That guard is `string extends K`, which holds exactly
when `K` is `string` — TypeScript cannot be asked whether a type is finite, so
give `RequiredMap` a union of string literals and nothing else. A template
literal like `` `x-${string}` `` is infinite but passes the guard.

Do not write inline `{ readonly[k in string]: T }` without `?` — TypeScript
types every access as `T` but the value can be `undefined` at runtime.
**Exception:** mutually-recursive types (e.g.
`type Obj = { readonly[k in string]?: Obj }`) must use the inline form. A type
alias may not reference itself through *another* alias's instantiation, so
`type Obj = StringMap<Obj>` is TS2456 ("Type alias 'Obj' circularly references
itself") even though it expands to the inline spelling, which resolves. That is
a property of aliasing, not of any one definition — writing the record as a
mapped type rather than a conditional one does not lift it.

When iterating all defined entries of a `StringMap<T>`, use `definedEntries`
from `fjs/types/object/module.f.mjs` instead of `Object.entries`; use
`definedValues` instead of `Object.values`.

#### `flatMap` over a filtering type predicate

Prefer `.flatMap(e => e !== undefined ? [e] : [])` over
`.filter((e): e is T => e !== undefined)` to remove `undefined` entries from an
array. Type predicates in `filter` are error-prone: if the element type changes,
the predicate silently becomes wrong. `flatMap` narrows correctly without a
manual type annotation.

#### Composition over intersection

Prefer composition over intersection types. When a type needs an existing record
plus extra fields, embed the record as a named field rather than mixing it in
with `&`. Write `type Signer = { rfc6979: Rfc6979, nf: PrimeField, g: Point }`,
not `type Signer = Rfc6979 & { nf: PrimeField, g: Point }`.

Intersection blurs where each field came from, couples the composite to the exact
shape of the part, and tempts you to widen the part to fit the whole (e.g.
bolting curve fields onto an `Rfc6979` that is also built and consumed on its own
from a bare subgroup order). A named field keeps the part **unchanged** —
independently constructed and consumed — and reads as plain data you destructure
(`const { rfc6979, nf, g } = signer`). This mirrors the data-first preference
behind avoiding `as` and type predicates: make the structure explicit instead of
deriving it.

**Exception:** use `&` when every alternative is materially more complex — when
composition would misdescribe the value or push real cost onto callers just to
satisfy the rule. The cases in this repository:

- **A type-level marker on a value that keeps its own runtime shape.**
  `Nominal<N, R, B> = symbol & {…}` and
  `Phantom<S, T> = S & { readonly[phantomKey]?: T }` exist precisely because the
  value still *is* a `symbol` / an `S` at runtime. A named field would invent a
  wrapper that never exists.
- **Describing an object you don't own, or a flat serialized shape.**
  `IncomingMessage = Readable & {…}` in `fjs/effects/node/module.mjs` describes
  Node's object, which really does carry both member sets on one level. Nesting
  the base under a field there would describe something that isn't there — and
  for a wire format it would change the encoding, not just the type.
- **A facade adding a member to a generic interface.**
  `FileCas = Cas<FileCasOperation> & { url: (v: Vec) => string }` — composition
  would route every consumer through an extra hop (`fileCas.cas.read(…)`) to
  express one added member.
- **Opening a record type to dynamic keys.** A record type restricts its fields:
  unknown keys are neither writable in a literal nor readable off a value.
  Intersecting it with `StringMap<unknown>` keeps the declared fields
  checked while allowing arbitrary keys:

  ```ts
  type A = {
      readonly x: number
  }

  // `a` doesn't have access to other fields.
  const a: A = {
      x: 5,
      // b: null, // compilation error
  }
  // const aB = a.b // compilation error

  // `AM` is a `StringMap` but with restricted fields.
  type AM = StringMap<unknown> & A

  // `am` has access to all fields, with `A`'s restrictions still applied.
  const am: AM = {
      x: 5,
      b: null,
      // x: 'no', // compilation error: `x` is still `number`
  }
  const amB = am.b // `unknown`
  ```

  Reach for this only when the composite type itself must carry both. To hand a
  record to something that expects a map, widen at the use site instead — `A` is
  already assignable to `StringMap<unknown>`, so
  `const m: StringMap<unknown> = a` needs no intersection (and no `as`).

The exception is about cost to the reader or to the runtime, not about `&` being
shorter to type. A composite assembled from record types you define and control —
the `Signer` case above — is still the rule, not the exception.

#### String literals instead of enum-like aliases

Use string literals as strongly-typed values directly — don't introduce enum-like
aliases (`enum`, named constants such as `const FOO = 'foo'`) the way other
languages require. TypeScript narrows string literals precisely, so the string
*is* the typed value at runtime. Prefer, in order:

1. a literal-union type when you only need the type — `type My = 'foo' | 'bar'`;
2. `const my = ['foo', 'bar'] as const` with `type My = typeof my[number]` when
   you also need to iterate the values at runtime;
3. `const my = { foo: 'v5', bar: 'v6' } as const` when you need a key→value
   mapping (and `keyof typeof my` gives you the key type).

Existing examples: `os` / `Os` and `architecture` / `Architecture` in
`fjs/ci/common/module.f.mjs`, and `actions` in `fjs/ci/config/module.f.mjs`.

#### Write the call, not the value it computes

A value an encoder would produce should be written as that call, not as the
computed result — in source and in proof expectations alike. `range('AF')`, not
`1090519110`.

The number is derived from an input, and writing it down discards the input that
explains it: nothing recovers `A`–`F` from the digits, and a reader cannot tell a
correct constant from a typo'd one. A named constant does not help — the value is
still hand-computed. This does not apply to numbers that mean themselves: an
index, a count, `0`, `1`.

When the value sits inside a larger literal, interpolate rather than inline:

```ts
// avoid
if (r !== '[{"expected":[1090519110]}]') { throw r }
// prefer
if (r !== `[{"expected":[${range('AF')}]}]`) { throw r }
```

Tests are the exception where the encoding itself is what's under test. A test
that builds both its input and its expectation from the same encoder cannot
detect a change to it — both sides move together. Some tests may keep
hand-written values to cover that; comment why they are literal.

### 6.3 Structure and scoping

#### Import instead of duplicating

When a sibling module already has the type or helper you need, import it — add
`export` to the existing declaration if it's not yet exported, rather than
duplicating it (e.g. `parse` reuses `Path`, `ValidationError`, `verror`,
`prependPath`, `primitive0Validate`, `constPrimitiveValidate` from `validate`).

#### Hoist helpers to module scope

Hoist helpers (functions, types, constants) to module scope when they don't
capture local state — don't redeclare them inside another function on every call.
If a `reduce`/`map` callback needs context that varies per call, thread it
through the accumulator rather than closing over a local, so the step function
itself can live at module scope.

Treat "doesn't capture local state" as a target to restructure toward, not just a
condition to check: for any nested helper meaningful enough to carry a name, lift
its captures into leading curried parameters and hoist it — even a helper with a
single call site and no per-call cost. A closed, module-scope function has a
context-free identity: content-addressable FunctionalScript can deduplicate
structurally identical closed functions across modules (and repositories), while
a helper that captures enclosing locals hashes uniquely to its context.

Don't split below the semantic seam, though — if a fragment can't be described by
a one-line JSDoc claim ("renews the lease", "publishes the staging file"),
restructure until it can rather than extracting an unnameable piece.

#### Hoist call-invariant computations

If a sub-expression does not depend on a function's parameters, evaluate it once
in the enclosing scope and capture the result instead of recomputing it on every
call. This includes property accesses and destructuring of a module-level value:
prefer `const { listToVec } = msb` at module scope and call `listToVec(x)` over
calling `msb.listToVec(x)` inside a per-call function.

#### Place curried partial applications at their dependency's scope

When building a value through a chain of curried partial applications
(`f(a)(b)(c)`), place each partial application at the scope matching what it
depends on. This is not primarily the previous rule's performance concern — it
makes the computation's dependency structure visible: the scope a binding lives
in tells the reader which arguments it needs without tracing the whole call
chain.

Example (`fjs/basen/module.f.mjs`): `chunkList(msb)` depends on neither `bits`
nor `v`, so it's bound once at module scope (`chunkListMsb`), shared by every
`baseN(...)` codec; `chunkListMsb(bits)` depends on `bits` but not `v`, so it's
applied once inside `baseN`'s body, not once per `vecToString(v)` call. When the
fully-applied chain is itself the thing captured once — assigned directly as an
object property, e.g.
`vecToString: compose(chunkListMsb(bits))(fold(chunkToString)(''))` — naming the
intermediate halves separately adds nothing: the composition already shows,
structurally, that neither operand depends on `v`. Content addressing gives a
second reason beyond readability: each partial application bound at its own scope
is a closed value with its own identity, shareable wherever the same layer
recurs — a monolithic body that re-derives the whole chain per call shares
nothing.

#### Factor out what two branches share

When two code branches share most of their structure, refactor so the shared part
appears once and only the difference lives in the conditional. Forcing the reader
to mentally diff two near-identical blocks is a readability cost, not just a DRY
violation. Prefer `{ ...shared, ...(cond ? { extra } : {}) }` over two object
literals that repeat every field, and `cond ? a : b` over duplicated
`if`/`return` arms whose bodies only differ in one expression. Hoist
call-invariant computations above the branch so the conditional contains only
what actually varies.

#### Prefer destructuring over indexed/property access

Bind tuple elements and record fields with a pattern
(`const [tag, value] = result`, `const { length, mime_type } = meta`,
`([tag, value]) => …` in a callback) instead of reaching for
`result[0]`/`result[1]`/`obj.field` at each use. It names the parts once, reads
closer to the data's shape, and avoids repeating the container.

For tagged tuples this is also safe: TypeScript narrows a destructured
discriminated union after a guard on the tag
(`const [tag, value] = result; if (tag === 'error') { … } /* value is the ok payload here */`),
so there is no reason to keep index access for narrowing. **Exception:** when you
genuinely need only one deeply-nested element and a full pattern would be noisier
than a single access.

### 6.4 Effects (`fjs/effects`)

Bind every effect in a sequence to its own name, all at one level, so the
sequence reads top-to-bottom in evaluation order instead of inside-out.

```ts
// avoid
step(a, x => step(f(x), y => step(g(y), z => h(z))))
// prefer
const x0 = step(a, f)
const x1 = step(x0, g)
return step(x1, h)
```

In practice this means not nesting `step` calls from `fjs/effects` — but the
requirement is the *visible sequence*, not the absence of the token `step(`
inside another `step(`. Nesting costs more than indentation: it hides how many
effects run, it puts every continuation's parameter in scope for everything below
it (inviting accidental shadowing), and it makes inserting or reordering a link a
re-indentation of the whole block.

Lifting a nested continuation into a named helper does **not** satisfy this rule
— `step(a, cont)` with `const cont = x => step(f(x), …)` beta-reduces to the
nested form, so nothing was flattened and the sequence is now split across two
definitions instead of being visible in one. Extract a continuation when it is a
meaningful named operation in its own right, never to relocate a nesting you were
asked to remove.

#### Reaching back to an earlier value: use `historyStep`

A later link needing a value from an earlier one is **not** a reason to nest — a
nested continuation only reaches back because it closes over the enclosing scope.
Use `historyStep`, which carries every earlier value forward in a newest-first
tuple (a `History`) so they stay reachable downstream and the chain stays flat.
`history(e)` starts a history from a plain effect; `historyStep` takes a history
and returns one, so it composes with itself to any depth and only the entry point
needs `history`.

```ts
// avoid — nested only so `h` can still see `x`
step(a, x => step(f(x), y => h(x, y)))
// prefer
const x0 = historyStep(history(a), f)
return step(x0, ([y, x]) => h(x, y))
```

A position in the tuple is distance back from the current link, not evaluation
order, so a destructuring reads reverse-chronologically (`([z, y, x]) => …` binds
`x` earliest). Reaching further back costs an index rather than a traversal, but
a long chain makes the positions hard to count; when that starts to hurt,
collapse it into a record of named fields (`pure({ x, y } as const)`) and start a
fresh history from there. Before reaching for either, check whether the nesting is
forced only by a local declared inside a continuation that doesn't depend on it —
hoist such locals per [§6.3](#hoist-call-invariant-computations) and the nesting
often dissolves on its own.

#### Why the combinators themselves nest

This rule governs sequences of effects in **consuming** code, and the combinators
in `fjs/effects` are what make it followable. The nesting has to exist somewhere:
a name cannot be bound to an effect that has not been produced yet, so `f(param)`
cannot become `const x0` until `e` resolves. `step` recurses into itself inside
the continuation it rebuilds, `foldStep` composes one step per item, and
`historyStep` runs `f` inside `e`'s continuation. Each writes that nesting down
**once**, in one line, so no caller ever writes it again. That is the point of the
combinator, not an exemption from the rule: without `historyStep` the rule would
be unfollowable the moment a later link needed an earlier link's value. Read a
nested `step` in a `fjs/effects` combinator as the rule being paid for, and one
anywhere else as the rule being broken.

### 6.5 FunctionalScript module rules

Authored FunctionalScript source is JavaScript with JSDoc. Relative
repository-owned dependencies follow these source rules:

- `.f.mjs` is authored FunctionalScript implementation/proof source, and its
  relative runtime imports target `.f.mjs`;
- `types.ts` is authored type-only TypeScript source and carries no runtime
  implementation;
- `.f.mjs` — and later `.f.js` — consumes `types.ts` through JSDoc `@import`,
  and TypeScript consumes it through `import type`, both always naming the real
  `types.ts` file;
- a declaration-only module belongs in `types.ts` rather than acquiring an
  artificial runtime representation;
- never add a runtime import/export or runtime value solely to represent a
  TypeScript-only type declaration;
- compiler support does not gate the later `.f.mjs` -> `.f.js` rename;
  FunctionalScript parser coverage and package support do.

Avoid references to built-in or external Node modules such as `node:path` in
FunctionalScript source. No `try`/`catch` — see
[§3.5](#35-never-use-trycatch-test-throwing-with-the-throw-key).

### 6.6 Formatting

Don't vertically align code with padding spaces (e.g. extra spaces before `:` /
`=` to line up values across rows). It churns on every edit and makes
`git blame` noisy. Write `'actions/checkout': 'v5',` not
`'actions/checkout':                          'v5',`. Vertical alignment is fine
in markdown, documentation, and comments.

### 6.7 Rust

Avoid `macro_rules!` in Rust code. Declarative macros hide types from
rust-analyzer, break grep and jump-to-definition, and encourage "invisible code"
that contradicts FunctionalScript's preference for explicit, locally-readable
values. When per-type trait boilerplate looks like a macro candidate (e.g. one
impl block per nominal newtype, byte-identical modulo names), prefer in this
order:

1. a sealed helper trait carrying the variant choice with one-line per-type impls
   and a single blanket `impl<T: Trait>` deriving the boilerplate;
2. a `build.rs` code generator driven from a small source-of-truth table written
   in plain Rust (or a FunctionalScript module if the same table drives other
   artifacts too);
3. accept the hand-written duplication as the cost of readability.

Reach for `macro_rules!` only when no other option is materially better for
readers.

---

## 7. Issues (`todo/`)

Issues are tracked in `todo/` directories, not on GitHub. See
[todo/README.md](./todo/README.md) for the full format and priority/status
conventions.

GitHub issues are an **intake** channel, not a tracker: external contributors
cannot add `todo/` files, so they report there instead (see
[CONTRIBUTING.md](./CONTRIBUTING.md)). A maintainer turns each such report into a
`todo/` file — see the table below.

| Situation                  | What to do                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Where to file**          | Next to the code it describes. A bug scoped to `fjs/foo/bar/` goes in `fjs/foo/bar/todo/{slug-kebab}.md`. Cross-cutting or language-design issues go in the top-level `todo/`. |
| **How to file**            | Create `todo/{slug-kebab}.md` using a short kebab-case slug. Follow the issue format in `todo/README.md`: title, priority, status, problem, proposal, tasks, related links. |
| **Reported on GitHub**     | Create the `todo/` file for the report, linking the GitHub issue from its `Related` section. The `todo/` file is the tracked issue from then on; the GitHub issue stays open only as the reporter's thread and is closed when the fix ships. |
| **After fixing**           | Delete the issue file immediately in the same PR. Before deleting, ensure design decisions are captured in the codebase (see the documentation table in [§4](#4-documentation)). |
| **Won't fix**              | Document the reason in the relevant `README.md`, in a code comment, or in another issue — then delete the issue file. Do not leave a status-only tombstone.                |
| **Blocked by a third party** | File under `todo/blocked/{slug-kebab}.md`. Every file there **must** include a **Trigger** section stating the precise condition that unblocks it. Do not put third-party-blocked items in regular `todo/` directories. |

Reference issues with an explicit link, not GitHub's `#` prefix. `#NNN` is
reserved for GitHub PR/issue numbers.

---

## 8. Pull requests

### 8.1 Scope

The PR should implement only one feature/improvement with minimal code changes.

### 8.2 Before submitting

Ensure all of the checks in [§2](#2-everyday-workflow) pass.

### 8.3 CHANGELOG

The changelog is the [./changelog/](./changelog/) directory: a directory per
released version (a single file per version through `0.44.0`) plus
`changelog/unreleased/` holding one file per unreleased PR — see
[changelog/README.md](./changelog/README.md) for the layout.

To add a CHANGELOG entry, first open the PR to obtain its number, then create
`changelog/unreleased/<PR>.md` named by that number — recreating
`changelog/unreleased/` if a release just consumed it (Git does not track
empty directories). A PR never edits another PR's file, so two PRs can never
conflict. Write entries in the `Topic: short description` style, with no PR
number or link inside the file — the file name already carries the number, and
a renderer derives the link from it. A PR with several entries puts them all
in its one file, most important first. CHANGELOG entries are created after the
PR exists because the file is named by the PR number.

Only add CHANGELOG entries for code changes — PRs that only touch `todo/`,
`AGENTS.md`, or other documentation files do not need one.

- **Keep it short.** An entry is **at most a few lines** (about three wrapped
  lines, ~250 characters) — what changed and, when it isn't obvious, why. It is a
  release note for users of the package, not a design document. Rationale,
  migration walkthroughs, measurements, and alternatives-considered belong in the
  PR description, the relevant `README.md`, or JSDoc on the affected exports; the
  entry's file name identifies the PR, so a reader can go there for the full
  story.
- **No links.** The file name is the PR number, so an entry neither repeats it
  nor links to the PR. Do not link to — or name in plain text — an issue or
  `todo/` file either: issue files are deleted when the work is done, so those
  references rot and mean nothing to a reader of the published package.
- **A file holds list items only.** No heading — the version or PR number is the
  file name — and no Markdown beyond paragraphs, list items, inline code, and
  bold, so the website can render entries with a small self-hosted parser.
- These rules govern **new** entries. Don't rewrite a released entry as a side
  effect of an unrelated PR — a feature PR touches its own file and nothing
  else. Entries written before this convention end with an inline
  `[#NNN](url)` PR link (and the oldest have none); they are published history,
  so leave them as they are. A deliberate cleanup pass over past releases is a
  legitimate PR of its own (this convention arrived as one), and no released
  text is lost when it happens: the full prior wording stays in the PR and in
  git history.

### 8.4 Breaking changes and versioning

- Make breaking changes whenever they are the right design — don't preserve a
  worse API (e.g. a stale re-export or a non-canonical export location) just to
  avoid churn, and don't treat "it's already published" as a reason to keep a
  shape ([§5.2](#52-the-api-is-the-most-important-part-of-quality)). The version
  number is what lets consumers stay on the old API; a released version is
  immutable, so nothing is taken away from anyone by improving the next one.
  When a change breaks the public API, prefix its CHANGELOG entry with
  `**BREAKING CHANGES:**` and update every importer in the same PR rather than
  keeping a compatibility shim.
- **The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html),
  and the CHANGELOG decides which number moves.** A `**BREAKING CHANGES:**` entry
  anywhere in `changelog/unreleased/` means the release shipping it cannot be a
  patch. The package is still pre-1.0, where the leading `0.` is pinned and the
  *minor* position plays the role the major one plays after 1.0:

  | `changelog/unreleased/` contains            | Pre-1.0 — `0.Y.Z` | 1.0 and later — `X.Y.Z` |
  | ------------------------------------------- | ----------------- | ----------------------- |
  | at least one `**BREAKING CHANGES:**` entry  | `0.(Y+1).0`       | `(X+1).0.0`             |
  | new features, nothing breaking              | `0.Y.(Z+1)`       | `X.(Y+1).0`             |
  | fixes only                                  | `0.Y.(Z+1)`       | `X.Y.(Z+1)`             |

  Pre-1.0 the leading `0.` costs one position, and the distinction it costs is
  feature-vs-fix, not the break signal: `0.Y` moves **only** for a breaking
  change, and everything else — new features included — is a patch. That is
  deliberate. `^0.41.0` and `~0.41.0` both resolve to `>=0.41.0 <0.42.0` under
  npm (Cargo's bare `0.41.0` and JSR/Deno agree), so while the package is pre-1.0
  the minor is the only upgrade boundary a resolver enforces. Reserving it for
  breaking changes makes crossing it mean "something broke, read the entries" and
  makes every patch release a safe upgrade that still delivers features — the
  same contract the 1.0-and-later column gives, one position to the left. SemVer
  §4 leaves `0.y.z` undefined ("Anything MAY change at any time"), so this is a
  convention chosen inside the spec rather than a departure from it.

  A bigger bump is a number, not a cost — it never argues for holding back a
  breaking change, it only records that one happened. Releases through `0.41.0`
  predate this convention and took a minor bump for feature-only releases too
  (`0.35.0`, `0.33.0`); they are published, so leave their numbers alone.
- Releasing is its own commit: the version lives in `package.json` (`"version"`)
  — `deno.json` holds tasks and formatting only. When it's bumped, rename
  `changelog/unreleased/` to `changelog/X.Y.Z/`, keeping the entry files
  exactly as they are. The next PR that adds an entry recreates
  `changelog/unreleased/`. Releases through `0.44.0` are single
  `changelog/X.Y.Z.md` files; leave them as they are.
- **After every update of the release PR from `main`, check that
  `changelog/unreleased/` is empty.** A PR merged after the rename puts its
  entry file back into `changelog/unreleased/`, and an update from `main`
  carries it into the release branch — outside the renamed directory. Move any
  such file into `changelog/X.Y.Z/` before merging the release, or its change
  ships unrecorded in the changelog. Check again right before merging.
