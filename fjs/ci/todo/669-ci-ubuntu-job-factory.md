## 669-ci-ubuntu-job-factory. Factor out the `ubuntu` / `ubuntuArm` Job builders

**Priority:** P4
**Status:** open

### Problem

`fjs/ci/common/module.f.ts` defines two exported Job builders that differ only in one
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

The former `fjs/ci/playwright/module.f.ts` consumer is intentionally excluded: the
current Playwright job is being removed by
[remove-playwright-job](remove-playwright-job.md), and this refactoring must not preserve
or migrate that obsolete module.

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

- [ ] Add the exported `job` factory in `fjs/ci/common/module.f.ts`.
- [ ] Re-express `ubuntu` and `ubuntuArm` in terms of `job`.
- [ ] Migrate the surviving external construction in `fjs/ci/module.f.ts`.
- [ ] Do not migrate or retain `fjs/ci/playwright/module.f.ts`; its removal is owned by
      `remove-playwright-job.md`.
- [ ] Confirm `proof.f.ts` still covers `job`, `ubuntu`, and `ubuntuArm`.
- [ ] Verify generated workflow output is unchanged apart from separately planned
      Playwright removal.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [i170-ci-tool-steps](todo.md) — the `MetaStep` to `Step` pipeline (`toSteps`) these
  builders wrap.
- [remove-playwright-job](remove-playwright-job.md) — removes the obsolete Playwright Job
  consumer rather than migrating it to this factory.
