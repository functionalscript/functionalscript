## 669-ci-ubuntu-job-factory. Factor out the `ubuntu` / `ubuntuArm` Job builders

**Priority:** P4
**Status:** open

### Problem

`fs/ci/common/module.f.ts:98-106` defines two exported Job builders that differ
only in a single image constant:

```ts
export const ubuntu = (ms: readonly MetaStep[]): Job => ({
    'runs-on': images.ubuntu.intel,
    steps: toSteps(ms)
})

export const ubuntuArm = (ms: readonly MetaStep[]): Job => ({
    'runs-on': images.ubuntu.arm,
    steps: toSteps(ms)
})
```

The entire body — the `Job` shape, the `steps: toSteps(ms)` call — is repeated
verbatim. The only thing that varies is `'runs-on'` (`images.ubuntu.intel` vs
`images.ubuntu.arm`). This is the textbook DRY case `AGENTS.md` calls out: "two
nearly-identical functions differ only in a constant". Today there are two
runners; a third image (e.g. a future macOS or Windows runner, or a pinned
container) would mean a third copy of the same three lines.

The same `{ 'runs-on': X, steps: toSteps(Y) }` shape is also hand-built at
two more sites outside `common`:

- `fs/ci/module.f.ts:38` —
  `return [id, { 'runs-on': image, steps: toSteps(result) }]`
- `fs/ci/playwright/module.f.ts:13-14` —
  `{ 'runs-on': playwrightImage, steps: toSteps(basicNode(...)([...])) }`

so the factory removes four copies, not two.

### Proposal

Introduce a factory parameterized by the image, then derive the two public
exports from it. This keeps the public API (`ubuntu`, `ubuntuArm`)
unchanged while removing the duplicated body:

```ts
export const job = (runsOn: string) => (ms: readonly MetaStep[]): Job => ({
    'runs-on': runsOn,
    steps: toSteps(ms),
})

export const ubuntu = job(images.ubuntu.intel)
export const ubuntuArm = job(images.ubuntu.arm)
```

The factory makes adding a new runner a one-liner (`export const macos =
job(images.macos.arm)`), and it documents that "a Job is just a runner image
plus the standard step pipeline" in one place instead of implying it twice.

`job` is exported (not private) because two consumers outside `common`
hand-build the same shape today: `fs/ci/module.f.ts:38` becomes
`[id, job(image)(result)]` and `fs/ci/playwright/module.f.ts:13-14` becomes
`job(playwrightImage)(basicNode(...)([...]))`.

### Tasks

- [ ] Add the exported `job` factory in `fs/ci/common/module.f.ts`.
- [ ] Re-express `ubuntu` and `ubuntuArm` in terms of `job`.
- [ ] Migrate the two external sites (`fs/ci/module.f.ts:38`,
      `fs/ci/playwright/module.f.ts:13-14`).
- [ ] Confirm `proof.f.ts` coverage still exercises both exports (they remain
      distinct exported values, so existing proofs should pass unchanged).
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [i170-ci-tool-steps](todo.md) — the `MetaStep` → `Step`
  pipeline (`toSteps`) these builders wrap.
