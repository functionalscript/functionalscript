# 667-ci-package-aware-default-extras. Make default CI extras package-aware

**Priority:** P3
**Status:** done

## Problem

The built-in `fjs ci` generator includes default FunctionalScript self-test
steps that are specific to this repository:

- `fjs compile issues/demo/data/tree.json _tree.f.js`
- `deno task fjs compile issues/demo/data/tree.json _tree.f.js`
- `npm uninstall functionalscript -g`

Projects that install FunctionalScript and run `fjs ci` should not be forced to
have this repository's `issues/demo/data/tree.json` fixture. Also, if the current
package is not named `functionalscript`, uninstalling a hard-coded package name
does not undo the preceding `npm install -g <package tarball>` step.

## Proposal

Read `package.json` during default CI generation and derive:

- `name` — the package to uninstall after the local tarball install.
- whether the repository is this FunctionalScript repo.

Only include the demo compile step when `package.json.name === "functionalscript"`.
Use the package name from `package.json` for `npm uninstall <name> -g`.

If `package.json` is missing, unreadable, malformed, or has no string `name`, use
conservative defaults:

- do not include the repository-specific demo compile step;
- uninstall `functionalscript`, preserving the historical default.

## Tasks

- [x] Read and parse `package.json` in `fs/ci/module.f.ts`.
- [x] Gate the demo compile step on package name.
- [x] Use package name for `npm uninstall`.
- [x] Add virtual CI proofs for FunctionalScript and non-FunctionalScript
  package names.
