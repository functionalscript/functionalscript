# Publishing Packages

We are targeting the following systems:

- JS:
  - [X] NPM
  - [X] JSR
  - [ ] https://esm.sh/ optional
- Rust:
  - [ ] https://crates.io/

The main principle is that we should be able to install FunctionalScript from Git/GitHub. Currently,

- `NPM` works with Git links and `.mjs` files.
- `JSR`. Unfortunately, JSR doesn't support JSDoc type information, see [jsr-io/jsr/issues/494](https://github.com/jsr-io/jsr/issues/494).
- Browsers. `import * from 'https://...'`.

We have two options:

- Continue to use JavaScript source files and generate JSR package before publishing,
- Switch to TypeScript source files and write [prepack](https://docs.npmjs.com/cli/v7/using-npm/scripts) script. TS files could be a problem for our parser because it doesn't strip type annotations yet.

This problem will go away as soon as ECMAScript supports for [Type Annotations](https://github.com/tc39/proposal-type-annotations).

## Updating Packages

Currently, we regenerate `exports` in [./jsr.json](./index.f.mjs) using `npm run index` during CD (publishing) and `version` using `npm run version`. We should combine it into `update` script.

We don't check in CI if it was regenerated. The idea is that CI should check if all generated files in Git are updated:

- [package.json](./package.json) `version` property
- [jsr.json](./jsr.json), `version` and `exports` property.

`version` property should be the same in `package.json` and `jsr.json`.

We abandoned the idea to publish on every commit on `main`. Instead, we publish only when there is an new version in the `main`. This strategy can also work for Rust packages.

## CI Publishing (merge to `main`)

Check if the version is new, then publish.
