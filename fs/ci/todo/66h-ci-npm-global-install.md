## 66H-ci-npm-global-install. `fs/ci`: an `npmGlobalInstall` factory for global npm tool steps

**Priority:** P4
**Status:** open

### Problem

Three CI step sites build the identical `run`-based step "globally install a
pinned npm package", differing only in the package name and version value:

```ts
// fs/ci/node/module.f.ts:25-26
const fjsGlobalInstall = (version: string): MetaStep =>
    install({ run: `npm install -g functionalscript@${version}` })

// fs/ci/node/module.f.ts:47
install({ run: `npm install -g @typescript/native-preview@${tsgo}` }),

// fs/ci/playwright/module.f.ts:20
install({ run: `npm install -g playwright@${playwright}` }),
```

The shape `install({ run: \`npm install -g ${pkg}@${version}\` })` is repeated
verbatim. The deltas are exactly the package name and the pinned version:

| | package | version |
|---|---|---|
| node (fjs)  | `functionalscript`              | `version` (param) |
| node (tsgo) | `@typescript/native-preview`    | `tsgo` (from config) |
| playwright  | `playwright`                    | `playwright` (from config) |

A reader has to parse three template strings to notice they are the same
recipe, and a fourth global-install tool would fork a fourth copy.

### Proposed abstraction

A small factory in `fs/ci/common/module.f.ts` — the module that already
centralizes `install`/`test`/`clean`/`uses`/`toSteps` — capturing "globally
install one pinned npm package":

```ts
export const npmGlobalInstall =
    (pkg: string) =>
    (version: string): MetaStep =>
        install({ run: `npm install -g ${pkg}@${version}` })
```

The call sites collapse to point-free or one-argument calls:

```ts
// fs/ci/node/module.f.ts
const fjsGlobalInstall = npmGlobalInstall('functionalscript')
// ...
npmGlobalInstall('@typescript/native-preview')(tsgo),

// fs/ci/playwright/module.f.ts
npmGlobalInstall('playwright')(playwright),
```

`fjsGlobalInstall` reduces to a point-free binding — the same style as
`installNode = setupTool('actions/setup-node@v6', 'node-version')` proposed in
[i175](todo.md).

### Why this qualifies

- Three real call sites today, all shipping — past the second-consumer bar.
- Identical shape, only data (package name, version) varies — the textbook
  `AGENTS.md` data-parameterized-factory case.
- It is **complementary to, not a duplicate of,
  [i170](todo.md) and [i175](todo.md)**, which
  cover two different axes of CI step construction:
  - i170 `toolSteps(setup, cmds)` — the *install-then-test step sequence*.
  - i175 `setupTool(uses, versionKey)` — `uses`-based GitHub Actions *setup*
    steps (`install({ uses, with: { '<x>-version': v } })`).
  - This issue — `run`-based *shell* steps (`install({ run: 'npm install -g …' })`).

  These are three distinct step kinds. `setupTool` builds `uses` steps;
  `npmGlobalInstall` builds `run` steps; neither subsumes the other.

### Caveats / why this is an idea, not a mechanical edit

- **Currying direction.** Currying as `(pkg) => (version) =>` lets
  `fjsGlobalInstall = npmGlobalInstall('functionalscript')` read point-free,
  matching i175's `installNode` binding. A two-argument
  `(pkg, version)` form is equally valid if the point-free binding is not
  wanted — decide alongside i175's shape so the two factories stay consistent.
- **Mechanical savings are small** (one line per site); the value is making
  "globally install a pinned npm tool" one named recipe so a fourth tool reuses
  it instead of hand-spelling a fourth `npm install -g` template.
- **Proof coverage.** `fs/ci/proof.f.ts` already exercises the generated
  workflow; confirm the three steps it produces are byte-identical before and
  after, and that every branch of the new factory is covered (all three
  consumers call it, so 100% coverage falls out).

### Tasks

- [ ] Add `npmGlobalInstall` to `fs/ci/common/module.f.ts`.
- [ ] Rebind `fjsGlobalInstall` and the two inline `npm install -g` steps in
      `fs/ci/node/module.f.ts` and `fs/ci/playwright/module.f.ts` to it.
- [ ] Confirm `npx tsc` is clean and `fjs t` passes; verify the generated
      workflow YAML is unchanged.

### Related

- [i170](todo.md) — `toolSteps` step-sequence builder (different
  axis: the install+test sequence).
- [i175](todo.md) — `setupTool` for `uses`-based setup steps
  (different axis: GitHub Actions setup actions). This issue is the `run`-based
  sibling.
