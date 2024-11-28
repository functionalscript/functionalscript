# Publishing Packages

We are targeting the following systems:

- JS:
  - NPM
  - JSR
  - https://esm.sh/ optional
- Rust:
  - https://crates.io/

## Creating `./index.f.cjs`

Currently, we regenerate [./index.f.cjs](./index.f.cjs) using `npm run index` during CD (publishing). However, we don't check in CI if it was regenerated. The idea is that CI should check if all generated files in Git are updated:
- [package.json](./package.json) `version` property
- [jsr.json](./jsr.json), `version` property
- [index.f.cjs](./index.f.cjs)

`version` property should be `version` calculated on a `main` branch.

We may abandon the idea to publish on every commit on `main`. Instead, we will publish only we when we update a version in the `main` branch. This strategy can also work for Rust packages. The idea is that people can still reference from Git if they would like to have a not-published version of a package. We will still release in CI but only when there is a new version.

## Publishing

Before publishing, we have to be sure that

1. [index.f.cjs](./index.f.cjs) is up to date
2. `version` is updated in [jsr.json](./jsr.json) and [package.json](./package.json).
