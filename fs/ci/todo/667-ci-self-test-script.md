## 667-ci-self-test-script. Add an optional package self-test script convention

**Priority:** P3
**Status:** open

### Problem

The built-in `fjs ci` generator currently needs package-aware logic for
FunctionalScript-specific self-checks. In this repository, the generated workflow
should compile `issues/demo/data/tree.json` after installing the freshly packed
tarball, but that fixture is not meaningful for projects that merely depend on
FunctionalScript.

Checking `package.json.name === "functionalscript"` works, but it keeps a
repository-specific behavior embedded in the shared CI generator. Other packages
may also want their own post-pack self-checks, and the generator should not need
to know their file layout.

### Proposal

Introduce an optional `package.json` script convention for package-specific CI
self-checks, for example:

```json
{
  "scripts": {
    "ci:self-test": "fjs compile issues/demo/data/tree.json _tree.f.js"
  }
}
```

The generated Node CI workflow can run:

```sh
npm run ci:self-test --if-present
```

after `npm pack` and `npm install -g <tarball>`. Repositories without the script
skip the hook cleanly. FunctionalScript itself can move its demo compile check
into `package.json`, removing the need for the CI generator to special-case the
package name for that step.

The package-name lookup is still useful for uninstalling the package installed
from the tarball:

```sh
npm uninstall <package.json.name> -g
```

### Open Questions

- Is `ci:self-test` the right script name, or should the convention be
  `fjs:self-test`, `ci:package-test`, or something else?
- Should Deno/Bun have equivalent optional hooks, or should this convention be
  limited to the Node/npm tarball self-check?
- Should the generator always emit `npm run ci:self-test --if-present`, or only
  emit it when `package.json.scripts["ci:self-test"]` exists at generation time?

### Tasks

- [ ] Choose and document the script name.
- [ ] Move FunctionalScript's demo compile check into that package script.
- [ ] Update `fs/ci/module.f.ts` to call the optional script instead of checking
  for `package.json.name === "functionalscript"` for the demo compile step.
- [ ] Update CI proofs for package-specific and absent-script behavior.
