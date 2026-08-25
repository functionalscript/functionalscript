## listen-dispatch-order. Queued requests are answered inside `listen`

**Priority:** P3
**Status:** open

### Problem

The virtual `listen` hands every queued request to the listener before it
returns, so a listener's observable effects happen *before* the caller's next
effect. A program that logs `bound` after `listen`, with a listener that logs
`request`, prints `request, bound` here and `bound, request` on Node — where
`listen` resolves on the `listening` event and requests arrive afterwards.

Reported on
[#1693](https://github.com/functionalscript/functionalscript/pull/1693), and
measured rather than reasoned about, on Linux with Node 22.22.2 and reproduced
on Darwin with Node 23.11.0 — a server whose listener pushes `request`,
awaiting `listen`, then pushing `bound`, prints `bound, request, answered`. It cannot print anything else there: nothing can
connect to a socket that is not yet listening, so on a host a queued request
*before* `listen` does not exist. It is only this runner, where requests are
fixtures in `State`, that can have one.

Nothing observes it today: `fjs/web`'s listener writes no state and its log line is the
only effect after `listen`, so both orders print the same thing. A listener that
counts requests in `MemOp`, or logs, would see the difference.

### Proposal

Dispatch at `forever` rather than at `listen`, which is where a real program is
when its requests arrive. `listen` would record the binding and return; `forever`
would drain the queue and then answer `notImplemented`, as it must — its result
type is `Result<never, NotImplemented>`, so that is the only value it can
produce.

The catch is that a program which never calls `forever` would then never answer
its queued requests, and every existing proof of `main` would change shape. It is
a small change to make and a larger one to be sure of, which is why it is filed
rather than folded into the pull request that found it.

### Tasks

- [ ] Move the drain from `listen` to `forever`.
- [ ] Decide what a program that never blocks should see — nothing answered, or
      the queue drained at the end of the run.
- [ ] Re-prove `fjs/web`'s `main`, whose responses would then arrive after its
      log line rather than before.

### Related

- `fjs/effects/node/virtual/module.f.mjs` — `listen`, and the absent `forever`.
- [`fjs/web`](../../../../web/README.md) — "Proving it without a socket".
