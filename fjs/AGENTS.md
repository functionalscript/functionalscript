# FunctionalScript and TypeScript (`fjs/`)

Rules for everything under `fjs/` — authored FunctionalScript (`.f.mjs`) and the
type-only TypeScript (`types.ts`) beside it. Repository-wide rules live in the
root [AGENTS.md](../AGENTS.md), and the design principles both code bases follow
live in [DESIGN.md](../doc/DESIGN.md).

## Contents

1. [Testing and proof coverage](#1-testing-and-proof-coverage)
2. [Documentation](#2-documentation)
3. [Coding style](#3-coding-style)

---

## 1. Testing and proof coverage

### 1.1 Commands

- `tsc` — type-check. The compiler is the environment's, not a dependency of
  this package: the Nix developer shell provides it, or install the version
  `fjs/ci/config/module.f.mjs` pins globally. Not `npx tsc`, which resolves
  nothing locally and fetches the registry's latest.
- `fjs test` (or any equivalent from
  [CONTRIBUTING.md](../CONTRIBUTING.md#ways-to-run-the-functionalscript-test-suite))
  — test FunctionalScript (`.f.mjs`) files.

### 1.2 Proof coverage is mandatory

New FunctionalScript modules and functions must have **100% proof coverage**
across every dimension: every exported function called, every line executed, and
every branch (both sides of each conditional) taken. This applies to authored
FunctionalScript source, `.f.mjs`
([`fjs/fsc/README.md`](./fsc/README.md) defines the extensions). A new
implementation module ships with a co-located proof (its `proof` export) that
exercises all of its exports along all code paths — partial coverage of new code
is not acceptable. If a line or branch genuinely cannot be reached, restructure
the code so it isn't there rather than leaving it uncovered.

An implementation is `module.f.mjs` and its proof is `proof.f.mjs`. Stage 1 of
the TypeScript-to-JavaScript migration is complete: no authored implementation or
proof `.f.ts` remains, so write both files as JavaScript with JSDoc. Authored
`types.ts` companions may remain permanently and hold the type-level API.

Proof discovery and coverage follow the same extension: `shouldLoad` in
[`fjs/dev/module.f.mjs`](./dev/module.f.mjs) matches authored
FunctionalScript source, and both `npm run cov` and `deno task cov` include
`module.f.mjs`. Ordinary (non-FunctionalScript) `.mjs` files stay opt-in through
the `proof.mjs` filename convention.

A `proof.f.mjs` is authored `.f.mjs` like any other. Its relative **runtime**
imports must target `.f.mjs` modules. Type-only APIs may live in an authored
`types.ts` companion and are referenced directly through that real source path.
Its leading JSDoc block may include, for example:

```js
/**
 * ...
 *
 * @import { Phantom } from '../phantom/types.ts'
 */
```

No `@module`: a proof's documentation is not published, so the tag has nothing
to attach it to (§2).

JSDoc `@import` introduces no runtime dependency; a `types.ts` file naming the
same path from TypeScript uses `import type` instead. A type that several modules
need independently of one implementation belongs in `types.ts`, not in a JSDoc
typedef that consumers would have to reach into the implementation for. Never add
a runtime value for a TypeScript-only declaration such as `declare const`.
Compiler support remains independent of this JavaScript/JSDoc rule. See
[`fjs/fsc/README.md`](./fsc/README.md) for the extension contract and module
policy.

### 1.3 Use `assert` / `assertEq`, never a hand-written `if`/`throw`

Assert results in `proof` code with `assert`/`assertEq` from
[`fjs/asserts/module.f.mjs`](./asserts/module.f.mjs), not a hand-written
`if (cond) { throw ... }`.

A local `if`/`throw` in a test is itself a new branch for the coverage tool to
track, and its failure side is normally never exercised (the test is expected to
pass), so it lands as a permanently-uncovered branch in the very module meant to
close coverage gaps. `assert`/`assertEq` push that branch into a shared helper
whose own branches are already fully covered elsewhere, so the call site adds no
new uncovered branch.

### 1.4 Assert type-level facts with `Assert<Equal<…>>`

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

Some facts have nowhere else to be checked and so *require* one. A `const` type
parameter is the standing example: dropping the modifier widens every call site
silently and `tsc` still passes, so the assertion is the only thing standing
between the signature and a schema quietly typed one notch too loose. See
[§3.2](#32-types), "Prefer a `const` type parameter to a cast at the call site".

### 1.5 Never use `try`/`catch`; test throwing with the `throw` key

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

### 1.6 Do not prove a `.f.mjs` API from plain JavaScript

A `proof.mjs` exists to prove its **sibling `module.mjs`** — host code that
FunctionalScript cannot express, such as the DOM adapter in
`emergent_testing/browser` or the `node:` bindings in `effects/node/memory`.
That is its whole purpose.

It is **not** a back door for proving a `.f.mjs` API against inputs or control
flow the subset forbids: values built by `Object.setPrototypeOf`,
`Object.assign`, `defineProperty` or an accessor; a `try`/`catch` runner; a real
async scheduler. Do not add such a file, and do not add such cases to an
existing `proof.mjs`.

These scenarios are speculation about what an *arbitrary JavaScript caller*
might hand a FunctionalScript function, and nobody has asked for them. A module
is proven against the values FunctionalScript can build, by `proof.f.mjs`
tables, and that is the contract the module promises. Mixed
JavaScript/FunctionalScript interop is a separate concern for a separate
repository; it does not belong in this one's proofs.

**Recommended: judge a `proof.mjs` by a native runner.** `fjs t` is the
FunctionalScript runner — it walks a proof tree where a leaf is a pure thunk and
suspension, timers and real I/O belong to the interpreter. A host proof is none
of those: it awaits, it opens a `node:vm` context, it drives a DOM stand-in. The
runner its host already has fits it better, and `emergent_testing` is built for
that — `registerModule` hands each leaf to an external framework so the
framework owns scheduling, and `all.test.mjs` is the entry point `node --test`,
`bun test` and `deno test` discover. Prefer `node --test` when a `proof.mjs`
fails or behaves differently under the two.

This one is a recommendation, not a rule. Both runners see every proof today,
and `fjs t` stays the reference runner for everything `.f.mjs`.

---

## 2. Documentation

Use JSDoc for module documentation in both JavaScript and TypeScript source.

**`@module` is what makes a leading block *be* module documentation.** It is not
a marker of entry-point-ness. `deno doc` reads the tag and nothing else: a file
whose leading block carries it gets that prose as its `module_doc`, and a file
without it gets no `module_doc` at all — the block is dropped, not demoted.
Verified against the pinned Deno (`fjs/ci/config/module.f.mjs`), for `.mjs` and
`.ts` alike; the tag need not be in the first block, only in some block.

**So the tag goes wherever a file has module-level documentation a reader is
meant to get from `deno doc`** — `module.f.mjs`, `types.ts`, `private.ts` — and a
`module.*` file always has some. A file whose leading block only holds `@import`
tags has nothing to attach and wants no `@module`. Where a file's documentation
reaches no reader, the tag buys nothing; `proof.*` is the clear case.

Which reader differs by file kind, and the tag does not decide it.
`module.f.mjs` and `types.ts` are public API surface. `private.ts` is not: it
holds implementation-private types outside the public declaration closure, and
its generated declarations are excluded from the package entirely
([`fsc/README.md`](./fsc/README.md)). Its prose is for contributors reading the
sources, so the tag belongs there — but a public documentation build must not be
pointed at it.

Put it in the leading block, followed by one blank line before the first
source-level import or declaration.

`proof.*` is settled rather than assumed. The restore left all 11 proof files
untagged and confirmed with `deno doc --json` that they publish no `module_doc`
— which is the intent, since a proof's prose documents a verification rather
than an API and no documentation build is pointed at proofs. Point one at them
and the tag is what would have to change.

The tag is necessary, not sufficient. It decides whether `deno doc` *can* see a
file's module documentation; whether anything is generated from that file is a
separate question of what the documentation build is pointed at.

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

There are no exceptions left: `types.ts`, plus the optional sibling
`private.ts` for implementation-private types outside the public declaration
closure, is the only authored TypeScript in the repository. The former
exception — the `fjs/emergent_testing/scenarios`
fixtures and the `all.test.ts` entry, whose `.ts` extension proved that Node,
Bun and Deno execute a TypeScript proof natively — was retired in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520): the
scenario suite never ran in CI and is deleted, with recreation documented in
[`fjs/emergent_testing/scenarios.md`](./emergent_testing/scenarios.md),
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
| What changed in a release                        | `changelog/` (short, see [changelog/README.md](../changelog/README.md#entries)) |
| Rationale, measurements, alternatives considered | the PR description                        |

---

## 3. Coding style

### 3.1 Immutability and purity

- Don't mutate arrays, sets, maps, or objects in place. Avoid `.push`, `.pop`,
  `.shift`, `.unshift`, `.splice`, `.sort`, `.reverse`, `Set#add`, `Set#delete`,
  `Map#set`, `Map#delete`, and index/property assignment on accumulators. Build
  new values with `.map`, `.filter`, `.flatMap`, spread, `new Set([...prev, x])`,
  `new Map([...prev, [k, v]])`, and `Object.fromEntries(entries.map(...))`.
- Use `let` variables only within the function body where they are declared.

#### One realm, one prototype chain

FunctionalScript never handles objects from another realm — a `node:vm`
context, an iframe, a worker — and never replaces an object's prototype:
`Object.setPrototypeOf`, `Reflect.setPrototypeOf` and the `__proto__` setter
are out, and `__proto__` as a data member is written `{ ['__proto__']: v }`.

The two halves buy the same thing, which is why they are one rule: every value
an `.f.mjs` function sees was built by this realm's constructors, so
`instanceof` and the prototype chain are reliable.

**Detect an array with `a instanceof Array`.** That is the spelling
FunctionalScript uses. `Array.isArray` is not a more careful version of it
here, only a longer one guarding against values this rule already excludes.

A boundary that does take foreign values is a host boundary: it belongs in a
thin `.mjs` that converts them before any `.f.mjs` sees them.

#### No regular expressions

Do not use regular expressions. Express lexical checks and transformations with
ordinary typed functions so their structure, supported characters, and edge
cases remain explicit and independently testable.

### 3.2 Types

#### JavaScript/JSDoc type declarations

Authored `.mjs` / `.f.mjs` files must remain valid JavaScript. Put named and
generic static types in JSDoc rather than TypeScript syntax, and keep public
assignability and declaration-emission behavior intact when a type's spelling
changes. A separately useful type-level API may live in an authored sibling
`types.ts`; that file remains TypeScript type source and holds no runtime
implementation.

No authored `.mjs` may contain a **file-scope** JSDoc `@typedef` — anywhere in
the repository, whatever the directory or basename. Function-local typedefs are
allowed, and are the normal home for compile-time proof types (see the
`consistency` and `signatures` entries in `fjs/edag/proof.f.mjs` and
`fjs/effects/proof.f.mjs`). A named file-scope type goes to one of:

- the sibling `types.ts` when it is part of the **public declaration closure** —
  public types, plus any private `_` helper a shipped public declaration
  reaches transitively (e.g. `_Byte` in `fjs/types/byte_set/types.ts`) — or the
  type is inlined into the annotation instead;
- an optional sibling `private.ts` for implementation-private types outside the
  public closure, when separating them reads cleaner than inlining (e.g.
  `fjs/common/monoid/private.ts`, `fjs/rtti/data/private.ts`); do not create it
  mechanically for every `_` name;
- nowhere: a short type used once or twice is simply inlined.

Name private types and private runtime constants with a leading `_`, even when
module linkage requires an export: exportability is linkage, not API status, so
renaming or removing a `_`-prefixed name is not by itself a breaking change.
The public contract still governs transitive effects. See
[Private types](./fsc/README.md#private-types) for the full rule.

That rule runs in one direction only. Moving a *published public* typedef to a
`_` name is an ordinary breaking API change: it needs its own
`**BREAKING CHANGES:**` declaration and importer updates, exactly like removing
any other public declaration. The `.f.ts` -> `.f.mjs` rename was the one moment
a module's visibility contract could be corrected for free — that rename already
broke importers, so a correction rode along with it — and stage 1 is over, so
that moment has passed for every module in the tree.

A pending refactor is not a reason to pre-privatize. Visibility follows what the
module should offer consumers today, not what a future task plans to delete:
`Concat` and `NotLazy` in `fjs/types/list` stay public even though
[`simplify-list-type.md`](./types/list/todo/simplify-list-type.md) plans to
remove both. Hiding a type behind `_` to make its eventual removal cheaper gives
up a real present-day API for a discount on a breaking change that should simply
be declared when it happens.

The intra-directory dependency direction is
`types.ts <- private.ts <- module.f.mjs <- proof.f.mjs <- module.mjs <- proof.mjs`
(dependency to dependent; a layering guide, not a requirement that every file
exists). `types.ts` must not depend on `private.ts`, and verification moves
downstream: an assertion that checks the implementation belongs in a proof
function, not in `types.ts`. Recursive RTTI whose annotation needs a named
public type may stay in `module.f.mjs` (e.g. `exp` in `fjs/edag/module.f.mjs`),
and declarative compile-time/runtime constants shared between TypeScript and
runtime code may be split into a normal subordinate metaprogramming module such
as `meta/module.f.mjs` when that helps — it is an ordinary module, discovered
and covered like any other `module.f.mjs`, never a requirement.

Use `@typedef` (function-local in `.mjs`, or `export type` in `types.ts` /
`private.ts`) for a named type and `@template` for its type parameters. A
constraint goes in braces before the parameter name:

```js
/**
 * @template {Operation} O
 * @template T
 * @template E
 * @typedef {(_: Pr<O, O[0]>[1]) => Effect<O, T, E>} Cont
 */
```

TypeScript 7 also supports variance modifiers on JSDoc type-alias parameters.
Translate TypeScript `in` / `out` directly on `@template` instead of dropping
the variance annotation. For example:

```ts
export type Cont<out O extends Operation, T, E> =
    (_: Pr<O, O[0]>[1]) => Effect<O, T, E>
```

becomes:

```js
/**
 * @template {Operation} out O
 * @template T
 * @template E
 * @typedef {(_: Pr<O, O[0]>[1]) => Effect<O, T, E>} Cont
 */
```

The supported forms are `@template out T`, `@template in T`, and constrained
forms such as `@template {Operation} out O`. Variance modifiers belong to type
parameters of a JSDoc type alias (`@typedef`); do not put `in` / `out` on an
ordinary function's `@template`, where TypeScript rejects them.

The `const` modifier is the mirror image: it belongs to a **function's** type
parameter and TypeScript rejects it on a type alias (`export type A<const T>`
is TS1277). Every JSDoc spelling works — `@template const T`,
`@template {Type} const T`, `@type {<const T extends Type>(x: T) => R}`, and
`<const T>(x: T) => R` inside an authored `types.ts`. A type alias that names a
*function type* can therefore carry it even though the alias itself cannot:

```ts
export type _MakeType1<K extends Tag1> = <const T extends Type>(t: T) => Type1<K, T>
```

What it does, and when to reach for it, is "Prefer a `const` type parameter to
a cast at the call site" below.

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
artificial JavaScript runtime representation. See [§2](#2-documentation)
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

#### Types are `readonly`

Every array, tuple, and object member in a repository type declaration —
`types.ts` or `private.ts` — must be `readonly`: `readonly T[]`, not `T[]`;
`readonly [A, B]`, not `[A, B]`; `readonly a: T`, not `a: T`. This is the
type-level counterpart of [§3.1](#31-immutability-and-purity):
FunctionalScript data is immutable, and a type that admits mutation
misdescribes the value even where nothing ever mutates it.

**Scope: TypeScript source, not JSDoc.** A function-local JSDoc `@typedef`
(§3.2, "JavaScript/JSDoc type declarations") is out of scope — the `@property`
list style has no established `readonly` spelling in this codebase, and every
such typedef is proof-local, describing one call's shape rather than named,
reusable repository data. Inlining the type instead of using `@property`
(`@typedef {{ readonly a: T }} _Name`) can still take `readonly`, and should
where it reads no worse; nothing here requires converting existing
`@property` typedefs.

Function parameters are exempt — `(name: string, fn: () => void) => …` needs
no `readonly` on `name`/`fn`, since a parameter list is not itself a mutable
container. A mapped type's brand/index signature is not exempt just because
the field is never assigned a real value at runtime (e.g. `Nominal`'s
`{ readonly[k in N]: … }` in `fjs/types/nominal/types.ts`), and neither is a
mapped type used only inside a conditional/indexed-access type-level check and
never as a value's own type (e.g. `NotUnion`'s `readonly [U] extends
readonly [T]` in `fjs/types/object/types.ts`) — the rule is about what the
declaration says, not about whether a mismatch is currently observable.

**Exceptions need explicit reviewer sign-off, and most legitimate ones share
one shape: the type describes an object that lives outside FunctionalScript
files** — a host or library API this repository does not own and cannot
redeclare, mutable by that API's own contract (a Node.js builtin, a
third-party SDK's object). `IncomingMessage = Readable & {…}` in
`fjs/effects/node/module.mjs` (§3.2, "Composition over intersection") is the
existing example: it describes Node's own object, not FunctionalScript data.
Even there, prefer `readonly` on any member this codebase only reads — the
exception is for a member the external API itself requires writable or
reassigns, not a blanket pass for the whole type.

A type over data this repository defines and constructs is not exempt just
because a change would be a breaking API change for consumers — that is a
reason to plan and land the fix deliberately (see "Breaking changes and
versioning" in [changelog/README.md](../changelog/README.md)), not a reason
to leave the member mutable. `fjs/effects/node/todo/state-types-conventions.md`
and the "Six operation tuples are not `readonly`" section of
[`fjs/effects/todo/node-module-layering.md`](./effects/todo/node-module-layering.md)
track exactly this kind of already-known, deliberately-deferred gap; a type
left mutable for this reason needs a comment pointing to its tracking issue,
same as any other approved exception.

A third legitimate shape: the compiler itself rejects the `readonly` spelling.
`fjs/media/html/types.ts`'s `Element1`/`Element2` rest tail stays a plain
`Node[]` because `readonly Node[]` there makes `tsc` report TS2456
("circularly references itself") on the mutually-recursive
`Element1`/`Element2` → `Node` → `Element` cycle, which the identical
structure with a mutable rest array does not trigger. Verify against the
pinned compiler before claiming this exception — most recursive types in this
repository (e.g. `fjs/rtti/ts/types.ts`'s `_SelfArray`) take `readonly` without
issue, so this is a specific compiler limitation on that shape, not a general
excuse for anything recursive.

If a type must genuinely expose a mutable field for some other reason, it
needs the same explicit reviewer sign-off on the PR that introduces it, with
a comment on the field explaining why it is mutable. Do not add a
non-`readonly` member and assume it will pass review silently.

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
conditionals, and references (`or(...)`, a bare `string` or `option`) already
carry precise, non-widening types and are exempt. The mistake is invisible at
runtime (the value is correct; only the type widens), which is exactly why it
must be a style rule.

Example: `const jsonrpc = '2.0' as const` and
`const request = { jsonrpc, method } as const`, but
`const id = or(string, number, null)` needs nothing.

#### Prefer a `const` type parameter to a cast at the call site

When a literal is written **as an argument** and the callee is generic over it,
the fix belongs on the signature, not on the argument. Give the type parameter
the `const` modifier and the caller writes the literal plainly:

```js
validate(/** @type {const} */ ({ a: 42 }))   // a reader for `{ a: 42 }`
validate({ a: 42 })                          // the same, with `<const T>`
```

A cast there is the absence of a modifier on the callee, not a fact about the
value — and it has to be repeated at every call, where the modifier is written
once. `rtti` (`or`, `array`, `record` — `option` is nullary and takes
nothing), `rtti/validate`,
`rtti/parse`, `types/result` (`ok`, `error`), `protocol/mcp`'s
`toolEntry`, and `bnf`'s `option` already carry it; a new schema- or
literal-taking export should too.

Three things bound the rule:

- **It reaches arguments only.** A literal bound to a `const` first has already
  widened by the time it is passed, so "Pin literal `const`s" above still
  governs every declaration — `const t = /** @type {const} */ ([42]);
  validate(t)` needs its pin no matter what `validate`'s signature says. The
  same goes for a literal handed to `.map` or driving a `for…of`: there is no
  signature to modify.
- **Primitives do not need it.** TypeScript already keeps the literal when the
  type parameter's constraint admits primitives, so `validate(42)` reads `42`
  either way. The modifier earns its place on object and array literals.
- **Do not add one that changes nothing.** Removing a `const` must break
  `tsc`; if it does not, the modifier is noise — delete it, or add the
  assertion that makes it load-bearing (below). A general-purpose value lifter
  is usually the wrong place for one: `const` on `pureOk` would infer
  `pureOk([])` as `readonly []`, which stops unifying with the array branch
  beside it. Read "no call site inlines a literal" as *not yet*, though, and
  check the module's `README.md` before concluding it: `toolEntry`'s documents
  an inline schema, so its front door was a call site even when the tree had
  none.

Because a dropped modifier widens silently rather than failing, pin the
inference with an `Assert<Equal<…>>` in the proof, per
[§1.4](#14-assert-type-level-facts-with-assertequal) — over a struct or tuple
literal, since a primitive would pass with or without it:

```js
constParameter: () => {
    const v = validate({ a: 42, b: 'hello' })
    /** @typedef {Assert<Equal<typeof v, Validate<{ readonly a: 42, readonly b: 'hello' }>>>} _ConstParameter */
},
```

The typedef sits inside the proof entry because an authored `.mjs` carries no
file-scope typedef (§3.2).

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
[`fjs/asserts/module.f.mjs`](./asserts/module.f.mjs) over a cast:

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

That inversion holds for a `const` **declaration**. On an **argument** the cast
should not be there at all: see "Prefer a `const` type parameter to a cast at
the call site" above, which moves the pin to the callee's signature.

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
absorbed by the cast instead of flagged. Prefer no cast at all, so the object
literal is checked structurally on its own.

`asyncRun(map)` is worth spelling out, because the callee does **not** supply
that context on its own: `ToAsyncOperationMap<O>` is a mapped type keyed on
`O[0]`, not a homomorphic `{[K in keyof T]: …}`, so TypeScript cannot infer `O`
back out of the argument. Left to argument inference `O` falls back to its
`Operation` constraint — payloads and outputs `never` — which no real map is
assignable to, and the call site reaches for exactly the cast this section warns
about. **Annotate the result instead**: pin the runner's own type — an inline
generic annotation, or a `types.ts` name such as `/** @type {MemoryRun} */` —
and `O` is inferred from the return type, giving the call a real `O` to check
its argument against. Both Node runners are written that way —
`fjs/effects/node/module.mjs`'s `runNodeEffect` and
`fjs/effects/node/memory/module.mjs`'s `memoryRun`.

What that buys differs with what the call passes, and only the first case is
the hazard this section is about. `runNodeEffect` passes an object **literal**,
so its annotation is the only thing checking any handler — without it nothing
is checked. `memoryRun` passes an already-annotated call result, whose handlers
are checked at the factory regardless; there the annotation buys agreement
between the *declared map type* and `O`, caught at the runner rather than
wherever the map is spread next. Both are worth having. Don't claim the second
is the first.

Reach for `@satisfies` only where a check without adopting the target type is
actually wanted, e.g. a value that must additionally be nominal-branded —
`asNominal(x) satisfies T` becomes `/** @satisfies {T} */ (asNominal(x))`, not
`@type`.

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
`tsc` and `fjs t` both pass — but it gives declaration emit no *name* for
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

#### Curried generic exports need an explicit `@returns`

Give every exported function an explicit `@returns` — or a top-level `@type`
covering the whole signature — rather than leaning on an inferred return type,
and check the emitted `.d.mts` for new `any` or `/*elided*/` after changing a
module with generics or recursive data. An inferred return type on a curried
generic export can collapse to `any` in declaration emit while `tsc` and `fjs t`
both stay green, so nothing inside the repository notices; only a consumer
type-checking against the published declaration does. Same failure as the
`@type {const}` case above, reached from the other direction.

When a generic function composes other independently-generic functions in its
body, annotate each arrow with its own `@template` / `@param` / `@returns`
instead of writing one `@type {<T, S>(...) => ...}` over the whole chain.
[`fjs/types/array`](./types/array/module.f.mjs)'s `isFixedArray` is the worked
example; `types/sorted_list`, `types/range_map` and `fsc` use the same shape. A
single top-level signature has to restate every type variable of every stage,
which is where the inference it replaced goes wrong again.

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
**Exception:** a record whose keys are static and all present — a grammar's
variant, whose tags the author writes — may be typed as
`AbstractRequiredMap<string, T>`, or as its inline spelling where recursion
forces it, with the abstraction stated on the type: a read of a key that
isn't there is typed `T` and yields `undefined`. Making every key optional
there was tried, on `fjs/ebnf`'s `Variant`, and cost more than it guarded:
every alternative the author wrote read as possibly missing, and every
consumer paid a guard or a cast. A lookup by a key that arrived at runtime
belongs in a `StringMap<T>`.

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
  `FileCas = Cas<FileCasOperation> & { readonly url: (v: Vec) => string }` —
  composition would route every consumer through an extra hop
  (`fileCas.cas.read(…)`) to express one added member.
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

### 3.3 Structure and scoping

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

### 3.4 Effects (`fjs/effects`)

**There is one effect type, in one module.** `Effect<O, T, E>`
(`fjs/effects/types.ts`) is a `Pure` thunk yielding `Result<T, E>` or a `Do`
node — the error channel is part of the representation, not a wrapper over it.
`E` defaults to `NotImplemented`. `fjs/effects/module.f.mjs` holds all of it:
the representation, the interpreters `match` / `partialMatch` / `runPure`, and
the combinators.

**Compose with `step`**, which runs the continuation only on `ok` and
propagates an `error` on its own. Reach for `catchStep` where a failure has a
real fallback, `resultStep` where both branches genuinely matter, `mapStep` for
a trailing projection over the value, `resultMapStep` for one that decides the
outcome from both branches, and `unwrapStep` only where panicking is the
considered answer. See [`fjs/effects/README.md`](./effects/README.md).

There used to be two of each combinator, a `Result`-blind set in this module and
a branch-aware set in an `fjs/effects/io/` subdirectory. They were a trap rather
than a layer: an operation must return a `Result`, so every effect carries one,
and a `step` that ignored it would run the next link after a failed one.
`resultStep` **is** that former raw `step`, at the type that says what its
continuation receives — and with the collision gone, so is the subdirectory.

Nothing "genuinely cannot fail". A `List` cell and a `Program`'s exit code were
once listed here as such; both carry channels now, and so does every **absorb
point** — a module that converts a channel into its own vocabulary, such as an
MCP handler whose protocol *is* its error channel, says `Effect<O, T, never>`.
That `never` is a claim a reader can disagree with, and widening it later leaves
every consumer that merely chains untouched.

The rules below apply to the whole family, and to `step` first.

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
`historyStep` carries `ok` values, which is why a `Result`-blind one could not
serve: it carried each link's `Result` into the tuple, so every later link had
to destructure results it had no intention of handling.
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
hoist such locals per [§3.3](#hoist-call-invariant-computations) and the nesting
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

### 3.5 FunctionalScript module rules

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
[§1.5](#15-never-use-trycatch-test-throwing-with-the-throw-key).

### 3.6 Formatting

Don't vertically align code with padding spaces (e.g. extra spaces before `:` /
`=` to line up values across rows). It churns on every edit and makes
`git blame` noisy. Write `'actions/checkout': 'v5',` not
`'actions/checkout':                          'v5',`. Vertical alignment is fine
in markdown, documentation, and comments.
