# Issues

## Allow Debugging During Test Run

Currently, we read files as strings and then parse them as functions. See [dev/test.mjs](dev/test.mjs). In this case, the debugger doesn't know about the source code and can't debug the functions. The main reason for loading modules as functions was that Deno v1 didn't support `.cjs` files. However, Deno v2 supports them.

We can fix the issue by changing our test runner. The test runner will scan all directories, find all `test.f.cjs` files, and then load them using `require`.

**Note:** In this case, we will drop support for Deno v1.

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

## Switching to ESM

Currently, the biggest obstacle to using ESM is that we cannot make bundles on ESM modules without an FS parser.
The solution is to deploy ESM modules to HTTPS.

## Can we get rid of `jsr.json` and use only `package.json`?

No.
