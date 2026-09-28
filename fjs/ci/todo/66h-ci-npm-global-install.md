## 66H-ci-npm-global-install. `fjs/ci`: an `npmGlobalInstall` factory for global npm tool steps

**Priority:** P4
**Status:** open

### Problem

Two CI step sites build the same `run`-based step for globally installing a
pinned npm package. `fjs/ci/node/module.f.mjs`'s `fjsGlobalInstall` installs
`functionalscript`, and `publishSteps` in `fjs/ci/publish/module.f.mjs` installs
the configured TypeScript, because `npm publish` runs `prepack`, which runs
`tsc`, and that compiler is no longer a `devDependency`:

```js
// fjs/ci/node/module.f.mjs
install({ run: `npm install -g functionalscript@${version}` })
// fjs/ci/publish/module.f.mjs
install({ run: `npm install -g typescript@${typescript.version}` })
```

The second-consumer threshold this proposal set is therefore met. Whether two
one-line call sites are worth a factory is the open question, not whether the
duplication exists. (The second site this issue was filed against, a
`@typescript/native-preview` install, is gone; the TypeScript install replaced
it as the second consumer.)

The former `fjs/ci/playwright/module.f.mjs` call site is intentionally not a consumer of
this proposal. That job and its global install have already been deleted, and this task
must not resurrect that obsolete path.

### Proposed abstraction

Add a small factory to `fjs/ci/common/module.f.mjs`, which already centralizes
`install`/`test`/`uses`/`toSteps`:

```ts
export const npmGlobalInstall =
    (pkg: string) =>
    (version: string): MetaStep =>
        install({ run: `npm install -g ${pkg}@${version}` })
```

The surviving call sites become:

```ts
const fjsGlobalInstall = npmGlobalInstall('functionalscript')

npmGlobalInstall('typescript')(typescript.version)
```

Currying as `(pkg) => (version) =>` supports the point-free `fjsGlobalInstall` binding
and matches the shape proposed for other setup factories. A two-argument form remains an
acceptable implementation choice if those related APIs settle on that style.

### Why this still qualifies

- Two real consumers: `fjsGlobalInstall` and the TypeScript install in
  `publishSteps`.
- The construction is identical and varies only by data.
- The abstraction names one repository policy: install a pinned npm tool globally.

**Re-check the count before building it.** An abstraction justified by a count
has to be re-checked when the count moves. Two sibling factories filed beside
this one — `toolSteps` (issue 170) and `setupTool` (issue 175) — were closed
because the Nix migration took their call sites, and
[built-package-checks](./built-package-checks.md) proposes removing
`fjsGlobalInstall`'s registry install, which would leave this factory one
consumer again.

### Tasks

- [ ] Add `npmGlobalInstall` to `fjs/ci/common/module.f.mjs`.
- [ ] Rebind `fjsGlobalInstall` in `fjs/ci/node/module.f.mjs`.
- [ ] Rebind the TypeScript global install in `publishSteps`
      (`fjs/ci/publish/module.f.mjs`).
- [ ] Confirm proof coverage for both consumers and the generated step shape.
- [ ] Verify generated workflow output is unchanged.
- [ ] Run `tsc` and `fjs t`.

### Related

- [built-package-checks](./built-package-checks.md) — proposes replacing the
  registry install `fjsGlobalInstall` performs.
