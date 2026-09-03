## Add the `.f.mjs` runtime fixtures for test and coverage

**Priority:** P2
**Status:** blocked
**Blocked by:** [authored `.f.mjs` package support](../../ci/todo/f-mjs-package-support.md)

**No longer a migration gate**
([#1520](https://github.com/functionalscript/functionalscript/pull/1520)): the
source migration completed, and the whole repository — every `module.f.mjs`
loaded through its proof under Node and Deno coverage — now provides the
evidence this synthetic fixture was designed to give in advance. What remains
is future regression infrastructure on its own schedule.

### Problem

Tooling recognition of `.f.mjs` has landed: `shouldLoad` in
`fjs/dev/module.f.mjs` matches `.f.mjs`, `npm run cov` and `deno task cov`
include `module.f.mjs`, and the canonical Deno CI generator
(`fjs/ci/deno/module.f.mjs`) delegates to `deno task cov` with a regression
proof, so `deno.json` is the only owner of the Deno coverage filter.

What is still missing is end-to-end evidence from an actual `.f.mjs` runtime
fixture. No repository fixture currently proves that a migrated
`module.f.mjs` is loaded through its proof and retained in both Node and Deno
coverage output.

The fixture depends on authored `.mjs` package support because package emission
must preserve authored `.mjs` rather than treating it as generated JavaScript.
The original rationale also cited a *TypeScript* proof importing `module.f.mjs`
under `allowJs` / `checkJs`; that half is spent, since the fixture's proof is
`proof.f.mjs` and no `.f.ts` may be authored. `allowJs` / `checkJs` are enabled
and are not something this task waits on.

This task does **not** require a compiler-ready proof. Stage 1 was independent
of FunctionalScript compiler coverage, and the fixture only has to prove the
source layout end to end.

As originally written it prescribed a mixed `module.f.mjs` + `proof.f.ts`
fixture, because migrating the proof extension was still ahead. That is no
longer writable: stage 1 removed the last authored `.f.ts` and no new one may be
authored ([`fjs/AGENTS.md`](../../AGENTS.md) §1.2). The fixture is
`module.f.mjs` + `proof.f.mjs`, which is also what the repository's own proofs
now look like.
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
private.ts
module.f.mjs
proof.f.mjs
```

`private.ts` is what keeps a TypeScript `import type` consumer of `./types.ts`
in the fixture. Before the proof became `proof.f.mjs` that role belonged to the
proof itself; the sibling `private.ts` is the permitted authored-TypeScript form
that can still play it ([`fjs/AGENTS.md`](../../AGENTS.md) §2), and it is the
shape the repository's own modules use.

The fixture should be outside the published runtime API and should exercise the
normal test discovery and coverage commands. It was meant to prove the tooling
boundary *before* the first real `.f.ts` -> `.f.mjs` conversion; every
conversion has since happened, so what it buys now is a small, deliberate
regression fixture rather than advance evidence.

Keep proof-extension migration separate from compiler readiness. Update
`AGENTS.md` and `CONTRIBUTING.md` so `proof.f.mjs` is explicitly allowed during
Stage 1 whenever its JavaScript/JSDoc and runtime dependency closure are ready.
Authored `types.ts` companions are type-only source and do not block proof
migration.

A dedicated `proof.f.mjs` fixture may be added when useful, but it is not a
prerequisite for the first real module conversion and must not create a circular
dependency on migrating assertion helpers first.

### Tasks

- [ ] Add a synthetic `module.f.mjs` fixture with a co-located `proof.f.mjs`
      that imports and tests it through the normal test command.
- [ ] Add an authored sibling `types.ts` used from JavaScript with JSDoc
      `@import` and from TypeScript with `import type`, both through the same
      `./types.ts` source path. The TypeScript side is a sibling `private.ts`,
      since the proof is `proof.f.mjs` and no other authored TypeScript form is
      permitted.
- [ ] Verify the fixture type-checks under `tsc` with the Stage-1
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

- A `proof.f.mjs` importing `module.f.mjs` is executed by the normal test
  command and type-checks under `tsc`.
- The `.f.mjs` fixture appears as a covered file in `npm run cov` and in
  `deno task cov`.
- `proof.f.mjs` is the proof extension; nothing in the fixture depends on the
  retired `proof.f.ts` form.
- TypeScript `import type` and JSDoc `@import` both reference the real authored
  `types.ts` source file.
- Deno resolves the same `types.ts` source path without special annotations or a
  dummy runtime type module.
- No authored JavaScript retains a type-only reference to an implementation
  `.ts` / `.f.ts`; none remains to reference, and such types live in `types.ts`.
- Standalone `proof.mjs` behavior is unchanged. The other extensions this
  criterion once named — `.f.ts`, generated `.f.js`, `proof.f.ts` — no longer
  exist in the tree.

### Ordering

This task is **blocked by**
[`f-mjs-package-support.md`](../../ci/todo/f-mjs-package-support.md).

The rest of the original ordering is spent: it also had to complete "before
converting the first real repository module from `.f.ts` to `.f.mjs`", and every
such conversion has happened, so that clause constrains nothing and is not a
reason to hold the fixture back. A synthetic compiler fixture that does not
enter the published runtime graph remains unblocked by this issue.

### Related

- [`fjs/fsc/README.md`](../../fsc/README.md) — source-extension convention and
  two-stage repository migration.
- Stage-1 of the repository-wide migration, tracked in
  `todo/migrate-typescript-to-mjs.md` until it was completed and deleted; the
  contract it left is [`fjs/fsc/README.md`](../../fsc/README.md). It was once
  **blocked by** this fixture task; that gate was de-scoped rather than met, since every conversion happened
  first and the repository itself became the evidence the fixture was to supply
  in advance. This task is independent regression work now and blocks nothing.
- [`664-emergent-testing-module-files.md`](./664-emergent-testing-module-files.md)
  — separate proposal to bulk-load ordinary `module.*` files for white-box
  testing. Ordinary `.mjs` files stay opt-in through the `proof.mjs` convention
  until then; this issue does not expand that rule.
