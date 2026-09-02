## Migrate authored TypeScript implementations to `.mjs`

**Priority:** P1
**Status:** open — stage 1 is done, the issue is not. It still owns the stage-2
boundary below (`module.f.mjs -> module.f.js` may not start before it), and
[`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md), which performs that
rename, carries "Complete migrate authored TypeScript to `.mjs`" as an unchecked
task. [`fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
used to carry this file as **Blocked by** as well; that made the dependency
circular and it no longer does — its stated precondition is met, so it can
start now, while the rename it enables stays gated on it.
This is not the `todo/README.md` "kept as the record" exception — it is an open
task whose first stage is complete. Delete it when stage 2 starts, together with
those references and the conventions below.

### Problem

This is the problem as it stood when the issue was filed; stage 1 has since
resolved it, and what remains is the stage-2 boundary described below.

FunctionalScript used authored `.ts` / `.f.ts` implementation source and
generated `.js` output. The compiler migration also used `.f.mjs` as a marker
for modules accepted by the current FunctionalScript compiler. Those two
migrations should not be coupled: removing TypeScript from runtime
implementations is a repository-wide source-language migration, while compiler
compatibility depends on the feature set implemented by the FunctionalScript
parser/compiler.

TypeScript is also useful as a type language. A type-only API does not need a
JavaScript runtime representation and should not be forced through the
implementation migration merely because its declarations currently live in a
`module.f.ts`. Likewise, a runtime implementation may benefit from keeping a
separate TypeScript type-level API beside it.

Keeping unsupported runtime modules as `.f.ts` until the FunctionalScript
compiler can parse them would unnecessarily block the implementation migration.
Forcing type-only files into JSDoc would create the opposite problem: it would
make us translate TypeScript constructs such as `declare const` and `unique
symbol` even though no JavaScript runtime module is wanted.

The repository therefore needs two independent source categories and two ordered
implementation stages:

1. type-only APIs may live permanently in authored `types.ts` files;
2. migrate all authored TypeScript **implementations and proofs** to JavaScript
   with JSDoc, independently of FunctionalScript compiler support;
3. after implementation TypeScript is gone, migrate compiler-supported
   FunctionalScript implementations from `.f.mjs` to authored `.f.js`.

"Permanently" above, and everywhere below it, means **with respect to this
migration**: a `types.ts` is not an implementation-migration target and must not
be forced through JSDoc translation. It does not mean a `types.ts` outlives
TypeScript itself. [rtti-type-system](./rtti-type-system.md) retires the ones
beside `.f.mjs` modules — 92 of the 94 in the tree — but not on a short
checklist. The epic's rule is that a declaration retires only when the
generated `.d.ts` **reproduces what it published**, and it lists categories
that do not satisfy that yet. Reading the conditions off as "schemas exist,
`.d.ts` generated, compiler can read the module" is what an earlier draft of
this note did, and all three can hold while the file still cannot go.

That third condition is not a formality here, and an earlier draft of this note
omitted it. The epic's unit is not the extension but whether the compiler can
read the file: a `.f.mjs` module using syntax the parser does not yet accept has
no RTTI checking whatever it is annotated with, so retiring its TypeScript would
leave it checked by nothing. Guaranteed acceptance is what the rename to `.f.js`
signifies ([`fjs/fsc/README.md`](../fjs/fsc/README.md)), which makes step 3 of
this migration a prerequisite for retiring those `types.ts` files rather than an
independent track.

Two further conditions come from the epic and neither is about this migration,
so it is worth naming them here rather than letting this note read as the whole
test:

- **Every declaration in the file must be representable.** Adjacency to a
  schema-bearing module is a fact about *placement*, not contents. A `types.ts`
  can also hold declarations that describe no runtime value —
  [`fjs/types/array/types.ts`](../fjs/types/array/types.ts) exports `Index`,
  `Tuple`, `KeyOf`, `Includes` — and no schema and no printer produces those.
  The epic assigns them no stage on purpose: either the eDSL grows a
  representation, or those files are explicitly retained.
- **The public subpath has to survive.** The package has no `exports` map and
  ships `**/*.d.ts`, so `types.d.ts` is a public entry point a consumer may
  import by path. Deleting the file breaks that consumer even when every
  declaration in it is reproduced elsewhere, so retirement needs a
  compatibility re-export or an explicit breaking change.

Both still hold: a `types.ts` survives this migration untouched, and goes when
TypeScript stops being the type system for FunctionalScript — for the modules
the compiler can read.

The existing compiler-compatibility migration in
[`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md) is **blocked by** this
stage-1 implementation task.

### Proposal

#### Stage 1 extension meaning

During this task:

```text
module.ts   -> module.mjs
module.f.ts -> module.f.mjs
proof.f.ts  -> proof.f.mjs
```

Type-only source follows a different path:

```text
module.f.ts -> types.ts
```

A directory may also split its type API from its implementation before the
implementation migrates:

```text
types.ts
module.f.ts -> module.f.mjs
proof.f.ts  -> proof.f.mjs
```

- `.ts` / `.f.ts` are authored TypeScript **implementation/proof** source that
  still remains to migrate, except for intentional `types.ts` type modules —
  none remains; this list defines what the extensions meant during the task;
- `.mjs` is authored ESM JavaScript with JSDoc types;
- `.f.mjs` is authored FunctionalScript-intent JavaScript with JSDoc types;
- `.f.mjs` does **not** promise that the current FunctionalScript compiler can
  parse the module;
- `types.ts` is authored TypeScript type-only source and is **not** an
  implementation migration target;
- `.js` remains generated output and must not be authored while TypeScript
  implementation source remains;
- `.d.ts` / `.d.mts` remain generated declarations.

The authoritative extension contract in [`../fjs/fsc/README.md`](../fjs/fsc/README.md)
and the package plans must use these meanings throughout stage 1.

#### Separate type-only APIs into `types.ts`

Use `types.ts` for declarations that intentionally have no runtime
representation or that are intentionally separated from the runtime
implementation. This is ordinary authored TypeScript source, not generated
output and not a temporary migration extension.

A `types.ts` may coexist with every implementation stage:

```text
types.ts + module.f.ts
types.ts + module.f.mjs
types.ts + module.f.js
```

This gives the type-level API a stable lifetime while the runtime implementation
moves independently. It also lets declarations use the full TypeScript type
language, including constructs that cannot be represented faithfully or
conveniently in JSDoc.

Both TypeScript and JavaScript implementations reference the same real source
file. TypeScript uses a normal type-only import:

```ts
import type { Phantom } from './types.ts'
```

JavaScript puts the corresponding `@import` in its leading module JSDoc block:

```js
/**
 * ...
 *
 * @module
 *
 * @import { Phantom } from './types.ts'
 */
```

Both forms are type-only, and the referenced `types.ts` physically exists, so
the source tree never depends on specifier substitution. The source specifier
does not change when `module.f.ts -> module.f.mjs -> module.f.js`. (An earlier
revision of this document also claimed Deno does not substitute a missing `.ts`
specifier with an authored `.d.ts`. For the *published package* that claim was
measured and found wrong in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520): Deno
2.9.5 (TypeScript 6.0.3) resolves the `./types.ts` specifiers inside shipped
`.d.mts` files to `types.d.ts`, verified by a deliberate misuse being rejected
with TS2322 rather than falling back to `any`. The claim does still hold at one
boundary — Deno substitutes only for packages resolved as npm packages through
`node_modules`, not for `file:`-linked directories, which it treats as
first-party source; method and caveats in
[`packed-consumer-validation.md`](../fjs/ci/packed-consumer-validation.md).)

This split is a normal module-organization option, not only an escape hatch. A
runtime module may keep simple, implementation-local types in TypeScript/JSDoc
beside the code, while a separately useful type-level API can live in `types.ts`.
Do not split mechanically when it only adds indirection, but do not force a type
into JSDoc merely to keep all declarations in `module.f.*` either.

A file containing only `type`/`interface` declarations, type-only imports/exports,
`declare const`, or similar compile-time declarations should normally become
`types.ts` instead of `.f.mjs`. Existing `.f.mjs` files that are truly
runtime-empty declaration modules may likewise be converted to `types.ts` when
that is the cleaner type-module organization. Never invent runtime exports,
`Symbol()` values, or other JavaScript representations just to preserve a
type-system-only declaration.

`types.ts` is normal TypeScript source, so it is checked without changing
`skipLibCheck`; generated declaration files remain ignored as before and no
`.gitignore` exception is needed.

#### Enable JavaScript checking and validate `types.ts` packaging first

Before the first `.ts` / `.f.ts` implementation file moves to `.mjs` / `.f.mjs`,
keep `allowJs` and `checkJs` enabled in the root `tsconfig.json`. TypeScript
remains the repository type checker during this migration; JSDoc replaces
implementation TypeScript syntax without creating an unchecked intermediate
source set.

Stage 1 was written as **blocked by** both of these prerequisites before the
first real repository `.f.ts` -> `.f.mjs` implementation conversion. Neither
gate held in the end — both were de-scoped rather than met, as the matching
`[x]` items under [Tasks](#tasks) record:

- [`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md)
  makes authored `.mjs` and real `types.ts` checked, packable source and validates
  the emitted package layout. What the migration needed from it — the validation
  — was performed one-time in
  [#1520](https://github.com/functionalscript/functionalscript/pull/1520) and
  recorded in
  [`packed-consumer-validation.md`](../fjs/ci/packed-consumer-validation.md);
- [`../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
  is **blocked by** that package-support task and adds an actual `.f.mjs`
  runtime fixture proving proof execution plus Node and Deno coverage. It became
  moot as advance evidence once every conversion had happened: the repository
  itself now supplies it, with every `module.f.mjs` loaded through its proof
  under Node and Deno coverage.

Both files remain open as regression work on their own schedule. Neither gates
anything in this issue any more, and neither holds stage 2.

Package and publish jobs run only in CI from a clean checkout. The migration does
not need to preserve packability of arbitrary developer working trees or track
ignored generated outputs across source renames; a later CI package job starts
without those stale files.

The `types.ts` source convention must also be validated outside `tsc`. With
`rewriteRelativeImportExtensions: true`, the package fixture must establish how
`./types.ts` references from `.ts` and `.mjs` appear in emitted declarations,
which generated `types.js` / `types.d.ts` artifacts are required in the packed
package, and that TypeScript, Node, Deno, and Bun can consume the result. That
experiment was run in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520): emitted
declarations keep the `./types.ts` specifier verbatim, only `types.d.ts` is
required in the package, and generated `types.js` is not — the minimal portable
layout is `.mjs` + `.d.mts` + `types.d.ts`, and `prepack` was simplified to
declaration emit plus a no-emit re-check accordingly.

#### Migrate gradually from runtime dependency leaves

Stage 1 is incremental, not a repository-wide atomic rename. Start with authored
`.ts` / `.f.ts` implementation files whose relative authored **runtime**
dependencies have already migrated to JavaScript, then migrate their callers and
continue upward through the runtime dependency graph.

A file or coherent group is eligible when every relative authored runtime source
dependency outside the group is already JavaScript (`.mjs` / `.f.mjs`). Cycles
may migrate as one coherent group. Type-only APIs are handled independently in
`types.ts` and therefore do not need a JavaScript runtime migration first.

The transition is intentionally asymmetric for runtime dependencies:

- remaining `.ts` / `.f.ts` implementations may depend at runtime on already
  migrated `.mjs` / `.f.mjs`;
- migrated `.mjs` / `.f.mjs` must not import remaining authored implementation
  `.ts` / `.f.ts` at runtime;
- migrated JavaScript may use JSDoc `@import` from a real authored `types.ts`;
- when a required type still lives only in a remaining implementation `.ts` /
  `.f.ts`, split that type into `types.ts` before migrating the JavaScript
  consumer rather than retaining a JavaScript-to-TypeScript implementation edge.

These migration restrictions classify repository-owned authored source
relationships. External or built-in runtime imports such as `node:http` are not
migration edges and may remain where the module design requires them.

FunctionalScript parser support is not an eligibility condition. A `.f.ts`
implementation may move to `.f.mjs` even if the current FunctionalScript
compiler does not yet support all syntax in that file.

Proof files follow the same source-language rule. A migrated `module.f.mjs` may
keep its existing `proof.f.ts` temporarily, but `proof.f.mjs` is allowed as soon
as that proof can be expressed as JavaScript with JSDoc and every authored
runtime dependency outside its migration group is already `.f.mjs`. Type-only
APIs may remain permanently in `types.ts`. Compiler support for the proof is
not required. By the end of stage 1, every `proof.f.ts` implementation/proof file
must therefore have migrated to `proof.f.mjs`.

Preserve TypeScript type semantics when translating types that remain inside
JavaScript source to JSDoc. TypeScript 7 supports variance annotations on JSDoc
type aliases through modifiers on `@template`. For example:

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

Use `@template out T`, `@template in T`, or constrained forms such as
`@template {Operation} out O`. Variance modifiers belong to a JSDoc type alias
(`@typedef`), not to an ordinary function's `@template`.

#### Use `@import` for type-only dependencies

A JavaScript implementation must not gain a real JavaScript import just because
it uses a separately declared type. Use JSDoc `@import` with the same real source
path used by `import type`. All module-level `@import` tags belong in one
leading JSDoc block — sharing it with `@module` in a file that carries one, or
standing alone in a file that does not, such as `proof.*`; do not create
separate `@import` comment blocks. Which files carry `@module` is
[`fjs/AGENTS.md`](../fjs/AGENTS.md) §2, not this document.

The corresponding TypeScript implementation uses `import type` with the same
specifier:

```ts
import type { Types } from './types.ts'
```

JavaScript in a `module.*` file uses:

```js
/**
 * ...
 *
 * @module
 *
 * @import { Types } from './types.ts'
 */
```

JavaScript in a `proof.*` file, which has no `@module` tag, groups the same
`@import` tags without one:

```js
/**
 * @import { Types } from './types.ts'
 */
```

Do not point migrated JavaScript back at a remaining implementation `.ts` /
`.f.ts` merely for a type. If that type must survive independently of the
implementation, move or split it into `types.ts` first. If it is naturally
local to the implementation and expressible in JSDoc, migrate it with the
implementation instead.

Package validation must prove that authored `types.ts`, generated declarations,
any generated type-module runtime artifact required by resolution, and a clean
consumer all work; that is tracked in
[`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md).

#### Preserve private type intent with `_`

A named type migrating out of a `.f.ts` never becomes a **file-scope** JSDoc
`@typedef` — authored `.mjs` files carry none, repository-wide (root
`AGENTS.md`; placement rules in
[`../fjs/AGENTS.md`](../fjs/AGENTS.md) §3.2).
It lands in the sibling `types.ts` when it is part of the public declaration
closure, in an optional sibling `private.ts` when it is implementation-private
and separating it reads cleaner than inlining, inline in the annotations that
use it, or function-local in a proof when it is a compile-time proof type. For
example:

```ts
type Node = number
export type Tree = readonly Node[]
```

becomes, in `types.ts`:

```ts
export type _Node = number
export type Tree = readonly _Node[]
```

The leading `_` is the FunctionalScript API visibility convention, kept even
when linkage requires an export: `_Node` is private by contract, so consumers
must not depend on the name directly, and renaming or removing `_Node` is not a
breaking change solely because a declaration exposed it.

The public contract still governs transitive effects. In the example above,
`Tree` is public and depends on `_Node`; changing `_Node` from `number` to
`string` changes `Tree`'s public assignability and is therefore a breaking
change. The underscore exempts only the private alias itself, never a change to
the expanded public API. Public types keep ordinary names without a leading
`_`.

Which types are public is an API design decision made at the migration
boundary, not a mechanical copy of what the `.f.ts` happened to export. The
`.f.ts` -> `.f.mjs` rename is already a breaking change — importers must update
the specifier — so it is the one moment where a module's JSDoc visibility
contract can be corrected at no extra cost to consumers: a former export whose
only role was an implementation detail may become `_`, and a module-private
helper that belongs to the module's public vocabulary may be published under an
ordinary name. Such a correction rides along with the migration's own
`**BREAKING CHANGES:**` entry and does not need a second one.

After a module is `.mjs` its JSDoc visibility contract is settled, and the
convention then runs in one direction only. Moving a published public typedef to
a `_` name is an ordinary breaking API change from that point on: it needs its
own `**BREAKING CHANGES:**` entry and importer updates, exactly like removing any
other public declaration. Only the migration itself gets the free correction.

A pending refactor is not a reason to pre-privatize. Visibility follows what the
module should offer consumers today, not what a future task plans to delete:
`Concat` and `NotLazy` in `fjs/types/list` stay public even though
[`../fjs/types/list/todo/simplify-list-type.md`](../fjs/types/list/todo/simplify-list-type.md)
plans to remove both. Hiding a type behind `_` to make its eventual removal
cheaper gives up a real present-day API in exchange for a discount on a breaking
change that should simply be documented when it happens.

Generated private declaration artifacts are not shipped
([`../fjs/fsc/README.md`](../fjs/fsc/README.md)); the `_` contract itself is
permanent, since `_` names still reach the declarations that do ship.

#### Typedef documentation does not survive declaration emit

> Since the repository-wide prohibition on file-scope `@typedef` in authored
> `.mjs` (root [`AGENTS.md`](../AGENTS.md)),
> named types live in `types.ts`/`private.ts`, whose documentation emits
> through the normal TypeScript pipeline — so this loss no longer affects
> authored code. The record below explains the behavior and why the
> prohibition avoids it.

The same upstream gap has a second, opposite-facing symptom: declaration emit
drops the documentation written on a JSDoc `@typedef`. A TypeScript
`/** 8-word SHA-2 state vector. */ export type V8 = …` keeps its comment in the
emitted `.d.ts`; the equivalent `@typedef` in a `.mjs` emits as a bare
`export type V8 = …`, and the prose — including any `@example` — is gone from the
published declaration. Documentation on `export const` declarations is
unaffected, so a migrated module loses exactly its JSDoc type documentation.

`fjs/crypto/sha2` is the clearest case so far: `V8`, `V16`, `State` and `Sha2`
were documented types, and `Sha2` carried the module's `@example` walkthrough.
All of it survives in the source and none of it reaches `module.f.d.mts`. The
loss is therefore invisible to anyone reading the repository and visible only to
a consumer of the published package.

A separately authored `types.ts` avoids this JSDoc-emission problem: its
TypeScript declaration comments are emitted through the normal TypeScript
pipeline. That is another legitimate reason to split a substantial type-level
API, but it is not a requirement to split every small typedef out of its
implementation.

Related upstream behavior: TypeScript sometimes re-emits a bare `@typedef`
comment attached to the *following* declaration instead
([microsoft/TypeScript#43534](https://github.com/microsoft/TypeScript/issues/43534),
fixed for the services layer), and
[microsoft/TypeScript#61664](https://github.com/microsoft/TypeScript/issues/61664)
proposes stripping redundant JSDoc type directives from declaration emit while
keeping documentation. Neither tracks this loss directly.

Re-measured in
[#1530](https://github.com/functionalscript/functionalscript/pull/1530)
across three review rounds, the rule on tsc 7.0.2 is: a typedef block keeps
its documentation only when it is the first thing in the file *and* a blank
line separates it from whatever follows — so in a real module, whose header
comment comes first, typedef documentation never attaches at all. A
regression relative to strada 5.9.3, which kept trimmed prose in every
measured shape. The minimal reproduction and a
paste-ready upstream body (targeting `microsoft/typescript-go`) live in
[`blocked/jsdoc-typedef-doc-declaration-emit.md`](./blocked/jsdoc-typedef-doc-declaration-emit.md);
filing it is that issue's first task.

This does not block any migration group — it is a documentation-fidelity
regression, not a type-contract one. Keep writing the documentation in the
source meanwhile.

#### Module header and import ordering

`@module` placement is [`fjs/AGENTS.md`](../fjs/AGENTS.md) §2: the tag goes
wherever a file has module-level documentation a reader is meant to get from
`deno doc`, `types.ts` and `private.ts` included — not only `module.*`. It is
linked rather than restated here deliberately; this document carried its own
copy of an earlier, narrower rule and so did not move when §2 did. A `module.*`
file starts with one leading JSDoc block carrying `@module`; always put one
blank line after that block before the first source-level import or
declaration.

For TypeScript, put type-only imports first, external or built-in runtime imports
second, then repository-owned relative runtime imports: already-migrated
JavaScript before remaining TypeScript. Separate these groups with one blank
line:

```ts
/**
 * <Module documentation>
 *
 * @module
 */

import type ...
import type ...

import ... from 'node:...'
import ... from 'package'

import ... from '...mjs'
import ... from '...mjs'

import ... from '...ts'
import ... from '...ts'
```

For JavaScript, group all module-level `@import` tags into one leading JSDoc
block — sharing that block with `@module` in a `module.*` file, or standing
alone at the top of a `proof.*` or other non-`module.*` file — then put one
blank line before runtime imports. Never scatter `@import` tags as separate
comments interleaved with individual `import` statements. External or built-in
runtime imports come first, followed by repository-owned relative `.mjs`
runtime imports, matching the same order as TypeScript: type imports, then
`.mjs` imports, then remaining `.ts` imports:

```js
/**
 * <Module documentation>
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

A `proof.*` or other non-`module.*` file with `@import` tags uses the same
grouping without a `@module` tag:

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

The `.mjs` / `.ts` grouping and the Stage 1 migration restriction apply only to
repository-owned relative runtime imports. External or built-in imports are not
migration edges and may remain where the module design requires them. A migrated
JavaScript implementation has no remaining relative runtime `.ts` / `.f.ts`
import group: Stage 1 still forbids JavaScript runtime dependencies on remaining
authored TypeScript implementations.

The blank line after the module JSDoc block is load-bearing for declaration
emit. Without it, the header can become the leading comment of the first
`import` statement. Declaration emit rewrites the import list — dropping
runtime-only imports and synthesizing `import type` for what the declarations
actually reference — and when the statement carrying the header is not among the
survivors, the header goes with it. With the blank line the header detaches from
that statement and is emitted as the file's own leading comment.

Checked against every `.mjs` in the repository carrying an `@module` header — 26
modules, no exceptions:

| header separated from first `import` statement | header kept | count |
| ---------------------------------------------- | ----------- | ----- |
| yes                                             | yes         | 13    |
| no `import` statement at all                    | yes         | 8     |
| no                                              | **no**      | 5     |

A module with no `import` statement keeps its header unconditionally: there is no
statement for the comment to attach to, so it is already the file's own leading
comment. That is why the loss looks intermittent rather than systematic — most
migrated modules are in one of the two safe categories by accident, not by
intent.

`fjs/common/monoid`, `fjs/types/btree/remove`, `fjs/types/btree/set`,
`fjs/types/list` and `fjs/types/nullable` were the five known to lose their
header and want the same one-line fix. That count was stale: re-measured in
[#1526](https://github.com/functionalscript/functionalscript/pull/1526), 24
modules lost the header this way and another 4 had no `@module` block in
source at all. All are fixed there — every one of the 127 emitted
`module.f.d.mts` / `module.d.mts` files now carries `@module`.

#### Curried generic exports need an explicit `@returns`

A curried, generic exported function whose `@template`/`@param` chain has no
`@returns` still type-checks correctly in the repository — `tsc` reads the
`.mjs` source and infers the return type from the body, so `fjs t` and every
in-repo consumer stay correct. What breaks is declaration emit: TypeScript
infers a deep, often self-referential structural type for the return value
(e.g. a recursive `List<T>` union) that it cannot *name* in a `.d.mts` file,
so it collapses the unresolved part to `any` or `/*elided*/`. The loss is
invisible in the repository — only a consumer type-checking against the
published declaration sees it, exactly the same failure mode as [typedef
documentation not surviving declaration
emit](#typedef-documentation-does-not-survive-declaration-emit) above, but for
assignability instead of prose.

Found on `fjs/types/sorted_list`'s `genericMerge`, `merge`, and `intersect`
during review of [#1478](https://github.com/functionalscript/functionalscript/pull/1478):
omitting `@returns` took the module's emitted declaration from 0 to 7 `any`
and 6 `/*elided*/`, and let a call like `merge(cmp)(a)(b)` be assigned to the
wrong `SortedList<T>` without a type error when checked against the emitted
`.d.mts` — while the same misuse was correctly rejected against the `.mjs`
source and against `main`'s pre-migration `.f.ts`. Adding an explicit
`@returns` naming the return type on each restored the declaration to 0
`any`/`elided` and made both directions of the substitution check fail again,
matching `main`.

The fix generalizes: every exported function, curried or not, should carry an
explicit `@returns` (or a top-level `@type` on the whole signature) rather
than relying on inferred return types — check the emitted `.d.mts` for
`any`/`elided` as part of migrating any module with generics or recursive
data.

A related mechanical finding from the same review round: composing multiple
independently-generic helper functions inside another generic function's body
(e.g. `genericMerge` calling `cmpReduce` calling into `keepTail`, all
separately `<T>`-generic) loses type inference when each is annotated with a
single `@type {<T, S>(...) => ...}` on the whole arrow chain — TypeScript
cannot always unify the type parameters across the nested generic-value calls,
and parameters silently widen to `unknown`. The fix already has precedent in
`fjs/types/array/module.f.mjs`'s `isTuple`: give each arrow in the curried
chain its own JSDoc comment with `@template`/`@param`/`@returns`, so the
template parameter is a real, named binding in scope for the rest of the
function body instead of an anonymous part of a value's call signature.
`fjs/types/sorted_list`, `fjs/types/range_map`, and `fjs/fsc` all use this
per-arrow style for their generic helpers. Prefer the single `@type {<T,
S>(...) => ...}` form (as `fjs/types/list/module.f.mjs`'s `reduce` and similar
non-composing generics already do) when a generic function does not call
other independently-generic functions in its body; switch to the per-arrow
style once composition breaks inference.

#### Mutually recursive constants need `typeof`, not `@type {const}`

rtti schemas are values, not types, so a recursive schema is a cycle in the
*value* graph: `unknown` names `object` and `array`, and both are built from
`unknown`. TypeScript source closed that cycle with inference plus `as const`,
which has no declaration-level JSDoc equivalent. The replacement is an explicit
`@type` whose element types are `typeof` references to the other constants:

```js
/** @type {() => readonly['or', typeof primitive, typeof object, typeof array]} */
export const unknown = () => ['or', primitive, object, array]

export const object = record(unknown)
export const array = rttiArray(unknown)
```

Forward references are fine — `unknown` is annotated in terms of `object` and
`array`, which are declared below it.

The failure this avoids is **declaration emit**, not type checking, and the
three candidate spellings fail in different places. Measured on
`fjs/media/json/rtti/module.f.mjs` ([#1498](https://github.com/functionalscript/functionalscript/pull/1498)):

| form | `tsc` | emitted `.d.mts` |
| ---- | --------- | ---------------- |
| no annotation | **TS2345** — literal widens to `(string \| …)[]`, not a `Type` | — |
| `/** @type {const} */(…)` inline cast | clean | 4 `any` + 2 `/*elided*/` |
| `@type {() => readonly[…typeof…]}` | clean | 0 `any`, 0 `elided` |

The bare form is just the "pin literal `const`s" rule. The interesting case
is the middle one: it type-checks, `fjs t` is green, and the damage is visible
only to a consumer of the published package — the same invisible-in-repository
failure mode as [curried generic exports](#curried-generic-exports-need-an-explicit-returns).
`@type {const}` pins the tuple but gives the emitter no *name* for the
recursive positions, so it inlines the structure and gives up at depth,
collapsing to `/*elided*/ any`. `typeof primitive` / `typeof object` /
`typeof array` are names the emitter can print, so each node of the cycle
refers to its neighbours by name and the emitted declaration stays finite and
exact (it also stays smaller: 1392 vs 2248 characters).

Keep the round-trip proven rather than asserted. `fjs/media/json/types.ts`
carries `Assert<Equal<Unknown, Ts<typeof unknown>>>`, so the hand-written type
and the schema-derived one are checked against each other; without such an
assert the explicit `@type` is an unverified claim about a schema the compiler
would otherwise have inferred.

This generalizes beyond JSON. Any mutually recursive group of exported rtti
schemas needs the same treatment, and more of them are expected as rtti use
grows — reach for `typeof` cross-references first, and check the emitted
`.d.mts` for `any` / `elided` before considering the group migrated.

#### Declaration-only TypeScript is not a migration hard case

Do not require the migration plan to pre-design a JavaScript/JSDoc
representation for a type-only module. If a source file has no runtime API,
rename/rewrite it as `types.ts` and keep the declarations in TypeScript.

`fjs/types/phantom/module.f.ts` is the known example. Its public `Phantom` type
uses a type-only `declare const phantomKey: unique symbol`. `declare` is not
valid JavaScript, and replacing it with a runtime `Symbol()` would change the
module's current zero-runtime-representation design. Under the `types.ts`
convention this is no longer a hard case at all:

```text
fjs/types/phantom/module.f.ts -> fjs/types/phantom/types.ts
```

Consumers reference the real `../phantom/types.ts` from `import type` or JSDoc
`@import`. No artificial JavaScript phantom module is required in source.

For a mixed runtime/type module, split the declarations that should remain
TypeScript into `types.ts` and migrate the actual implementation separately.
Only TypeScript syntax that remains inside runtime implementation source needs a
JSDoc translation. If such syntax has no established semantics-preserving JSDoc
translation and cannot naturally move into `types.ts`, record it as a focused
hard case and postpone only that runtime implementation group.

For each migration group:

- identify declaration-only files and convert them to `types.ts` rather than
  JavaScript;
- optionally split a stable type-level API into sibling `types.ts` before
  migrating the runtime implementation;
- replace remaining TypeScript-only implementation syntax with equivalent
  JavaScript plus JSDoc types;
- preserve public assignability semantics, not only runtime behavior;
- preserve JSDoc type visibility intent: public typedefs retain public names and
  implementation-only typedefs use the `_` prefix;
- if an implementation-only TypeScript construct has no established
  semantics-preserving JSDoc translation and does not belong in `types.ts`,
  record it as a focused hard case and postpone that runtime source module rather
  than inventing a redesign inside the mechanical migration;
- update runtime imports to migrated JavaScript paths;
- update type-only imports to the real `types.ts` paths when declarations are
  split out;
- update proofs, tests, scripts, generated CI configuration, documentation, and
  other path-sensitive tooling;
- preserve type checking, declaration generation, runtime behavior, proofs,
  coverage, and package behavior.

#### End of stage 1

Keep `**/*.js` ignored while TypeScript implementations can still generate
`.js`. After the last authored implementation/proof `.ts` / `.f.ts` source file
is removed:

1. authored `types.ts` may remain permanently — it does;
2. remove obsolete generated implementation `.js` output when performing that
   transition — done with the emission pass in
   [#1520](https://github.com/functionalscript/functionalscript/pull/1520);
3. remove the blanket `**/*.js` rule from `.gitignore` when generated
   implementation output no longer conflicts with authored `.js` — done in
   [#1545](https://github.com/functionalscript/functionalscript/pull/1545).

All three have happened; the list is kept as the record of what the boundary
required, not as work outstanding.

Do **not** assume the second TypeScript runtime-emission pass can be removed just
because only `types.ts` source remains. The package-support experiment must first
determine whether generated `types.js` is required for portable package
resolution. Simplify `prepack` only to the minimal layout proven by that test.
**Resolved:** the experiment ran in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520) —
`types.js` is not required and the JavaScript emit is removed. `prepack` keeps a
second, no-emit `tsc` invocation: review found that the old pass 2 doubled as
the repository's only declaration-emit round-trip check (with `.d.mts` present,
`tsc` resolves `.mjs` imports through the emitted declarations, so the
`Assert<Equal<…, Ts<typeof …>>>` pins evaluate against what consumers see), and
a plain `tsc` check (`noEmit` is set in `tsconfig.json`) preserves that
property without emitting anything.

Generated declaration ignores remain unchanged.

Only after this boundary may stage 2 use:

```text
module.f.mjs -> module.f.js
```

Stage 2 additionally requires
[`../fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
so authored `.f.js` is directly type-checked, receives `.d.ts` declarations, is
packed, and works for a clean package consumer before the first
compiler-compatibility rename. A sibling `types.ts` remains unchanged across
this rename.

### Tasks

**Stage 1 source migration is complete.** No authored `.f.ts` remains
(`find . -name '*.f.ts'` returns 0 outside `node_modules`); the last twelve
migrated in [#1505](https://github.com/functionalscript/functionalscript/pull/1505).
The packaging work, the cleanup, the prose sweep and the documentation sweep
that followed it are all done too, and every item under
[Remaining after stage 1](#remaining-after-stage-1) is closed.

That closes stage 1, not this issue. What is left in the list below is standing
convention — rules that constrain future edits (`@type {const}` placement,
`@satisfies`, `_`-prefix visibility and its breaking-change consequences,
keeping the runtimes and the `**BREAKING CHANGES:**` declarations honest) plus
the three verification items whose last known instances are fixed and measure
clean. None of those is a pending change to make, so do not read this list as
the reason the file survives. The file survives because the **stage-2 boundary
is still ahead**: [End of stage 1](#end-of-stage-1) is what permits
`module.f.mjs -> module.f.js`, no rename has happened, that rename waits on
[`f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md) — open, not
blocked by this file; the reverse dependency was circular and is gone — and
[`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md), which performs the
rename, still carries "Complete migrate authored TypeScript to `.mjs`"
unchecked. Deleting it now would orphan the boundary and that task. When stage 2 begins, move the standing conventions into
[`fjs/AGENTS.md`](../fjs/AGENTS.md) and
[`fjs/fsc/README.md`](../fjs/fsc/README.md), re-point the 30 inbound references
across 16 other files, and delete the file in that change.

- [x] Complete
      [`f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md),
      including `allowJs` / `checkJs`, authored `types.ts`, Deno validation, and
      clean-consumer validation. De-scoped as a gate in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      everything the *migration* needs from it — the validation itself — was
      performed one-time and recorded in
      [`packed-consumer-validation.md`](../fjs/ci/packed-consumer-validation.md);
      the committed CI fixture remains tracked in that file as future
      regression work, not a blocker for this task.
- [x] Then complete
      [`f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
      before the first real repository `.f.ts` -> `.f.mjs` implementation
      conversion. Moot as a gate: every conversion already happened, and the
      whole repository — every `module.f.mjs` loaded through its proof under
      Node and Deno coverage — now provides the evidence the synthetic fixture
      was designed to give in advance. The fixture file remains as future
      regression work, not a blocker for this task.
- [x] Update contributor, compiler, language, package, test, and roadmap
      documentation to the stage-1 extension meanings and `types.ts` convention.
      Distinct from the prose sweep two items below, which fixed stale `.f.ts`
      *paths*; this one fixed the *guidance*, which still read as a live gate on
      completed work. Contributor: [`CONTRIBUTING.md`](../CONTRIBUTING.md) gained
      the `types.ts` / `private.ts` placement rule, the `!**/private.d.ts`
      packaging consequence, and the fact that `.f.js` is not authored today.
      The placement rule restates `AGENTS.md` §3 and
      [`fjs/AGENTS.md`](../fjs/AGENTS.md) §3.2 for a human contributor; the
      `.f.js` half is new here, since §3.5 says only that compiler support does
      not gate the eventual `.f.mjs` -> `.f.js` rename, and the root `AGENTS.md`
      does not mention `.f.js` at all. Compiler: [`fjs/fsc/README.md`](../fjs/fsc/README.md), the
      authoritative contract — its `.f.js` row claimed the extension is
      generated from `.f.ts`, which no command has done since
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520);
      its two stage-1 prerequisites still read as gates rather than as the
      de-scoped record; and it still instructed a reader to remove the
      `**/*.js` `.gitignore` rule that
      [#1545](https://github.com/functionalscript/functionalscript/pull/1545)
      removed. Language: [`spec/README.md`](../spec/README.md)'s File Types table
      now says the `.f.js` in it is the *language's* extension and names the
      repository's `.f.mjs` / `types.ts` spelling beside it. Package:
      [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md)'s
      stage-1 invariant listed `.ts` as "awaiting migration" and `.js` as
      generated, and omitted `types.ts` entirely. Test:
      [`fjs/emergent_testing/README.md`](../fjs/emergent_testing/README.md) now
      states that `types.ts` is neither load tier and carries no proof-coverage
      obligation. Roadmap: [`plan/roadmap.md`](./plan/roadmap.md) described
      stage 1 in the present tense as ongoing.
- [x] Identify type-only `.ts` / `.f.ts` files and convert them directly to
      `types.ts`; identify truly runtime-empty declaration-only `.f.mjs` files
      that should become `types.ts` as well when that is the cleaner design.
      Both halves are empty sets, measured rather than assumed. The first is
      moot: `find . -name '*.ts' -not -path './node_modules/*'` returns exactly
      101 `types.ts` and 19 `private.ts` and nothing else, so no `.ts` /
      `.f.ts` is left to reclassify. For the second, no authored `.mjs` in the
      tree lacks a runtime export except three executables — `fjs/module.mjs`
      (the CLI entry point), `fjs/emergent_testing/all.test.mjs` (the
      external-runner entry) and `fjs/types/bigint/benchmark.mjs` — none of
      which is a declaration module. Zero `.mjs` carries a file-scope
      `@typedef` either, which is the other shape a runtime-empty type module
      would take, so the rule in
      [`fjs/fsc/README.md`](../fjs/fsc/README.md) now applies to new source
      only. Re-measure both before reopening this.
- [x] Rename `fjs/types/phantom/module.f.ts` to
      `fjs/types/phantom/types.ts` and update its type-only consumers to use the
      real `types.ts` source path; do not introduce a runtime phantom value.
- [x] For mixed modules where a type-level API should stay in TypeScript, split
      that API into sibling `types.ts` before migrating JavaScript consumers.
- [x] Identify runtime-dependency-leaf `.ts` / `.f.ts` implementation files and
      migrate those first; `types.ts` companions do not participate in that
      runtime ordering.
- [x] Migrate `proof.f.ts` to `proof.f.mjs` when the proof is JavaScript/JSDoc
      ready and its authored runtime dependencies are migrated; allow stable
      type-only imports from `types.ts` and do not gate this on compiler support.
- [x] Validate a migrated `.mjs` / `.f.mjs` fixture with an authored `types.ts`,
      using the same real `types.ts` path from `.ts` and `.mjs`, including
      TypeScript, Deno, Bun, package emit, and clean consumers. Done as a
      one-time measured validation in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520),
      recorded with sources and per-runtime commands in
      [`packed-consumer-validation.md`](../fjs/ci/packed-consumer-validation.md);
      that is sufficient for the migration. A committed, CI-run fixture —
      scoped to the supported fully erased `import type` form — remains future
      work in
      [`f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md),
      not a blocker for this task.
- [x] Verify emitted declarations reference package paths that actually exist and
      determine whether generated `types.js` is required for portable consumers.
      Done in [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      the emitted `./types.ts` specifiers do **not** name a shipped file, yet
      TypeScript 5.9.3/7.0.2, Deno 2.9.5, and Bun 1.3.11 all substitute them with
      the shipped `types.d.ts`; generated `types.js` is not required.
- [x] Keep migrated JavaScript free of runtime **and type-only source**
      dependencies on remaining implementation `.ts` / `.f.ts`; split required
      declarations into `types.ts` first.
- [ ] Translate TypeScript generic constraints and `in` / `out` variance that
      remain in JavaScript source to JSDoc `@template` syntax without changing
      assignability.
- [ ] Give every exported function an explicit `@returns` (or top-level
      `@type` covering the full signature) rather than relying on inferred
      return types, and check the emitted `.d.mts` for new `any`/`elided`
      after migrating any module with generics or recursive data — inferred
      return types on curried generic exports can silently collapse to `any`
      in declaration emit even though `tsc` and `fjs t` stay green. Use
      the per-arrow `@template`/`@param`/`@returns` style (`fjs/types/array`'s
      `isTuple`, reused by `sorted_list`/`range_map`/`fsc`) instead of a
      single `@type {<T, S>(...) => ...}` when a generic function composes
      other independently-generic functions in its body.
- [ ] Keep `/** @type {const} */` as an inline cast on the expression, never
      hoisted to a leading declaration annotation — the declaration-level
      form fails with `TS2304` because TypeScript resolves `const` as an
      ordinary type name there, unlike every other `@type` cast.
- [ ] Translate a source-level `expr satisfies T` to `/** @satisfies {T} */
      (expr)`, not `/** @type {T} */ (expr)` — `@satisfies` checks
      assignability while keeping the expression's inferred type, `@type`
      discards it, and the two silently diverge on a mismatch. More broadly,
      don't wrap a value handed to a generic call in an enclosing `@type` cast
      just to pin its type: that cast makes the argument no longer
      contextually typed by the call site, so TypeScript stops checking it
      against the callee's per-key contract (seen with a large object literal
      passed to a `ToAsyncOperationMap<O>`-shaped parameter — cast the whole
      literal and every operation's implementation goes unchecked against
      `O`). Let the callee's own parameter type check the literal instead;
      reach for `@satisfies` only where a real check-without-adopting is
      wanted (e.g. `asNominal(x) satisfies T`).
- [ ] Annotate mutually recursive exported constants (rtti schema groups above
      all) with an explicit `@type` that cross-references its neighbours by
      `typeof`, not with `/** @type {const} */`. The const cast type-checks but
      leaves the emitter no name for the recursive positions, so it inlines the
      structure and collapses it to `/*elided*/ any` in the `.d.mts` while the
      repository stays green. Expect more of these as rtti spreads; check the
      emitted declaration for `any` / `elided` before calling such a group
      migrated, and keep an `Assert<Equal<…, Ts<typeof …>>>` beside the schema
      so the explicit annotation stays verified rather than asserted. The last
      known instance — `fjs/media/json/schema`'s `unknownThunk`, whose
      `@type {const}` cast collapsed `not` to `/*elided*/ any` and five
      sibling fields to bare `any` — was fixed with the `typeof` annotation in
      [#1526](https://github.com/functionalscript/functionalscript/pull/1526);
      emitted declarations measure zero `elided` repo-wide after it. (Its
      Phantom `$out` intentionally differs from `Ts<typeof unknownThunk>` in
      field optionality, so no exact `Equal` round-trip assert applies there.)
- [ ] Decide each migrated type's visibility at the migration boundary: prefix
      implementation-only types with `_` and leave publicly useful ones
      unprefixed, judged by what the module should offer its consumers rather
      than by what the `.f.ts` happened to export or by what a pending refactor
      plans to delete. Place each per the file-scope-typedef prohibition:
      `types.ts` for the public declaration closure, optional `private.ts`,
      inline, or function-local in a proof.
- [x] Apply the module-header/import convention: `@module` belongs only to
      `module.*` entry-point files, never to `proof.*` or other files; group
      module-level JavaScript `@import` tags into one leading JSDoc block —
      sharing it with `@module` in a `module.*` file, standing alone otherwise —
      always put one blank line after that block, group external/built-in
      runtime imports separately, and order repository-owned relative runtime
      imports as migrated `.mjs` before remaining `.ts`; fix the modules that
      already lose their header. The header half is done: the "four remain"
      count was stale, and
      [#1526](https://github.com/functionalscript/functionalscript/pull/1526)
      fixed the measured 24 emit losses plus 4 sources with no `@module`
      block, so all 127 emitted module declarations carry the header. The
      convention half is done in
      [#1545](https://github.com/functionalscript/functionalscript/pull/1545):
      every scattered module-level `@import` comment (125 `.mjs` files,
      multi-line blocks joined to one tag each) moved into its leading block,
      the import-group ordering measured zero violations, and all 129 emitted
      module declarations keep their header through the sweep.
- [x] File an upstream issue for JSDoc typedef documentation being dropped from
      declaration emit, and keep writing type documentation in the source
      meanwhile; substantial type APIs may instead live directly in `types.ts`
      when that is the cleaner module design. Spun out in
      [#1530](https://github.com/functionalscript/functionalscript/pull/1530)
      into
      [`blocked/jsdoc-typedef-doc-declaration-emit.md`](./blocked/jsdoc-typedef-doc-declaration-emit.md)
      with a measured reproduction and a paste-ready upstream body; the filing
      itself, an external action, is that issue's first task.
- [ ] Treat `_`-prefixed JSDoc typedef names as private even when declarations
      emit them as exports, but still require `**BREAKING CHANGES:**` whenever a
      change to one alters the assignability of a public declaration.
- [ ] Once a module is `.mjs`, treat any later move of a public JSDoc typedef to
      a `_` name as an ordinary breaking API change with its own
      `**BREAKING CHANGES:**` declaration and importer updates, not as a
      visibility cleanup.
- [x] Continue upward through the runtime dependency graph in reviewable groups
      until no authored TypeScript implementation/proof source remains. Done for
      every module in the migration group: no `.f.ts` is left anywhere. The
      `fjs/emergent_testing/scenarios/*.pass.ts` fixtures were the one exception
      while they existed — authored TypeScript that `run.sh` hard-linked to
      `_scenario.proof.ts`, whose extension was the thing under test rather than
      an unmigrated module. The suite was deleted in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520),
      so the exception is gone with it: no `*.pass.ts` is tracked and neither
      the directory nor `run.sh` exists. See the scenario item under
      [Remaining after stage 1](#remaining-after-stage-1).
- [x] Translate `.ts` to `.mjs` and `.f.ts` to `.f.mjs`, moving static type
      information either to JSDoc or to an intentionally separate `types.ts`
      without weakening public type semantics.
- [ ] Update imports, proofs, tests, coverage globs, scripts, generated CI, and
      documentation for every migrated group.
- [x] Sweep prose references to already-migrated modules: `AGENTS.md`, README
      files, and `todo/*.md` still name `.f.ts` paths that no longer exist, so
      snippets copied from them produce broken imports and links. Include
      type-only renames such as `module.f.ts -> types.ts` and any typedef renames
      in this sweep. Done together with the measured sweep under
      [Remaining after stage 1](#remaining-after-stage-1).
- [ ] Preserve Node, Deno, Bun, proof, coverage, type-checking, declaration, and
      CI package behavior throughout the migration.
- [ ] Add required `**BREAKING CHANGES:**` declarations for every public
      runtime or type-contract change; direct changes to an emitted `_` alias
      are exempt only when the expanded public contract is unchanged.
- [x] After the last authored TypeScript implementation/proof file is gone,
      simplify the package emit path only as allowed by the validated `types.ts`
      package layout. Authored `types.ts` remains. Done in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      `prepack` emits declarations only, then re-checks against them without
      emitting.
- [x] Then remove `**/*.js` from `.gitignore` when generated implementation
      JavaScript no longer needs the blanket ignore. Done in
      [#1545](https://github.com/functionalscript/functionalscript/pull/1545).
- [ ] Keep the compiler-compatibility migration explicitly **blocked by** this
      task.

#### Remaining after stage 1

Each item below is stated with the measurement that produced it, so the next
person can re-check rather than re-derive. Counts are as of
[#1505](https://github.com/functionalscript/functionalscript/pull/1505).

- [x] **Make `npm run cov` report real coverage.** Done, though not the way an
      earlier revision of this line claimed: `cov` still passes no path and so
      still uses `node --test` default discovery. What fixed it is that the one
      file discovery finds is now authored `fjs/emergent_testing/all.test.mjs`
      rather than `all.test.ts`
      ([#1520](https://github.com/functionalscript/functionalscript/pull/1520)),
      so it matches `*.test.?(c|m)js` on every Node version instead of
      depending on that version's TypeScript support. The dead
      `**/module.f.ts` glob is gone and the three 100% thresholds were added.

      The diagnosis above was right and the "vacuous for several PRs" framing
      was wrong, so both are recorded here rather than deleted. The cause was
      test *discovery*: with no path arguments `node --test` looks for its own
      default patterns (`*.test.*`, `test.*`, `*-test.*`, `test-*.*`,
      `*_test.*`, `test/**`); the repo's proofs are `proof.f.mjs` /
      `module.f.mjs` and match none of them, and the only file in the tree that
      does is `fjs/emergent_testing/all.test.ts`. Whether that file is picked up
      is Node-version-dependent, because it is TypeScript. Measured with the
      pre-fix command
      (`node --test --experimental-test-coverage --test-coverage-include=**/module.f.ts --test-coverage-include=**/module.f.mjs`):

      | Node | tests | coverage report |
      |---|---|---|
      | 22.22.2 | 2431 | yes, `all files 99.93` |
      | 23.11.1 | **0** | **none** |
      | 24.18.1 | 2431 | yes, `all files 99.93` |
      | 26.7.0 | 2495 | yes, `all files 99.93` |

      So every Node version CI actually runs (`22.23.2`, `24.18.1`, `26.7.0` in
      the `node22` / `node24` / `node26` jobs) already reported real coverage;
      v23 — released, EOL, not in CI — is the version that reports nothing. The
      Naming the entrypoint explicitly was measured as the candidate fix, and
      it works — the same counts and the same `99.93` report on 22, 24 and 26,
      with v23's `tests 0` becoming `tests 2431`. It is **not** what shipped, so
      read it as the counterfactual it is: `cov` still passes no path. What
      shipped is the entry file becoming authored `all.test.mjs`, which matches
      `*.test.?(c|m)js` on every Node version and so removes the
      TypeScript-support dependency that made v23 differ, plus dropping the dead
      `**/module.f.ts` glob and adding the three 100% thresholds. A future
      rename of the test entry is therefore still assessed against default
      discovery — keep the new name matching those patterns.

      The 2431-vs-2495 gap is **not** a second defect. It is exactly the 64
      sub-tests — those reachable only through a test function's *return value*.
      `usesInlineTestContext` (`fjs/effects/node/module.f.mjs`) selects the
      flattened registration strategy below the Node 26 baseline, where
      `inlineContext` runs sub-tests inside their parent registration instead of
      declaring them to the framework, so the framework counts the parent only.
      Node 26 uses native `expectFailure` and nested registration, and counts
      all 2495, matching `npm test` (`node ./fjs/module.mjs t`). Measured on
      26.7.0: 2431 top-level plus 64 nested `✔` lines; on 24.18.1: 2431
      top-level, 0 nested, of which 2376 carry the ` ...` inline marker (the
      remaining 55 are throw-tests, which never produce sub-tests). Same work
      executed either way — only the reported count differs.
- [x] **Settle whether generated `types.js` is required for portable
      resolution.** This gated the two items after it and was the one open
      correctness risk for published consumers. After `npm run prepack`,
      `grep -rhoE "from '[^']*\.ts'" --include='*.d.ts' --include='*.d.mts' .`
      (minus `node_modules` and `.d.ts` specifiers) counts **801** imports
      written `from '…/types.ts'`, and `types.ts` is *not* in the
      tarball: `package.json`'s `files` lists `**/*.d.ts` but no `**/*.ts`, so a
      consumer resolves those specifiers only if its toolchain substitutes
      `.ts` -> `.d.ts`. Not introduced by the source migration — the same
      command at `3859e7d4`, the commit before stage 1 finished, counts **778**.
      **Settled in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):**
      only `types.d.ts` must ship; neither `types.js` nor `types.ts` is
      required. A clean consumer against the packed tarball (importing
      `module.f.mjs` at runtime and a `types.js`-specifier type) type-checks
      under tsc 5.9.3 and 7.0.2 (`nodenext`, `strict`, defaults) and runs under
      Node v22, Bun 1.3.11 (`bun run` and `bun build`), and Deno 2.9.5
      (`deno run` and `deno check`, node_modules resolution) — with **zero**
      `.js` files in the package. The "Deno does not substitute" premise this
      item inherited was measured and found wrong; a deliberate misuse is
      rejected with TS2322, so the resolution is real, not an `any` fallback.
- [x] **Then remove the JavaScript-emitting `tsc` pass, if the experiment
      allows.** `prepack`'s second pass (`tsc --noEmit false --declaration
      false`) emitted exactly 96 files: 85 `types.js`, one per authored
      `types.ts`, and 11 from `fjs/emergent_testing/scenarios` plus
      `all.test.ts`. Removed in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      the `types.js` half is settled above, and the scenario half never gated
      it — the compiled scenario `.js` shipped in the tarball but nothing
      imported it; `run.sh` consumes the authored `.ts` fixtures directly, so
      the scenario decision below is settled separately. One of the 11 was not
      dead, caught in review: `all.test.js` was the documented external-runner
      entry for package consumers, so the entry is now authored
      `fjs/emergent_testing/all.test.mjs` — shipped in the package and
      discovered by the repository's own runners. The pass's *output* was dead,
      but review caught that the pass itself was not: running `tsc` with
      declarations already in the tree re-checks every `.mjs` import through
      the emitted `.d.mts` (which outranks `.mjs` in resolution), which is what
      made the `Assert<Equal<…>>` round-trip pins bite — seeding the
      `fjs/AGENTS.md` §3.2 counter-example fails the two-pass `prepack` and passes a
      naive one-pass one. `prepack` is therefore
      `tsc --noEmit false --emitDeclarationOnly && tsc`: declaration
      emit, then the same round-trip check with nothing emitted.
- [x] **Then drop the blanket `.gitignore` rule** for generated JavaScript
      (`.gitignore` line 131). Unblocked by
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      no build or packaging command generates repository `.js` any more, so the
      rule guarded only stale artifacts in pre-existing working trees. (`fjs
      compile` still writes one where a caller asks for it; that output is now
      untracked rather than ignored.) Dropped in
      [#1545](https://github.com/functionalscript/functionalscript/pull/1545);
      `**/*.js` deliberately stays in `package.json` `files` because the
      extension may be used for other purposes later, so a publish must keep
      coming from a clean checkout either way.
- [x] **Decide what happens to the `emergent_testing` scenario fixtures.**
      `fjs/emergent_testing/scenarios/*.ts`, `scenarios/all.ts` and
      `all.test.ts` were the only authored non-`types.ts` TypeScript left. Their
      extension was load-bearing: `run.sh` dispatched on `*.pass.ts` /
      `*.fail.ts` and hard-linked the scenario to `_scenario.proof.ts` and
      `all.ts` to `_all.test.ts`, so what they exercised was `node --test`,
      `bun test` and `deno test` executing a **TypeScript** proof natively.
      Decided in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      the suite never ran in CI, so it is deleted rather than kept —
      [`fjs/emergent_testing/scenarios.md`](../fjs/emergent_testing/scenarios.md)
      records the sources verbatim and how to recreate them. `all.test.ts` is
      renamed to authored `all.test.mjs` (which the package also ships as the
      external-runner entry), and the repository's only authored TypeScript is
      now `types.ts` and its optional sibling `private.ts`. The obsolete rename issue
      `fjs/emergent_testing/todo/205.md` is deleted with the suite.
- [x] **Sweep the remaining stale prose.** Done. The measured set was 88
      mentions across 42 `.md` files naming an `X.f.ts` whose `X.f.mjs` now
      exists (resolving each mention against the tree, excluding the changelog,
      whose history is correctly left alone); that measurement now returns **9**,
      and all 9 are the rename arrows (`module.f.ts -> module.f.mjs`) and
      completed `[x]` items in this file and `fjs/fsc/README.md`, where the
      `.f.ts` spelling *is* the subject.

      Two other rulers get quoted for this and are easy to mix up, so name the
      one you mean. A **path-like mention** is one module-path token ending in
      the old extension; a **line** may hold several. Whole tree, the changelog
      excluded:

      | ruler | `main` | after the sweep |
      | --- | --- | --- |
      | path-like mentions | 294 | 52 |
      | lines containing `.f.ts` | 398 | 145 |

      `AGENTS.md` went from 10 mentions on 24 lines to 0 on 1 — the one
      line left records that stage 1 is complete — and its guidance now leads
      with the JavaScript/JSDoc form, keeping `import type` for `types.ts` and
      for the scenario fixtures whose `.ts` extension is load-bearing.

      Beyond renaming references to files that moved, the sweep also fixed
      forward-looking plans that told a contributor to *create* a `.f.ts`
      (`fjs/bnf/todo/unicode-rules.md`, `fjs/effects/todo/node-module-layering.md`
      and ~40 others), since no such file may be authored any more.

      All 20 files that still contain the old extension anywhere are listed
      below, and each one is deliberate. (History of the count: `205.md` left
      the set when
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520)
      deleted it, the formatter issue left when
      [#1530](https://github.com/functionalscript/functionalscript/pull/1530)
      retitled it, `serializable-data.md` left when
      [#1539](https://github.com/functionalscript/functionalscript/pull/1539)
      implemented `fjs/rtti/data` and deleted it, and earlier revisions
      of this paragraph ran one short —
      `fjs/emergent_testing/scenarios.md`, which quotes the deleted `run.sh`
      verbatim, was in the measured set but never enumerated. Review on #1530
      caught it.) Describing the migration or the
      extension itself: this file, `AGENTS.md`,
      [`fjs/fsc/README.md`](../fjs/fsc/README.md),
      [`f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md),
      [`f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md),
      [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md),
      [`f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md),
      [`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md),
      [`plan/roadmap.md`](./plan/roadmap.md), [`spec/README.md`](../spec/README.md),
      [`demo/README.md`](./demo/README.md),
      [`nanvm-lib/todo/mvp-roadmap.md`](../nanvm-lib/todo/mvp-roadmap.md),
      and
      [`blocked/js-extension-type-annotations.md`](./blocked/js-extension-type-annotations.md)
      (the formatter issue left the set when
      [#1530](https://github.com/functionalscript/functionalscript/pull/1530)
      retitled it to
      [`formatter-for-f-js-files.md`](../fjs/todo/formatter-for-f-js-files.md)).
      Quoting `shouldLoad`, which still matches `.f.ts`:
      [`664-emergent-testing-module-files.md`](../fjs/emergent_testing/todo/664-emergent-testing-module-files.md)
      and [`skip-property.md`](../fjs/emergent_testing/todo/skip-property.md)
      (`205.md` was also on this list until
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520)
      deleted it with the scenario suite it described).
      Recording a superseded convention or a completed move:
      [`028-unit-test-examples-api.md`](../fjs/emergent_testing/todo/028-unit-test-examples-api.md),
      [`throw-payload-assertions.md`](../fjs/emergent_testing/todo/throw-payload-assertions.md),
      [`group-fs-subdirectories-by-concern.md`](../fjs/todo/group-fs-subdirectories-by-concern.md)
      and [`scenarios.md`](../fjs/emergent_testing/scenarios.md), which quotes
      the deleted scenario harness verbatim.
      Plus [`browser-testing.md`](../fjs/emergent_testing/todo/browser-testing.md),
      rewritten browser-native in
      [#1545](https://github.com/functionalscript/functionalscript/pull/1545)
      down to one deliberate mention recording the retired transpile premise.
      Re-measure with the same resolve-against-the-tree
      method, at the final commit, before claiming a number — prose that
      enumerates survivors can itself add mentions, which is how a stale count
      got published the first time.
- [x] **Redesign or retire `browser-testing.md`.**
      [`fjs/emergent_testing/todo/browser-testing.md`](../fjs/emergent_testing/todo/browser-testing.md)
      held 10 of the surviving path-like mentions on 23 lines — its whole
      design was a transpile step from `.f.ts` to `.f.js`, because browsers
      cannot load TypeScript. Decided and done in
      [#1545](https://github.com/functionalscript/functionalscript/pull/1545):
      rewritten browser-native — authored `.f.mjs` loads directly, so the
      transpile step, the generated module graph, and the mixed-graph
      machinery are gone while the goal, the three-runner design, the report
      protocol, and the validation list survive in condensed form (442 lines
      to ~160, one deliberate historical `.f.ts` mention).
- [x] **Retitle `formatter-for-f-js-and-f-ts-files.md`.** Done in
      [#1530](https://github.com/functionalscript/functionalscript/pull/1530):
      now [`fjs/todo/formatter-for-f-js-files.md`](../fjs/todo/formatter-for-f-js-files.md),
      naming `.f.mjs` (and the stage-2 `.f.js`) as the formatter's targets.
- [x] **Fix the one broken doc link that is not a rename artifact.**
      `fjs/rtti/todo/serializable-data.md` linked to `../data/module.f.ts`
      before `fjs/rtti/data/` existed. Resolved by implementing that
      issue: the module landed as authored `.f.mjs` source
      ([`fjs/rtti/data/module.f.mjs`](../fjs/rtti/data/module.f.mjs))
      and the issue file was deleted.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first authored TypeScript
  implementation source is converted to JavaScript.
- Authored `types.ts` is a first-class checked type-source convention.
- Declaration-only source can become `types.ts` without creating an artificial
  runtime JavaScript value; `fjs/types/phantom` uses this path.
- A runtime module may coexist with sibling `types.ts`, and TypeScript
  `import type` plus JSDoc `@import` both use the same real source path.
- Deno resolves source `types.ts` without `@ts-types`, `@ts-self-types`, a dummy
  authored `types.js`, or missing-file declaration substitution.
- ~~The `.f.mjs` runtime test/coverage fixture is complete before the first real
  repository `.f.ts` -> `.f.mjs` implementation conversion.~~ **De-scoped, not
  met:** every conversion happened first, and the repository became the evidence
  the fixture was to supply in advance. The fixture stays future regression work
  in
  [`f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md).
- No authored implementation/proof `.ts` or `.f.ts` source files remain at the
  end of Stage 1; authored `types.ts` files may remain permanently.
- Migration proceeds incrementally from runtime dependency leaves toward
  callers; type-only APIs can be separated into `types.ts` and do not require
  runtime migration ordering.
- Authored JavaScript uses `.mjs` / `.f.mjs` with JSDoc where static type
  information stays with the implementation, while `types.ts` holds
  intentionally separate type-level APIs.
- `proof.f.mjs` migration is gated by JavaScript/JSDoc and runtime dependency
  readiness, never by current FunctionalScript compiler support.
- Migrated JavaScript does not reference remaining implementation `.ts` /
  `.f.ts`, even for a type-only edge; declarations needed independently are
  split into `types.ts` first.
- No artificial runtime representation is introduced for declarations such as
  `declare const` or `unique symbol` that live naturally in `types.ts`.
- TypeScript generic constraints and variance annotations that remain in JSDoc
  are preserved with their JSDoc `@template` equivalents; public assignability
  is not weakened.
- Implementation-only JSDoc typedefs use `_`-prefixed names and are treated as
  private API even when TypeScript emits them as exported declaration aliases.
- Documentation lost from emitted declarations because it was attached to a
  JSDoc `@typedef` is recorded as a known upstream gap; an intentionally separate
  `types.ts` may preserve declaration documentation through normal TypeScript
  emit.
- Every module-level import follows the module-header/import convention:
  `@module` placement follows [`fjs/AGENTS.md`](../fjs/AGENTS.md) §2;
  JavaScript groups module-level `@import` tags into one leading
  JSDoc block — shared with `@module` where present, standing alone otherwise —
  one blank line follows that block, external/built-in runtime imports form
  their own group, and repository-owned relative runtime imports are ordered as
  migrated `.mjs` before remaining `.ts`. The `@module` header survives
  declaration emit.
- Every exported function's return type survives into its emitted declaration as
  a named type, not `any` or `/*elided*/`; curried generic exports carry an
  explicit `@returns` rather than relying on inference, and the per-arrow
  `@template`/`@param`/`@returns` style is used wherever a generic function
  composes other independently-generic functions in its body.
- `/** @type {const} */` stays an inline cast on the expression it types, never a
  leading declaration-level annotation.
- Mutually recursive exported constants carry an explicit `@type` that names its
  neighbours through `typeof`, and their emitted declarations contain no `any` or
  `/*elided*/`; a `Ts<typeof …>` round-trip assert keeps each such annotation
  verified against the schema it describes.
- Renaming or removing an emitted `_`-prefixed alias is not breaking solely due
  to that alias being emitted; any resulting change to a public declaration's
  assignability is still a breaking change.
- Each migrated module's JSDoc typedef visibility is justified by the public
  vocabulary that module should offer; pre-migration export status is evidence
  for that decision, not the decision itself.
- Reclassifying a public JSDoc typedef as `_` after its module has migrated is
  treated as a breaking API change, so the free correction is available only at
  the `.f.ts` -> `.f.mjs` boundary.
- `.f.mjs` means FunctionalScript-intent JavaScript, not current-compiler
  compatibility.
- Package-owned `.mjs`, authored `types.ts`, generated declarations, and any
  generated `types.js` required by package resolution work from a clean CI
  package build and clean TypeScript/Node/Deno/Bun consumers.
- Tests, proofs, coverage, supported runtimes, and type checking continue to
  pass.
- After the last authored TypeScript implementation/proof source is removed, the
  package emit path is simplified only as far as the `types.ts` package
  experiment proves portable; authored `types.ts` remains supported.
- `.gitignore` no longer blanket-ignores `.js` at the end of this task once
  generated implementation JavaScript no longer requires that rule.
- The compiler-compatibility migration starts only after this task and the
  authored-`.f.js` package/tooling prerequisite are complete.

### Related

- [`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md)
  — stage-1 authored `.mjs` / `types.ts` validation, declarations, and package
  support.
- [`../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
  — stage-1 end-to-end `.f.mjs` proof and coverage prerequisite.
- [`../fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
  — stage-2 authored `.f.js` package/tooling prerequisite.
- [`../fjs/ci/todo/publishing-packages.md`](../fjs/ci/todo/publishing-packages.md)
  — broader package-publishing plan.
- [`../fjs/fsc/README.md`](../fjs/fsc/README.md) — authoritative FunctionalScript
  extension and migration contract.
- [`../fjs/AGENTS.md`](../fjs/AGENTS.md) §3.2 — private-type placement rules;
  [`../fjs/fsc/README.md`](../fjs/fsc/README.md) — why generated private
  declarations are not packaged.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — upstream request for `stripInternal` support on JSDoc typedefs.
- [`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md) — existing compiler
  integration and compiler-compatibility migration.
- [`plan/roadmap.md`](./plan/roadmap.md) — project roadmap.
