## Make undefined function results explicit

**Priority:** P3
**Status:** wip

### Problem

The syntax parser currently requires terminating function bodies. Repository
`module.f.mjs` sources also contain functions that complete normally with
JavaScript's implicit `undefined` result.

### Tasks

- [ ] Find function bodies that can complete normally in `module.f.mjs`.
- [ ] Add explicit `return undefined` while preserving subsequent statements
      and the results of existing return paths.
- [ ] Update the reachable-block-end TODO to track future implicit returns.
- [ ] Run the checks required by the changed modules.
