## Proof recorders mutate arrays

**Priority:** P5
**Status:** open

### Problem

[`fjs/AGENTS.md` §3.1](../AGENTS.md#31-immutability-and-purity) rules out
`.push`, `.shift` and the rest of the in-place array methods in `.f.mjs`, and
a `proof.f.mjs` is authored `.f.mjs` like any other (§1.2) — no exemption is
written for proofs. One proof still records what the code under test did by
mutating an array:

- [`fjs/sul/proof.f.mjs`](../sul/proof.f.mjs) — `run` records each `add`
  call with `log.push([l, r, m, isSymbol])`.

The recorder stands in for a callback the code under test calls for its
effect, a sink, so there is a reason for it. The rule does not say whether
that reason is enough.

[`fjs/cli/proof.f.js`](../cli/proof.f.js) had the same recorder in
`handlerReceivesRemainingArgs` and no longer does: its handler writes the
arguments to standard output with `log`, and the proof reads them from the
state the virtual run returns.

Two proofs counted calls with a `let` a callback incremented, which the
compiler refuses for the same reason, and no longer do.
[`fjs/effects/node/proof.f.mjs`](../effects/node/proof.f.mjs) (`longList`,
`failsClosed`) keeps the count and the removed paths as the state
`fjs/effects/mock`'s `run` threads through the operations.
[`fjs/dev/gen/proof.f.js`](../dev/gen/proof.f.js) (`withSubprocess`) dropped
its counter: the stand-in `spawn` asserts a command no caller sends, so a
start fails the proof where it happens.

### Proposal

Either of two answers, and the choice is the design decision here:

- **Document an exemption** in `fjs/AGENTS.md`: a proof may mutate a
  recorder it creates, when the recorder never leaves the proof entry.
- **Record immutably.** Thread what was recorded through a state instead of
  a closure: `fjs/effects/mock`'s `run` already threads a state through every
  handler, and the memory effects hold values across a run. `_driveCas` in
  [`fjs/cas/proof.f.js`](../cas/proof.f.js), the synthetic CAS driver both
  CAS proofs share, is the worked case: its override queues and its command
  log are the state `run` threads. `cli` was done this way, through the
  virtual run's own state. `sul` is callback-shaped and needs more: its
  encoder threads a storage value that could hold the log, but `end` returns
  the root alone, so the API under test would have to return the storage too.

### Tasks

- [ ] Decide between the exemption and immutable recording.
- [x] `fjs/cli/proof.f.js` records through the run's state.
- [x] The counters in `fjs/effects/node` and `fjs/dev/gen` are gone.
- [ ] Apply it to `fjs/sul/proof.f.mjs`.
- [ ] `tsc`, `fjs test`.
