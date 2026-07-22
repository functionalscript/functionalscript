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

### Mixed TypeScript and JavaScript sources

During the transition from TypeScript to JavaScript, the repository may contain both:

- `.ts` source files, compiled to `.js` and `.d.ts` files for NPM;
- hand-written `.js` source files with JSDoc, copied to NPM as-is and used to generate `.d.ts` files.

The main `tsconfig.json` can validate both source types in one pass:

```jsonc
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "declaration": true
  }
}
```

Then `tsc` validates both `.ts` and `.js` files without generating package files.

Publishing in place requires cleaning old generated package files and then running two emission passes. A dedicated cross-platform cleanup script should run first:

```json
{
  "scripts": {
    "clean:package-output": "node ./fs/ci/npm/clean-package-output.js",
    "emit:declarations": "tsc --noEmit false --emitDeclarationOnly",
    "emit:typescript": "tsc --noEmit false --allowJs false --checkJs false --declaration false",
    "prepack": "npm run clean:package-output && npm run emit:declarations && npm run emit:typescript"
  }
}
```

The cleanup script must remove stale generated `.js` and `.d.ts` files before either compiler pass. It must remove only ignored, untracked package outputs and preserve tracked hand-written `.js` files. It must not traverse or modify dependency and cache directories such as `node_modules` and `target`.

The first emission pass includes both `.ts` and `.js` sources and emits only declarations:

```text
source.ts -> source.d.ts
source.js -> source.d.ts
```

The second pass excludes JavaScript inputs and emits JavaScript only from TypeScript:

```text
source.ts -> source.js
```

`--checkJs false` is required in the second pass because the base configuration enables `checkJs`, while that pass disables `allowJs`. `--declaration false` avoids regenerating the TypeScript declarations already emitted by the first pass. It can be omitted if regenerating those declarations is preferable.

Constraints:

- Do not keep an authored `x.ts` and authored `x.js` for the same module, because they target the same output paths.
- Hand-written `.js` files must be tracked even though generated `.js` files are ignored.
- Every package build, including local `npm pack`, must start by removing stale generated package outputs.

Tasks:

- [ ] Enable `allowJs` and `checkJs` in `tsconfig.json`.
- [ ] Add the tracked-file-aware package-output cleanup script.
- [ ] Replace the current one-pass `prepack` script with cleanup followed by the two-pass build.
- [ ] Add a package test containing one `.ts` module and one tracked, hand-written JSDoc `.js` module.
- [ ] In the package test, generate outputs for a temporary source, delete or rename that source, rerun `prepack`, and verify its stale `.js` and `.d.ts` outputs are absent from the packed archive.
- [ ] Verify the packed archive preserves the original hand-written `.js`, includes generated `.js` from TypeScript, and includes declarations for both.