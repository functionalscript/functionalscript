## request-body-lifetime. A request body outlives its request, and the two runners disagree about what it holds

**Priority:** P2
**Status:** open

### Problem

A listener is handed its request body as a `List`
(`IncomingMessage.body`, `../types.ts`). A `List` is a value, so a listener may
keep it — through a memory effect (`../../memory/`), whose store the Node runner
creates once for the whole process (`runNodeEffect`, `../module.mjs`) — and pull
it while answering a **later** request. Nothing refuses that, and the two runners
answer it differently.

Measured on Darwin with Node 23.11.0, by a listener that `memWrite`s the body it
was handed for `POST /store` and answers without reading it, then `memRead`s that
list for `POST /later` and pulls one cell of it:

| runner | what the pull answered |
| --- | --- |
| Node | **the end of the body**, at offset nought, although the client sent 11 bytes with the stored request |
| virtual | **`ok`, 11 bytes** — the stored request's own body, replayed from `State.bodies` |

So one program receives two plausible bodies, each complete and in order, and
nothing downstream can tell which it has. On the host the socket is gone: Node has
dumped whatever the listener did not read, its iterator answers `done`, and `done`
is how this stream says *end*, so the body reads as empty rather than as absent.
In the virtual runner the cursor is deliberately kept after the response — it is
how a proof asks what the listener did with its body
(`_RequestBodyCursor`, `../virtual/types.ts`) — so the bytes are still there to
hand out, and the pull also moves the *first* request's cursor while the second
request's own body stays untouched.

This arrived with the streaming body ([streaming-http-bodies](./streaming-http-bodies.md),
stage 2). A `Vec` body could be kept across requests and still be the bytes the
client sent; a `List` over a socket cannot.

### Proposal

Give the body a lifetime and refuse a pull outside it, in both runners and in one
message — the pairing `requestBodyOffsetMessage` (`../module.f.mjs`) already is,
so that a program meeting the refusal in a proof meets the same words on a host.

What has to be decided:

- **Where the lifetime ends.** The response being written is the one boundary both
  runners can name: the Node runner knows it in `answerRequest`, and the virtual
  runner knows it where `listen` records what the listener answered. "When the
  socket closes" has no virtual counterpart.
- **What the virtual runner keeps.** `State.bodies` must go on holding `rest` and
  `offset` after the response, because that record is how "answered without
  reading the body" is asserted where there is no connection to watch close. So
  the cursor is *closed*, not dropped.
- **Whether a listener should be able to keep a body at all.** The answer may be
  that this is the wrong shape rather than a missing refusal —
  [requestlistener-stateful](./requestlistener-stateful.md) is the open question
  about what a listener may carry between requests, and a body handle is the first
  concrete thing it would have to say something about.

### Tasks

- [ ] Decide the boundary, and the message a pull past it is refused with.
- [ ] Refuse it in the Node runner, and mirror it in the virtual runner with the
      cursor closed rather than dropped.
- [ ] Proofs on both sides, from the input above: a body stored under one request
      and pulled under a later one.

### Related

- [streaming-http-bodies](./streaming-http-bodies.md) — the change that made the
  body a `List`, and so made this reachable.
- [requestlistener-stateful](./requestlistener-stateful.md) — what a listener may
  carry between requests, which is the question this is a case of.
- `../types.ts` (`ReadRequestBytes`) — what a pull already refuses, and the
  property a refusal here has to keep: the same words from either runner.
