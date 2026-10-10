## Remove obsolete Node required checks

**Priority:** P3
**Status:** wip

### Problem

The Node 22/24 runtime, CI and documentation cleanup is implemented in
[#2804](https://github.com/functionalscript/functionalscript/pull/2804), stacked
on [#2802](https://github.com/functionalscript/functionalscript/pull/2802).
The remaining cutover step requires repository administration access: the
active [main-2 ruleset](https://github.com/functionalscript/functionalscript/rules/20948497)
still requires the removed `node22` and `node24` jobs.

Those contexts must be removed before the implementation enters the merge
queue, or the queue can wait for checks that no longer run. Preserve the nine
surviving required checks and all other ruleset settings.

### Tasks

- [ ] Remove only `node22` and `node24` from the required status checks in
      ruleset `20948497`, and verify the saved ruleset.
- [ ] Delete this TODO once that repository-setting change is complete.
