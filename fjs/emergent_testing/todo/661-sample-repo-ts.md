## 661-sample-repo-ts. Sample repo: FunctionalScript test framework for vanilla TypeScript

**Priority:** P3
**Status:** open

### Problem

There is no minimal example repository showing how to use the FunctionalScript test
framework in a plain TypeScript project. New users have no reference for how to
structure tests, what the different proof styles look like, or how to wire up CI.

### Proposal

Create a public sample repository with:

**Test styles demonstrated**

- Module-level asserts
- White-box proofs
- Black-box proofs

**CI** running all of:

- `npx fjs js t`
- Node test runner
- Deno test runner
- Bun test runner

### Tasks

- [ ] Create the sample repository
- [ ] Add examples of module-level asserts
- [ ] Add examples of white-box proofs
- [ ] Add examples of black-box proofs
- [ ] Add CI workflow running `npx fjs js t`, Node, Deno, and Bun runners

### Related

- [i661-test-runner-behavior](todo.md) — documents runner behavior differences relevant to CI setup
