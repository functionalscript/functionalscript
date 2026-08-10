## Package support for authored `.mjs`

**Priority:** P2
**Status:** wip

### Problem

The repository-wide
[TypeScript-to-`.mjs` migration](../../../todo/migrate-typescript-to-mjs.md)
cannot convert its first package-owned `.ts` / `.f.ts` source until the
TypeScript and NPM pipeline treats authored `.mjs` as first-class source.

The package configuration originally validated only authored TypeScript and
published its generated `.js` / `.d.ts`, with no checked authored `.mjs` plus
generated `.d.mts` path — turning on `allowJs` / `checkJs` while keeping a
one-pass emit would have made authored `.mjs` both an input and an output
target. **This part is done** (see Progress below): `allowJs`/`checkJs` are
on and `prepack` is the two-pass emit that keeps authored `.mjs` untouched.
What the Problem below still motivates is the *validation* half — a fixture
and proofs that the mixed-source package actually builds and type-checks
correctly for a consumer.

Stage 1 is dependency-first for **runtime** dependencies. Remaining `.ts` /
`.f.ts` may import already migrated `.mjs` / `.f.mjs`, while migrated JavaScript
must not retain runtime imports of remaining TypeScript. Type-only dependencies
are different: migrated JavaScript may reference types from remaining `.ts` /
`.f.ts` with JSDoc `@import`, because it creates no runtime dependency. The
package pipeline must preserve a usable declaration path for those references
without inventing a JavaScript runtime import or runtime representation.

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
source.ts  -> source.js + source.d.ts
source.mjs -> source.mjs + source.d.mts
```

Enable `allowJs` and `checkJs` before the first source conversion so TypeScript
validates both authored extensions.

Use one packaging lifecycle command with two ordered TypeScript passes while
TypeScript source remains:

```json
"prepack": "tsc --noEmit false --emitDeclarationOnly && tsc --noEmit false --declaration false"
```

The first pass emits declarations for both `.ts` and `.mjs`. With those
declarations present, the second TypeScript invocation resolves the generated
`.d.mts` declarations for authored `.mjs` modules, so it emits runtime
JavaScript for the remaining TypeScript sources without overwriting authored
`.mjs`.

This exact configuration is already exercised by
[PR #1451](https://github.com/functionalscript/functionalscript/pull/1451): it
enables `allowJs` / `checkJs`, keeps `benchmark.mjs` in the repository, uses the
same two-pass `prepack`, and its Node 26 CI `npm pack` step succeeds. Keep this
simple ordering rather than adding a separate runtime-emission configuration
unless a real repository case demonstrates that it is needed.

Keep both passes inline in `prepack`; do not add public `emit:*` scripts for
users to run independently. Normal development should type-check and test the
source tree without generating package artifacts.

Because the CI package job starts from a clean checkout, a renamed
`source.ts -> source.mjs` does not carry ignored `source.js` / `source.d.ts`
artifacts from an earlier revision into the package job. Those files never need
to be discovered or deleted by the new `.mjs` input.

Do not introduce a staging tree or rewrite runtime specifiers. An authored
`.mjs` / `.f.mjs` group must therefore be closed over authored **runtime**
JavaScript dependencies outside the group. Remaining TypeScript may import
already migrated `.mjs`; migrated JavaScript may use JSDoc `@import` for a
remaining TypeScript type-only dependency, for example:

```js
/** @import { Phantom } from '../../types/phantom/module.f.ts' */
```

This exception is type-only. A real JavaScript `import` from `.mjs` / `.f.mjs`
to remaining `.ts` / `.f.ts` is still rejected. Do not create runtime imports,
exports, or values merely to make a type-only module usable from migrated
JavaScript.

For FunctionalScript modules during stage 1:

- `.f.ts` is remaining authored TypeScript;
- `.f.mjs` is authored FunctionalScript-intent JavaScript, whether or not the
  current FunctionalScript compiler accepts all of its syntax;
- `.f.ts` may depend at runtime on `.f.ts` or already migrated `.f.mjs`;
- `.f.mjs` runtime imports may depend on `.f.mjs`, not remaining `.f.ts` or
  generated `.f.js`;
- `.f.mjs` JSDoc `@import` may reference a type from remaining `.f.ts` without
  making that TypeScript file a runtime dependency.

Update `AGENTS.md` with that asymmetric runtime source-migration policy and the
JSDoc type-only exception. Compiler compatibility is a later `.f.mjs` -> `.f.js`
migration and is not part of this package prerequisite.

JSDoc declaration emit currently exposes every top-level `@typedef` as an
exported type alias. During the migration, implementation-only typedefs use the
repository's leading-`_` convention, for example `_Node`; see
[`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md).
An emitted `export type _Node = ...` is therefore package-private by contract,
not public API. Clean-consumer tests must exercise documented public types and
must not turn `_`-prefixed declaration artifacts into supported API merely
because TypeScript emitted them.

The eventual replacement is `@internal` plus `stripInternal`, blocked on
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
and tracked in
[`todo/blocked/jsdoc-typedef-strip-internal.md`](../../../todo/blocked/jsdoc-typedef-strip-internal.md).

Package selection does not need to distinguish every authored `.mjs` by public
API status during this transition. Incidental authored files such as
`fjs/types/bigint/benchmark.mjs` may be present in the archive; because they are
not part of the documented public API, their presence does not block this task.
They can be removed separately when no longer useful.

As soon as no authored `.ts` / `.f.ts` source remains, remove the second
TypeScript runtime-emission pass. `prepack` then needs only declaration emission:

```json
"prepack": "tsc --noEmit false --emitDeclarationOnly"
```

### Progress

The core TypeScript/NPM pipeline support is in place: `tsconfig.json` has
`allowJs`/`checkJs` enabled, `package.json`'s `prepack` is the exact two-pass
`tsc` command proposed here, `files` already lists `**/*.mjs`/`**/*.d.mts`
alongside `**/*.js`/`**/*.d.ts`, and `AGENTS.md` documents the asymmetric
`.f.ts`/`.f.mjs` runtime dependency policy. What remains open is the
*validation* half: no fixture or proof yet exercises the mixed `.ts`+`.mjs`
package build, the clean-consumer type-check, the rejected `.mjs`→`.ts` runtime
import direction, or the allowed JSDoc type-only `.mjs`→`.ts` direction.

### Tasks

- [ ] Keep `fjs/types/bigint/benchmark.mjs` type-checked with the rest of authored
      JavaScript; removing the benchmark is a separate cleanup and is not a
      prerequisite for this task.
- [x] Enable `allowJs` and `checkJs` in the root TypeScript configuration before
      the first `.ts` / `.f.ts` migration.
- [x] Update NPM package rules to include authored `.mjs` and generated `.d.mts`.
      Do not add special exclusions merely for non-public authored `.mjs` files.
- [x] Replace one-pass package emission with the two ordered `tsc` commands
      directly in `prepack`: declarations first, then JavaScript emission.
- [x] Do not expose separate `emit:*` package scripts; packaging owns generated
      outputs.
- [ ] Keep package/publish jobs on a clean CI checkout; do not add generated
      output tracking or cleanup for artifacts from previous revisions.
- [ ] Add a mixed authored `.ts` + JSDoc `.mjs` package fixture.
- [ ] Include an implementation-only `_`-prefixed JSDoc typedef in the fixture;
      tolerate its current exported declaration form without treating it as
      clean-consumer public API.
- [ ] Test the allowed `.ts` -> `.mjs` runtime dependency direction in a clean
      checkout and CI-built package archive.
- [ ] Reject authored `.mjs` runtime imports of remaining relative `.ts` or
      generated `.js`.
- [ ] Add a remaining `.ts` type-only dependency and consume it from authored
      `.mjs` with JSDoc `@import`; verify that no runtime import/value is needed.
- [ ] Verify the emitted `.d.mts` for that type-only edge resolves correctly from
      the clean CI-built package and does not reference an omitted package file.
- [ ] Type-check a clean consumer using exported/transitive types from the
      authored `.mjs` fixture, including the type-only dependency, without
      importing `_`-prefixed private typedefs.
- [ ] Verify the CI-built archive contains authored `.mjs`, generated `.js`,
      `.d.ts`, and `.d.mts` in the expected paths during stage 1.
- [x] Update `AGENTS.md` to the asymmetric `.f.ts` / `.f.mjs` migration policy.
- [ ] Add validation/proofs for the allowed TypeScript -> migrated-JavaScript
      runtime direction, the rejected migrated-JavaScript -> TypeScript runtime
      direction, and the allowed JSDoc type-only migrated-JavaScript ->
      TypeScript direction.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first source conversion.
- The main TypeScript check validates authored `.ts` and `.mjs`.
- `prepack` contains the two ordered `tsc` passes directly while TypeScript
  remains, with declaration emission first and JavaScript emission second.
- The exact two-pass command succeeds under `npm pack` with authored `.mjs`
  present; PR #1451 provides the initial repository validation of this behavior.
- Package emission produces `.d.ts` for `.ts`, `.d.mts` for `.mjs`, `.js` only
  for `.ts`, and preserves authored `.mjs` unchanged.
- `_`-prefixed JSDoc typedefs are treated as private API even if declaration
  emission currently writes them as exported aliases; clean-consumer tests do
  not depend on those names.
- Non-public authored `.mjs` files do not require special package exclusions.
- No separate user-facing `emit:*` scripts are required.
- Package/publish runs start from a clean CI checkout, so ignored generated
  outputs from previous revisions cannot leak into a package build.
- No repository-owned cleanup or legacy generated-output tracking is required
  for the stage-1 migration.
- Remaining `.ts` may import migrated `.mjs`; migrated `.mjs` cannot runtime
  import remaining `.ts` or generated `.js`.
- Migrated `.mjs` may use JSDoc `@import` for a type-only dependency that remains
  `.ts`, and the resulting declarations work for a clean package consumer
  without adding a runtime dependency.
- A clean consumer can import the CI-built `.mjs` runtime and type-check against
  its `.d.mts` declarations.
- `.f.mjs` carries no current-compiler compatibility promise during stage 1.
- No staging tree or package-time runtime-specifier rewrite is needed.

### Ordering

Complete this task before the first package-owned `.ts` / `.f.ts` -> `.mjs` /
`.f.mjs` conversion in
[`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md).
The migration then proceeds gradually from runtime dependency leaves.

After the last authored `.ts` / `.f.ts` source is removed, simplify `prepack` to
its declaration-only form and remove the TypeScript-to-JavaScript emit path.
Then the separate [`f-js-package-support.md`](./f-js-package-support.md) task
prepares authored `.f.js` before compiler-compatibility migration starts.

### Related

- [PR #1451](https://github.com/functionalscript/functionalscript/pull/1451) —
  initial implementation and CI validation of `allowJs` / `checkJs` plus the
  two-pass `prepack`.
- [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
  — repository-wide stage-1 source migration.
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