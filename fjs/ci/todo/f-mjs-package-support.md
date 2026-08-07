## Package support for authored `.mjs`

**Priority:** P1
**Status:** open

### Problem

The repository-wide
[TypeScript-to-`.mjs` migration](../../../todo/migrate-typescript-to-mjs.md)
cannot convert its first package-owned `.ts` / `.f.ts` source until the
TypeScript and NPM pipeline treats authored `.mjs` as first-class source.

The current package configuration validates authored TypeScript and publishes
its generated `.js` / `.d.ts`, but does not yet provide the corresponding
checked authored `.mjs` plus generated `.d.mts` path. Turning on `allowJs` /
`checkJs` while keeping the current one-pass emit makes authored `.mjs` both an
input and an output target.

Stage 1 is dependency-first. Remaining `.ts` / `.f.ts` may import already
migrated `.mjs` / `.f.mjs`, but migrated JavaScript must not retain runtime or
declaration references to remaining TypeScript. The package pipeline does not
rewrite module specifiers, so this invariant must work directly in a clean
checkout and packed artifact.

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
declarations present, the second pass emits JavaScript for the remaining
TypeScript sources while preserving authored `.mjs` unchanged.

Keep both passes inline in `prepack`; do not add public `emit:*` scripts for
users to run independently. Normal development should type-check and test the
source tree without generating package artifacts.

Because the CI package job starts from a clean checkout, a renamed
`source.ts -> source.mjs` does not carry ignored `source.js` / `source.d.ts`
artifacts from an earlier revision into the package job. Those files never need
to be discovered or deleted by the new `.mjs` input.

Do not introduce a staging tree or rewrite runtime/declaration specifiers. An
authored `.mjs` / `.f.mjs` group must therefore be closed over authored
JavaScript dependencies outside the group. Remaining TypeScript may import
already migrated `.mjs`; the reverse direction is rejected.

For FunctionalScript modules during stage 1:

- `.f.ts` is remaining authored TypeScript;
- `.f.mjs` is authored FunctionalScript-intent JavaScript, whether or not the
  current FunctionalScript compiler accepts all of its syntax;
- `.f.ts` may depend on `.f.ts` or already migrated `.f.mjs`;
- `.f.mjs` may depend on `.f.mjs`, not remaining `.f.ts` or generated `.f.js`.

Update `AGENTS.md` with that asymmetric source-migration policy. Compiler
compatibility is a later `.f.mjs` -> `.f.js` migration and is not part of this
package prerequisite.

As soon as no authored `.ts` / `.f.ts` source remains, remove the second
TypeScript runtime-emission pass. `prepack` then needs only declaration emission:

```json
"prepack": "tsc --noEmit false --emitDeclarationOnly"
```

### Tasks

- [ ] Make `fjs/types/bigint/benchmark.mjs` pass TypeScript validation or delete
      it if it is no longer needed.
- [ ] Enable `allowJs` and `checkJs` in the root TypeScript configuration before
      the first `.ts` / `.f.ts` migration.
- [ ] Update NPM package rules to include package-owned `.mjs` and `.d.mts`
      while excluding unrelated `.mjs` files.
- [ ] Replace one-pass package emission with the two ordered `tsc` commands
      directly in `prepack`: declarations first, then JavaScript emission.
- [ ] Do not expose separate `emit:*` package scripts; packaging owns generated
      outputs.
- [ ] Keep package/publish jobs on a clean CI checkout; do not add generated
      output tracking or cleanup for artifacts from previous revisions.
- [ ] Add a mixed authored `.ts` + JSDoc `.mjs` package fixture.
- [ ] Test the allowed `.ts` -> `.mjs` dependency direction in a clean checkout
      and CI-built package archive.
- [ ] Reject authored `.mjs` runtime imports and declaration-retained references
      to remaining relative `.ts` or generated `.js`.
- [ ] Verify emitted `.d.mts` contains no references to omitted package files.
- [ ] Type-check a clean consumer using exported/transitive types from the
      authored `.mjs` fixture.
- [ ] Verify the CI-built archive contains authored `.mjs`, generated `.js`,
      `.d.ts`, and `.d.mts` in the expected paths during stage 1.
- [ ] Update `AGENTS.md` to the asymmetric `.f.ts` / `.f.mjs` migration policy.
- [ ] Add validation/proofs for the allowed TypeScript -> migrated-JavaScript
      direction and rejected migrated-JavaScript -> TypeScript direction.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first source conversion.
- The main TypeScript check validates authored `.ts` and `.mjs`.
- `prepack` contains the two ordered `tsc` passes directly while TypeScript
  remains, with declaration emission first and JavaScript emission second.
- Package emission produces `.d.ts` for `.ts`, `.d.mts` for `.mjs`, `.js` only
  for `.ts`, and preserves authored `.mjs` unchanged.
- No separate user-facing `emit:*` scripts are required.
- Package/publish runs start from a clean CI checkout, so ignored generated
  outputs from previous revisions cannot leak into a package build.
- No repository-owned cleanup or legacy generated-output tracking is required
  for the stage-1 migration.
- Remaining `.ts` may import migrated `.mjs`; migrated `.mjs` cannot retain
  runtime/declaration references to remaining `.ts` or generated `.js`.
- A clean consumer can import the CI-built `.mjs` runtime and type-check against
  its `.d.mts` declarations.
- `.f.mjs` carries no current-compiler compatibility promise during stage 1.
- No staging tree or package-time specifier rewrite is needed.

### Ordering

Complete this task before the first package-owned `.ts` / `.f.ts` -> `.mjs` /
`.f.mjs` conversion in
[`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md).
The migration then proceeds gradually from dependency leaves.

After the last authored `.ts` / `.f.ts` source is removed, simplify `prepack` to
its declaration-only form and remove the TypeScript-to-JavaScript emit path.
Then the separate [`f-js-package-support.md`](./f-js-package-support.md) task
prepares authored `.f.js` before compiler-compatibility migration starts.

### Related

- [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
  — repository-wide stage-1 source migration.
- [`publishing-packages.md`](./publishing-packages.md) — broader package roadmap.
- [`f-js-package-support.md`](./f-js-package-support.md) — stage-2 authored
  `.f.js` package prerequisite.
- [`fjs/fsc/README.md`](../../fsc/README.md) — authoritative extension contract.
- [`.f.mjs` test and coverage support](../../emergent_testing/todo/f-mjs-test-and-coverage.md)
  — runtime proof/coverage fixtures for authored `.f.mjs`.
