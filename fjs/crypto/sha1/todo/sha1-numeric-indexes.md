## Make SHA-1 numeric indexes explicit

**Priority:** P2
**Status:** wip

### Problem

The SHA-1 compression loop reads `stages` and `w` using numeric computed
keys. FunctionalScript requires these keys to use `Number(...)`.

### Tasks

- [ ] Wrap both numeric keys in `Number(...)` without changing hash results.
- [ ] Check the full module and record the next compiler refusal, if any.
- [ ] Run type checking and the SHA-1 tests and coverage.
