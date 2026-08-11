## 669-ci-ubuntu-job-factory. Factor out the `ubuntu` / `ubuntuArm` Job builders

**Priority:** P4
**Status:** open

### Problem

`fjs/ci/common/module.f.mjs` defines two exported Job builders that differ only in one
image constant:

```ts
export const ubuntu = (ms: readonly MetaStep[]): Job => ({
    'runs-on': images.ubuntu.intel,
    steps: toSteps(ms),
})

export const ubuntuArm = (ms: readonly MetaStep[]): Job => ({
    'runs-on': images.ubuntu.arm,
    steps: toSteps(ms),
})
```

The entire body is duplicated. The only variation is `'runs-on'`.

The same `{ 'runs-on': image, steps: toSteps(result) }` shape is also constructed in
`fjs/ci/module.f.ts`, so there are currently three surviving copies of the same Job
construction pattern.

The former `fjs/ci/playwright/module.f.ts` consumer is intentionally excluded: that
module has already been deleted, and this refactoring must not resurrect it.

### Proposal

Introduce a factory parameterized by the image, then derive the existing public builders
from it:

```ts
export const job = (runsOn: string) => (ms: readonly MetaStep[]): Job => ({
    'runs-on': runsOn,
    steps: toSteps(ms),
})

export const ubuntu = job(images.ubuntu.intel)
export const ubuntuArm = job(images.ubuntu.arm)
```

Keep `job` exported because the surviving external construction in `fjs/ci/module.f.ts`
can become:

```ts
[id, job(image)(result)]
```

This preserves the public `ubuntu` and `ubuntuArm` APIs while centralizing the common Job
shape. A future runner may reuse the factory when it has a real implementation, but this
task must not add compatibility code for the deleted Playwright job.

### Tasks

- [ ] Add the exported `job` factory in `fjs/ci/common/module.f.mjs`.
- [ ] Re-express `ubuntu` and `ubuntuArm` in terms of `job`.
- [ ] Migrate the surviving external construction in `fjs/ci/module.f.ts`.
- [ ] Confirm `proof.f.ts` still covers `job`, `ubuntu`, and `ubuntuArm`.
- [ ] Verify generated workflow output is unchanged.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [i170-ci-tool-steps](todo.md) — the `MetaStep` to `Step` pipeline (`toSteps`) these
  builders wrap.
