## Package support for authored `.f.js`

**Priority:** P1
**Status:** open — the stage-1 precondition below is met; this work can start now.

### Problem

After authored TypeScript is removed, `.f.js` will become the marker for
FunctionalScript source accepted by the current parser/compiler. The existing
package design, however, is built around authored `.ts` / `.mjs` roots and does
not yet guarantee that a standalone authored `.f.js` module is directly checked,
gets a generated `.d.ts`, is included in the NPM package, or type-checks from a
clean consumer.

Compiler compatibility alone is therefore not enough to rename `.f.mjs` to
`.f.js`. Without explicit package/tooling support, a compiler-ready module could
ship without the declaration and validation guarantees expected from the rest of
the package.

This work was gated on the stage-1 TypeScript migration (tracked in
`todo/migrate-typescript-to-mjs.md`, deleted when it finished; the contract it
established is [`fjs/fsc/README.md`](../../fsc/README.md)) for two stated
reasons: while `.f.ts` existed, TypeScript could generate
`.f.js`, and the repository ignored `**/*.js`. Both are now false — stage 1
removed the last `.f.ts` and the emission pass with it
([#1520](https://github.com/functionalscript/functionalscript/pull/1520)), and
the blanket ignore is gone
([#1545](https://github.com/functionalscript/functionalscript/pull/1545)) — so
the gate is satisfied and this task is open.

What stays gated is the *rename*, not this work: the first `.f.mjs` -> `.f.js`
is blocked by **this** task completing, per the acceptance criteria below, and
by the stage-2 boundary in [`fjs/fsc/README.md`](../../fsc/README.md). Reading
the dependency the other way was circular while the stage-1 issue existed — it
stayed open until stage 2 started, stage 2 needed this task done, and this task
waited on it — which is why the block is recorded here as met rather than
pending.

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
`allowJs` / `checkJs` and emits its declaration.

Validation must include `.f.js` as an explicit root/source pattern, not merely
rely on another `.mjs` module importing it. Declaration emission must likewise
cover standalone `.f.js` modules and produce `.d.ts` files for package
consumers.

Package and publish jobs continue to run in CI from a clean checkout. Stage 2
therefore does not need generated-output cleanup or repeated local-pack safety;
it only needs to make sure authored `.f.js` is included as source and never
mistaken for generated TypeScript output.

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
- [ ] Verify NPM package rules include authored `.f.js` and its `.d.ts`.
- [ ] Add an authored `.f.js` package fixture that is not reachable only through
      an `.mjs` root, proving direct source discovery.
- [ ] Verify the fixture is type-checked in the repository.
- [ ] Verify the clean CI package build contains the authored `.f.js` and its
      generated declaration.
- [ ] Verify a clean consumer can import the `.f.js` runtime and type-check
      against its generated `.d.ts` without repository source files.
- [ ] Update package/contributor documentation for the stage-2 authored `.f.js`
      meaning.

### Acceptance criteria

- A standalone authored `.f.js` is directly included in repository TypeScript
  checking.
- Declaration emission produces a corresponding `.d.ts`.
- The packed NPM artifact contains the authored `.f.js` and all declarations
  required by its public/transitive type graph.
- Package/publish runs start from a clean CI checkout; no local generated-output
  cleanup or repeated-pack guarantee is required.
- A clean consumer can execute/import the `.f.js` runtime and type-check it.
- No staging tree or package-time runtime/declaration specifier rewrite is
  required.
- The first `.f.mjs` -> `.f.js` compiler-compatibility rename is **blocked by**
  completion of this task.

### Related

- [`fjs/fsc/README.md`](../../fsc/README.md) — the extension contract. Stage 1
  removed authored TypeScript and made `.js` authorable again; this task is
  what makes it *packable*.
- [`f-mjs-package-support.md`](./f-mjs-package-support.md) — stage-1 authored
  `.mjs` package support.
- [`publishing-packages.md`](./publishing-packages.md) — broader package plan.
- [`fjs/fsc/README.md`](../../fsc/README.md) — extension contract.
- [`todo/fjs-nanvm-integration.md`](../../../todo/fjs-nanvm-integration.md) —
  compiler-compatibility migration blocked by this package prerequisite.
