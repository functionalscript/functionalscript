## Separate CI Job for Deno Coverage

**Priority:** P3
**Status:** open

Add a dedicated CI job that runs `deno task cov` so coverage is tracked on every PR without slowing down the main test matrix.

### Plan

- [ ] Add a `deno-coverage` job to the CI generator (`fjs/ci/module.f.ts` or a new `fjs/ci/deno/module.f.ts` variant) that runs `deno task cov` (runs `deno test --allow-read --allow-env && deno coverage --include='.*module\\.f\\.ts'`, matching the `npm run cov` scope).
- [ ] Decide whether to upload the coverage report (e.g. to Codecov or as a GitHub artifact).
- [ ] Run only on one platform (e.g. `ubuntu-intel`) to avoid redundancy.
