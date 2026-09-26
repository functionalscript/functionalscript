## request-body-timeouts. A stalled request body holds a connection

**Priority:** P3
**Status:** open

### Problem

A client that declares a large `Content-Length` and then stops sending holds a
connection until Node's `requestTimeout` — **300 seconds** by default. Reported
on [#1693](https://github.com/functionalscript/functionalscript/pull/1693): a
`POST` declaring 20 MB and sending 100 KB got no response for four seconds and
would have got none for five minutes.

It is slowloris-shaped rather than a hang: each stalled request costs one
connection, not a thread.

**The half of this that was about buffering is answered, and what is left is the
timeout.** The runner used to read the body to its end before calling the
listener, so *every* stalled request waited, including one for a method the
listener was never going to serve. It does not any more: the body is a `List` the
listener pulls from ([streaming-http-bodies](./streaming-http-bodies.md), stage
2), so `fjs/web` answers `405` without reading a byte and the runner closes the
connection rather than draining what is still coming. The `Vec` cap was a second
bound and retired with the same change, which costs this issue nothing — it never
covered a body that stayed *under* the cap and simply never arrived, which is
this issue's case.

So what waits now is a listener that *wants* the body — a `fjs/cas` `add`, say —
on a client that stopped sending, and what it waits for is the five-minute
default every deployment inherits. `fjs/web` binding loopback is the only other
thing bounding it.

`CONNECT` is the one method that already works this way, and shows what the
saving looks like. Node raises it on the request line, so the runner's `501`
goes out before a byte of body is read — measured on Darwin with Node 23.11.0,
where a `CONNECT` declaring twenty megabytes and sending a hundred kilobytes was
answered in 2 ms and closed at 3, against a `POST` with the same body that had
no answer at 6,000 ms. It reaches that path by not being a request at all rather
than by any decision made here, but the shape of the win is the same one.

### Proposal

Two independent halves, either of which helps:

- **Timeouts.** `createServer` sets none, so every deployment inherits Node's
  five-minute default. A server the effect layer builds should choose
  `requestTimeout` and `headersTimeout` deliberately — and a listener that wants
  a different policy needs somewhere to say so, which is an API question rather
  than a constant.
- **Don't buffer what nobody will read.** **Done**, by
  [streaming-http-bodies](./streaming-http-bodies.md)'s stage 2: the listener
  receives the request before the body and decides whether to read it, so a `405`
  answers without a byte of it arriving and the runner closes the connection
  rather than draining the rest. What that does not fix is a listener that *does*
  want the body, which is the timeout half above.

### Tasks

- [ ] Decide the default `requestTimeout` / `headersTimeout` for a server built
      through `createServer`, and whether a listener can override them.
- [x] Revisit once streaming bodies land: a listener that never reads the body
      should not wait for one. — `IncomingMessage.body` is a `List`
      ([streaming-http-bodies](./streaming-http-bodies.md), stage 2), so the
      listener is called before the body arrives and `answerRequest`
      (`../module.mjs`) closes the connection on a body it did not finish
      reading. A listener that reads one still waits, which is the first task.

### Related

- [streaming-http-bodies](./streaming-http-bodies.md) — the redesign that removed
  the buffering this issue was about, leaving the timeouts.
- [`fjs/web`](../../../web/README.md) — refuses every method but `GET`/`HEAD`,
  now before a byte of body is read.
