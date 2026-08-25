## request-body-timeouts. A stalled request body holds a connection

**Priority:** P3
**Status:** open

### Problem

The Node runner reads a request body to its end before it calls the listener, so
a client that declares a large `Content-Length` and then stops sending holds the
connection until Node's `requestTimeout` — **300 seconds** by default. Reported
on [#1693](https://github.com/functionalscript/functionalscript/pull/1693): a
`POST` declaring 20 MB and sending 100 KB got no response for four seconds and
would have got none for five minutes.

It is slowloris-shaped rather than a hang: each stalled request costs one
connection, not a thread. Two things bound it today — `fjs/web` binds loopback,
and a body past the `Vec` cap is refused at the cap and the connection closed
([streaming-http-bodies](./streaming-http-bodies.md)) — but a body that stays
*under* the cap and simply never arrives is not covered by either.

The method is known before the body is: `fjs/web` answers `405` to everything
but `GET` and `HEAD`, and never reads a body at all. Buffering one for a method
the listener will refuse is work nobody asked for.

### Proposal

Two independent halves, either of which helps:

- **Timeouts.** `createServer` sets none, so every deployment inherits Node's
  five-minute default. A server the effect layer builds should choose
  `requestTimeout` and `headersTimeout` deliberately — and a listener that wants
  a different policy needs somewhere to say so, which is an API question rather
  than a constant.
- **Don't buffer what nobody will read.** With streaming bodies
  ([streaming-http-bodies](./streaming-http-bodies.md)) the listener receives the
  request before the body and decides whether to read it; a `405` then answers
  without a byte of it arriving. That is the real fix, and this issue is one more
  reason for it.

### Tasks

- [ ] Decide the default `requestTimeout` / `headersTimeout` for a server built
      through `createServer`, and whether a listener can override them.
- [ ] Revisit once streaming bodies land: a listener that never reads the body
      should not wait for one.

### Related

- [streaming-http-bodies](./streaming-http-bodies.md) — the redesign that removes
  the buffering this issue is about.
- [`fjs/web`](../../../web/README.md) — refuses every method but `GET`/`HEAD`
  after the body has already been read.
