# Publishing Packages

**Priority:** P3
**Status:** open

We are targeting the following systems:

- JS:
  - [X] NPM
- Rust:
  - [ ] https://crates.io/

Currently,

- FunctionalScript can't be installed from Git using `NPM`.
- `JSR`. Unfortunately, JSR doesn't support JSDoc type information, see [jsr-io/jsr/issues/494](https://github.com/jsr-io/jsr/issues/494).
- Browsers. `import * from 'https://...'`.

This problem will go away as soon as ECMAScript supports for [Type Annotations](https://github.com/tc39/proposal-type-annotations).

## Alternatives

- JS:
  - [ ] JSR
  - [ ] https://esm.sh/ optional

## Updating Packages

`npm run update` bumps dependencies via `npm-check-updates`, reinstalls, syncs `deno.lock`, and regenerates the CI workflow.

The version is the single source of truth in [package.json](./package.json). We publish only when a new version appears on `main`. This strategy can also work for Rust packages.

## CI Publishing (merge to `main`)

- [X] Check if the version is new, then publish.
