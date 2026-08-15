# Rewrite spec §5 (I/O) to use effects

**Priority:** P3
**Status:** open

## Problem

[`spec/README.md` §5](../spec/README.md#5-io) predates the effect system. It
sketches three alternatives without recording a decision:

- **§5.1 Isolated I/O** — dependency injection; requires the VM to implement
  external functions.
- **§5.2 Isolated Asynchronous I/O** — requires a promise implementation.
- **§5.3 State Machine with Asynchronous Requests** — the VM implements
  neither external functions nor promises; a program is a request
  (`readonly [Input, Continuation]`) and the host performs the I/O.

The decision has since been made and implemented: I/O is done with
**effects** ([`fjs/effects`](../fjs/effects/module.f.mjs)), and we plan to
continue using them. An `Effect<O, T>` is plain data — a `Pure` thunk or a
`Do` node (`{ command, payload, continuation }`) — and a runner interprets
the commands ([`fjs/effects/node`](../fjs/effects/node/module.f.mjs) for real
I/O; [`memory`](../fjs/effects/memory),
[`mock`](../fjs/effects/mock), and the
[virtual node runner](../fjs/effects/node/virtual/README.md) for tests). The
`fjs` CLI itself already runs through this system. Effects are the evolution
of §5.3: a `Do` node is exactly the "request with continuation", so the VM
needs no built-in external functions or promises, and asynchrony and mocking
are properties of the runner, not of the language.

## Tasks

- [ ] Rewrite §5 as a single effects-based I/O section: the `Effect` value
      shape (`Pure` / `Do`), operations (`Operation` as
      `readonly [name, signature]`), composition with `step`, and runners as
      the interpreters that perform commands.
- [ ] Fold §5.1–§5.3 into it: dependency injection survives as "the runner is
      the injected dependency"; §5.2's promise requirement is dropped
      (promises live only inside runners, if at all); §5.3 is recorded as the
      chosen model, realized by `fjs/effects`.
- [ ] Link the authoritative sources:
      [`fjs/effects/types.ts`](../fjs/effects/types.ts) (the `Effect` type
      and its invariants), [`fjs/effects/eff`](../fjs/effects/eff/README.md)
      (the method-chaining wrapper), and the runners.
- [ ] Check related sections stay consistent: §3.2 (Ownership of Mutable
      Objects), §8.3 (Async in Tests), and
      [promise](../spec/todo/3380-promise.md) — I/O no longer depends on it.
