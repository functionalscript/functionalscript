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
