## Proof recorders mutate arrays

**Priority:** P5
**Status:** open

### Problem

[`fjs/AGENTS.md` §3.1](../AGENTS.md#31-immutability-and-purity) rules out
`.push`, `.shift` and the rest of the in-place array methods in `.f.mjs`, and
a `proof.f.mjs` is authored `.f.mjs` like any other (§1.2) — no exemption is
written for proofs. Several proofs record what the code under test did by
mutating an array:

- [`fjs/cli/proof.f.mjs`](../cli/proof.f.mjs) — `handlerReceivesRemainingArgs`
  collects the handler's arguments with `captured.push(...args)`.
- [`fjs/sul/proof.f.mjs`](../sul/proof.f.mjs) — `run` records each `add`
  call with `log.push([l, r, m, isSymbol])`.

Each recorder stands in for a callback the code under test calls for its
effect — a command handler, a sink — so there is a reason for it.
The rule does not say whether that reason is enough.

### Proposal

Either of two answers, and the choice is the design decision here:

- **Document an exemption** in `fjs/AGENTS.md`: a proof may mutate a
  recorder it creates, when the recorder never leaves the proof entry.
- **Record immutably.** Thread what was recorded through a state instead of
  a closure: `fjs/effects/mock`'s `run` already threads a state through every
  handler, and the memory effects hold values across a run. `_driveCas` in
  [`fjs/cas/proof.f.mjs`](../cas/proof.f.mjs), the synthetic CAS driver both
  CAS proofs share, is the worked case: its override queues and its command
  log are the state `run` threads. The callback-shaped ones (`cli`, `sul`) may
  need their API under test to return what it would have written.

### Tasks

- [ ] Decide between the exemption and immutable recording.
- [ ] Apply it to each proof above.
- [ ] `tsc`, `fjs test`.
