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
`checkJs` without changing emission also makes `npm run prepack` fail: authored
`.mjs` becomes an input and a JavaScript emit target, producing TS5055 overwrite
errors.

Stage 1 is dependency-first. Remaining `.ts` / `.f.ts` may import already
migrated `.mjs` / `.f.mjs`, but migrated JavaScript must not retain runtime or
declaration references to remaining TypeScript. The package pipeline does not
rewrite module specifiers, so this invariant must work directly in a clean
checkout and packed artifact.

### Proposal

Implement the minimum validation, repeatable emission, package-content,
repository-policy, and clean-consumer support required before the first stage-1
source migration. The broader package roadmap remains in
[`publishing-packages.md`](./publishing-packages.md).

Use the stage-1 authored/generated invariant:

```text
source.ts  -> source.js + source.d.ts
source.mjs -> source.mjs + source.d.mts
```

Enable `allowJs` and `checkJs` before the first source conversion. TypeScript
must validate both authored extensions and exclude generated declarations from
the source set.

Declaration emission covers `.ts` and `.mjs`; JavaScript emission covers `.ts`
only. Authored `.mjs` is preserved unchanged. A repository-owned cleanup runs
before emission and removes only generated outputs derived from authored source:
generated `.js` for `.ts`, plus `.d.ts` / `.d.mts` declarations. It must never
remove authored `.mjs` or use a broad cleanup such as `git clean`.

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

### Tasks

- [ ] Make `fjs/types/bigint/benchmark.mjs` pass TypeScript validation or delete
      it if it is no longer needed.
- [ ] Enable `allowJs` and `checkJs` in the root TypeScript configuration before
      the first `.ts` / `.f.ts` migration.
- [ ] Include authored `.ts` and `.mjs` source while excluding generated
      `.d.ts` and `.d.mts` declarations from source validation.
- [ ] Update NPM package rules to include package-owned `.mjs` and `.d.mts`
      while excluding unrelated `.mjs` files.
- [ ] Add a cross-platform cleanup that derives generated outputs from authored
      source and removes only generated `.js`, `.d.ts`, and `.d.mts` files.
- [ ] Replace one-pass `prepack` with cleanup, declaration emission for `.ts`
      and `.mjs`, then JavaScript emission from `.ts` only.
- [ ] Add a mixed authored `.ts` + JSDoc `.mjs` package fixture.
- [ ] Test the allowed `.ts` -> `.mjs` dependency direction in a clean checkout
      and packed archive.
- [ ] Reject authored `.mjs` runtime imports and declaration-retained references
      to remaining relative `.ts` or generated `.js`.
- [ ] Run `npm pack` twice consecutively and verify both runs have the same
      package file set.
- [ ] Verify emitted `.d.mts` contains no references to omitted package files.
- [ ] Type-check a clean consumer using exported/transitive types from the
      authored `.mjs` fixture.
- [ ] Verify the packed archive contains authored `.mjs`, generated `.js`,
      `.d.ts`, and `.d.mts` in the expected paths during stage 1.
- [ ] Update `AGENTS.md` to the asymmetric `.f.ts` / `.f.mjs` migration policy.
- [ ] Add validation/proofs for the allowed TypeScript -> migrated-JavaScript
      direction and rejected migrated-JavaScript -> TypeScript direction.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first source conversion.
- The main TypeScript check validates authored `.ts` and `.mjs` without treating
  generated declarations as source.
- Packing emits `.d.ts` for `.ts`, `.d.mts` for `.mjs`, `.js` only for `.ts`,
  and preserves authored `.mjs` unchanged.
- Every pack starts from a known generated-output state, and two consecutive
  packs succeed without TS5055 or manual cleanup.
- Remaining `.ts` may import migrated `.mjs`; migrated `.mjs` cannot retain
  runtime/declaration references to remaining `.ts` or generated `.js`.
- A clean consumer can import the packed `.mjs` runtime and type-check against
  its `.d.mts` declarations.
- `.f.mjs` carries no current-compiler compatibility promise during stage 1.
- No staging tree or package-time specifier rewrite is needed.

### Ordering

Complete this task before the first package-owned `.ts` / `.f.ts` -> `.mjs` /
`.f.mjs` conversion in
[`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md).
The migration then proceeds gradually from dependency leaves.

After stage 1 finishes and `.js` becomes authorable, the separate
[`f-js-package-support.md`](./f-js-package-support.md) task prepares authored
`.f.js` before compiler-compatibility migration starts.

### Related

- [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
  — repository-wide stage-1 source migration.
- [`publishing-packages.md`](./publishing-packages.md) — broader package roadmap.
- [`f-js-package-support.md`](./f-js-package-support.md) — stage-2 authored
  `.f.js` package prerequisite.
- [`fjs/fsc/README.md`](../../fsc/README.md) — authoritative extension contract.
- [`.f.mjs` test and coverage support](../../emergent_testing/todo/f-mjs-test-and-coverage.md)
  — runtime proof/coverage fixtures for authored `.f.mjs`.
