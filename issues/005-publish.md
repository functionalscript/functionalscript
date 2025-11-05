# Publishing Packages

We are targeting the following systems:

- JS:
  - [X] NPM
  - [X] JSR
  - [ ] https://esm.sh/ optional
- Rust:
  - [ ] https://crates.io/

Currently,

- FunctionalScript can't be installed from Git using `NPM`.
- `JSR`. Unfortunately, JSR doesn't support JSDoc type information, see [jsr-io/jsr/issues/494](https://github.com/jsr-io/jsr/issues/494).
- Browsers. `import * from 'https://...'`.

This problem will go away as soon as ECMAScript supports for [Type Annotations](https://github.com/tc39/proposal-type-annotations).

## Updating Packages

Currently, we regenerate `exports` in [./jsr.json](./index.f.ts) using `npm run update` during CD (publishing).

We don't check in CI if it was regenerated. The idea is that CI should check if all generated files in Git are updated:

- [package.json](./package.json) `version` property.
- [deno.json](./deno.json), `version` and `exports` property.

`version` property should be the same in `package.json` and `deno.json`.

We abandoned the idea to publish on every commit on `main`. Instead, we publish only when there is an new version in the `main`. This strategy can also work for Rust packages.

## CI Publishing (merge to `main`)

Check if the version is new, then publish.
