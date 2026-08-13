## Publishing packages

**Priority:** P3
**Status:** open

Targeting the following systems:

- JS:
  - [x] NPM
  - [ ] JSR — JSR doesn't support JSDoc type information, see [jsr-io/jsr/issues/494](https://github.com/jsr-io/jsr/issues/494). This problem will go away once ECMAScript supports [Type Annotations](https://github.com/tc39/proposal-type-annotations).
  - [ ] https://esm.sh/ (optional)
  - [ ] Browsers via `import * from 'https://...'`
- Rust:
  - [ ] https://crates.io/

FunctionalScript can't currently be installed from Git using NPM.

### Updating packages

`npm run update` reinstalls, syncs `deno.lock`, and regenerates the CI workflow; dependency version bumps in `package.json` are manual until [replace-npm-check-updates-with-an-internal-script.md](./replace-npm-check-updates-with-an-internal-script.md) lands. The version is the single source of truth in `package.json`. We publish only when a new version appears on `main`. This strategy can also work for Rust packages.

### CI publishing (merge to `main`)

- [x] Check if the version is new, then publish.

Package and publish jobs run in CI from a clean checkout. We do not rely on
packing from a developer working tree, and ignored generated outputs from an
earlier revision are not part of the package-build state. `prepack` belongs to
this packaging path; normal development should type-check and test without
producing package artifacts.

### Authored and generated JavaScript extensions

The repository source migration is split into two stages; see
[`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
and the authoritative FunctionalScript extension contract in
[`fjs/fsc/README.md`](../../fsc/README.md).

During stage 1, use different extensions for authored JavaScript and generated
TypeScript output:

```text
source.ts  -> source.js + source.d.ts
source.mjs -> source.mjs + source.d.mts
```

The stage-1 invariant is:

- `.ts` is authored TypeScript still awaiting migration;
- `.mjs` is authored ESM JavaScript with JSDoc types;
- `.js` is generated from `.ts` and is not authored;
- `.d.ts` and `.d.mts` are generated declarations.

For FunctionalScript specifically, `.f.mjs` means authored
FunctionalScript-intent JavaScript during stage 1; it does **not** promise that
the current FunctionalScript parser/compiler accepts the whole module. The
focused P1 prerequisite before the first package-owned migration is
[`f-mjs-package-support.md`](./f-mjs-package-support.md).

After all authored TypeScript is removed, the TypeScript-to-JavaScript emit path
is removed and the blanket `**/*.js` ignore is removed. Stage 2 can then use
`.f.js` as authored compiler-compatible FunctionalScript. Before the first
`.f.mjs` -> `.f.js` rename, complete
[`f-js-package-support.md`](./f-js-package-support.md) so standalone authored
`.f.js` source is directly checked, gets `.d.ts`, is packed, and resolves for a
clean consumer.

### Stage-1 TypeScript configuration

Before the first `.ts` -> `.mjs` conversion, the main `tsconfig.json` should
validate both authored TypeScript and JavaScript by enabling:

```jsonc
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true
  }
}
```

Enabling `checkJs` includes `fjs/types/bigint/benchmark.mjs`; keep it checked
like any other authored JavaScript. Its eventual removal is independent cleanup
and is not a prerequisite for the migration.

NPM must include the stage-1 runtime and declaration extensions. It is not
necessary to special-case incidental non-public authored `.mjs` files: for
example, packing `benchmark.mjs` is harmless because it exposes no documented
public API. Such files can be removed later when no longer useful.

### Stage-1 emission

Keep packaging simple and keep emission as an implementation detail of the NPM
lifecycle. While implementation `.ts` / `.f.ts` source remained, `prepack` was
two ordered TypeScript passes — declarations first, then JavaScript emission.
With only `types.ts` and test-fixture TypeScript left,
[#1520](https://github.com/functionalscript/functionalscript/pull/1520) measured
that no generated `.js` is required and replaced the second pass with a plain
check, which re-resolves the tree through the just-emitted declarations and so
keeps the declaration round-trip property:

```json
{
  "scripts": {
    "prepack": "tsc --noEmit false --emitDeclarationOnly && tsc"
  }
}
```

Do not expose separate `emit:declarations` or `emit:typescript` scripts. Users
should not need to invoke individual package-emission phases during normal
development.

The first pass emits declarations for both authored extensions:

```text
source.ts  -> source.d.ts
source.mjs -> source.d.mts
```

The generated declarations are then present for the second invocation. For the
repository configuration, TypeScript resolves those `.d.mts` declarations for
the authored `.mjs` modules, so the second pass emits the remaining TypeScript
runtime JavaScript without trying to overwrite the authored `.mjs` files:

```text
source.ts -> source.js
```

This exact setup is validated by
[PR #1451](https://github.com/functionalscript/functionalscript/pull/1451),
which enables `allowJs` / `checkJs`, keeps an authored `benchmark.mjs`, uses this
`prepack`, and passes the Node 26 CI `npm pack` step. A separate runtime-emission
configuration is therefore unnecessary unless a real repository case shows the
simple two-pass command is insufficient.

No generated-output cleanup is needed before packaging because the CI package
job starts from a clean checkout. In particular, after `source.ts` is renamed
to `source.mjs`, an ignored `source.js` / `source.d.ts` from a developer's older
working tree cannot appear in the CI package job.

Authored `.mjs` is copied without rewriting runtime imports, and emitted
`.d.mts` specifiers are not rewritten. Stage-1 migration is therefore
asymmetric and dependency-first: authored `.ts` may import already migrated
`.mjs`, while authored `.mjs` must not retain relative runtime or declaration
references to remaining `.ts` or generated `.js`.

As soon as the last authored `.ts` / `.f.ts` source is removed, the runtime
JavaScript emission pass has no purpose and should be removed from
`package.json`. `prepack` then becomes declaration-only:

```json
{
  "scripts": {
    "prepack": "tsc --noEmit false --emitDeclarationOnly"
  }
}
```

### Stage-2 authored `.f.js`

Once stage 1 is complete, `.js` is no longer generated from repository
TypeScript and becomes authorable again. The stage-2 package invariant for a
compiler-compatible FunctionalScript module is:

```text
source.f.js -> source.f.js + source.f.d.ts
```

TypeScript with `allowJs` / `checkJs` must include authored `.f.js` directly in
its checked source roots and declaration emission. NPM and clean-consumer tests
must cover both runtime and declarations. These requirements are owned by
[`f-js-package-support.md`](./f-js-package-support.md).

### Tasks

- [ ] Complete [`f-mjs-package-support.md`](./f-mjs-package-support.md) before
      the first stage-1 source conversion.
- [ ] After the last `.ts` / `.f.ts` source is removed, simplify `prepack` to the
      declaration-only `tsc --noEmit false --emitDeclarationOnly` command.
- [ ] Complete [`f-js-package-support.md`](./f-js-package-support.md) after
      stage 1 and before the first authored `.f.js` compiler-compatibility
      conversion.

### Related

- [PR #1451](https://github.com/functionalscript/functionalscript/pull/1451) —
  initial implementation and CI validation of authored `.mjs` package support.
- [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
  — repository-wide two-stage ordering.
- [`f-mjs-package-support.md`](./f-mjs-package-support.md) — focused stage-1
  authored `.mjs` prerequisite.
- [`f-js-package-support.md`](./f-js-package-support.md) — focused stage-2
  authored `.f.js` prerequisite.
- [`fjs/fsc/README.md`](../../fsc/README.md) — authoritative FunctionalScript
  extension and migration contract.
- [GitHub issue #398](https://github.com/functionalscript/functionalscript/issues/398)
  — the original package report.
