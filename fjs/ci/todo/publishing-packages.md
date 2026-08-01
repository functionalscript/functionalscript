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

### Authored and generated JavaScript extensions

During the transition from TypeScript to JavaScript, use different extensions for authored and generated JavaScript:

```text
source.ts  -> source.js + source.d.ts
source.mjs -> source.mjs + source.d.mts
```

The extension invariant is:

- `.ts` is authored TypeScript;
- `.mjs` is authored ESM JavaScript with JSDoc types;
- `.js` is generated JavaScript and is never authored;
- `.d.ts` and `.d.mts` are generated declarations.

For FunctionalScript modules, [`fjs/fsc/README.md`](../../fsc/README.md) adds a
stronger capability convention: `.f.mjs` is authored JavaScript that the
current FunctionalScript parser and compiler must accept, while `.f.ts` may
still use unsupported parser features or TypeScript syntax. The blocking P1
implementation work required before the first real `.f.mjs` migration is
tracked in [`f-mjs-package-support.md`](./f-mjs-package-support.md). This P3
document remains the broader package-publishing roadmap and records the shared
package-emission convention.

The main `tsconfig.json` should validate authored TypeScript and JavaScript while excluding generated declarations:

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

### Existing benchmark

Enabling `checkJs` includes `fjs/types/bigint/benchmark.mjs`. Before enabling it, either make the benchmark pass TypeScript validation or delete the benchmark if it is no longer needed. The benchmark should not be excluded from `tsconfig.json`.

NPM must include both runtime extensions and both declaration extensions. Non-package `.mjs` files must remain excluded from the packed archive.

Publishing requires generated-output cleanup followed by two TypeScript emission passes:

```json
{
  "scripts": {
    "clean:generated": "node <repository-owned-cleanup-script>",
    "emit:declarations": "tsc --noEmit false --emitDeclarationOnly",
    "emit:typescript": "tsc --noEmit false --allowJs false --checkJs false --declaration false",
    "prepack": "npm run clean:generated && npm run emit:declarations && npm run emit:typescript"
  }
}
```

The repository-owned cleanup derives output paths from authored `.ts` and
`.mjs` inputs and removes only their generated `.js`, `.d.ts`, and `.d.mts`
artifacts. It must preserve authored `.mjs` and unrelated files and must not use
a broad working-tree cleanup. This makes repeated local `prepack` and `npm pack`
runs independent of ignored outputs left by an earlier run.

The first emission pass emits declarations for both authored source extensions:

```text
source.ts  -> source.d.ts
source.mjs -> source.d.mts
```

The second emission pass excludes JavaScript inputs and emits JavaScript only from TypeScript:

```text
source.ts -> source.js
```

Changing a module from `.ts` to `.mjs` also changes its import extension. Importers must be updated from the TypeScript or generated `.js` path to the authored `.mjs` path.

Authored `.mjs` is copied to the package without rewriting runtime import
specifiers, and this plan does not rewrite module specifiers retained in emitted
`.d.mts` declarations. Therefore migration must be dependency-closed in both
graphs: an authored `.mjs` module must not reference an unmigrated relative
`.ts` source or generated `.js` sibling through executable imports, JSDoc type
imports, or any other declaration-retained reference. Its relative runtime and
type dependencies must already be authored `.mjs` or be converted in the same
coherent group.

An authored `.ts` module may import `.mjs`; its generated `.js` and `.d.ts`
outputs preserve that `.mjs` specifier, which works both in a checkout and in
the packed artifact. No staging tree, package-time runtime-import rewrite, or
declaration-specifier rewrite is planned.

### Tasks

- [ ] Complete the blocking P1 authored-`.f.mjs` package work in
      [`f-mjs-package-support.md`](./f-mjs-package-support.md), including the
      repeatable cleanup-and-emission sequence and consecutive-pack regression.

### Related

- [`f-mjs-package-support.md`](./f-mjs-package-support.md) — focused P1 package
  prerequisite for the first real `.f.mjs` migration.
- [`fjs/fsc/README.md`](../../fsc/README.md) — FunctionalScript source
  extensions and incremental repository migration.
- [GitHub issue #398](https://github.com/functionalscript/functionalscript/issues/398)
  — the original report.
