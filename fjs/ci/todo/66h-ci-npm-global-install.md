## 66H-ci-npm-global-install. `fjs/ci`: an `npmGlobalInstall` factory for global npm tool steps

**Priority:** P4
**Status:** open

### Problem

**Update:** the `@typescript/native-preview`/`tsgo` global-install call site described
below no longer exists in the repo (verified via
`grep -rn "native-preview\|tsgo" .github/workflows/ fjs/ci/`, which finds only this file's
own text). `fjs/ci/node/module.f.mjs` currently has a single global-install site,
`fjsGlobalInstall`, for `functionalscript`. With only one real consumer left, the
second-consumer threshold this proposal relies on (see "Why this still qualifies" below)
no longer holds, and a shared `npmGlobalInstall` factory may not be worth the abstraction
until a second consumer actually reappears. Leaving this open rather than closing it,
since a future global-install site (or the return of a tsgo-like tool) would revive the
case for it.

Originally, two CI step sites built the same `run`-based step for globally installing a
pinned npm package:

```ts
// fjs/ci/node/module.f.mjs
const fjsGlobalInstall = (version: string): MetaStep =>
    install({ run: `npm install -g functionalscript@${version}` })

install({ run: `npm install -g @typescript/native-preview@${tsgo}` })
```

The shape `install({ run: `npm install -g ${pkg}@${version}` })` was duplicated; only the
package name and version differed.

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

- **Only one real surviving consumer remains** (`fjsGlobalInstall`); the
  `@typescript/native-preview` site is gone, so the original second-consumer threshold no
  longer holds — see the Problem update above.
- The construction is identical and varies only by data.
- The abstraction names one repository policy: install a pinned npm tool globally.
- A future second consumer can reuse the factory without restoring the deleted Playwright
  job.

This remains distinct from:

- [i170](./170-ci-tool-step-builder.md), which builds install-and-test step sequences;
- [i175](./175-ci-setup-tool-factory.md), which builds `uses`-based GitHub Actions setup steps.

`npmGlobalInstall` builds a `run`-based shell-install step.

### Tasks

- [ ] Add `npmGlobalInstall` to `fjs/ci/common/module.f.mjs`.
- [ ] Rebind `fjsGlobalInstall` in `fjs/ci/node/module.f.mjs`.
- [ ] ~~Replace the inline `@typescript/native-preview` global-install step.~~ (site no
      longer exists — see Problem update)
- [ ] Confirm proof coverage for the surviving consumer and the generated step shape.
- [ ] Verify generated workflow output is unchanged.
- [ ] Run `tsc` and `fjs t`.

### Related

- [i170](./170-ci-tool-step-builder.md) — `toolSteps` step-sequence builder.
- [i175](./175-ci-setup-tool-factory.md) — `setupTool` for `uses`-based setup steps.
