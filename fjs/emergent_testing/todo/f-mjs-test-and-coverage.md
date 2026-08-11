## Add the `.f.mjs` runtime fixtures for test and coverage

**Priority:** P1
**Status:** blocked
**Blocked by:** [authored `.f.mjs` package support](../../ci/todo/f-mjs-package-support.md)

### Problem

Tooling recognition of `.f.mjs` has landed: `shouldLoad` in
`fjs/dev/module.f.ts` matches `.f.mjs`, `npm run cov` and `deno task cov`
include `module.f.mjs`, and the canonical Deno CI generator
(`fjs/ci/deno/module.f.mjs`) exports `coverageInclude` with a regression proof.

What is still missing is end-to-end evidence from an actual `.f.mjs` runtime
fixture. No repository fixture currently proves that a migrated
`module.f.mjs` is loaded through its proof and retained in both Node and Deno
coverage output.

The fixture depends on authored `.mjs` package support because a TypeScript proof
must be able to import `module.f.mjs` while `allowJs` / `checkJs` remain enabled,
and package emission must preserve that authored `.mjs` rather than treating it
as generated JavaScript.

This task does **not** require the first real repository module migration or a
compiler-ready `proof.f.mjs`. Stage 1 is independent of FunctionalScript compiler
coverage. A mixed synthetic fixture using `module.f.mjs` + `proof.f.ts` is enough
to prove the first source-migration layout end to end.

`proof.f.mjs` is nevertheless an allowed Stage-1 source extension. A real proof
may migrate from `proof.f.ts` to `proof.f.mjs` as soon as it can be expressed as
JavaScript with JSDoc and its authored **runtime** dependencies are already
`.f.mjs`; current FunctionalScript compiler support is not a migration gate.
Type-only APIs may live in a real authored sibling `types.ts`, for example:

```js
/** @import { Phantom } from '../../types/phantom/types.ts' */
```

The same source path is used by TypeScript `import type`. Because `types.ts`
exists as a real source module, the convention must work in TypeScript, Node
package tooling, and Deno without relying on TypeScript-specific `.d.ts`
resolution behavior. If a type needed by the proof still lives only inside an
implementation `.f.ts`, split that type into the directory's `types.ts` before
migrating the consumer. Do not retain a JSDoc reference from migrated JavaScript
to the remaining implementation `.f.ts`.

### Proposal

After [`f-mjs-package-support.md`](../../ci/todo/f-mjs-package-support.md)
completes, add the smallest synthetic `.f.mjs` runtime fixture that proves the
mixed Stage-1 layout and the type-only source companion:

```text
types.ts
module.f.mjs
proof.f.ts
```

The fixture should be outside the published runtime API and should exercise the
normal test discovery and coverage commands. It exists only to prove the tooling
boundary before the first real repository `.f.ts` -> `.f.mjs` conversion.

Keep proof-extension migration separate from compiler readiness. Update
`AGENTS.md` and `CONTRIBUTING.md` so `proof.f.mjs` is explicitly allowed during
Stage 1 whenever its JavaScript/JSDoc and runtime dependency closure are ready.
Authored `types.ts` companions are type-only source and do not block proof
migration.

A dedicated `proof.f.mjs` fixture may be added when useful, but it is not a
prerequisite for the first real module conversion and must not create a circular
dependency on migrating assertion helpers first.

### Tasks

- [ ] Add a synthetic `module.f.mjs` fixture with a co-located `proof.f.ts` that
      imports and tests it through the normal test command.
- [ ] Add an authored sibling `types.ts` used from JavaScript with JSDoc
      `@import` and from TypeScript with `import type`, both through the same
      `./types.ts` source path.
- [ ] Verify the fixture type-checks under `npx tsc` with the Stage-1
      `allowJs` / `checkJs` configuration.
- [ ] Verify the same fixture type-checks and runs under Deno, so the convention
      does not depend on TypeScript's declaration-file resolution behavior.
- [ ] Verify the `.f.mjs` implementation appears in both Node and Deno coverage
      output.
- [ ] Update `AGENTS.md` and `CONTRIBUTING.md` so `proof.f.mjs` migration is
      gated by JavaScript/JSDoc plus runtime dependency readiness, not compiler
      support; `types.ts` companions are explicitly outside the runtime
      implementation migration.

### Acceptance criteria

- A `proof.f.ts` importing `module.f.mjs` is executed by the normal test command
  and type-checks under `npx tsc`.
- The `.f.mjs` fixture appears as a covered file in `npm run cov` and in
  `deno task cov`.
- `proof.f.mjs` is explicitly allowed during Stage 1 when its authored runtime
  dependencies are already migrated and the proof is valid JavaScript/JSDoc.
- TypeScript `import type` and JSDoc `@import` both reference the real authored
  `types.ts` source file.
- Deno resolves the same `types.ts` source path without special annotations or a
  dummy runtime type module.
- Migrated JavaScript does not retain a type-only reference to remaining
  implementation `.ts` / `.f.ts`; such types are split into `types.ts` first.
- Existing `.f.ts`, generated `.f.js`, `proof.f.ts`, and standalone `proof.mjs`
  behavior is unchanged.

### Ordering

This task is **blocked by**
[`f-mjs-package-support.md`](../../ci/todo/f-mjs-package-support.md) and must
complete before converting the first real repository module from `.f.ts` to
`.f.mjs`. The synthetic fixture itself is the prerequisite evidence and does not
count as a production/source migration. A synthetic compiler fixture that does
not enter the published runtime graph is likewise not blocked by this issue.

### Related

- [`fjs/fsc/README.md`](../../fsc/README.md) — source-extension convention and
  two-stage repository migration.
- [`../../../todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
  — repository-wide Stage-1 migration that is blocked by this fixture task.
- [`664-emergent-testing-module-files.md`](./664-emergent-testing-module-files.md)
  — separate proposal to bulk-load ordinary `module.*` files for white-box
  testing. Ordinary `.mjs` files stay opt-in through the `proof.mjs` convention
  until then; this issue does not expand that rule.
