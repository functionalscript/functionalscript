## Package support for authored `.f.mjs`

**Priority:** P1
**Status:** open

### Problem

The first existing repository module cannot move from `.f.ts` to authored
`.f.mjs` until the TypeScript and NPM package pipeline understands that source
extension. The current package configuration validates and publishes generated
`.js` and `.d.ts`, but does not yet provide the corresponding authored `.mjs`
and generated `.d.mts` path.

The repository's authoritative FunctionalScript module rule also currently
allows imports only from `.f.ts`. Incremental migration requires unmigrated
`.f.ts` importers to target modules after those dependencies move to `.f.mjs`,
while migrated `.f.mjs` modules must remain closed over migrated dependencies.

This work blocks the P1 incremental compiler migration and fjs–nanvm integration.
Keeping it only inside the broader P3 package-publishing roadmap makes the
ordering unclear and allows a prerequisite to be deferred behind the work it
blocks.

### Proposal

Implement the minimum validation, emission, package-content, repository-policy,
and consumer tests needed before the first real `.f.mjs` module enters the
repository's published runtime graph. The broader package strategy and other
package targets remain in [`publishing-packages.md`](./publishing-packages.md).

Use the authored/generated extension invariant:

```text
source.ts  -> source.js + source.d.ts
source.mjs -> source.mjs + source.d.mts
```

TypeScript validates both authored extensions. Declaration emission covers both
`.ts` and `.mjs`, while JavaScript emission runs only for `.ts`; authored `.mjs`
is copied unchanged into the package.

Do not introduce a staging tree or rewrite module specifiers during packaging.
A migrated `.f.mjs` group must therefore be dependency-closed across both
runtime imports and references retained in emitted `.d.mts` declarations.
Relative runtime or type references from authored `.f.mjs` must resolve to
`.f.mjs` modules already migrated or converted in the same group. Authored
`.ts` may import `.mjs`, and its generated outputs preserve the `.mjs`
specifier.

Update the FunctionalScript module rules in `AGENTS.md` with the same asymmetric
policy:

- authored `.f.ts` may import relative `.f.ts` or `.f.mjs` modules;
- authored `.f.mjs` may import or reference relative `.f.mjs` modules only;
- neither extension may use built-in or external Node modules.

This permits unmigrated callers to follow a renamed dependency without weakening
the dependency-closure invariant for compiler-ready `.f.mjs` source.

### Tasks

- [ ] Make `fjs/types/bigint/benchmark.mjs` pass TypeScript validation or delete
      it if it is no longer needed.
- [ ] Enable `allowJs` and `checkJs` in the main TypeScript configuration.
- [ ] Include authored `.ts` and `.mjs` source while excluding generated
      `.d.ts` and `.d.mts` declarations from source validation.
- [ ] Update NPM package rules to include package-owned `.mjs` and `.d.mts`
      files while excluding unrelated `.mjs` files.
- [ ] Replace the current one-pass `prepack` script with declaration emission
      for `.ts` and `.mjs`, followed by JavaScript emission from `.ts` only.
- [ ] Add a package fixture containing an authored `.ts` module and an authored
      JSDoc `.mjs` module.
- [ ] Test the supported mixed-source direction, authored `.ts` importing
      authored `.mjs`, in a clean checkout and from the packed archive.
- [ ] Reject authored `.mjs` runtime imports that reference relative `.ts` or
      generated `.js` files.
- [ ] Reject JSDoc or declaration-retained references from authored `.mjs` to
      relative `.ts` or generated `.js` files.
- [ ] Verify emitted `.d.mts` files contain no references to files omitted from
      the packed archive.
- [ ] Type-check a clean consumer against the packed archive, including an
      exported type from the authored `.mjs` fixture and its transitive
      declaration dependencies.
- [ ] Verify the packed archive contains authored `.mjs`, generated `.js`,
      `.d.ts`, and `.d.mts` files in the expected package paths.
- [ ] Update `AGENTS.md` so `.f.ts` FunctionalScript modules may import relative
      `.f.ts` or `.f.mjs`, while authored `.f.mjs` runtime and type dependencies
      remain restricted to relative `.f.mjs`.
- [ ] Add validation or proofs for the allowed `.f.ts` → `.f.mjs` direction and
      the rejected `.f.mjs` → `.f.ts` / generated `.f.js` directions.

### Acceptance criteria

- The main TypeScript check validates authored `.ts` and `.mjs` source without
  treating generated declarations as source inputs.
- Packing emits `.d.ts` for `.ts`, emits `.d.mts` for `.mjs`, emits `.js` only
  for `.ts`, and preserves authored `.mjs` unchanged.
- The package contains every runtime and declaration file needed by migrated
  `.f.mjs` modules and excludes unrelated `.mjs` files.
- Authored `.ts` importing authored `.mjs` works before and after packing.
- Authored `.mjs` cannot introduce relative runtime or declaration references
  to unmigrated `.ts` or generated `.js` files.
- A clean consumer can import the packed `.mjs` runtime and type-check against
  its emitted `.d.mts` declarations without access to repository source files.
- `AGENTS.md` explicitly permits `.f.ts` modules to import `.f.mjs` and preserves
  the dependency-closed import and type-reference rule for authored `.f.mjs`.
- No package-time runtime-import or declaration-specifier rewriting is needed.

### Ordering

Complete this task, including the `AGENTS.md` module-import policy update,
together with
[`.f.mjs` test and coverage support](../../emergent_testing/todo/f-mjs-test-and-coverage.md),
before converting the first existing repository module from `.f.ts` to
`.f.mjs`. A synthetic compiler fixture that does not enter the published runtime
graph may be used earlier.

### Related

- [`publishing-packages.md`](./publishing-packages.md) — broader P3 package
  publishing roadmap and authored/generated JavaScript convention.
- [`fjs/fsc/README.md`](../../fsc/README.md) — FunctionalScript extension
  contract and incremental migration strategy.
- [`todo/fjs-nanvm-integration.md`](../../../todo/fjs-nanvm-integration.md) — P1
  integration plan blocked by this package prerequisite.
