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
earlier revision are not part of the package-build state.

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
validate authored TypeScript and JavaScript while excluding generated
declarations:

```jsonc
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "declaration": true
  },
  "include": [
    "**/*.ts",
    "**/*.mjs"
  ],
  "exclude": [
    "target",
    "**/*.d.ts",
    "**/*.d.mts"
  ]
}
```

`**/*.d.ts` must be excluded because it also matches `**/*.ts`.

Enabling `checkJs` includes `fjs/types/bigint/benchmark.mjs`. Before enabling it,
either make the benchmark pass TypeScript validation or delete it if it is no
longer needed. The benchmark should not be excluded from `tsconfig.json`.

NPM must include both stage-1 runtime extensions and both declaration extensions.
Non-package `.mjs` files must remain excluded from the packed archive.

### Stage-1 emission

Publishing uses two TypeScript emission passes from the clean CI checkout:

```json
{
  "scripts": {
    "emit:declarations": "tsc --noEmit false --emitDeclarationOnly",
    "emit:typescript": "tsc --noEmit false --allowJs false --checkJs false --declaration false",
    "prepack": "npm run emit:declarations && npm run emit:typescript"
  }
}
```

The first pass emits declarations for both authored extensions:

```text
source.ts  -> source.d.ts
source.mjs -> source.d.mts
```

The second pass disables JavaScript inputs and emits runtime JavaScript only
from TypeScript:

```text
source.ts -> source.js
```

This split avoids trying to overwrite authored `.mjs`. No generated-output
cleanup is needed before packaging because the CI package job starts from a
clean checkout. In particular, after `source.ts` is renamed to `source.mjs`, an
ignored `source.js` / `source.d.ts` from a developer's older working tree cannot
appear in the CI package job.

Authored `.mjs` is copied without rewriting runtime imports, and emitted
`.d.mts` specifiers are not rewritten. Stage-1 migration is therefore
asymmetric and dependency-first: authored `.ts` may import already migrated
`.mjs`, while authored `.mjs` must not retain relative runtime or declaration
references to remaining `.ts` or generated `.js`.

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
- [ ] Complete [`f-js-package-support.md`](./f-js-package-support.md) after
      stage 1 and before the first authored `.f.js` compiler-compatibility
      conversion.

### Related

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
