## Package support for authored `.mjs`

**Priority:** P2
**Status:** wip

### Problem

This task was written as the gate on the repository-wide TypeScript-to-`.mjs`
migration — stage 1, tracked in `todo/migrate-typescript-to-mjs.md` and deleted
when it finished, its contract now in
[`fjs/fsc/README.md`](../../fsc/README.md). That migration could not convert its first package-owned `.ts` / `.f.ts`
implementation source until the TypeScript and NPM pipeline treated authored
`.mjs` as first-class source. It no longer gates that migration. Stage 1's
source conversion is complete — every conversion happened, and what the
migration needed from this task was performed one-time in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520) and
recorded in [`packed-consumer-validation.md`](../packed-consumer-validation.md).
What remains here is regression infrastructure on its own schedule, described
below.

One downstream dependency does survive, and deliberately:
[`f-mjs-test-and-coverage.md`](../../emergent_testing/todo/f-mjs-test-and-coverage.md)
is still **blocked by** this task, because its fixture needs package emission to
preserve authored `.mjs` rather than treat it as generated JavaScript. Both are
regression work now, so neither holds up the migration or stage 2 — but that
ordering between them is real.

The package configuration originally validated only authored TypeScript and
published its generated `.js` / `.d.ts`, with no checked authored `.mjs` plus
generated `.d.mts` path — turning on `allowJs` / `checkJs` while keeping a
one-pass emit would have made authored `.mjs` both an input and an output
target. **This part is done** (see Progress below): `allowJs`/`checkJs` are
on and `prepack` is the two-pass emit that keeps authored `.mjs` untouched.
What remains is the validation half — a fixture and proofs that the mixed-source
package actually builds and type-checks correctly for consumers and all supported
runtimes.

Stage 1 was dependency-first for runtime implementations: remaining `.ts` /
`.f.ts` could import already migrated `.mjs` / `.f.mjs`, while migrated
JavaScript could not depend on remaining implementation TypeScript. None of
either remains. Type-only APIs were always separate, and that part still holds:
a directory may contain a real authored `types.ts` source module, stable before,
during, and after the implementation migration.

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
it with a plain `tsc` check — review found the pass also served as the
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
`tsc --noEmit false --emitDeclarationOnly && tsc` — the second
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

For FunctionalScript modules during stage 1 (stage 1 is complete, so the
`.f.ts` rules below are the record of that period, not current state):

- `.f.ts` was remaining authored TypeScript implementation/proof source;
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

Authored `.mjs` files carry no file-scope JSDoc `@typedef` (root `AGENTS.md`);
named types live in `types.ts` or an optional `private.ts`, so declaration emit
exposes private types as `_`-prefixed names in `types.d.ts` and as generated
`private.d.ts` files. Both are package-private by contract, not public API:
clean-consumer tests must exercise documented public types and must not turn
`_`-prefixed declaration artifacts into supported API merely because TypeScript
emitted them. Generated `private.d.ts` is no longer shipped: `package.json`'s
`files` carries a `!**/private.d.ts` negation — an exclusion at pack time, with
`prepack` unchanged and the working tree left alone. An earlier design draft
deleted the files instead; do not reintroduce a deletion step. So `private.d.ts`
is no longer among the package-private
artifacts above — what remains is the `_`-prefixed names that still ship by
design: `_` types emitted into `types.d.ts` and exported `_` constants emitted
into `module.d.mts`. The leak-tolerance contract narrows to those, and stays
permanent for them; see
[`../../fsc/README.md`](../../fsc/README.md) for the contract itself.

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
re-check (plain `tsc`; `noEmit` is set in `tsconfig.json`), keeping its
declaration-emit round-trip property. That PR
also performed the clean packed-consumer validation manually (tsc 5.9.3/7.0.2,
Node v22, Deno 2.9.5, Bun 1.3.11 — measurements recorded in
[`packed-consumer-validation.md`](../packed-consumer-validation.md)).
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
- [ ] Add a package fixture in the current source model — `module.f.mjs` with a
      co-located `proof.f.mjs`, an authored `types.ts` and, for the
      private-declaration check, a sibling `private.ts` (authored
      implementation and proof `.f.ts` are retired, so the fixture must not
      reintroduce them). The proof is not optional paperwork: `fjs/AGENTS.md`
      §1.2 requires 100% proof coverage for every authored `.f.mjs`, so a
      fixture without one fails `npm run cov` and lands the repository in
      violation of its own rule — while demonstrating package support.
      Two constraints follow from what the fixture is *for*:
      - It must be a **conforming** module: its private type stays out of every
        exported signature, matching the public-declaration-closure rule and
        the rest of the tree. A fixture that exports a private-typed binding
        would permanently redden the packed-declaration check it exists to
        support.
      - Any violation is therefore *deliberate and temporary*, applied while
        verifying the check and then reverted — never the fixture's steady
        state. Two different controls are needed, and they must not be run in
        the same place:
        - **Can the check fail at all?** Export a binding whose signature names
          the private type, here in the fixture, and confirm `TS2307`.
        - **Is the check exhaustive?** This one must go in a module the
          consumer would *not* name — one with no private surface today, and
          in particular **not** this fixture. A hand-written import list would
          name the fixture, so a violation placed here fails under a fixed list
          too and proves nothing about enumeration. Measured end to end with
          `fjs/emergent_testing`, which had no `private.ts`: given one, plus an
          exported binding whose signature names it, the job exits 2 with
          `TS2307` on the packed declaration.

          The same violation with the `files` negation dropped is **green**,
          because the private declaration then ships and the reference
          resolves. So this job does not detect a dropped negation, and nothing
          else does either: an assertion over the packed listing was written for
          that and removed as not worth its complexity — what it caught was
          declaration noise in the tarball, which the `_` contract already
          tolerates, not a broken package. The negation is one line in
          `package.json` and losing it is a visible diff in review.
      Scope: the fixture exercises the
      supported, fully erased `import type` form only. The forbidden inline `import { type X }` /
      `import * as` / side-effect forms are a documented one-time measurement
      ([`packed-consumer-validation.md`](../packed-consumer-validation.md),
      "`types.js` is not a real module") — their behavior belongs to consumer
      toolchains, not to this package, so re-testing it every CI run adds no
      information.
- [ ] Import a type from that fixture through the real `./types.ts` path from both
      TypeScript (`import type`) and JavaScript (JSDoc `@import`).
- [ ] Verify the source fixture under `tsc`, Deno, and Bun; Deno must resolve
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
- [ ] Include an implementation-only `_`-prefixed type (in the fixture's
      `types.ts` or `private.ts`, per the file-scope-typedef prohibition) whose
      name reaches the emitted declarations; tolerate that declaration form
      without treating it as clean-consumer public API.
- [x] Test the allowed `.ts` -> `.mjs` runtime dependency direction in a clean
      checkout and CI-built package archive. Retired, not performed: the
      direction no longer exists to test. Every authored `.ts` left is a
      `types.ts` / `private.ts`, and every one of their import statements is
      `import type` (226 at the time of writing) — measured on the tree after
      [#1750](https://github.com/functionalscript/functionalscript/pull/1750).
      A runtime dependency out of an authored `.ts` would also need emitted
      JavaScript for it, and the decision above settled that `types.js` is not
      part of the package layout, so the form is doubly excluded. Writing a
      fixture for it would manufacture a source shape the repository forbids.
- [ ] Reject authored `.mjs` runtime imports to any relative authored `.ts` —
      the rule outlived the migration and got *wider*, not narrower. It once
      guarded against importing implementation `.ts` / `.f.ts`; with those
      retired, the remaining authored `.ts` are exactly the type-level
      `types.ts` / `private.ts` companions, for which no JavaScript is emitted,
      so a runtime import would resolve in the source tree and dangle in the
      package. Type-only imports (`import type`, JSDoc `@import`) stay allowed
      and are the only permitted form. Currently zero authored `.mjs` violate
      this, so the fixture pins a property that already holds.
- [x] Type-check and run a clean packed-package consumer under TypeScript, Node,
      Deno, and Bun using the `types.ts`-backed API. Measured manually in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520)
      (tsc 5.9.3 and 7.0.2 under `nodenext`/`strict`, Node v22, Deno 2.9.5
      `run`+`check`, Bun 1.3.11 `run`+`build`); turning this into a committed
      CI fixture is the remaining fixture work above.
- [ ] Verify the CI-built archive contains exactly the generated/runtime/type
      artifacts needed for the `types.ts` convention during stage 1.
- [ ] Run the clean packed-package consumer **in CI**, in a job with no
      repository checkout, consuming the tarball handed over as an artifact by
      [`ci-integration-tests.md`](ci-integration-tests.md) (which also owns the
      job-ordering edge that keeps it from racing the upload). The missing
      checkout is the point and is stronger than merely working outside the
      repository: with no repository on the runner there is no `tsconfig.json`
      up the tree to inherit, no `node_modules` to resolve into, and no source
      file that could stand in for a declaration the tarball omits. Four
      details decide whether such a job can fail at all, each learned by
      measurement rather than reasoning:
      - **Type-check every packed declaration**, enumerated from the installed
        artifact — not a hand-written consumer importing today's known
        surfaces, whose import list goes stale the moment a module changes.
      - **Leave `skipLibCheck` at its `false` default.** `tsc --init` writes
        `true`; that silently turns the job into a no-op. It applies to
        declaration files however they enter the program, root files included.
      - **Install the tarball as a real dependency**, never by unpacking into
        `node_modules` by hand — a later `npm install` prunes what is not in
        `package.json`, leaving the check passing on an empty file list.
      - **Pin the compiler** to the repository's exact `typescript` version.
        With no checkout there is no lockfile, so a bare `npm install
        typescript` lets the registry change the verdict with no repository
        change. The version is readable without a checkout: `npm pack` keeps
        `devDependencies` in the packed `package.json`.
      The private-declaration assertion this job carries is a condition on it:
      every packed declaration is type-checked from the installed artifact, so a
      public declaration that came to depend on an unshipped private module is a
      red build. Landed in
      [#1767](https://github.com/functionalscript/functionalscript/pull/1767).
- [x] Update `AGENTS.md` to the asymmetric `.f.ts` / `.f.mjs` migration policy.
- [x] Decide, based on the fixture, whether the second TypeScript runtime-emission
      pass can ever be removed while authored `types.ts` files remain, or whether
      generated `types.js` is part of the permanent package layout. Decided in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
      `types.js` is not part of the layout, and the pass's JavaScript emission
      is removed while its declaration round-trip check survives as a plain
      `tsc` invocation with declarations present.

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
- Authored `.mjs` cannot runtime-import any relative authored `.ts` or generated
  `.js`; type-only imports of `types.ts` / `private.ts` companions are the only
  permitted form. (The converse allowance — implementation `.ts` importing
  migrated `.mjs` — lapsed with the migration: no authored implementation `.ts`
  remains to exercise it.)
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
package-owned implementation `.ts` / `.f.ts` -> `.mjs` / `.f.mjs` conversion of
the stage-1 migration. The migration then proceeded gradually from runtime dependency leaves, with
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
- [`fjs/fsc/README.md`](../../fsc/README.md) — the extension contract left by
  the repository-wide stage-1 implementation source migration.
- [`fjs/AGENTS.md`](../../AGENTS.md) §3.2 — private-type placement rules;
  [`fjs/fsc/README.md`](../../fsc/README.md) — the `_` contract and why
  generated private declarations are not packaged.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — upstream JSDoc typedef stripping limitation; no longer a blocker here, since
  no authored `.mjs` declares a file-scope typedef to strip.
- [`publishing-packages.md`](./publishing-packages.md) — broader package roadmap.
- [`f-js-package-support.md`](./f-js-package-support.md) — stage-2 authored
  `.f.js` package prerequisite.
- [`fjs/fsc/README.md`](../../fsc/README.md) — authoritative extension contract.
- [`.f.mjs` test and coverage support](../../emergent_testing/todo/f-mjs-test-and-coverage.md)
  — runtime proof/coverage fixtures for authored `.f.mjs`.
