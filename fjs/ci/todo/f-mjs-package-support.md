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
What remains is the validation half — a fixture and proofs that the mixed-source
package actually builds and type-checks correctly for consumers and all supported
runtimes.

Stage 1 is dependency-first for runtime implementations. Remaining `.ts` /
`.f.ts` may import already migrated `.mjs` / `.f.mjs`, while migrated JavaScript
must not depend on remaining implementation TypeScript. Type-only APIs are
separate: a directory may contain a real authored `types.ts` source module that
is stable before, during, and after the implementation migration.

Using a real `types.ts` is intentional. Both TypeScript and JSDoc can reference
the exact same source path, and Deno can resolve the file directly instead of
relying on TypeScript-specific substitution from a nonexistent `.ts` / `.js`
path to an authored `.d.ts` file.

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

Use the stage-1 source model:

```text
source.ts   -> source.js + source.d.ts
source.mjs  -> source.mjs + source.d.mts
types.ts    -> generated type-package artifacts to be validated
```

`types.ts` is authored TypeScript source whose purpose is a type-level API rather
than a runtime implementation. It may contain `type`, `interface`, type-only
imports/exports, `declare const`, `unique symbol`, and similar declarations. It
may coexist with `module.f.ts`, `module.f.mjs`, or later `module.f.js`.

Both TypeScript and JavaScript implementations reference the real source file:

```ts
import type { Phantom } from './types.ts'
```

```js
/** @import { Phantom } from './types.ts' */
```

No resolver alias is involved: `types.ts` exists in the repository, so the
source tree never depends on specifier substitution. (For the *packed* package
the substitution concern was measured and retired in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520): Deno
2.9.5 does apply `.ts` -> `.d.ts` substitution to the `./types.ts` specifiers
inside shipped `.d.mts` files, as do TypeScript 5.9.3/7.0.2 and Bun 1.3.11 —
but only for packages resolved as npm packages through `node_modules`, not for
`file:`-linked directories, which Deno treats as first-party source. Method and
caveats: [`packed-consumer-validation.md`](../packed-consumer-validation.md).)

Enable `allowJs` and `checkJs` before the first implementation source conversion
so TypeScript validates both authored implementation extensions. No
`skipLibCheck` change is required: `types.ts` is ordinary source and is checked
normally even while dependency `.d.ts` checking remains skipped.

Use one packaging lifecycle command with two ordered TypeScript passes while the
current mixed source layout requires it:

```json
"prepack": "tsc --noEmit false --emitDeclarationOnly && tsc --noEmit false --declaration false"
```

The first pass emits declarations for `.ts` and `.mjs`. With those declarations
present, the second TypeScript invocation emits runtime JavaScript for `.ts`
sources without overwriting authored `.mjs`. (The mixed layout no longer
requires it: with only `types.ts` and test-fixture TypeScript left, the second
pass emitted nothing any consumer resolves, and
[#1520](https://github.com/functionalscript/functionalscript/pull/1520) replaced
it with `tsc --noEmit` — review found the pass also served as the
declaration-emit round-trip check, a property the no-emit re-check keeps.)

This exact `.ts` + `.mjs` configuration is already exercised by
[PR #1451](https://github.com/functionalscript/functionalscript/pull/1451): it
enables `allowJs` / `checkJs`, keeps `benchmark.mjs` in the repository, uses the
same two-pass `prepack`, and its Node 26 CI `npm pack` step succeeds.

The `types.ts` convention adds one packaging question that must be proven by the
fixture rather than assumed. With `rewriteRelativeImportExtensions: true`, verify
what TypeScript emits for references to `./types.ts` from both `.ts` and `.mjs`,
which generated `types.js` / `types.d.ts` artifacts are required in the package,
and whether Node, Deno, Bun, and a clean TypeScript consumer all resolve the
packed result. **Answered in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520)** by
direct measurement against the packed tarball: declaration emit keeps
`./types.ts` verbatim, only `types.d.ts` is required, `types.js` is not, and
TypeScript 5.9.3/7.0.2, Node v22, Deno 2.9.5, and Bun 1.3.11 all resolve the
result. The JavaScript emit is removed; `prepack` is
`tsc --noEmit false --emitDeclarationOnly && tsc --noEmit` — the second
invocation keeps the old pass's declaration-emit round-trip check without its
output — and the package file list is unchanged.

Keep both passes inline in `prepack`; do not add public `emit:*` scripts for
users to run independently. Normal development should type-check and test the
source tree without generating package artifacts.

Because the CI package job starts from a clean checkout, a renamed
`source.ts -> source.mjs` does not carry ignored `source.js` / `source.d.ts`
artifacts from an earlier revision into the package job. Those files never need
to be discovered or deleted by the new `.mjs` input.

Do not introduce a staging tree or rewrite source specifiers by hand. An authored
`.mjs` / `.f.mjs` group must therefore be closed over authored runtime JavaScript
dependencies outside the group. Remaining implementation TypeScript may import
already migrated `.mjs`; migrated JavaScript must not runtime-import remaining
`.ts` / `.f.ts` implementation source.

When a migrated implementation needs a type that would otherwise keep a
type-only edge to an implementation module, split that type into the directory's
authored `types.ts` first. A JSDoc `@import` to `types.ts` is allowed because it
is an intentional type-source dependency, not a runtime dependency.

A declaration-only `module.f.ts` should therefore normally become `types.ts`
instead of `module.f.mjs`. Do not invent `Symbol()` values or other runtime
representations merely to keep type-system-only constructs in JavaScript.

For FunctionalScript modules during stage 1:

- `.f.ts` is remaining authored TypeScript implementation/proof source;
- `.f.mjs` is authored FunctionalScript-intent JavaScript, whether or not the
  current FunctionalScript compiler accepts all of its syntax;
- `types.ts` is authored type-only TypeScript source and is outside the runtime
  implementation migration;
- `.f.ts` may depend at runtime on `.f.ts` or already migrated `.f.mjs`;
- `.f.mjs` runtime imports may depend on `.f.mjs`, not remaining `.f.ts` or
  generated `.f.js`;
- `.f.ts`, `.f.mjs`, and later `.f.js` may use `types.ts` through `import type` or
  JSDoc `@import`.

Update `AGENTS.md` with that runtime source-migration policy and the stable
`types.ts` companion convention. Compiler compatibility is a later
`.f.mjs -> .f.js` migration and is not part of this package prerequisite.

JSDoc declaration emit currently exposes every top-level `@typedef` as an
exported type alias. During the migration, implementation-only typedefs that stay
inside `.mjs` use the repository's leading-`_` convention, for example `_Node`;
see [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md).
An emitted `export type _Node = ...` is therefore package-private by contract,
not public API. Clean-consumer tests must exercise documented public types and
must not turn `_`-prefixed declaration artifacts into supported API merely
because TypeScript emitted them.

Types intentionally moved to `types.ts` use ordinary TypeScript syntax and do
not need the JSDoc-emission workaround merely to remain expressible. The eventual
replacement for private JSDoc typedefs is still `@internal` plus `stripInternal`,
blocked on
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
and tracked in
[`todo/blocked/jsdoc-typedef-strip-internal.md`](../../../todo/blocked/jsdoc-typedef-strip-internal.md).

Package selection does not need to distinguish every authored `.mjs` by public
API status during this transition. Incidental authored files such as
`fjs/types/bigint/benchmark.mjs` may be present in the archive; because they are
not part of the documented public API, their presence does not block this task.
They can be removed separately when no longer useful.

### Progress

The core `.ts` + `.mjs` pipeline support is in place: `tsconfig.json` has
`allowJs`/`checkJs` enabled, and `files` lists `**/*.mjs`/`**/*.d.mts`
alongside `**/*.js`/`**/*.d.ts`. `prepack` was the two-pass `tsc` command
proposed here until
[#1520](https://github.com/functionalscript/functionalscript/pull/1520) proved
the JavaScript output unnecessary and replaced the second pass with a no-emit
re-check (`tsc --noEmit`), keeping its declaration-emit round-trip property. That PR
also performed the clean packed-consumer validation manually (tsc 5.9.3/7.0.2,
Node v22, Deno 2.9.5, Bun 1.3.11 — measurements recorded in
[`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)).
What remains open is a committed, CI-run fixture exercising a real authored
`types.ts` from both TypeScript and JSDoc, Deno source checking, declaration
emission, `npm pack`, and a clean consumer.

### Tasks

- [ ] Keep `fjs/types/bigint/benchmark.mjs` type-checked with the rest of authored
      JavaScript; removing the benchmark is a separate cleanup and is not a
      prerequisite for this task.
- [x] Enable `allowJs` and `checkJs` in the root TypeScript configuration before
      the first `.ts` / `.f.ts` implementation migration.
- [x] Update NPM package rules to include authored `.mjs` and generated `.d.mts`.
      Do not add special exclusions merely for non-public authored `.mjs` files.
- [x] Replace one-pass package emission with the two ordered `tsc` commands
      directly in `prepack`: declarations first, then JavaScript emission.
      Superseded by
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      once only `types.ts` and test-fixture TypeScript remained, the JavaScript
      pass was measured to emit nothing consumers resolve, and its emission was
      dropped while its declaration round-trip check survives as a second
      no-emit `tsc` invocation.
- [x] Do not expose separate `emit:*` package scripts; packaging owns generated
      outputs.
- [ ] Keep package/publish jobs on a clean CI checkout; do not add generated
      output tracking or cleanup for artifacts from previous revisions.
- [ ] Add a mixed `module.f.ts` / `module.f.mjs` plus authored `types.ts` package
      fixture. Scope: the fixture exercises the supported, fully erased
      `import type` form only. The forbidden inline `import { type X }` /
      `import * as` / side-effect forms are a documented one-time measurement
      ([`packed-consumer-validation.md`](../packed-consumer-validation.md),
      "`types.js` is not a real module") — their behavior belongs to consumer
      toolchains, not to this package, so re-testing it every CI run adds no
      information.
- [ ] Import a type from that fixture through the real `./types.ts` path from both
      TypeScript (`import type`) and JavaScript (JSDoc `@import`).
- [ ] Verify the source fixture under `npx tsc`, Deno, and Bun; Deno must resolve
      the real `types.ts` without `@ts-types`, `@ts-self-types`, or a dummy
      `types.js` source file.
- [x] Verify declaration emit from both `.ts` and `.mjs` rewrites/preserves the
      type-module specifier into a path that exists in the packed artifact.
      Measured in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520)
      with the premise corrected: declaration emit preserves `./types.ts`
      verbatim, a path that is *not* in the packed artifact — and that is fine,
      because TypeScript, Deno, and Bun all substitute it with the shipped
      `types.d.ts` (proved by a deliberate type error being rejected, not
      silently accepted).
- [x] Verify which artifacts current `prepack` generates from `types.ts`
      (including `types.js` and `types.d.ts`) and keep only the package behavior
      required for portable resolution. Done in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      only `types.d.ts` is required; `types.js` is no longer generated.
- [ ] Include an implementation-only `_`-prefixed JSDoc typedef in the `.mjs`
      fixture; tolerate its current exported declaration form without treating it
      as clean-consumer public API.
- [ ] Test the allowed `.ts` -> `.mjs` runtime dependency direction in a clean
      checkout and CI-built package archive.
- [ ] Reject authored `.mjs` runtime imports to remaining relative implementation
      `.ts` / `.f.ts`; type-only imports to intentional `types.ts` companions are
      allowed.
- [x] Type-check and run a clean packed-package consumer under TypeScript, Node,
      Deno, and Bun using the `types.ts`-backed API. Measured manually in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520)
      (tsc 5.9.3 and 7.0.2 under `nodenext`/`strict`, Node v22, Deno 2.9.5
      `run`+`check`, Bun 1.3.11 `run`+`build`); turning this into a committed
      CI fixture is the remaining fixture work above.
- [ ] Verify the CI-built archive contains exactly the generated/runtime/type
      artifacts needed for the `types.ts` convention during stage 1.
- [x] Update `AGENTS.md` to the asymmetric `.f.ts` / `.f.mjs` migration policy.
- [x] Decide, based on the fixture, whether the second TypeScript runtime-emission
      pass can ever be removed while authored `types.ts` files remain, or whether
      generated `types.js` is part of the permanent package layout. Decided in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      `types.js` is not part of the layout, and the pass's JavaScript emission
      is removed while its declaration round-trip check survives as
      `tsc --noEmit`.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first implementation source
  conversion.
- The main TypeScript check validates authored `.ts`, `.mjs`, and `types.ts`.
- TypeScript `import type` and JSDoc `@import` both reference the same real
  `./types.ts` source file.
- Deno resolves the source tree without declaration-file substitution tricks.
- `prepack` contains the two ordered `tsc` passes directly while they are needed,
  with declaration emission first and JavaScript emission second.
- The exact package command succeeds with authored `.mjs` and `types.ts` present.
- Emitted declaration specifiers resolve to files actually present in the package
  for TypeScript and Deno consumers.
- `_`-prefixed JSDoc typedefs are treated as private API even if declaration
  emission currently writes them as exported aliases; clean-consumer tests do
  not depend on those names.
- Remaining implementation `.ts` may import migrated `.mjs`; migrated `.mjs`
  cannot runtime-import remaining implementation `.ts` / `.f.ts` or generated
  `.js`.
- A clean consumer can import the CI-built `.mjs` runtime and type-check its
  `types.ts`-backed public API.
- `.f.mjs` carries no current-compiler compatibility promise during stage 1.
- No staging tree or hand-written package-time specifier rewrite is needed.

### Ordering

This task is **no longer a migration gate**
([#1520](https://github.com/functionalscript/functionalscript/pull/1520)): the
migration completed with the one-time measured validation recorded in
[`packed-consumer-validation.md`](../packed-consumer-validation.md), which is
sufficient for it. What remains here — the committed, CI-run fixture — is
future regression infrastructure on its own schedule.

The original ordering, kept for history: complete this task before the first
package-owned implementation `.ts` / `.f.ts` -> `.mjs` / `.f.mjs` conversion in
[`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md).
The migration then proceeds gradually from runtime dependency leaves, with
`types.ts` companions split out where useful before their JavaScript consumers
migrate.

Do not simplify the package emit pipeline merely because no implementation/proof
`.ts` remains. First establish whether authored `types.ts` requires generated
JavaScript for package resolution. That question is settled: measured directly
against the packed tarball in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520), it does
not, and the pipeline is simplified accordingly.

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
