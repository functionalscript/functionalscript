## 66H-ci-npm-global-install. `fjs/ci`: an `npmGlobalInstall` factory for global npm tool steps

**Priority:** P4
**Status:** open

### Problem

Two surviving CI step sites build the same `run`-based step for globally installing a
pinned npm package:

```ts
// fjs/ci/node/module.f.mjs
const fjsGlobalInstall = (version: string): MetaStep =>
    install({ run: `npm install -g functionalscript@${version}` })

install({ run: `npm install -g @typescript/native-preview@${tsgo}` })
```

The shape `install({ run: `npm install -g ${pkg}@${version}` })` is duplicated; only the
package name and version differ.

The former `fjs/ci/playwright/module.f.mjs` call site is intentionally not a consumer of
this proposal. That job and its global install have already been deleted, and this task
must not resurrect that obsolete path.

### Proposed abstraction

Add a small factory to `fjs/ci/common/module.f.mjs`, which already centralizes
`install`/`test`/`clean`/`uses`/`toSteps`:

```ts
export const npmGlobalInstall =
    (pkg: string) =>
    (version: string): MetaStep =>
        install({ run: `npm install -g ${pkg}@${version}` })
```

The surviving call sites become:

```ts
const fjsGlobalInstall = npmGlobalInstall('functionalscript')

npmGlobalInstall('@typescript/native-preview')(tsgo)
```

Currying as `(pkg) => (version) =>` supports the point-free `fjsGlobalInstall` binding
and matches the shape proposed for other setup factories. A two-argument form remains an
acceptable implementation choice if those related APIs settle on that style.

### Why this still qualifies

- There are two real surviving consumers, meeting the second-consumer threshold.
- The construction is identical and varies only by data.
- The abstraction names one repository policy: install a pinned npm tool globally.
- A future third consumer can reuse the factory without restoring the deleted Playwright
  job.

This remains distinct from:

- [i170](todo.md), which builds install-and-test step sequences;
- [i175](todo.md), which builds `uses`-based GitHub Actions setup steps.

`npmGlobalInstall` builds a `run`-based shell-install step.

### Tasks

- [ ] Add `npmGlobalInstall` to `fjs/ci/common/module.f.mjs`.
- [ ] Rebind `fjsGlobalInstall` in `fjs/ci/node/module.f.mjs`.
- [ ] Replace the inline `@typescript/native-preview` global-install step.
- [ ] Confirm proof coverage for both surviving consumers and the generated step shape.
- [ ] Verify generated workflow output is unchanged.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [i170](todo.md) — `toolSteps` step-sequence builder.
- [i175](todo.md) — `setupTool` for `uses`-based setup steps.
