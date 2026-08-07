## Package support for authored `.f.js`

**Priority:** P1
**Status:** blocked
**Blocked by:** [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)

### Problem

After authored TypeScript is removed, `.f.js` will become the marker for
FunctionalScript source accepted by the current parser/compiler. The existing
package design, however, is built around authored `.ts` / `.mjs` roots and does
not yet guarantee that a standalone authored `.f.js` module is directly checked,
gets a generated `.d.ts`, survives generated-output cleanup, is included in the
NPM package, or type-checks from a clean consumer.

Compiler compatibility alone is therefore not enough to rename `.f.mjs` to
`.f.js`. Without explicit package/tooling support, a compiler-ready module could
ship without the declaration and validation guarantees expected from the rest of
the package.

This work cannot begin until
[`migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
finishes: while `.f.ts` exists, TypeScript can generate `.f.js`, and the
repository intentionally ignores `**/*.js`.

### Proposal

After stage 1 removes authored TypeScript, TypeScript-to-JavaScript emission, and
the blanket `.js` ignore, make authored `.f.js` a first-class checked and
packable source extension before the first compiler-compatibility rename.

The stage-2 invariant is:

```text
source.f.mjs -> source.f.js + source.f.d.ts
```

The rename from `.f.mjs` to `.f.js` means the source is accepted by the current
FunctionalScript compiler. TypeScript still checks the authored JavaScript via
`allowJs` / `checkJs` and emits its declaration. The authored `.f.js` file itself
must never be treated as generated output or removed by cleanup.

Validation must include `.f.js` as an explicit root/source pattern, not merely
rely on another `.mjs` module importing it. Declaration emission must likewise
cover standalone `.f.js` modules and produce `.d.ts` files for package
consumers.

Generated-output cleanup after stage 1 may remove declarations derived from
authored JavaScript, but it must preserve authored `.mjs` and `.f.js` source.
NPM packaging must include the authored `.f.js` runtime and its `.d.ts`
declaration, and clean-consumer tests must verify runtime and type resolution.

Do not add package-time import or declaration-specifier rewriting. A migrated
`.f.js` group must remain dependency-closed according to the compiler migration
rules in [`todo/fjs-nanvm-integration.md`](../../../todo/fjs-nanvm-integration.md).

### Tasks

- [ ] After stage 1, include authored `.f.js` directly in the root TypeScript
      checked source set with `allowJs` / `checkJs`.
- [ ] Ensure declaration emission produces `.d.ts` for standalone authored
      `.f.js` modules.
- [ ] Update generated-output cleanup so it may remove generated declarations
      for `.f.js` but never removes authored `.f.js` itself.
- [ ] Verify NPM package rules include authored `.f.js` and its `.d.ts`.
- [ ] Add an authored `.f.js` package fixture that is not reachable only through
      an `.mjs` root, proving direct source discovery.
- [ ] Verify the fixture is type-checked in the repository.
- [ ] Verify repeated `npm pack` remains safe and deterministic with authored
      `.f.js` present.
- [ ] Verify a clean consumer can import the `.f.js` runtime and type-check
      against its generated `.d.ts` without repository source files.
- [ ] Verify cleanup and packing preserve authored `.f.js` while generated
      declarations are recreated as needed.
- [ ] Update package/contributor documentation for the stage-2 authored `.f.js`
      meaning.

### Acceptance criteria

- A standalone authored `.f.js` is directly included in repository TypeScript
  checking.
- Declaration emission produces a corresponding `.d.ts`.
- Generated cleanup never removes authored `.f.js`.
- The packed NPM artifact contains the authored `.f.js` and all declarations
  required by its public/transitive type graph.
- Two consecutive package builds succeed without manual cleanup.
- A clean consumer can execute/import the `.f.js` runtime and type-check it.
- No staging tree or package-time runtime/declaration specifier rewrite is
  required.
- The first `.f.mjs` -> `.f.js` compiler-compatibility rename is **blocked by**
  completion of this task.

### Related

- [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
  — stage-1 prerequisite that removes TypeScript and makes `.js` authorable.
- [`f-mjs-package-support.md`](./f-mjs-package-support.md) — stage-1 authored
  `.mjs` package support.
- [`publishing-packages.md`](./publishing-packages.md) — broader package plan.
- [`fjs/fsc/README.md`](../../fsc/README.md) — extension contract.
- [`todo/fjs-nanvm-integration.md`](../../../todo/fjs-nanvm-integration.md) —
  compiler-compatibility migration blocked by this package prerequisite.
