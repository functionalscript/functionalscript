## wildcard-binding-conflicts. `listen` compares addresses textually

**Priority:** P4
**Status:** on-hold

### Problem

The virtual `listen` refuses a second bind when the address string already
appears in `State.listening`. A host's rule can be wider: a wildcard socket may
own the port for its whole family, so `0.0.0.0:8080` and then `127.0.0.1:8080`
is `EADDRINUSE` on Linux with Node 22, while this runner allows it.

**How much wider is a platform question, and the two measurements taken so far
disagree.** The same pair is *allowed* on Darwin with Node 24. Both figures come
from [#1693](https://github.com/functionalscript/functionalscript/pull/1693) —
the first from the review bot that reported the divergence, the second from a
reviewer who went looking for it on another platform.

So a program that binds a wildcard *and* a specific address on one port can be
proven here and fail on a host.

### Why it is on hold rather than open

Encoding the wider rule means choosing an answer to questions the platforms
disagree about — as the two measurements above already do — and a wrong answer
in the model is worse than a missing one: a proof would then assert behaviour
that is not universally true, which is the failure this runner exists to
prevent. The known variables:

- `SO_REUSEADDR` and `SO_REUSEPORT` change the answer, and Node sets neither the
  same way everywhere;
- a dual-stack `::` binding covers IPv4-mapped addresses on Linux by default and
  not on the BSDs, so `[::]:8080` versus `127.0.0.1:8080` has no single answer;
- `0.0.0.0` versus `::` on one port differs again by platform.

Nothing binds a wildcard today. `Listen` requires the host as an argument, and
its one consumer ([`fjs/web`](../../../../web/)) passes loopback — the textual
rule is permissive in exactly the case no program currently uses.

### Trigger

A consumer that binds a wildcard address, or two servers on one port. Then the
overlap relation has to be modelled properly — per family, with the dual-stack
case decided explicitly — rather than guessed.

### Related

- `fjs/effects/node/virtual/module.f.mjs` — `listen`, and `State.listening`.
- [`fjs/web`](../../../../web/README.md) — binds `127.0.0.1`, one server.
