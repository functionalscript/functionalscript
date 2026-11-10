## Fail coverage when source inputs cannot be admitted

**Priority:** P1
**Status:** wip

### Problem

A proof can execute under Node while the dependency parser rejects its source.
Coverage currently reports success and silently repeats uncached execution on
every run. A passing coverage command must require successful source admission
when its cache is available; a normal cold-cache miss remains valid.

### Tasks

- [ ] Count failed manifest admission as a failed module while continuing the
      remaining coverage checks and retaining successful modules' cache entries.
- [ ] Prove that an unsupported namespace import exits nonzero even when its
      Node proofs pass, and that ordinary cold/warm checks still succeed.
