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

TypeScript is also useful for type-level source. A type-only API does not need to
be translated to JSDoc merely because its runtime implementation migrates. It may
remain in a real authored `types.ts` file, including TypeScript-only declarations
such as `declare const` and `unique symbol`.

The repository therefore has two source categories and two ordered implementation
stages:

1. type-only APIs may live permanently in authored `types.ts` files;
2. migrate authored TypeScript **implementations and proofs** to JavaScript with
   JSDoc, independently of FunctionalScript compiler support;
3. after implementation TypeScript is gone, migrate compiler-supported
   FunctionalScript implementations from `.f.mjs` to authored `.f.js`.

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

- `.ts` / `.f.ts` are authored TypeScript implementation/proof source that still
  remains to migrate, except for intentional `types.ts` type modules;
- `.mjs` is authored ESM JavaScript with JSDoc types;
- `.f.mjs` is authored FunctionalScript-intent JavaScript with JSDoc types;
- `.f.mjs` does **not** promise that the current FunctionalScript compiler can
  parse the module;
- `types.ts` is authored TypeScript source for a type-level API and is outside the
  runtime implementation migration;
- `.js` remains generated output and must not be authored while TypeScript
  implementation source can still generate it;
- `.d.ts` / `.d.mts` remain generated declarations.

The authoritative extension contract in [`../fjs/fsc/README.md`](../fjs/fsc/README.md)
and the package/test plans must use these meanings throughout Stage 1.

#### Keep type-only APIs in real `types.ts`

Use `types.ts` for declarations that intentionally have no runtime
implementation or that are intentionally separated from runtime code. This is
ordinary authored TypeScript source, not generated output and not a temporary
migration extension.

A `types.ts` may coexist with every implementation stage:

```text
types.ts + module.f.ts
types.ts + module.f.mjs
types.ts + module.f.js
```

Both TypeScript and JavaScript implementations reference the same real source
file:

```ts
import type { Phantom } from './types.ts'
```

```js
/** @import { Phantom } from './types.ts' */
```

Both forms are type-only. The important property is that `types.ts` actually
exists. Do not rely on TypeScript resolving a missing `types.ts` or `types.js`
specifier to an authored `.d.ts`; Deno does not provide that substitution and
fails such source graphs.

This split is a normal module-organization option, not only an escape hatch. A
runtime module may keep simple, implementation-local types in TypeScript/JSDoc
beside the code, while a separately useful type-level API can live in `types.ts`.
Do not split mechanically when it only adds indirection, but do not force a type
into JSDoc merely to remove all TypeScript syntax either.

A file containing only `type`/`interface` declarations, type-only imports/exports,
`declare const`, or similar compile-time declarations should normally become
`types.ts` instead of `.f.mjs`. Never invent runtime `Symbol()` values or other
JavaScript representations just to preserve a type-system-only declaration.

`types.ts` is checked as normal TypeScript source, so no `skipLibCheck` change and
no `.gitignore` exception are required.

#### Validate package behavior before migration

Before the first real `.f.ts -> .f.mjs` implementation conversion, complete:

- [`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md),
  which validates authored `.mjs`, real `types.ts`, declaration/runtime emission,
  packed-package resolution, and clean consumers;
- [`../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md),
  which is **blocked by** package support and validates an actual `.f.mjs`
  runtime fixture under Node and Deno coverage.

`allowJs` and `checkJs` are already enabled and TypeScript remains the repository
type checker during Stage 1.

The real `types.ts` convention must be tested end to end rather than inferred
from `tsc` alone. In particular, with `rewriteRelativeImportExtensions: true`,
verify:

- how `./types.ts` references from `.ts` and JSDoc `.mjs` appear in emitted
  `.d.ts` / `.d.mts`;
- which generated `types.js` / `types.d.ts` artifacts are required in the packed
  package;
- whether TypeScript, Node, Deno, and Bun all resolve the packed result;
- whether the second TypeScript runtime-emission pass must remain while authored
  `types.ts` exists.

Do not simplify the package pipeline until that experiment establishes the
portable layout.

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
- migrated `.mjs` / `.f.mjs` must not runtime-import remaining implementation
  `.ts` / `.f.ts`;
- migrated JavaScript may use JSDoc `@import` from intentional `types.ts` type
  modules;
- when a required type still lives only in a remaining implementation `.ts` /
  `.f.ts`, split that type into `types.ts` before migrating the JavaScript
  consumer rather than retaining a type edge to the implementation module.

FunctionalScript parser support is not an eligibility condition. A `.f.ts`
implementation may move to `.f.mjs` even if the current FunctionalScript
compiler does not yet support all syntax in that file.

Proof files follow the same source-language rule. A migrated `module.f.mjs` may
keep its existing `proof.f.ts` temporarily, but `proof.f.mjs` is allowed as soon
as that proof can be expressed as JavaScript with JSDoc and every authored
runtime dependency outside its migration group is already `.f.mjs`. Type-only
APIs may remain permanently in `types.ts`. Compiler support for the proof is not
required.

#### Preserve TypeScript semantics in JSDoc

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

A JavaScript implementation must not gain a runtime import just because it uses a
separately declared type. Use JSDoc `@import`:

```js
/** @import { Types } from './types.ts' */
```

The corresponding TypeScript source uses the same real path:

```ts
import type { Types } from './types.ts'
```

Do not point migrated JavaScript at a remaining implementation `.ts` / `.f.ts`
merely for a type. If that type must survive independently of the implementation,
move or split it into `types.ts` first. If it is naturally implementation-local
and expressible in JSDoc, migrate it with the implementation instead.

#### Preserve private JSDoc type intent with `_`

A non-exported TypeScript type that is translated into a JavaScript `@typedef`
can become externally visible because TypeScript currently emits JSDoc typedefs
as exported aliases. The upstream request to make `@internal` plus
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

The public contract still governs transitive effects. If changing `_Node` changes
the assignability of a public `Tree`, that is still a breaking change. The
underscore exempts only the private alias itself.

Which JSDoc typedefs are public is an API design decision made at the migration
boundary, not a mechanical copy of what the `.f.ts` happened to export. Once a
module is `.mjs`, later moving a published public typedef to `_` is an ordinary
breaking API change.

A pending refactor is not a reason to pre-privatize. Visibility follows what the
module should offer consumers today. `Concat` and `NotLazy` in `fjs/types/list`
stay public even though
[`../fjs/types/list/todo/simplify-list-type.md`](../fjs/types/list/todo/simplify-list-type.md)
plans to remove both.

This convention is temporary. Once TypeScript can strip `@internal` JSDoc
typedefs correctly, replace the underscore workaround as tracked by
[`blocked/jsdoc-typedef-strip-internal.md`](./blocked/jsdoc-typedef-strip-internal.md).

#### Typedef documentation does not survive declaration emit

Declaration emit currently drops documentation written on a JSDoc `@typedef`.
A TypeScript declaration such as
`/** 8-word SHA-2 state vector. */ export type V8 = …` keeps its comment in the
emitted `.d.ts`; the equivalent JSDoc typedef in `.mjs` emits as a bare type
alias. Documentation on runtime exports is unaffected.

`fjs/crypto/sha2` is the clearest case so far: `V8`, `V16`, `State`, and `Sha2`
were documented types, and `Sha2` carried the module's `@example` walkthrough.
The source documentation survives, but it does not reach `module.f.d.mts`.

A substantial type-level API kept in authored `types.ts` avoids this JSDoc
translation problem because TypeScript emits its declaration comments normally.
This is a legitimate reason to split a type API, but not a requirement to split
every small typedef.

Related upstream behavior includes
[microsoft/TypeScript#43534](https://github.com/microsoft/TypeScript/issues/43534)
and
[microsoft/TypeScript#61664](https://github.com/microsoft/TypeScript/issues/61664),
but no issue specifically tracking this documentation loss has been identified.
File one and keep documenting source types meanwhile; this gap does not block a
migration group.

#### Separate the `@module` header from the first import

A module's `@module` header can disappear from emitted declarations when it is
attached to the first import statement. Keep a blank line after the module JSDoc:

```js
/**
 * ...
 * @module
 */

/** @import { Tuple } from './types.ts' */
import { mask } from '...'
```

Without the blank line, declaration emit may drop the import statement and its
attached header. This is a source-formatting requirement, not an upstream type
system gap.

The modules currently known to need this fix are:
`fjs/common/monoid`, `fjs/types/btree/remove`, `fjs/types/btree/set`,
`fjs/types/list`, and `fjs/types/nullable`.

#### Exported generic functions need stable declaration signatures

A curried generic exported function may type-check correctly from `.mjs` source
while declaration emit collapses an inferred return type to `any` or
`/*elided*/`. This was observed in `fjs/types/sorted_list` during review of
[#1478](https://github.com/functionalscript/functionalscript/pull/1478).

Give every exported function an explicit `@returns`, or a top-level `@type`
covering the complete signature, rather than relying on declaration emit to name
a deep inferred type. Check emitted `.d.mts` for `any` / `/*elided*/` after
migrating modules with generics or recursive data.

A related inference issue appears when a generic function composes other
independently generic helpers. A single `@type {<T, S>(...) => ...}` on a whole
curried chain may widen parameters to `unknown`. Use per-arrow
`@template` / `@param` / `@returns` when composition breaks inference. Existing
precedents include `fjs/types/array`'s `isTuple`, plus `sorted_list`, `range_map`,
and `fsc`.

Prefer the simpler single-`@type` form when it works; switch to per-arrow JSDoc
only when inference demonstrates the need.

#### Keep `@type {const}` as an inline cast

`/** @type {const} */` is valid as an inline JSDoc cast on an expression. Do not
hoist it into a declaration-level annotation: TypeScript resolves `const` there
as an ordinary type name and reports TS2304.

#### Declaration-only TypeScript is not a migration hard case

Do not design a JavaScript/JSDoc runtime representation for a type-only module.
If a source file has no runtime API, rewrite it as `types.ts` and keep the type
language in TypeScript.

`fjs/types/phantom/module.f.ts` is the canonical example. Its public `Phantom`
type uses a type-only `declare const phantomKey: unique symbol`. `declare` is not
valid JavaScript, and replacing it with a runtime `Symbol()` would change the
module's current zero-runtime-value design. Under this convention:

```text
fjs/types/phantom/module.f.ts -> fjs/types/phantom/types.ts
```

Consumers reference the real `../phantom/types.ts` from TypeScript `import type`
or JSDoc `@import`.

For a mixed runtime/type module, split declarations that should remain TypeScript
into `types.ts` and migrate the implementation separately. Only TypeScript syntax
that remains inside runtime implementation source needs a JSDoc translation.

For each migration group:

- identify type-only files and convert them to `types.ts` rather than JavaScript;
- optionally split a stable type-level API into sibling `types.ts` before
  migrating the runtime implementation;
- replace remaining TypeScript-only implementation syntax with equivalent
  JavaScript plus JSDoc types;
- preserve public assignability semantics, not only runtime behavior;
- preserve JSDoc type visibility intent: public typedefs retain public names and
  implementation-only typedefs use the `_` prefix;
- update runtime imports to migrated JavaScript paths;
- update type-only imports to real `types.ts` paths where declarations are split;
- update proofs, tests, scripts, generated CI configuration, documentation, and
  other path-sensitive tooling;
- preserve TypeScript, Node, Deno, Bun, declaration, proof, coverage, and package
  behavior.

#### End of Stage 1

Stage 1 ends when no authored TypeScript **implementation/proof** source remains;
authored `types.ts` may remain permanently.

Keep `**/*.js` ignored while TypeScript implementation sources can generate
`.js`. After the last implementation/proof source migrates, remove obsolete
generated implementation `.js` and make `.js` authorable only when the package
pipeline no longer needs that blanket ignore.

Do **not** assume the second TypeScript runtime-emission pass can be removed just
because only `types.ts` files remain. The package-support fixture must determine
whether generated `types.js` is required for portable package resolution. Apply
the simplest proven package layout at that boundary.

Only after Stage 1 may Stage 2 use:

```text
module.f.mjs -> module.f.js
```

Stage 2 additionally requires
[`../fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
so authored `.f.js` is directly type-checked, receives declarations, is packed,
and works for a clean consumer before the first compiler-compatibility rename.
A sibling `types.ts` remains unchanged across this rename.

### Tasks

- [ ] Complete
      [`f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md),
      including real `types.ts`, Deno validation, package emit, and clean
      consumers.
- [ ] Then complete
      [`f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
      before the first real repository `.f.ts -> .f.mjs` implementation
      conversion.
- [ ] Update contributor, compiler, package, test, and roadmap documentation to
      the Stage-1 extension meanings and `types.ts` convention.
- [ ] Identify type-only `.ts` / `.f.ts` files and convert them to `types.ts`.
- [ ] Rename `fjs/types/phantom/module.f.ts` to
      `fjs/types/phantom/types.ts`; do not introduce a runtime phantom value.
- [ ] For mixed modules where a type-level API should stay in TypeScript, split
      that API into sibling `types.ts` before migrating JavaScript consumers.
- [ ] Identify runtime-dependency-leaf `.ts` / `.f.ts` implementation files and
      migrate those first; `types.ts` companions do not participate in runtime
      ordering.
- [ ] Migrate `proof.f.ts` to `proof.f.mjs` when the proof is JavaScript/JSDoc
      ready and its authored runtime dependencies are migrated; allow type-only
      imports from `types.ts` and do not gate this on compiler support.
- [ ] Validate a migrated `.mjs` / `.f.mjs` fixture with real authored `types.ts`
      from both TypeScript and JSDoc, including `npx tsc`, Deno, Bun, package
      emit, and clean package consumers.
- [ ] Verify emitted declarations reference paths that actually exist in the
      packed package and determine whether generated `types.js` is required.
- [ ] Keep migrated JavaScript free of runtime dependencies on remaining
      implementation `.ts` / `.f.ts`; intentional type-only dependencies on
      `types.ts` are allowed.
- [ ] Translate TypeScript generic constraints and `in` / `out` variance that
      remain in JavaScript source to JSDoc `@template` syntax without changing
      assignability.
- [ ] Give every exported function an explicit `@returns` or top-level `@type`
      when needed to prevent `any` / `/*elided*/` declaration output; use
      per-arrow generic JSDoc when composition breaks inference.
- [ ] Keep `/** @type {const} */` as an inline cast on the expression, never a
      leading declaration annotation.
- [ ] Decide each JSDoc typedef's visibility at the migration boundary: prefix
      implementation-only typedefs with `_` and leave publicly useful ones
      unprefixed.
- [ ] Keep a blank line between a module's `@module` header and its first import
      statement so the header survives declaration emit.
- [ ] File an upstream issue for JSDoc typedef documentation being dropped from
      declaration emit.
- [ ] Treat `_`-prefixed JSDoc typedef names as private even when declarations
      emit them as exports, but still require `**BREAKING CHANGES:**` whenever a
      change alters a public declaration's assignability.
- [ ] Once a module is `.mjs`, treat any later move of a public JSDoc typedef to
      `_` as an ordinary breaking API change.
- [ ] Continue upward through the runtime dependency graph in reviewable groups
      until no authored TypeScript implementation/proof source remains.
- [ ] Update imports, proofs, tests, coverage globs, scripts, generated CI, and
      documentation for every migrated group.
- [ ] Sweep prose references to migrated paths and renamed typedefs at least at
      the end of Stage 1.
- [ ] Preserve Node, Deno, Bun, proof, coverage, type-checking, declaration, and
      CI package behavior throughout the migration.
- [ ] Add required `**BREAKING CHANGES:**` changelog entries for public runtime
      or type-contract changes; direct changes to emitted `_` aliases are exempt
      only when the expanded public contract is unchanged.
- [ ] After implementation/proof TypeScript is gone, simplify the package emit
      path only as allowed by the validated `types.ts` package layout.
- [ ] Then remove `**/*.js` from `.gitignore` when generated implementation
      JavaScript no longer needs the blanket ignore.
- [ ] Keep the compiler-compatibility migration explicitly **blocked by** this
      task.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first authored TypeScript
  implementation source is converted to JavaScript.
- Authored `types.ts` is a first-class checked type-source convention.
- TypeScript `import type` and JSDoc `@import` both use the same real `types.ts`
  path.
- Deno resolves source `types.ts` without `@ts-types`, `@ts-self-types`, a dummy
  runtime `types.js`, or missing-file declaration substitution.
- The `.f.mjs` runtime test/coverage fixture is complete before the first real
  repository implementation conversion.
- No authored implementation/proof `.ts` or `.f.ts` source remains at the end of
  Stage 1; authored `types.ts` may remain permanently.
- Migration proceeds incrementally from runtime dependency leaves toward callers;
  type-only APIs do not require runtime migration ordering.
- Authored JavaScript uses `.mjs` / `.f.mjs` with JSDoc where static type
  information remains with the implementation.
- Migrated JavaScript does not runtime-import remaining implementation `.ts` /
  `.f.ts`; intentional type-only imports target `types.ts`.
- No artificial runtime representation is introduced for declarations such as
  `declare const` or `unique symbol`.
- TypeScript generic constraints and variance annotations that remain in JSDoc
  preserve public assignability.
- Implementation-only JSDoc typedefs use `_`-prefixed names and are treated as
  private API even when TypeScript emits them as exported declaration aliases.
- Every migrated module's `@module` header survives declaration emit.
- Exported generic functions do not silently degrade to `any` / `/*elided*/` in
  emitted declarations.
- Package-owned `.mjs`, real source `types.ts`, generated declarations, and any
  required generated `types.js` work from a clean CI package build and clean
  TypeScript/Node/Deno/Bun consumers.
- `.f.mjs` means FunctionalScript-intent JavaScript, not current-compiler
  compatibility.
- `.gitignore` no longer blanket-ignores authored `.js` once that is safe.
- The compiler-compatibility migration starts only after this task and the
  authored-`.f.js` package/tooling prerequisite are complete.

### Related

- [`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md)
  — Stage-1 authored `.mjs` / `types.ts` package validation.
- [`../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
  — Stage-1 end-to-end `.f.mjs` proof and coverage prerequisite.
- [`../fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
  — Stage-2 authored `.f.js` package prerequisite.
- [`blocked/jsdoc-typedef-strip-internal.md`](./blocked/jsdoc-typedef-strip-internal.md)
  — upstream blocker for stripping private JSDoc typedefs.
- [`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md) — compiler integration
  and compiler-compatibility migration.
- [`plan/roadmap.md`](./plan/roadmap.md) — project roadmap.
