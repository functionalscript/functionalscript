## Package support for authored `.mjs`

**Priority:** P2
**Status:** wip

### Problem

The repository-wide
[TypeScript-to-`.mjs` migration](../../../todo/migrate-typescript-to-mjs.md)
cannot convert its first package-owned `.ts` / `.f.ts` implementation source
until the TypeScript and NPM pipeline treats authored `.mjs` as first-class
source.

The package configuration originally validated only authored TypeScript and
published its generated `.js` / `.d.ts`, with no checked authored `.mjs` plus
generated `.d.mts` path — turning on `allowJs` / `checkJs` while keeping a
one-pass emit would have made authored `.mjs` both an input and an output
target. **This part is done** (see Progress below): `allowJs`/`checkJs` are
on and `prepack` is the two-pass emit that keeps authored `.mjs` untouched.
What the Problem below still motivates is the *validation* half — a fixture
and proofs that the mixed-source package actually builds and type-checks
correctly for a consumer.

Stage 1 is dependency-first for runtime implementations. Remaining `.ts` /
`.f.ts` may import already migrated `.mjs` / `.f.mjs`, while migrated JavaScript
must not depend on remaining implementation TypeScript. Type-only APIs are
separate: a directory may contain an authored `types.d.ts` companion that is
stable before, during, and after the implementation migration. It is permanent
type source, not generated output and not a file that Stage 1 later converts to
JavaScript.

Packaging and publishing run in CI from a clean checkout. Generated `.js`,
`.d.ts`, and `.d.mts` from an earlier commit or package build therefore do not
survive into the next package job. `prepack` is part of packaging, not a normal
development command, so the design does not need a local working-tree cleanup
protocol or separately exposed emission scripts.

### Proposal

Implement the minimum validation, emission, package-content, repository-policy,
and clean-consumer support required before the first stage-1 source migration.
The broader package roadmap remains in
[`publishing-packages.md`](./publishing-packages.md).

Use the stage-1 authored/generated invariant:

```text
source.ts   -> source.js + source.d.ts
source.mjs  -> source.mjs + source.d.mts
types.d.ts  -> types.d.ts
```

`types.d.ts` is authored declaration source. It may coexist with either
`module.f.ts`, `module.f.mjs`, or later `module.f.js` in the same directory.
Package selection already includes `**/*.d.ts`; repository ignore rules must make
an explicit exception for authored `types.d.ts` while continuing to ignore
generated declarations.

Enable `allowJs` and `checkJs` before the first source conversion so TypeScript
validates both authored implementation extensions. Keep `skipLibCheck: false`
so authored `types.d.ts` files receive declaration-file semantic checking rather
than being accepted without diagnostics.

Use one packaging lifecycle command with two ordered TypeScript passes while
TypeScript implementation source remains:

```json
"prepack": "tsc --noEmit false --emitDeclarationOnly && tsc --noEmit false --declaration false"
```

The first pass emits declarations for both `.ts` and `.mjs`. With those
declarations present, the second TypeScript invocation resolves the generated
`.d.mts` declarations for authored `.mjs` modules, so it emits runtime
JavaScript for the remaining TypeScript implementations without overwriting
authored `.mjs`. Authored `types.d.ts` is already a declaration and is packaged
as source rather than regenerated as a runtime file.

This exact `.ts` + `.mjs` configuration is already exercised by
[PR #1451](https://github.com/functionalscript/functionalscript/pull/1451): it
enables `allowJs` / `checkJs`, keeps `benchmark.mjs` in the repository, uses the
same two-pass `prepack`, and its Node 26 CI `npm pack` step succeeds. Extend that
validation with an authored `types.d.ts` companion rather than adding a staging
tree or a separate runtime-emission configuration.

Keep both passes inline in `prepack`; do not add public `emit:*` scripts for
users to run independently. Normal development should type-check and test the
source tree without generating package artifacts.

Because the CI package job starts from a clean checkout, a renamed
`source.ts -> source.mjs` does not carry ignored `source.js` / `source.d.ts`
artifacts from an earlier revision into the package job. Those files never need
to be discovered or deleted by the new `.mjs` input.

Do not introduce a staging tree or rewrite runtime specifiers. An authored
`.mjs` / `.f.mjs` group must therefore be closed over authored runtime
JavaScript dependencies outside the group. Remaining implementation TypeScript
may import already migrated `.mjs`; migrated JavaScript must not import or
JSDoc-reference remaining `.ts` / `.f.ts` implementation source.

When a migrated implementation needs a type that would otherwise keep such a
type-only edge, split that type into the directory's authored `types.d.ts` first.
Both TypeScript and JavaScript implementations reference the declaration module
through its authored source path:

```ts
import type { Phantom } from './types.d.ts'
```

```js
/** @import { Phantom } from './types.d.ts' */
```

Both forms are type-only, so there is no runtime import or runtime file
requirement. The same authored `./types.d.ts` source path survives
`module.f.ts -> module.f.mjs -> module.f.js`.

A declaration-only `module.f.ts` should therefore become `types.d.ts` instead of
`module.f.mjs`. The same cleanup may be applied to an existing `.f.mjs` that is
truly declaration-only and has no runtime API. Do not invent exports, `Symbol()`
values, or other runtime representations merely to keep type-system-only
constructs in JavaScript.

For FunctionalScript modules during stage 1:

- `.f.ts` is remaining authored TypeScript implementation source;
- `.f.mjs` is authored FunctionalScript-intent JavaScript, whether or not the
  current FunctionalScript compiler accepts all of its syntax;
- `types.d.ts` is authored type-only source and is not part of the implementation
  migration;
- `.f.ts` may depend at runtime on `.f.ts` or already migrated `.f.mjs`;
- `.f.mjs` runtime imports may depend on `.f.mjs`, not remaining `.f.ts` or
  generated `.f.js`;
- `.f.ts`, `.f.mjs`, and later `.f.js` may consume a sibling `types.d.ts` through
  the `./types.d.ts` type-only source specifier.

Update `AGENTS.md` with that runtime source-migration policy and the stable
`types.d.ts` companion convention. Compiler compatibility is a later
`.f.mjs -> .f.js` migration and is not part of this package prerequisite.

JSDoc declaration emit currently exposes every top-level `@typedef` as an
exported type alias. During the migration, implementation-only typedefs that stay
inside `.mjs` use the repository's leading-`_` convention, for example `_Node`;
see [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md).
An emitted `export type _Node = ...` is therefore package-private by contract,
not public API. Clean-consumer tests must exercise documented public types and
must not turn `_`-prefixed declaration artifacts into supported API merely
because TypeScript emitted them.

Types intentionally moved to `types.d.ts` use ordinary TypeScript declaration
syntax and do not need the JSDoc-emission workaround merely to remain expressible.
The eventual replacement for private JSDoc typedefs is still `@internal` plus
`stripInternal`, blocked on
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
and tracked in
[`todo/blocked/jsdoc-typedef-strip-internal.md`](../../../todo/blocked/jsdoc-typedef-strip-internal.md).

Package selection does not need to distinguish every authored `.mjs` by public
API status during this transition. Incidental authored files such as
`fjs/types/bigint/benchmark.mjs` may be present in the archive; because they are
not part of the documented public API, their presence does not block this task.
They can be removed separately when no longer useful.

As soon as no authored implementation/proof `.ts` / `.f.ts` source remains,
remove the second TypeScript runtime-emission pass. Authored `types.d.ts` files
may remain permanently; they do not require JavaScript emission. `prepack` then
needs only declaration emission:

```json
"prepack": "tsc --noEmit false --emitDeclarationOnly"
```

### Progress

The core TypeScript/NPM pipeline support is in place: `tsconfig.json` has
`allowJs`/`checkJs` enabled, `package.json`'s `prepack` is the exact two-pass
`tsc` command proposed here, and `files` already lists `**/*.mjs`/`**/*.d.mts`
alongside `**/*.js`/`**/*.d.ts`. This PR also sets `skipLibCheck: false`, so
`types.d.ts` is semantically checked. What remains open is the validation half:
no fixture yet exercises the mixed implementation-source package build together
with an authored `types.d.ts`, direct `./types.d.ts` type specifiers, and a
clean consumer.

### Tasks

- [ ] Keep `fjs/types/bigint/benchmark.mjs` type-checked with the rest of authored
      JavaScript; removing the benchmark is a separate cleanup and is not a
      prerequisite for this task.
- [x] Enable `allowJs` and `checkJs` in the root TypeScript configuration before
      the first `.ts` / `.f.ts` implementation migration.
- [x] Set `skipLibCheck: false` so authored declaration source is semantically
      checked by the repository TypeScript run.
- [x] Update NPM package rules to include authored `.mjs` and generated `.d.mts`.
      Do not add special exclusions merely for non-public authored `.mjs` files.
- [x] Replace one-pass package emission with the two ordered `tsc` commands
      directly in `prepack`: declarations first, then JavaScript emission.
- [x] Do not expose separate `emit:*` package scripts; packaging owns generated
      outputs.
- [x] Explicitly unignore authored `**/types.d.ts` while keeping generated
      `**/*.d.ts` ignored.
- [ ] Keep package/publish jobs on a clean CI checkout; do not add generated
      output tracking or cleanup for artifacts from previous revisions.
- [ ] Add a mixed `module.f.ts` / `module.f.mjs` plus authored `types.d.ts`
      package fixture.
- [ ] Import a type from that fixture through `./types.d.ts` from both TypeScript
      (`import type`) and JavaScript (JSDoc `@import`) and verify that TypeScript
      resolves the authored declaration directly without any runtime import.
- [ ] Include an implementation-only `_`-prefixed JSDoc typedef in the `.mjs`
      fixture; tolerate its current exported declaration form without treating it
      as clean-consumer public API.
- [ ] Test the allowed `.ts` -> `.mjs` runtime dependency direction in a clean
      checkout and CI-built package archive.
- [ ] Reject authored `.mjs` runtime imports or JSDoc type references to remaining
      relative implementation `.ts` / `.f.ts`; split required type APIs into
      `types.d.ts` first.
- [ ] Verify the CI-built archive preserves authored `types.d.ts` at its source
      path and a clean consumer can resolve the `./types.d.ts` type specifier.
- [ ] Type-check a clean consumer using exported/transitive types from the
      authored `.mjs` fixture and `types.d.ts`, without importing `_`-prefixed
      private JSDoc typedefs.
- [ ] Verify the CI-built archive contains authored `.mjs`, authored
      `types.d.ts`, generated `.js`, `.d.ts`, and `.d.mts` in the expected paths
      during stage 1.
- [x] Update `AGENTS.md` to the asymmetric `.f.ts` / `.f.mjs` migration policy.
- [ ] Add validation/proofs for the allowed TypeScript -> migrated-JavaScript
      runtime direction, rejected migrated-JavaScript -> TypeScript source
      direction, and authored `types.d.ts` companion resolution.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first implementation source
  conversion.
- `skipLibCheck` is `false`, so authored `types.d.ts` participates in normal
  declaration-file semantic checking.
- The main TypeScript check validates authored `.ts`, `.mjs`, and `types.d.ts`.
- `prepack` contains the two ordered `tsc` passes directly while TypeScript
  implementation source remains, with declaration emission first and JavaScript
  emission second.
- The exact two-pass command succeeds under `npm pack` with authored `.mjs` and
  `types.d.ts` present; PR #1451 provides the initial `.mjs` validation.
- Package emission produces `.d.ts` for implementation `.ts`, `.d.mts` for
  `.mjs`, `.js` only for implementation `.ts`, preserves authored `.mjs`
  unchanged, and preserves authored `types.d.ts` as source.
- `_`-prefixed JSDoc typedefs are treated as private API even if declaration
  emission currently writes them as exported aliases; clean-consumer tests do
  not depend on those names.
- Authored `types.d.ts` is tracked despite the generated `*.d.ts` ignore and is
  included in the package.
- TypeScript `import type` and JSDoc `@import` can both reference
  `./types.d.ts` directly, with no runtime import or runtime representation.
- Remaining `.ts` may import migrated `.mjs`; migrated `.mjs` cannot import or
  JSDoc-reference remaining implementation `.ts` / `.f.ts` or generated `.js`.
- A clean consumer can import the CI-built `.mjs` runtime and type-check against
  both its generated `.d.mts` and authored `types.d.ts` declarations.
- `.f.mjs` carries no current-compiler compatibility promise during stage 1.
- No staging tree or package-time runtime-specifier rewrite is needed.

### Ordering

Complete this task before the first package-owned implementation `.ts` / `.f.ts`
-> `.mjs` / `.f.mjs` conversion in
[`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md).
The migration then proceeds gradually from runtime dependency leaves, with
`types.d.ts` companions split out where needed before their JavaScript consumers
migrate.

After the last authored implementation/proof `.ts` / `.f.ts` source is removed,
simplify `prepack` to its declaration-only form and remove the
TypeScript-to-JavaScript emit path. Authored `types.d.ts` remains supported.
Then the separate [`f-js-package-support.md`](./f-js-package-support.md) task
prepares authored `.f.js` before compiler-compatibility migration starts.

### Related

- [PR #1451](https://github.com/functionalscript/functionalscript/pull/1451) —
  initial implementation and CI validation of `allowJs` / `checkJs` plus the
  two-pass `prepack`.
- [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
  — repository-wide stage-1 implementation source migration.
- [`todo/blocked/jsdoc-typedef-strip-internal.md`](../../../todo/blocked/jsdoc-typedef-strip-internal.md)
  — replace the temporary `_` convention with `@internal` when declaration emit
  supports it.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — upstream blocker for stripping private JSDoc typedefs.
- [`publishing-packages.md`](./publishing-packages.md) — broader package roadmap.
- [`f-js-package-support.md`](./f-js-package-support.md) — stage-2 authored
  `.f.js` package prerequisite.
- [`fjs/fsc/README.md`](../../fsc/README.md) — authoritative extension contract.
- [`.f.mjs` test and coverage support](../../emergent_testing/todo/f-mjs-test-and-coverage.md)
  — runtime proof/coverage fixtures for authored `.f.mjs`.