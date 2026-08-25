## wildcard-binding-conflicts. `listen` compares addresses textually

**Priority:** P4
**Status:** on-hold

### Problem

The virtual `listen` refuses a second bind when the address string already
appears in `State.listening`. A host's rule is wider: a wildcard socket owns the
port for its whole family, so `0.0.0.0:8080` and then `127.0.0.1:8080` is
`EADDRINUSE` on Linux and the BSDs, while this runner allows it. Reported on
[#1693](https://github.com/functionalscript/functionalscript/pull/1693), where it
was measured on Linux with Node 22.

So a program that binds a wildcard *and* a specific address on one port can be
proven here and fail on a host.

### Why it is on hold rather than open

Encoding the wider rule means choosing an answer to questions the platforms
disagree about, and a wrong answer in the model is worse than a missing one — a
proof would then assert behaviour that is not universally true, which is the
failure this runner exists to prevent:

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
