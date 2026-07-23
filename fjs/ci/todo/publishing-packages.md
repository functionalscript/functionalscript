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
- `.d.ts` and `.d.mts` are generated declarations.

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

Publishing requires two TypeScript emission passes:

```json
{
  "scripts": {
    "emit:declarations": "tsc --noEmit false --emitDeclarationOnly",
    "emit:typescript": "tsc --noEmit false --allowJs false --checkJs false --declaration false",
    "prepack": "npm run emit:declarations && npm run emit:typescript"
  }
}
```

The first pass emits declarations for both authored source extensions:

```text
source.ts  -> source.d.ts
source.mjs -> source.d.mts
```

The second pass excludes JavaScript inputs and emits JavaScript only from TypeScript:

```text
source.ts -> source.js
```

Changing a module from `.ts` to `.mjs` also changes its import extension. Importers must be updated from the TypeScript or generated `.js` path to the authored `.mjs` path.

Tasks:

- [ ] Make `fjs/types/bigint/benchmark.mjs` pass TypeScript validation or delete it.
- [ ] Enable `allowJs` and `checkJs` and add the authored-source `include` and generated-declaration `exclude` patterns to `tsconfig.json`.
- [ ] Update the NPM package rules to include `.mjs` and `.d.mts` while excluding non-package `.mjs` files.
- [ ] Replace the current one-pass `prepack` script with the two emission passes.
- [ ] Add a package test containing one `.ts` module and one JSDoc `.mjs` module.
- [ ] Test imports in both directions between `.ts` and `.mjs` modules.
- [ ] Verify the packed archive contains authored `.mjs`, generated `.js`, `.d.ts`, and `.d.mts` files.
