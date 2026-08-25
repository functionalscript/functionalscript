## address-model. `listen` treats a host as an opaque string

**Priority:** P4
**Status:** on-hold

### Problem

The virtual `listen` records the address it was given and compares it textually
against the addresses already in `State.listening`. It models neither of the two
things a real host decides:

**Which binds conflict.** A wildcard socket may own the port for its whole
family, so `0.0.0.0:8080` and then `127.0.0.1:8080` is `EADDRINUSE` on Linux with
Node 22, while this runner allows it. **How much wider the rule is, is a platform
question, and the two measurements taken so far disagree** — the same pair is
*allowed* on Darwin with Node 24. Both figures come from
[#1693](https://github.com/functionalscript/functionalscript/pull/1693): the
first from the review bot that reported the divergence, the second from a
reviewer who went looking for it on another platform.

**Which addresses exist at all.** Every host string binds here. On a real host
only an address of a local interface does — measured on Linux with Node 22.22.2:

| host | Node |
| --- | --- |
| `127.0.0.1` | binds |
| `192.0.2.1` | `EADDRNOTAVAIL — listen EADDRNOTAVAIL: address not available 192.0.2.1` |
| `example.com` | `EADDRNOTAVAIL`, against the resolved `172.66.147.243` |
| `does-not-exist.invalid` | `ENOTFOUND — getaddrinfo ENOTFOUND does-not-exist.invalid` |

So a program that binds a wildcard *and* a specific address on one port, or that
binds an address this machine does not hold, can be proven here and fail on a
host.

### Why it is on hold rather than open

Both halves mean choosing answers the platforms disagree about — as the wildcard
measurements above already do — and a wrong answer in the model is worse than a
missing one: a proof would then assert behaviour that is not universally true,
which is the failure this runner exists to prevent. The known variables:

- `SO_REUSEADDR` and `SO_REUSEPORT` change the conflict answer, and Node sets
  neither the same way everywhere;
- a dual-stack `::` binding covers IPv4-mapped addresses on Linux by default and
  not on the BSDs, so `[::]:8080` versus `127.0.0.1:8080` has no single answer;
- `0.0.0.0` versus `::` on one port differs again by platform;
- which addresses are local is a property of the machine, not of Node, so
  modelling it means `State` carrying an interface list that every proof would
  have to set up — and a name is a DNS answer, which the runner models nothing
  of.

Nothing binds a wildcard or a non-loopback address today. `Listen` requires the
host as an argument, and its one consumer ([`fjs/web`](../../../../web/)) passes
`127.0.0.1` — the string rule is permissive in exactly the cases no program
currently uses.

### Trigger

A consumer that binds a wildcard address, two servers on one port, or an address
that is not loopback. Then the address has to be modelled properly — overlap per
family with the dual-stack case decided explicitly, and existence against a
declared interface set — rather than guessed.

### Related

- `fjs/effects/node/virtual/module.f.mjs` — `listen`, and `State.listening`.
- [`fjs/web`](../../../../web/README.md) — binds `127.0.0.1`, one server.
