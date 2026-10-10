## Every proof spells `virtual({ ...emptyState, root })`

**Priority:** P4
**Status:** open

### Problem

A proof that runs a program on the virtual host builds its state as
`virtual({ ...emptyState, root })`. At `d8a75b4` that expression appears a
couple of hundred times across about two dozen proof files, the virtual
runner's own proof, the compiler's and the transpiler's the largest. On top
of it, several proofs define a local "run a program at a root" helper with
the same composition — `run` in [`fjs/proof.f.mjs`](../../../../proof.f.mjs)
and [`fjs/cli/proof.f.mjs`](../../../../cli/proof.f.mjs), and one inside
[`fjs/dev`](../../../../dev/module.f.mjs)'s in-module proof.

Should `State` gain a required field, every site changes; should a proof
need one more option, it is added to the spread at each.

### Proposal

[`virtual`](../module.f.mjs) exports `virtualAt = root => virtual({
...emptyState, root })`, and optionally `runProgram = program => root =>
args => virtualAt(root)(program(nodeProgramOptions(args)))` for the local
`run` helpers. A mechanical change, one proof directory per PR if the diff
is too large for one.

### Tasks

- [ ] Export the two helpers, proven.
- [ ] Move the proofs onto them.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [scenario-testing](../../../../emergent_testing/todo/scenario-testing.md)
  — the larger design that would replace the ad-hoc `run` helpers with a
  `Scenario` type; this helper is the small step that does not wait on it.
