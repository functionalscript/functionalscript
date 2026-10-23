## Investigate smart builds on developer machines

**Priority:** P3
**Status:** open

### Problem

The build-cache work initially targets CI using a selected committed
snapshot and a controlled build contract. The requirements and usefulness
of smart builds for everyday developer-machine workflows need separate
investigation.

### Scope

This task is investigation only. Record findings and open questions;
design and implementation are outside its scope.

### Tasks

- [ ] Examine local build and check workflows and identify repeated work.
- [ ] Investigate which CI assumptions hold on developer machines and which
      do not, including uncommitted inputs and the local execution environment.
- [ ] Record findings, limitations, and questions for any later design work.

### Related

- [CI build cache](../../ci/todo/097-smart-ca-ci.md) — initial CI work;
  independent of this investigation.
