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

`npm run update` bumps dependencies via `npm-check-updates`, reinstalls, syncs `deno.lock`, and regenerates the CI workflow. The version is the single source of truth in `package.json`. We publish only when a new version appears on `main`. This strategy can also work for Rust packages.

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
- `.d.ts` and `.d.mts` are generated declarations and are never authored.

This removes the need to distinguish authored and generated `.js` files through Git state. Cleanup can remove every generated `.js`, `.d.ts`, and `.d.mts` package output without risking deletion of authored JavaScript.

The existing `fs/types/bigint/benchmark.mjs` is an authored benchmark rather than package source. Rename it to `benchmark.bench.mjs` and exclude `*.bench.mjs` files from normal validation and packaging until they are independently migrated to checked JSDoc.

The main `tsconfig.json` should select authored extensions explicitly so generated files never become root inputs:

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
    "**/*.d.mts",
    "**/*.bench.mjs"
  ]
}
```

`**/*.d.ts` must be excluded because it also matches the `**/*.ts` include pattern. The explicit include list excludes generated `.js` files while retaining authored `.mjs` files.

Package emission should use a package-specific configuration so `prepack` does not emit files for repository-only TypeScript outside `fs`:

```jsonc
{
  "extends": "./tsconfig.json",
  "include": [
    "fs/**/*.ts",
    "fs/**/*.mjs"
  ],
  "exclude": [
    "fs/**/*.d.ts",
    "fs/**/*.d.mts",
    "fs/**/*.bench.mjs"
  ]
}
```

Update the package allowlist for both runtime extensions and both declaration extensions while excluding benchmarks:

```json
{
  "files": [
    "fs/**/*.js",
    "fs/**/*.mjs",
    "fs/**/*.d.ts",
    "fs/**/*.d.mts",
    "!fs/**/*.bench.mjs"
  ]
}
```

Publishing in place requires cleaning old generated package files and then running two emission passes:

```json
{
  "scripts": {
    "clean:package-output": "git clean -fX -- \":(glob)fs/**/*.js\" \":(glob)fs/**/*.d.ts\" \":(glob)fs/**/*.d.mts\"",
    "emit:declarations": "tsc -p tsconfig.package.json --noEmit false --emitDeclarationOnly",
    "emit:typescript": "tsc -p tsconfig.package.json --noEmit false --allowJs false --checkJs false --declaration false",
    "prepack": "npm run clean:package-output && npm run emit:declarations && npm run emit:typescript"
  }
}
```

The first emission pass includes both authored source extensions and emits declarations only:

```text
source.ts  -> source.d.ts
source.mjs -> source.d.mts
```

The second pass disables JavaScript inputs and emits JavaScript only from TypeScript:

```text
source.ts -> source.js
```

`--checkJs false` is required in the second pass because the base configuration enables `checkJs`, while that pass disables `allowJs`. `--declaration false` avoids regenerating the TypeScript declarations already emitted by the first pass.

Changing a module from `.ts` to `.mjs` changes its runtime import extension. Importers that previously referenced `source.ts` or generated `source.js` must be updated to reference `source.mjs`. The package test must cover imports in both directions between `.ts` and `.mjs` modules.

Constraints:

- Do not keep authored `x.ts` and `x.mjs` implementations for the same logical module.
- Authored JavaScript must use `.mjs`; authored `.js` files are forbidden.
- Generated `.js`, `.d.ts`, and `.d.mts` files remain ignored and untracked.
- Every package build, including local `npm pack`, must remove stale generated package outputs first.
- Benchmarks use the `.bench.mjs` suffix and are excluded from the package.

Tasks:

- [ ] Rename `fs/types/bigint/benchmark.mjs` to `benchmark.bench.mjs`.
- [ ] Enable `allowJs` and `checkJs` and add the explicit authored-source `include` and generated-output `exclude` patterns to `tsconfig.json`.
- [ ] Add `tsconfig.package.json` for package-only emission under `fs`.
- [ ] Update the package `files` allowlist to include `.mjs` and `.d.mts` and exclude `.bench.mjs`.
- [ ] Add the scoped `git clean -fX` command for generated `.js`, `.d.ts`, and `.d.mts` outputs.
- [ ] Replace the current one-pass `prepack` script with cleanup followed by the two-pass build.
- [ ] Add a package test containing one `.ts` module and one hand-written JSDoc `.mjs` module.
- [ ] Test `.ts` importing `.mjs` and `.mjs` importing the `.js` runtime path generated from `.ts`.
- [ ] Verify the first pass emits `.d.ts` from `.ts` and `.d.mts` from `.mjs`.
- [ ] Verify cleanup removes ignored generated outputs but preserves authored `.mjs` files.
- [ ] Generate outputs for a temporary source, delete or rename that source, rerun `prepack`, and verify its stale outputs are absent from the packed archive.
- [ ] Verify `benchmark.bench.mjs` is absent from the packed archive.
- [ ] Verify the packed archive contains authored `.mjs`, generated `.js`, and declarations for both source types.
