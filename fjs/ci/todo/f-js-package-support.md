## Package support for authored `.f.js`

**Priority:** P1
**Status:** wip — the stage-1 precondition below is met, and three tasks already hold ([measured](#measured-on-main)).

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

### Measured on `main`

Measured at `9169616` with the pinned `tsc` 7.0.2, by adding a throwaway
`fjs/ci/fixture-exp/module.f.js` that no `.mjs` imports:

```js
/** @type {(a: number) => (b: number) => number} */
export const add = a => b => a + b;
```

The first three tasks below already hold, with no configuration change:

- **Checked directly.** `tsconfig.json` has no `include`, so its default set
  takes every file, and `allowJs` / `checkJs` check it: `tsc --listFilesOnly`
  lists the module, and a bad cast added to it is `TS2352`.
- **Declaration emitted.** `prepack`'s declaration pass writes
  `module.f.d.ts` beside it.
- **Packed.** From a clean checkout, `npm pack` ships `module.f.js` and
  `module.f.d.ts`; `files`' `**/*.js` and `**/*.d.ts` cover them.
- **Clean consumer.** Installed from the tarball into an empty directory
  (`module` / `moduleResolution` `nodenext`, `strict`), a `test.ts` that
  imports `add` runs and prints `42`, and type-checks; a `bad.ts` assigning
  its result to a `string` fails with `TS2322`, so the declaration is read,
  not an `any` fallback.

So what this task still owes is a **committed** fixture and **CI** proof
that keep those true, plus five gaps the list below did not name:

- **Coverage.** `npm run cov`, which CI runs with 100% thresholds, includes
  only `**/module.f.mjs`. A `module.f.js` would escape the proof-coverage
  rule `fjs/AGENTS.md` sets for every FunctionalScript module. Fixed with
  the fixture.
- **Compiler acceptance is not enforced.** The `.f.js` contract is that the
  current compiler accepts the module ([`fjs/fsc/README.md`](../../fsc/README.md)),
  but nothing compiles authored `.f.js`: a module could be renamed, or
  edited later, into something the compiler refuses, and every check would
  stay green. The measured module compiles to `.rs`; its JSON target refuses
  it only because a function has no JSON. The compiler requires the
  terminating `;` (without it, `unexpected end`), which `tsc` does not, so
  only such a check catches a module written for `tsc` alone. The check is
  owned by [lint-compiler-compatible-files](../../fsc/todo/lint-compiler-compatible-files.md),
  which waits for the first authored `.f.js` to exist; this task's fixture
  is that file, so the lint is unblocked by it, and neither task waits on
  the other.
- **Proofs stay `.f.mjs` for now.** Block bodies compile (`const` and
  `return`), but the `if` and `throw` statements do not: each is refused at
  its first token. A proof fails by throwing, directly or through
  [`fjs/asserts`](../../asserts/module.f.mjs), whose module throws, so a
  `proof.f.js` would import a module the compiler refuses, against the
  dependency-closed rule above. Until `throw` compiles, a `module.f.js`
  pairs with a `proof.f.mjs`. `fjs test` already discovers `proof.f.js`, so
  nothing else blocks renaming a proof later.
- **The proof import rule names `.f.mjs` only.** [`fjs/AGENTS.md`](../../AGENTS.md)
  requires a `proof.f.mjs`'s relative runtime imports to target `.f.mjs`,
  and says `npm run cov` and `deno task cov` include `module.f.mjs`. A proof
  of a `module.f.js` breaks the first sentence as written, so the rule has
  to admit `.f.js`, the other FunctionalScript extension, in the same pull
  request as the fixture. Fixed with the fixture.
- **`package-check` never imports anything.** The job type-checks every
  declaration the tarball ships, so a packed `.f.d.ts` is checked, but no
  consumer module imports a runtime module or uses a declared type. The
  runtime and type-resolution half of the clean-consumer task needs steps
  of its own there, with a negative control.

### Tasks

- [x] Include authored `.f.js` directly in the root TypeScript checked source
      set with `allowJs` / `checkJs` — the default `include` already does
      ([measured](#measured-on-main)).
- [x] Ensure declaration emission produces `.d.ts` for standalone authored
      `.f.js` modules — `prepack` already does.
- [x] Verify NPM package rules include authored `.f.js` and its `.d.ts` —
      `files` already does.
- [x] Add an authored `module.f.js` package fixture that nothing but its
      own `proof.f.mjs` imports, and prove it is type-checked in the
      repository (a deliberate `TS2352`, reverted). In the same pull
      request, extend `fjs/AGENTS.md`'s proof import rule and its coverage
      sentence to `.f.js`. It is synthetic,
      [`../package/fixture/module.f.js`](../package/fixture/module.f.js),
      beside the `package-check` generator that will import it.
- [x] Include `module.f.js` in `npm run cov`'s coverage set, and in
      `deno task cov`'s, so the fixture is held to 100% like every
      `module.f.mjs`: an export its proof never calls fails `npm run cov`.
      Bun's `bun test --coverage` takes no filter, so it has nothing to
      extend.
- [ ] In `package-check`, import the fixture's runtime from a consumer
      module and type-check a use of its declaration, with a negative control
      that must fail — one command per step
      ([AGENTS.md §7](../../../AGENTS.md#7-continuous-integration)).
- [ ] Update package/contributor documentation for the stage-2 authored
      `.f.js` meaning: the `.f.js` row of [`fjs/fsc/README.md`](../../fsc/README.md)'s
      extension table, including why a proof stays `.f.mjs` until `throw`
      compiles.

Compiler acceptance of every authored `.f.js` is not a task here: it is
[lint-compiler-compatible-files](../../fsc/todo/lint-compiler-compatible-files.md),
unblocked by the fixture above and landing on its own schedule.

**Open question: a synthetic fixture, or the first real rename?** As
written, the fixture is synthetic: the acceptance criteria below and
[`fjs-nanvm-integration`](../../../todo/fjs-nanvm-integration.md#tasks) both
block the first real `.f.mjs` -> `.f.js` rename on this task completing, and
give the rename a task of its own there. A synthetic `module.f.js` ships in
the npm package as a module nobody uses, and exists only to be checked.

The alternative is to make the fixture the first real rename: a small,
dependency-closed repository module the compiler already accepts. It proves
the same things on real code, at the cost of breaking that module's import
path for npm consumers, which a `**BREAKING CHANGES:**` declaration would
have to say. Choosing it changes the gate, not just the fixture, so it is
the task owner's decision and lands as a change to this file first: the
acceptance criterion becomes "the first rename is this task's last step,
after the coverage and `package-check` steps", and the
rename task in `fjs-nanvm-integration` moves here. Until that decision is
recorded, implement the synthetic fixture.

**Decided: synthetic,** the default the task owner left in place; review
also preferred the smaller step that keeps a breaking change out of this task; the rename
follows this task, as `fjs-nanvm-integration` has it.

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
