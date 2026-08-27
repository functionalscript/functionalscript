## Keep private types out of public declarations

**Priority:** P2
**Status:** open

### Problem

FunctionalScript currently mixes named types with authored JavaScript source.
Common examples are:

```text
module.f.mjs  # FunctionalScript implementation + file-scope JSDoc typedefs
module.mjs    # host integration + file-scope JSDoc typedefs
proof.f.mjs   # proofs + file-scope JSDoc typedefs
types.ts      # public types + private helpers
```

Other authored JavaScript companions, such as `testlib.f.mjs`, can contain the
same file-scope typedefs and are subject to the same declaration emit. The same
problem also exists outside `fjs/`; for example, `todo/proof.f.mjs` is an authored
`.mjs` file with a file-scope typedef. TypeScript turns file-scope JSDoc
`@typedef`s in authored `.mjs` files into exported aliases, so
implementation-private names leak into generated `.d.mts` files. The existing
leading-`_` convention marks those names private by contract, but the declarations
still contain noise and make the source/package boundary less clear.

The requirement is to keep the public declaration/API surface clean and
self-contained. `private.ts` and `meta.f.mjs` are **optional tools** for reaching
that result; they are not file roles that every module must introduce.

### Proposal

Use these file roles when they improve the concrete design:

```text
module.f.mjs  # FunctionalScript implementation
module.mjs    # host integration, when needed
proof.f.mjs   # FunctionalScript proofs
proof.mjs     # host proofs, when needed
meta.f.mjs    # optional runtime metadata/data extracted to support type structure
types.ts      # public declaration closure
private.ts    # optional implementation-private file-scope TypeScript
```

The design target is the public boundary, not the presence of particular files:

- `types.ts` describes the public declaration closure;
- use `private.ts` when moving implementation-private file-scope types out of the
  public declaration surface makes the structure cleaner;
- use `meta.f.mjs` when extracting runtime metadata/data lets TypeScript types or
  proofs depend on it without reversing the dependency order;
- do not create either file mechanically when a simpler organization already
  keeps the public surface clean.

No authored `.mjs` file anywhere in the repository may declare a **file-scope**
JSDoc `@typedef`, regardless of directory, basename, or whether the file is
FunctionalScript. This includes `module.f.mjs`, `module.mjs`, `proof.f.mjs`,
`proof.mjs`, `meta.f.mjs`, `testlib.f.mjs`, root-level or `todo/` `.mjs` files,
and other descriptive companions. Function-local typedefs remain allowed as
described below.

Private type and runtime constant names continue to start with `_`.

#### Dependency order

When these roles are present, keep the source dependency order:

```text
meta.f.mjs <- types.ts <- private.ts <- module.f.mjs <- proof.f.mjs <- module.mjs <- proof.mjs
```

The arrow points from a dependency to a dependent: a file may depend on files to
its left, but moving a type proof must not introduce a reverse edge merely to
keep the proof near the declaration it checks. The order is a layering rule, not
a requirement that every file or edge exists.

The file-placement conventions below are defaults, not a mechanical classifier.
Analyze concrete cases and prefer the simplest organization that preserves this
dependency order and the clean public boundary. In particular, do not force a
recursive RTTI constant into `meta.f.mjs` when expressing its recursion requires
a named annotation from `types.ts`; keeping that constant downstream can be
cleaner than creating a `meta.f.mjs -> types.ts` reverse edge.

Place assertions in the earliest layer that can legitimately see everything they
assert without reversing this order:

- invariants entirely inside the public type model belong in `types.ts`;
- implementation-private type invariants may use `private.ts` when that is the
  cleanest place and they do not need downstream implementation values;
- assertions about `module.f.mjs` implementations, including function signatures,
  belong downstream in `proof.f.mjs`, normally as function-local typedef proofs;
- host-specific implementation assertions belong downstream in `proof.mjs`.

For example, `fjs/effects/types.ts` currently imports `step`, `catchStep`,
`resultStep`, `mapStep`, `resultMapStep`, and `unwrapStep` from `module.f.mjs`
only to assert their inferred signatures with `ReturnType<typeof ...>`. Those
assertions verify the implementation layer, so the migration should move them to
`proof.f.mjs` rather than move the implementation functions into `meta.f.mjs`.
A representative group of compile-time-only checks can live inside one proof
function so every typedef remains lexical:

```js
signatures: () => {
    /**
     * @typedef {Assert<Equal<
     *   ReturnType<typeof step<_AddOp, number, NotImplemented, _MulOp, string, string>>,
     *   Effect<_AddOp | _MulOp, string, NotImplemented | string>
     * >>} _StepSig
     */

    /** @typedef {Assert<Equal<ReturnType<typeof catchStep<...>>, Effect<...>>>} _CatchStepSig */
}
```

Recursive metadata needs the same case-by-case treatment. Two current examples
illustrate the intended approach:

- `fjs/media/revision`: `LockMap` / `LockSchema` stay in `types.ts`; the recursive
  `lock` RTTI constant may stay in `module.f.mjs` because its initializer needs
  the named `LockSchema` annotation from `types.ts`; the `Assert<Check<...>>`
  consistency checks that currently make `types.ts` import `module.f.mjs` move
  downstream into a function in `proof.f.mjs`.
- `fjs/edag`: recursive RTTI such as `exp` may stay in `module.f.mjs` when its
  explicit annotation depends on the public EDAG types; file-scope consistency
  assertions such as `Assert<Check...>` move into one or more proof functions so
  the RTTI/type relationship is still pinned without leaking typedefs or
  reversing the dependency order.

These examples do not establish a special rule for every recursive type. They
show the process: inspect the cycle, preserve the dependency direction, move
verification downstream when useful, and introduce `private.ts` / `meta.f.mjs`
only when they simplify the result. Narrow exceptions may still be needed after
the concrete case has been analyzed.

#### Public declaration closure

`types.ts` is primarily the public type API, but it may contain private `_`
helpers when they are required to express any shipped public declaration.
"Public declaration" includes both exported type aliases and declarations of
exported runtime values/functions.

The default placement guide is:

```text
public type                                         -> types.ts
private `_` helper used by any public declaration   -> types.ts
other file-scope private `_` type                   -> private.ts, when useful
function-local typedef                              -> allowed in place
runtime metadata/data extracted for type structure  -> meta.f.mjs, when useful
```

For example, a helper used by a public type stays in `types.ts`:

```ts
type _Tuple<N extends number, T, R extends readonly T[]> =
    N extends R['length'] ? R : _Tuple<N, T, readonly [...R, T]>

export type Tuple<N extends number, T> = _Tuple<N, T, readonly []>
```

The same rule applies when a helper appears in an exported value declaration.
For example, if declaration emit for an exported `find` contains:

```ts
export const find: <T>(cmp: Cmp<T>) =>
    (value: T) => (array: _SortedArray<T>) => T | null
```

then `_SortedArray` is part of the public declaration closure and must remain in
`types.ts` (or be inlined into the public declaration). Moving it to
`private.ts` would make a shipped declaration depend on a declaration module
that packaging removes.

`types.ts` must never import `private.ts`. If moving a private helper to
`private.ts` would create a `types.ts -> private.ts` edge or cause any generated
public declaration to reference `private.ts`, keep or inline that helper in
`types.ts` instead.

`private.ts` therefore should be uncommon. It is a tool for separating
implementation-private file-scope types that are outside the public declaration
closure; it is not a required companion and not a mechanical destination for
every `_` name.

#### Function-local typedefs

Function-local JSDoc `@typedef` declarations are allowed in any authored source
file. They may refer to lexical values that cannot be named from a sibling
TypeScript file.

For example:

```js
const proof = () => {
    const orConst = or(42, string)
    /** @typedef {Assert<Equal<typeof orConst, Or<readonly [42, typeof string]>>>} _OrConst */
}
```

Callback-local type proofs are also valid:

```js
({ kind }) => {
    /** @typedef {Assert<Equal<typeof kind, 'add'>>} _Kind */
    return kind
}
```

Private function-local typedefs keep the leading `_`. Declaration validation
must verify that function-local typedefs remain lexical and do not escape as
exported aliases in generated `.d.ts` / `.d.mts` files.

#### `meta.f.mjs`

`meta.f.mjs` is an optional tool for extracting runtime metadata/data when doing
so improves the type/declaration boundary. Typical cases are RTTI descriptors,
`as const`-style data, and lookup tables whose literal shape is used to define or
derive TypeScript types.

Do not create `meta.f.mjs` merely because a runtime value participates in a type
proof. A recursive metadata constant that needs a named annotation from
`types.ts` may remain in `module.f.mjs`; ordinary implementation functions stay
in `module.f.mjs` even when a proof inspects their signature with `typeof`,
`ReturnType`, or `Parameters`. Move verification downstream when that is the
cleaner solution. The `media/revision`, `edag`, and `effects` examples above are
the current models for this analysis.

When `meta.f.mjs` is useful, examples include RTTI values:

```ts
import type { type } from './meta.f.mjs'

export type Value = Ts<typeof type>
```

ordinary literal constants:

```ts
import type { statuses } from './meta.f.mjs'

export type Status = typeof statuses[number]
```

and normal runtime tables whose type is asserted:

```js
// meta.f.mjs
export const _framingKeywords =
    /** @type {const} */ (['import', 'const', 'export', 'default', 'from'])
```

```ts
// private.ts
import type { _framingKeywords } from './meta.f.mjs'

type _KeywordsAreComplete =
    Assert<Equal<(typeof _framingKeywords)[number], _FramingKeyword>>
```

```js
// module.f.mjs
import { _framingKeywords } from './meta.f.mjs'
```

Private constants in `meta.f.mjs` use the same leading-`_` API convention as
private types. They may need to be exported so sibling runtime or TypeScript
modules can name them, but that export is module linkage rather than public API:
consumers must not depend on `_`-prefixed constants directly. Renaming or removing
such a name is not a breaking change solely because it was exported. As with
private types, changes that alter an actual public runtime/type contract still
follow the normal breaking-change rules.

Runtime code imports values from `meta.f.mjs` normally. Authored TypeScript type
modules use only named type-only imports:

```ts
import type { PublicType } from './types.ts'
import type { metadataValue } from './meta.f.mjs'
```

Do not use runtime `import { ... }`, namespace imports, or side-effect imports in
`types.ts` or `private.ts`.

When present, `meta.f.mjs` is executable FunctionalScript source. Emergent
testing already loads every `*.f.mjs` during normal test discovery, including
modules without a `proof` export. Add `meta.f.mjs` to the Node and Deno coverage
filters so the existing coverage thresholds apply to it. How a particular
metadata module satisfies those thresholds is left to its developer; this
convention does not prescribe proof imports, calls, or other coverage-specific
implementation choices.

#### Breaking migration; no compatibility re-exports

Moving a public file-scope type from any authored `.mjs` file to `types.ts`
changes its public type import path. Moving a public runtime constant from
`module.f.mjs` to `meta.f.mjs` changes its runtime import path.

Treat either move as an intentional breaking API change when it occurs:

```text
public type:     ./<source>.mjs  -> ./types.ts
public metadata: ./module.f.mjs -> ./meta.f.mjs
```

Update every repository importer and the changelog. Do not preserve old entry
points with compatibility typedefs, exports, or re-exports.

#### Declaration emission and packaging

If `private.ts` is used, it remains in the normal TypeScript program so its
declarations and all JSDoc `@import` users are checked. Normal declaration emit
may therefore produce an intermediate `private.d.ts`.

Do not try to exclude `private.ts` from the TypeScript program. Instead, when
such files exist, make private-declaration cleanup the final `prepack` step:

1. emit declarations;
2. run the existing declaration round-trip type-check;
3. delete generated `private.d.ts` files as the final `prepack` command;
4. let `npm pack` select files after `prepack` completes;
5. inspect the actual tarball;
6. install the tarball in a clean TypeScript consumer and type-check it.

Conceptually:

```text
tsc --noEmit false --emitDeclarationOnly && tsc && <delete generated private.d.ts files>
```

Do **not** rewrite or post-process emitted declaration text. TypeScript may retain
source JSDoc comments such as:

```js
/** @import { _Private } from './private.ts' */
```

inside an emitted `.d.ts` / `.d.mts`. In a declaration file this is a comment,
not a TypeScript import or module dependency, so it may remain after
`private.d.ts` is deleted.

Validation of the packed artifact must prove:

- authored `private.ts` and generated `private.d.ts` are not shipped when those
  files are used during source checking;
- no packed `.d.ts` / `.d.mts` has a **semantic TypeScript dependency** on a
  private type module that is not shipped.

A raw text search for `private.ts` / `@import` is therefore incorrect because it
would reject harmless retained comments. If a structural scan is used, it must
ignore comments and reject only actual declaration syntax that creates a module
dependency. The clean-consumer TypeScript check is the final semantic validation.
References to packaged `meta.f.mjs` are allowed.

#### Repository-policy reconciliation

[`../fsc/README.md`](../fsc/README.md) currently documents the leading `_` as an
interim API contract for private JSDoc typedefs that TypeScript leaks into emitted
declarations. The upstream blocker is
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407),
and the wait-for-`@internal`/`stripInternal` strategy is tracked in
[`../../todo/blocked/jsdoc-typedef-strip-internal.md`](../../todo/blocked/jsdoc-typedef-strip-internal.md).

That policy remains authoritative until this migration is implemented. When this
TODO lands, update `fjs/fsc/README.md` and delete or narrow the blocked TODO so
the repository has one private-type strategy.

The `.mjs` typedef prohibition is repository-wide, so the implementation must
also update the root [`../../AGENTS.md`](../../AGENTS.md). The root policy should
state that no authored `.mjs` anywhere in the repository may contain a file-scope
JSDoc `@typedef`. `fjs/AGENTS.md` should then document the additional `fjs/`-specific
file roles and dependency order, making clear that `private.ts` and `meta.f.mjs`
are optional tools rather than required companions.

Authored TypeScript type modules remain type-only and use named
`import type { ... }` imports. Do not leave a rule that only governs `fjs/` while
root-level authored `.mjs` files such as `todo/proof.f.mjs` remain outside the
convention.

### Tasks

- [ ] Document `private.ts` and `meta.f.mjs` as optional tools for cleaning the
      public declaration/API surface, not required companion files.
- [ ] Document and preserve the dependency order
      `meta.f.mjs <- types.ts <- private.ts <- module.f.mjs <- proof.f.mjs <- module.mjs <- proof.mjs`
      for the roles that are present.
- [ ] Treat file placement as a design guide, not a mechanical rule; analyze
      recursive or otherwise constrained cases before introducing files,
      exceptions, or reverse dependencies.
- [ ] Update root `AGENTS.md` to prohibit file-scope JSDoc `@typedef` in every
      authored `.mjs` file anywhere in the repository.
- [ ] Update `fjs/AGENTS.md` to document `types.ts`, optional `private.ts`, the
      optional `meta.f.mjs` role, the public-declaration-closure rule, and the
      dependency-order rule for `fjs/`.
- [ ] Update `fjs/fsc/README.md` and delete or narrow
      `todo/blocked/jsdoc-typedef-strip-internal.md` so they no longer prescribe
      a conflicting private-JSDoc strategy.
- [ ] Prohibit file-scope JSDoc `@typedef` in every authored `.mjs`
      repository-wide; allow function-local `@typedef` everywhere.
- [ ] Migrate existing authored `.mjs` violations outside `fjs/`, including
      `todo/proof.f.mjs`, using the same public-boundary and layering principles.
- [ ] Keep the leading `_` convention for every private type and private runtime
      metadata constant name.
- [ ] Move public file-scope named types from authored `.mjs` JSDoc into
      `types.ts` as a breaking migration; update importers and changelog.
- [ ] Keep or inline every private `_` helper required transitively by any
      shipped public declaration in `types.ts`, including helpers appearing in
      exported runtime-value/function signatures.
- [ ] Use `private.ts` only when separating implementation-private file-scope
      types from the public declaration closure is the cleanest solution; do not
      create it mechanically or create reverse/public-declaration dependencies.
- [ ] Review type assertions that currently reverse the dependency order. Move
      implementation-signature assertions downstream into proof files where
      possible; specifically, move the `fjs/effects/types.ts` assertions over
      `step` / `catchStep` / `resultStep` / `mapStep` / `resultMapStep` /
      `unwrapStep` into one or more proof functions with function-local typedefs
      in `fjs/effects/proof.f.mjs`.
- [ ] Review recursive metadata cases individually. For `fjs/media/revision`,
      keep the recursive `lock` RTTI in `module.f.mjs` if its `LockSchema`
      annotation requires `types.ts`, and move the `LockMap` / `LockField`
      consistency asserts into a proof function. Apply the same analysis to
      recursive EDAG RTTI such as `exp`: keep it in `module.f.mjs` when needed to
      preserve layering and move file-scope consistency asserts into proof
      functions.
- [ ] Keep lexical type-proof typedefs inside their functions.
- [ ] Use `meta.f.mjs` only when extracting runtime metadata/data improves the
      public/type structure while preserving dependency order; private extracted
      constants use `_`. Do not move ordinary implementation functions or
      recursively annotated metadata merely because a proof inspects their type.
- [ ] Move file-scope private proofs over metadata/constants to `private.ts`,
      `types.ts`, or a downstream proof function according to the concrete
      dependency graph; do not force one placement mechanically.
- [ ] Treat moves of public runtime constants to `meta.f.mjs` as breaking API
      changes when such moves are chosen; update runtime importers and changelog,
      with no compatibility re-exports.
- [ ] Require every import in authored TypeScript type modules (`types.ts` and
      `private.ts` when present) to use named `import type { ... }`.
- [ ] Update Node and Deno coverage filters to include `meta.f.mjs`; emergent
      testing already loads it, and the existing coverage thresholds apply.
- [ ] When `private.ts` is used, keep it in normal TypeScript checking without
      runtime JS emit and delete generated `private.d.ts` files as the final
      `prepack` step.
- [ ] Do not rewrite/post-process emitted declarations to remove retained JSDoc
      `@import` comments; they are non-semantic in `.d.ts` / `.d.mts`.
- [ ] Inspect the `npm pack` artifact for unshipped private declaration
      dependencies, ignoring retained comments.
- [ ] Add fixtures covering both optional tools and cases that do not need them:
      - a private helper required by a public type alias;
      - a private helper required by an exported runtime value/function
        declaration (the `_SortedArray`/`find` shape);
      - an implementation-private type separated with `private.ts`;
      - a function-local typedef depending on a lexical value;
      - an implementation-function signature assertion placed downstream in a
        proof rather than introducing `private.ts`/`meta.f.mjs` unnecessarily;
      - a recursive metadata case whose named type annotation keeps it in
        `module.f.mjs` while its consistency assert moves into a proof function;
      - a FunctionalScript descriptive companion such as `testlib.f.mjs` whose
        former file-scope typedef is moved to the appropriate place;
      - a non-FunctionalScript authored `.mjs` case;
      - a root/outside-`fjs/` authored `.mjs` case;
      - a case where `meta.f.mjs` is useful, including a private `_` constant.
- [ ] Include a retained JSDoc `@import ... './private.ts'` comment in an emitted
      declaration fixture and verify the clean consumer succeeds without
      `private.ts`; this proves comments do not create package dependencies.
- [ ] Verify the normal test runner loads fixture `meta.f.mjs` and Node/Deno
      coverage includes it under the existing thresholds.
- [ ] Verify source checking, declaration emit/cleanup, Node+Deno coverage,
      packing, and clean-consumer type checking.

### Acceptance criteria

- The public declaration/API surface is clean and self-contained; `private.ts`
  and `meta.f.mjs` are optional tools, not required companion files.
- The dependency order
  `meta.f.mjs <- types.ts <- private.ts <- module.f.mjs <- proof.f.mjs <- module.mjs <- proof.mjs`
  is preserved for roles that are present; type assertions do not create reverse
  edges merely for convenience.
- File placement follows concrete design needs rather than a blanket syntactic
  rule; recursive metadata may remain in `module.f.mjs` when moving it to
  `meta.f.mjs` would require a `types.ts` dependency, with consistency assertions
  moved downstream when appropriate.
- No authored `.mjs` file anywhere in the repository contains a file-scope JSDoc
  `@typedef`, regardless of directory, basename, FunctionalScript marker, or role.
- Function-local JSDoc `@typedef` is allowed everywhere; private names keep `_`
  and do not escape as exported declaration aliases.
- `types.ts` is the public declaration closure: public types plus any private
  helpers required transitively to express shipped declarations of public types
  or exported runtime values/functions.
- If present, `private.ts` contains only implementation-private file-scope types
  outside the public declaration closure. It is used only when that separation
  improves the design.
- `types.ts` and every packed public declaration are independent of unshipped
  private type modules.
- Assertions about ordinary implementation-function signatures live downstream
  of `module.f.mjs` (normally inside proof functions with function-local typedefs
  in `proof.f.mjs`) rather than forcing those functions into `meta.f.mjs` or
  importing implementation functions into `types.ts`.
- Every import in authored TypeScript type modules uses named
  `import type { ... }`.
- When `meta.f.mjs` is used, it contains runtime metadata/data extracted because
  that improves the type/public structure while preserving dependency order.
  Private constants use leading `_` even when exported for sibling-module
  access; `_` marks them private by contract. Emergent testing loads
  `meta.f.mjs`, Node and Deno coverage filters include it, and the existing
  coverage thresholds apply; this convention does not prescribe how developers
  satisfy those thresholds.
- Moving public types to `types.ts` or public runtime metadata to `meta.f.mjs`
  are breaking migrations when those moves occur: importers and changelog are
  updated and no compatibility re-exports preserve old entry points.
- If declaration emit creates `private.d.ts`, final-`prepack` cleanup removes it
  before package contents are selected.
- Emitted declarations are not text-postprocessed: retained JSDoc `@import`
  comments may mention `private.ts` and are allowed because they do not create a
  TypeScript module dependency.
- The packed tarball contains no unshipped private type artifacts required by
  public declarations, and no packed declaration has a semantic dependency on
  an unshipped private module.
- Public declaration helpers retained in `types.ts` remain self-contained and
  resolvable from shipped declarations, including helpers used by exported
  runtime-value/function signatures.
- Root `AGENTS.md` documents the repository-wide all-authored-`.mjs` file-scope
  typedef prohibition, while `fjs/AGENTS.md` documents the `fjs/`-specific
  declaration-closure/dependency-order rules and the optional `private.ts` /
  `meta.f.mjs` tools.
- `fjs/fsc/README.md` and the blocked `@internal`/`stripInternal` TODO no longer
  prescribe a conflicting private-JSDoc strategy.
- A clean TypeScript consumer type-checks successfully against the packed
  tarball after private artifacts are removed, including when retained comments
  mention the removed private source path.

### Related

- [`../fsc/README.md`](../fsc/README.md) — current `_` leak-tolerance policy.
- [`../../AGENTS.md`](../../AGENTS.md) — root repository policy to update with the
  all-authored-`.mjs` rule.
- [`../AGENTS.md`](../AGENTS.md) — `fjs/`-specific authored-TypeScript and file-role
  policy to update.
- [`../../todo/blocked/jsdoc-typedef-strip-internal.md`](../../todo/blocked/jsdoc-typedef-strip-internal.md)
  — current wait-for-`@internal`/`stripInternal` strategy.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — upstream JSDoc typedef stripping limitation.
- [`detect-unexported-types-referenced-by-exported-types.md`](./detect-unexported-types-referenced-by-exported-types.md)
  — related declaration-leak detection.
- [`document-file-type-naming-conventions.md`](./document-file-type-naming-conventions.md)
  — repository source-file roles.
- [`../../todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md)
  — current JavaScript/JSDoc migration and `_` convention.
- [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md)
  — declaration emission and clean package validation.
