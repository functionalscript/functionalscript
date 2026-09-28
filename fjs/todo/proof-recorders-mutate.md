## Proof recorders mutate arrays

**Priority:** P5
**Status:** open

### Problem

[`fjs/AGENTS.md` §3.1](../AGENTS.md#31-immutability-and-purity) rules out
`.push`, `.shift` and the rest of the in-place array methods in `.f.mjs`, and
a `proof.f.mjs` is authored `.f.mjs` like any other (§1.2) — no exemption is
written for proofs. Several proofs record what the code under test did by
mutating an array:

- [`fjs/cas/proof.f.mjs`](../cas/proof.f.mjs) — `drive` appends each command
  to its `log` with `log.push(cmd)`, and answers from the caller's
  `overrides` with `queue.shift()`, which consumes those arrays in place. The
  log and the queues belong to one `drive(overrides)`, so two effects run
  through the same driver share both.
- [`fjs/mcp/cas/proof.f.mjs`](../mcp/cas/proof.f.mjs) — its `drive` answers
  with `queue.shift()` the same way.
- [`fjs/cli/proof.f.mjs`](../cli/proof.f.mjs) — `handlerReceivesRemainingArgs`
  collects the handler's arguments with `captured.push(...args)`.
- [`fjs/sul/proof.f.mjs`](../sul/proof.f.mjs) — `run` records each `add`
  call with `log.push([l, r, m, isSymbol])`.
- [`fjs/text/sgr/proof.f.mjs`](../text/sgr/proof.f.mjs) — the `stdout`
  stand-in for `createConsoleText` keeps what was written with
  `output.push(s)`.

Each recorder stands in for a callback the code under test calls for its
effect — a command handler, a sink, a writer — so there is a reason for it.
The rule does not say whether that reason is enough.

### Proposal

Either of two answers, and the choice is the design decision here:

- **Document an exemption** in `fjs/AGENTS.md`: a proof may mutate a
  recorder it creates, when the recorder never leaves the proof entry. The
  `cas` driver's queues would still not qualify, since they are the caller's
  arrays and outlive a run.
- **Record immutably.** Thread what was recorded through a state instead of
  a closure: `fjs/effects/mock`'s `run` already threads a state through every
  handler, and the memory effects hold values across a run. The `cas` and
  `mcp/cas` drivers, which already interpret an effect, are the natural
  first users; the callback-shaped ones (`cli`, `sul`, `text/sgr`) may need
  their API under test to return what it would have written.

### Tasks

- [ ] Decide between the exemption and immutable recording.
- [ ] Apply it to each proof above.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/cas/todo/proof-drive-shared.md`](../cas/todo/proof-drive-shared.md) —
  the two `drive` helpers become one; whichever lands second inherits the
  other's shape.
- [`fjs/text/sgr/todo/inplace-writer-split.md`](../text/sgr/todo/inplace-writer-split.md)
  — the in-place writer the `stdout` stand-in records.
