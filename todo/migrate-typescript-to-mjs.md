## Migrate authored TypeScript implementations to `.mjs`

**Priority:** P1
**Status:** open

### Problem

FunctionalScript currently uses authored `.ts` / `.f.ts` implementation source
and generated `.js` output. The compiler migration also used `.f.mjs` as a marker
for modules accepted by the current FunctionalScript compiler. Those two
migrations should not be coupled: removing TypeScript from runtime
implementations is a repository-wide source-language migration, while compiler
compatibility depends on the feature set implemented by the FunctionalScript
parser/compiler.

TypeScript is also useful as a declaration language. A type-only API does not
need a JavaScript runtime representation and should not be forced through the
implementation migration merely because its declarations currently live in a
`module.f.ts`. Likewise, a runtime implementation may benefit from keeping a
separate TypeScript type-level API beside it.

Keeping unsupported runtime modules as `.f.ts` until the FunctionalScript
compiler can parse them would unnecessarily block the implementation migration.
Forcing declaration-only files into JSDoc would create the opposite problem: it
would make us translate TypeScript constructs such as `declare const` and
`unique symbol` even though no JavaScript runtime module is wanted.

The repository therefore needs two independent source categories and two ordered
implementation stages:

1. type-only declarations may live permanently in authored `types.d.ts` files;
2. migrate all authored TypeScript **implementations and proofs** to JavaScript
   with JSDoc, independently of FunctionalScript compiler support;
3. after implementation TypeScript is gone, migrate compiler-supported
   FunctionalScript implementations from `.f.mjs` to authored `.f.js`.

Authored declaration source must be checked like authored implementation source.
The root TypeScript configuration therefore uses `skipLibCheck: false`; otherwise
TypeScript accepts semantic and ambient-context errors inside `.d.ts` files
without diagnostics.

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

Declaration-only source follows a different path:

```text
module.f.ts  -> types.d.ts
module.f.mjs -> types.d.ts   # only when the existing file is truly type-only
```

A directory may also split its type API from its implementation before the
implementation migrates:

```text
types.d.ts
module.f.ts -> module.f.mjs
proof.f.ts  -> proof.f.mjs
```

- `.ts` / `.f.ts` are authored TypeScript **implementation/proof** source that
  still remains to migrate;
- `.mjs` is authored ESM JavaScript with JSDoc types;
- `.f.mjs` is authored FunctionalScript-intent JavaScript with JSDoc types;
- `.f.mjs` does **not** promise that the current FunctionalScript compiler can
  parse the module;
- `types.d.ts` is authored, checked type-only source and is **not** an
  implementation migration target;
- `.js` remains generated output and must not be authored while TypeScript
  implementation source remains;
- other `.d.ts` / `.d.mts` files remain generated declarations unless
  explicitly designated as authored `types.d.ts`.

The authoritative extension contract in [`../fjs/fsc/README.md`](../fjs/fsc/README.md)
and the package plans must use these meanings throughout stage 1.

#### Separate type-only APIs into `types.d.ts`

Use `types.d.ts` for declarations that intentionally have no runtime
representation or that are intentionally separated from the runtime
implementation. This is ordinary authored TypeScript declaration source, not
generated output and not a temporary migration extension.

A `types.d.ts` may coexist with every implementation stage:

```text
types.d.ts + module.f.ts
types.d.ts + module.f.mjs
types.d.ts + module.f.js
```

This gives the type-level API a stable lifetime while the runtime implementation
moves independently. It also lets declarations use the full TypeScript type
language, including constructs that cannot be represented faithfully or
conveniently in JSDoc.

Both TypeScript and JavaScript implementations should reference the declaration
module by its authored source path:

```ts
import type { Phantom } from './types.d.ts'
```

```js
/** @import { Phantom } from './types.d.ts' */
```

Both forms are type-only and introduce no runtime import. The same authored
`types.d.ts` file is shipped with the package, so no generated or runtime
`types.js` module is needed, and the source path does not change when
`module.f.ts -> module.f.mjs -> module.f.js`.

This split is a normal module-organization option, not only an escape hatch. A
runtime module may keep simple, implementation-local types in TypeScript/JSDoc
beside the code, while a separately useful type-level API can live in
`types.d.ts`. Do not split mechanically when it only adds indirection, but do not
force a type into JSDoc merely to keep all declarations in `module.f.*` either.

A file containing only `type`/`interface` declarations, type-only imports/exports,
`declare const`, or similar compile-time declarations should normally become
`types.d.ts` instead of `.f.mjs`. Existing `.f.mjs` files that are truly
runtime-empty declaration modules may likewise be converted to `types.d.ts`.
Never invent runtime exports, `Symbol()` values, or other JavaScript
representations just to preserve a type-system-only declaration.

Because `.gitignore` currently ignores generated `**/*.d.ts`, Stage 1 must add an
explicit exception for authored `**/types.d.ts` while leaving ordinary generated
declarations ignored. Package rules must preserve those authored files as source.

#### Enable JavaScript and declaration checking first

Before the first `.ts` / `.f.ts` implementation file moves to `.mjs` / `.f.mjs`,
enable `allowJs` and `checkJs` in the root `tsconfig.json`. TypeScript remains the
repository type checker during this migration; JSDoc replaces implementation
TypeScript syntax without creating an unchecked intermediate source set.

Also set `skipLibCheck: false`. `types.d.ts` is authored source, so allowing the
compiler to skip declaration-file checking would make the repository accept
invalid authored declarations. This repository has few declaration dependencies,
and the TypeScript Go check remains fast with declaration checking enabled.

Stage 1 is **blocked by** both of these prerequisites before the first real
repository `.f.ts` -> `.f.mjs` implementation conversion:

- [`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md)
  makes authored `.mjs` and `types.d.ts` checked, packable source;
- [`../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
  is **blocked by** that package-support task and adds an actual `.f.mjs`
  runtime fixture proving proof execution plus Node and Deno coverage.

Package and publish jobs run only in CI from a clean checkout. The migration does
not need to preserve packability of arbitrary developer working trees or track
ignored generated outputs across source renames; a later CI package job starts
without those stale files.

#### Migrate gradually from runtime dependency leaves

Stage 1 is incremental, not a repository-wide atomic rename. Start with authored
`.ts` / `.f.ts` implementation files whose relative authored **runtime**
dependencies have already migrated to JavaScript, then migrate their callers and
continue upward through the runtime dependency graph.

A file or coherent group is eligible when every relative authored runtime source
dependency outside the group is already JavaScript (`.mjs` / `.f.mjs`). Cycles
may migrate as one coherent group. Type-only APIs are handled independently in
`types.d.ts` and therefore do not need a JavaScript runtime migration first.

The transition is intentionally asymmetric for runtime dependencies:

- remaining `.ts` / `.f.ts` implementations may depend at runtime on already
  migrated `.mjs` / `.f.mjs`;
- migrated `.mjs` / `.f.mjs` must not import remaining authored implementation
  `.ts` / `.f.ts`;
- migrated JavaScript may use JSDoc `@import` directly from authored
  `types.d.ts`;
- when a required type still lives only in a remaining implementation `.ts` /
  `.f.ts`, split that type into `types.d.ts` before migrating the JavaScript
  consumer rather than retaining a JavaScript-to-TypeScript source edge.

FunctionalScript parser support is not an eligibility condition. A `.f.ts`
implementation may move to `.f.mjs` even if the current FunctionalScript
compiler does not yet support all syntax in that file.

Proof files follow the same source-language rule. A migrated `module.f.mjs` may
keep its existing `proof.f.ts` temporarily, but `proof.f.mjs` is allowed as soon
as that proof can be expressed as JavaScript with JSDoc and every authored
runtime dependency outside its migration group is already `.f.mjs`. Type-only
APIs may remain permanently in `types.d.ts`. Compiler support for the proof is
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
it uses a separately declared type. Use JSDoc `@import` from the authored
`types.d.ts` companion itself:

```js
/** @import { Types } from './types.d.ts' */
```

This introduces no runtime dependency. The corresponding TypeScript
implementation uses `import type` with the same authored source path:

```ts
import type { Types } from './types.d.ts'
```

Do not point migrated JavaScript back at a remaining implementation `.ts` /
`.f.ts` merely for a type. If that type must survive independently of the
implementation, move or split it into `types.d.ts` first. If it is naturally
local to the implementation and expressible in JSDoc, migrate it with the
implementation instead.

Package validation must prove that authored `types.d.ts`, direct `types.d.ts`
specifiers, generated declarations, and a clean consumer all work without a
runtime type module; that is tracked in
[`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md).

#### Preserve private type intent with `_`

A non-exported TypeScript type that is translated into a JavaScript `@typedef`
can become externally visible merely because TypeScript currently emits JSDoc
typedefs as exported aliases. The upstream request to make `@internal` plus
`stripInternal` work for JSDoc typedefs is
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407).

Until that support is available, prefix implementation-only **JSDoc typedef**
names with `_` during migration. For example:

```ts
type Node = number
export type Tree = readonly Node[]
```

becomes conceptually:

```js
/** @typedef {number} _Node */
/** @typedef {readonly _Node[]} Tree */
```

The leading `_` is the FunctionalScript API visibility convention. It does not
prevent declaration emission, so generated declarations may contain
`export type _Node = number`. `_Node` is still private by contract: consumers
must not depend on that emitted name directly, so renaming or removing `_Node`
is not a breaking change solely because TypeScript exposed the alias.

The public contract still governs transitive effects. In the example above,
`Tree` is public and depends on `_Node`; changing `_Node` from `number` to
`string` changes `Tree`'s public assignability and is therefore a breaking
change. The underscore exempts only the private alias itself, never a change to
the expanded public API. Public typedefs keep ordinary names without a leading
`_`.

Types intentionally separated into `types.d.ts` use ordinary declaration-file
visibility rules and do not need the JSDoc underscore workaround merely because
they remain TypeScript.

Which JSDoc typedefs are public is an API design decision made at the migration
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

This convention is temporary. Once TypeScript can strip `@internal` JSDoc
typedefs correctly, replace the underscore workaround as tracked by
[`blocked/jsdoc-typedef-strip-internal.md`](./blocked/jsdoc-typedef-strip-internal.md).

#### Typedef documentation does not survive declaration emit

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

A separately authored `types.d.ts` does not have this JSDoc-emission problem: its
TypeScript declaration comments are already the published declaration source.
That is another legitimate reason to split a substantial type-level API, but it
is not a requirement to split every small typedef out of its implementation.

Related upstream behavior: TypeScript sometimes re-emits a bare `@typedef`
comment attached to the *following* declaration instead
([microsoft/TypeScript#43534](https://github.com/microsoft/TypeScript/issues/43534),
fixed for the services layer), and
[microsoft/TypeScript#61664](https://github.com/microsoft/TypeScript/issues/61664)
proposes stripping redundant JSDoc type directives from declaration emit while
keeping documentation. Neither tracks this loss directly; no upstream issue for
it has been identified yet.

This does not block any migration group — it is a documentation-fidelity
regression, not a type-contract one. Record it, keep writing the documentation in
the source, and file an upstream issue so the gap is tracked rather than
rediscovered by each migration.

#### Separate the `@module` header from the first import with a blank line

A module's `@module` header can disappear from the emitted declaration too, but
that one is **not** an upstream gap — it is a source-formatting requirement, and
a blank line fixes it:

```js
/**
 * ...
 * @module
 */
                                    // <- this blank line is load-bearing
/** @import { Tuple } from './types.d.ts' */
import { mask } from '...'
```

Without the blank line, the header is the leading comment of the first `import`
*statement* (an `@import` tag is a comment, not a statement, so it does not
separate them). Declaration emit rewrites the import list — dropping
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
`fjs/types/list` and `fjs/types/nullable` are the five that currently lose their
header and want the same one-line fix.

#### Curried generic exports need an explicit `@returns`

A curried, generic exported function whose `@template`/`@param` chain has no
`@returns` still type-checks correctly in the repository — `npx tsc` reads the
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
(e.g. `genericMerge` calling `cmpReduce` calling into `mergeTail`, all
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

#### Declaration-only TypeScript is not a migration hard case

Do not require the migration plan to pre-design a JavaScript/JSDoc
representation for a type-only module. If a source file has no runtime API,
rename/rewrite it as `types.d.ts` and keep the declarations in TypeScript.

`fjs/types/phantom/module.f.ts` is the known example. Its public `Phantom` type
uses a type-only `declare const phantomKey: unique symbol`. `declare` is not
valid JavaScript, and replacing it with a runtime `Symbol()` would change the
module's current zero-runtime-representation design. Under the `types.d.ts`
convention this is no longer a hard case at all:

```text
fjs/types/phantom/module.f.ts -> fjs/types/phantom/types.d.ts
```

Consumers reference it directly as `../phantom/types.d.ts` from `import type` or
JSDoc `@import`. No JavaScript phantom module is required.

For a mixed runtime/type module, split the declarations that should remain
TypeScript into `types.d.ts` and migrate the actual implementation separately.
Only TypeScript syntax that remains inside runtime implementation source needs a
JSDoc translation. If such syntax has no established semantics-preserving JSDoc
translation and cannot naturally move into `types.d.ts`, record it as a focused
hard case and postpone only that runtime implementation group.

For each migration group:

- identify declaration-only files and convert them to `types.d.ts` rather than
  JavaScript;
- optionally split a stable type-level API into sibling `types.d.ts` before
  migrating the runtime implementation;
- replace remaining TypeScript-only implementation syntax with equivalent
  JavaScript plus JSDoc types;
- preserve public assignability semantics, not only runtime behavior;
- preserve JSDoc type visibility intent: public typedefs retain public names and
  implementation-only typedefs use the `_` prefix;
- if an implementation-only TypeScript construct has no established
  semantics-preserving JSDoc translation and does not belong in `types.d.ts`,
  record it as a focused hard case and postpone that runtime source module rather
  than inventing a redesign inside the mechanical migration;
- update runtime imports to migrated JavaScript paths;
- update type-only imports to the authored `types.d.ts` source path when
  declarations are split into `types.d.ts`;
- update proofs, tests, scripts, generated CI configuration, documentation, and
  other path-sensitive tooling;
- preserve type checking, declaration generation, runtime behavior, proofs,
  coverage, and package behavior.

#### End of stage 1

Keep `**/*.js` ignored while TypeScript implementations can still generate
`.js`. After the last authored implementation/proof `.ts` / `.f.ts` source file
is removed:

1. authored `types.d.ts` may remain permanently;
2. simplify `prepack` from
   `tsc --noEmit false --emitDeclarationOnly && tsc --noEmit false --declaration false`
   to declaration-only `tsc --noEmit false --emitDeclarationOnly`;
3. remove the TypeScript-to-JavaScript emission path;
4. remove obsolete generated `.js` output from the working tree when performing
   that transition;
5. remove the blanket `**/*.js` rule from `.gitignore` so authored `.js` can be
   tracked again.

Generated declaration ignores remain, except for the explicit authored
`**/types.d.ts` exception.

Only after this boundary may stage 2 use:

```text
module.f.mjs -> module.f.js
```

Stage 2 additionally requires
[`../fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
so authored `.f.js` is directly type-checked, receives `.d.ts` declarations, is
packed, and works for a clean package consumer before the first
compiler-compatibility rename. A sibling `types.d.ts` remains unchanged across
this rename.

### Tasks

- [ ] Complete
      [`f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md),
      including `allowJs` / `checkJs`, `skipLibCheck: false`, authored
      `types.d.ts`, and clean-consumer validation.
- [ ] Then complete
      [`f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
      before the first real repository `.f.ts` -> `.f.mjs` implementation
      conversion.
- [x] Set `skipLibCheck: false` so authored declaration files are semantically
      checked by the repository TypeScript run.
- [x] Explicitly unignore authored `**/types.d.ts` while keeping other generated
      `**/*.d.ts` ignored.
- [ ] Update contributor, compiler, language, package, test, and roadmap
      documentation to the stage-1 extension meanings and `types.d.ts`
      convention.
- [ ] Identify declaration-only `.ts` / `.f.ts` files and convert them directly
      to `types.d.ts`; identify truly runtime-empty declaration-only `.f.mjs`
      files that should become `types.d.ts` as well.
- [ ] Rename `fjs/types/phantom/module.f.ts` to
      `fjs/types/phantom/types.d.ts` and update its type-only consumers to use
      the authored `types.d.ts` source path; do not introduce a runtime phantom
      module.
- [ ] For mixed modules where a type-level API should stay in TypeScript, split
      that API into sibling `types.d.ts` before migrating JavaScript consumers.
- [ ] Identify runtime-dependency-leaf `.ts` / `.f.ts` implementation files and
      migrate those first; `types.d.ts` companions do not participate in that
      runtime ordering.
- [ ] Migrate `proof.f.ts` to `proof.f.mjs` when the proof is JavaScript/JSDoc
      ready and its authored runtime dependencies are migrated; allow stable
      type-only imports from `types.d.ts` and do not gate this on compiler
      support.
- [ ] Validate a migrated `.mjs` / `.f.mjs` fixture with an authored
      `types.d.ts`, using the same direct `types.d.ts` type-only source path from
      `.ts` and `.mjs`, including package emit and a clean consumer; no runtime
      type module may be required.
- [ ] Keep migrated JavaScript free of runtime **and type-only source**
      dependencies on remaining implementation `.ts` / `.f.ts`; split required
      declarations into `types.d.ts` first.
- [ ] Translate TypeScript generic constraints and `in` / `out` variance that
      remain in JavaScript source to JSDoc `@template` syntax without changing
      assignability.
- [ ] Give every exported function an explicit `@returns` (or top-level
      `@type` covering the full signature) rather than relying on inferred
      return types, and check the emitted `.d.mts` for new `any`/`elided`
      after migrating any module with generics or recursive data — inferred
      return types on curried generic exports can silently collapse to `any`
      in declaration emit even though `npx tsc` and `fjs t` stay green. Use
      the per-arrow `@template`/`@param`/`@returns` style (`fjs/types/array`'s
      `isTuple`, reused by `sorted_list`/`range_map`/`fsc`) instead of a
      single `@type {<T, S>(...) => ...}` when a generic function composes
      other independently-generic functions in its body.
- [ ] Keep `/** @type {const} */` as an inline cast on the expression, never
      hoisted to a leading declaration annotation — the declaration-level
      form fails with `TS2304` because TypeScript resolves `const` as an
      ordinary type name there, unlike every other `@type` cast.
- [ ] Decide each JSDoc typedef's visibility at the migration boundary: prefix
      implementation-only typedefs with `_` and leave publicly useful ones
      unprefixed, judged by what the module should offer its consumers rather
      than by what the `.f.ts` happened to export or by what a pending refactor
      plans to delete. Types intentionally moved to `types.d.ts` use normal
      declaration-file visibility instead.
- [ ] Keep a blank line between a module's `@module` header and its first
      `import` statement so the header survives declaration emit; fix the
      modules that already lost theirs (`fjs/common/monoid`,
      `fjs/types/btree/remove`, `fjs/types/btree/set`, `fjs/types/list`,
      `fjs/types/nullable`).
- [ ] File an upstream issue for JSDoc typedef documentation being dropped from
      declaration emit, and keep writing type documentation in the source
      meanwhile; substantial type APIs may instead live directly in
      `types.d.ts` when that is the cleaner module design.
- [ ] Treat `_`-prefixed JSDoc typedef names as private even when declarations
      emit them as exports, but still require `**BREAKING CHANGES:**` whenever a
      change to one alters the assignability of a public declaration.
- [ ] Once a module is `.mjs`, treat any later move of a public JSDoc typedef to
      a `_` name as an ordinary breaking API change with its own changelog entry
      and importer updates, not as a visibility cleanup.
- [ ] Continue upward through the runtime dependency graph in reviewable groups
      until no authored TypeScript implementation/proof source remains.
- [ ] Translate `.ts` to `.mjs` and `.f.ts` to `.f.mjs`, moving static type
      information either to JSDoc or to an intentionally separate `types.d.ts`
      without weakening public type semantics.
- [ ] Update imports, proofs, tests, coverage globs, scripts, generated CI, and
      documentation for every migrated group.
- [ ] Sweep prose references to already-migrated modules: `AGENTS.md`, README
      files, and `todo/*.md` still name `.f.ts` paths that no longer exist, so
      snippets copied from them produce broken imports and links. Include
      declaration-only renames such as `module.f.ts -> types.d.ts` and any
      typedef renames in this sweep.
- [ ] Preserve Node, Deno, Bun, proof, coverage, type-checking, declaration, and
      CI package behavior throughout the migration.
- [ ] Add required `**BREAKING CHANGES:**` changelog entries for every public
      runtime or type-contract change; direct changes to an emitted `_` alias
      are exempt only when the expanded public contract is unchanged.
- [ ] After the last authored TypeScript implementation/proof file is gone,
      simplify `prepack` to its declaration-only command and remove the TS-to-JS
      emit path and obsolete generated `.js` outputs. Authored `types.d.ts`
      remains.
- [ ] Then remove `**/*.js` from `.gitignore` so authored `.js` is trackable.
- [ ] Keep the compiler-compatibility migration explicitly **blocked by** this
      task.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first authored TypeScript
  implementation source is converted to JavaScript.
- `skipLibCheck` is `false`, so authored declaration source receives semantic
  TypeScript checking rather than being skipped.
- Authored `types.d.ts` is a first-class checked and packaged source convention,
  explicitly unignored from the generated `*.d.ts` ignore.
- Declaration-only source can become `types.d.ts` without creating a runtime
  JavaScript module; `fjs/types/phantom` uses this path.
- A runtime module may coexist with sibling `types.d.ts`, and TypeScript
  `import type` plus JSDoc `@import` both reference the authored `types.d.ts`
  source path directly.
- The `.f.mjs` runtime test/coverage fixture is complete before the first real
  repository `.f.ts` -> `.f.mjs` implementation conversion.
- No authored implementation/proof `.ts` or `.f.ts` source files remain at the
  end of Stage 1; authored `types.d.ts` files may remain permanently.
- Migration proceeds incrementally from runtime dependency leaves toward
  callers; type-only APIs can be separated into `types.d.ts` and do not require
  runtime migration ordering.
- Authored JavaScript uses `.mjs` / `.f.mjs` with JSDoc where static type
  information stays with the implementation, while `types.d.ts` holds
  intentionally separate type-level APIs.
- `proof.f.mjs` migration is gated by JavaScript/JSDoc and runtime dependency
  readiness, never by current FunctionalScript compiler support.
- Migrated JavaScript does not reference remaining implementation `.ts` /
  `.f.ts`, even for a type-only edge; declarations needed independently are
  split into `types.d.ts` first.
- No artificial runtime representation is introduced for declarations such as
  `declare const` or `unique symbol` that live naturally in `types.d.ts`.
- TypeScript generic constraints and variance annotations that remain in JSDoc
  are preserved with their JSDoc `@template` equivalents; public assignability
  is not weakened.
- Implementation-only JSDoc typedefs use `_`-prefixed names and are treated as
  private API even when TypeScript emits them as exported declaration aliases.
- Documentation lost from emitted declarations because it was attached to a
  JSDoc `@typedef` is recorded as a known upstream gap; an intentionally
  separate `types.d.ts` may preserve declaration documentation directly.
- Every migrated module's `@module` header survives into its emitted
  declaration, which requires a blank line between that header and the first
  `import` statement.
- Every exported function's return type survives into its emitted declaration as
  a named type, not `any` or `/*elided*/`; curried generic exports carry an
  explicit `@returns` rather than relying on inference, and the per-arrow
  `@template`/`@param`/`@returns` style is used wherever a generic function
  composes other independently-generic functions in its body.
- `/** @type {const} */` stays an inline cast on the expression it types, never a
  leading declaration-level annotation.
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
- Package-owned `.mjs`, authored `types.d.ts`, and generated declarations work
  from a clean CI package build and clean NPM consumer.
- Tests, proofs, coverage, supported runtimes, and type checking continue to
  pass.
- After the last authored TypeScript implementation/proof source is removed,
  `prepack` performs only declaration emission and no TypeScript-to-JavaScript
  emission remains; authored `types.d.ts` remains supported.
- `.gitignore` no longer blanket-ignores `.js` at the end of this task and keeps
  an explicit exception for authored `types.d.ts`.
- The compiler-compatibility migration starts only after this task and the
  authored-`.f.js` package/tooling prerequisite are complete.

### Related

- [`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md)
  — stage-1 authored `.mjs` / `types.d.ts` validation, declarations, and package
  support.
- [`../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
  — stage-1 end-to-end `.f.mjs` proof and coverage prerequisite.
- [`../fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
  — stage-2 authored `.f.js` package/tooling prerequisite.
- [`../fjs/ci/todo/publishing-packages.md`](../fjs/ci/todo/publishing-packages.md)
  — broader package-publishing plan.
- [`../fjs/fsc/README.md`](../fjs/fsc/README.md) — authoritative FunctionalScript
  extension and migration contract.
- [`blocked/jsdoc-typedef-strip-internal.md`](./blocked/jsdoc-typedef-strip-internal.md)
  — replace the temporary `_` convention with `@internal` when upstream
  declaration emit supports it.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — upstream request for `stripInternal` support on JSDoc typedefs.
- [`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md) — existing compiler
  integration and compiler-compatibility migration.
- [`plan/roadmap.md`](./plan/roadmap.md) — project roadmap.