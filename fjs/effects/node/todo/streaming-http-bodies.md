## streaming-http-bodies. Streaming HTTP request and response bodies

**Priority:** P3
**Status:** open

### Problem

`IncomingMessage.body` and `ServerResponse.body` (`fjs/effects/node/types.ts`)
are each a single `Vec`, and a `Vec` caps at 131,072 bytes (128 KiB). The whole
body is therefore materialized before a listener sees it and after it answers:
the Node runner buffers the request (bounded, at the cap) and writes
the response with one `res.end(fromVec(body))`.

The runner refuses what it cannot represent — a request body past the cap is
answered `413` without the listener seeing it — so the limit is at least honest,
but it is still a limit no HTTP client expects.

Two consumers are already bounded by this:

- [`fjs/web`](../../../web/) cannot serve a file larger than the cap. It `stat`s
  first and answers `413` so a large file fails loudly instead of being
  truncated, but the file is perfectly readable — only the response frame cannot
  carry it.
- [`fjs/cas` web-api-server](../../../cas/todo/web-api-server.md) wants HTTP
  precisely because the protocol streams bodies, which would let `add`/`get`
  carry blobs of any size where MCP is capped at 128 KiB of inline content. The
  CAS store already streams (`Cas.read`/`Cas.write` deal in chunk lists), so
  this effect is the only thing in the way.

**The cap is low enough to have cost an adoption.** A demo replacing
`python3 -m http.server` with `fjs web` found eleven of the modules its page
imports over the ceiling — the largest 995,159 bytes, 7.6× the cap, and three
others over 340 KB — and reverted the swap. They are the engine the page
imports, not trimmable assets.

How that failed is the part worth keeping. Every small file answered `200`, so
loading the page as a smoke test passed; what caught it was a UI suite, where
44 of 46 cases failed on empty elements because the large modules never
arrived. A limit enforced per file is invisible to any check that does not
request the files that cross it.

### Proposal

The body is a `List<O, Vec, IoChannel>` on both sides — the shape
[`writeFromStream`](../module.f.mjs) already consumes and `fjs/cas`'s `read`
already produces. Reusing it is most of the design; what is left is one type
change, a pump in each runner, and one question per side that the existing code
does not already answer.

**The two sides are not equally ready, and should not land together.** The
response side is buildable from what is in the tree today. The request side
needs an operation that does not exist yet, so it is staged second and the
runner keeps its `413` until it lands.

#### Stage 1 — the response body

**The type.**

```ts
export type ServerResponse<O extends Operation> = {
    readonly status: number
    readonly headers: Headers
    readonly body: List<O, Vec, IoChannel>
}

export type RequestListener<O extends Operation> =
    (_: IncomingMessage) => Effect<O, ServerResponse<O>, never>
```

`ServerResponse` gains `O` because a lazy body *is* an effect, and the
operations it performs are the listener's own — `fjs/web`'s would be
`ReadBytes`. `CreateServer`'s `RequestListener<Operation>` spelling does not
change, and it is not erasure that keeps it there: the declaration pins
`Operation` because a `Server` must carry no type parameter, so each runner is
handed the widest listener the type says it may be handed and narrows it back
to its own op-set by a cast it already writes — the virtual one to
`_VirtualListener`, the Node one to `Erl<NodeOp>` in `answerRequest`. That
widening is the separate cause
[generic-operation-payload-erasure](./generic-operation-payload-erasure.md)
files beside the `Pr` erasure it is named for, asking whether `CreateServer`
can carry the listener's op-set instead. A `List` body neither raises that
question nor answers it.

The listener's channel stays `never` and the body's is `IoChannel`, and the
difference between them is the whole of the next section. A listener that
cannot answer still has a status code ([`../types.ts`](../types.ts)); a body
that fails *after* the status has gone out has none.

**The producer.** `fjs/cas` has the loop twice already — `read` and
`streamFile` in [`../../../cas/module.f.mjs`](../../../cas/module.f.mjs) are the
same `readBytes`-at-`chunkBytes` fold, ending the stream on an empty read — and
`fjs/web` would be the third caller. That is the point at which it moves into
[`../module.f.mjs`](../module.f.mjs) beside `writeFromStream`, as its mirror,
rather than being written a third time
([DESIGN §4](../../../../doc/DESIGN.md#4-reuse-dry-and-separation-of-concerns)).

That duplication is already filed, as
[66o-read-streamfile-dedup](../../../cas/todo/66o-read-streamfile-dedup.md),
which used to answer it by keeping the loop in `fjs/cas` and pointing `read` at
`streamFile`. A caller outside `fjs/cas` moves the destination, not the answer,
so that issue now defers to this one for where the loop lands and keeps the part
the move does not touch: `read` is pinned to `List<FileCasOperation, …>` by
the `FileCas` interface, so it has to widen a `List<ReadBytes, …>` wherever
the loop lives.

**`Content-Length` stays derivable, and stops being derived from the body.**
`fjs/web` writes it as `length(body) >> 3n` today, which a lazy list cannot
answer without draining. It does not have to: the size is already in hand where
it is needed, since `readBounded` is handed a `FileStat` and the `stat` that
produced it is the one the FIFO guard is there for anyway. A
producer that does not know its size omits the header, and what Node then frames
the response with depends on the request: `Transfer-Encoding: chunked` for one
that will understand it, and the closing connection itself for one that will
not.

**A body cell that fails after the headers are written must destroy the socket,
not end the response.** Measured on Darwin with Node 26.8.1 — the version
[`fjs/ci/config/module.f.mjs`](../../../ci/config/module.f.mjs) pins, with the
22.23.2 it pins beside it agreeing row for row — one 131,072-byte chunk written
of a longer body, then the producer failing:

| framing | `res.end()` | `res.destroy()` |
| --- | --- | --- |
| `Content-Length` declared | 131,072 bytes, then `ECONNRESET` | `ECONNRESET` |
| `Transfer-Encoding: chunked` | a **clean, complete** 131,072-byte response — `res.complete` is `true` and no error is raised | `ECONNRESET` |
| `Connection: close`, no length | a **clean, complete** 131,072-byte response | a **clean, complete** 131,072-byte response |

So Node's own framing check covers the declared-length case and nothing else,
and the case it misses is exactly the one a producer that cannot state its size
lands in: a truncated file the client cannot tell from a whole one, which is the
plausible wrong value [DESIGN §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
exists to refuse. Destroying covers the first two rows. It cannot cover the
third, and the next paragraph is why.

**The third framing has no terminator to withhold.** Node picks chunked only
where the request will understand it: `ServerResponse`'s constructor sets
`useChunkedEncodingByDefault` from the request's version and its `TE` header,
so an HTTP/1.0 request whose response omits `Content-Length` is framed
`Connection: close` with no `Transfer-Encoding` at all, and the EOF *is* the
end-of-body marker. Destroying produces that same EOF. Measured the same way
and against `curl --http1.0`, because Node's own client speaks only 1.1: 131,072
bytes and exit `0` from `res.end()`, and 131,072 bytes and exit `0` from
`res.destroy()` — byte for byte the same response. A `Content-Length` on the
same HTTP/1.0 request restores the check (exit `18`), and so does an HTTP/1.0
request carrying `TE: chunked`, which Node chunks like a 1.1 one.

So the runner refuses that combination rather than answering it: a body with no
`Content-Length`, on a request Node will not chunk, is answered `500` and the
pump never starts. The predicate is Node's own again, as the no-body one is —
`res.useChunkedEncodingByDefault`, which is readable before `writeHead` — rather
than a version test written here, so a request Node would chunk is served and
not refused. `500` rather than `505`: RFC 9110 §15.6.6 names the request's
*major* version, which 1.0 shares with 1.1, and this server does answer HTTP/1.0
perfectly well for a body whose size it knows. It is the pre-headers case
`failSafe` already answers `500` in, reached before rather than after the fact.

Nothing in the tree produces it — `fjs/web` declares the length from the `stat`,
so its bodies are all first-row — which is the reason to state the refusal here
rather than to discover it: the design admits an unsized body, and this is the
request it may not be handed one on. The virtual runner mirrors the refusal for
the reason it mirrors the no-body guard, and that costs its `IncomingMessage`
the field the predicate reads: the type carries `method`, `url`, `headers` and
`body` ([`../types.ts`](../types.ts)) and no version.

**A cell is not the only way a body ends early.** The pump runs inside the
`asyncTryCatch` that [`createServer`](../module.mjs) already wraps the listener
in, so a continuation that *throws* never reaches the policy above — it reaches
[`failSafe`](../module.mjs), whose `headersSent` branch answers with `res.end()`
because until now there was no body left to truncate. Measured the same way, one
131,072-byte chunk written under chunked framing and then a throw: the client
read a **clean, complete** 131,072-byte response, `res.complete` `true` and no
error raised. That is the same lie reached by the other door, so `headersSent`
destroys there too. What `failSafe` keeps is the pre-headers case, where a
status is still available and `500` is the answer.

**And a declared length bounds the reads, rather than being a guess about
them.** The fold above ends on an empty read, so a file that grows between the
`stat` and the reads would stream the new entry past the length already declared
for the old one — and nothing clamps it. Measured on Darwin with Node 23.11.0: a
response declaring 131,072 bytes and writing 1,000 more put all 132,072 of them
on the wire, and the keep-alive client failed `HPE_INVALID_CONSTANT` on the
**in-flight** response, not merely on the next one — the surplus is parsed as
the following status line, so the request being answered is lost along with the
one after it. Node's declared-length check runs one way only: the table above is
the short body, and there is no row for the long one.

Node 23.11.0 is not a version this repository pins, here or in the figures below
it. The pinned set is 26.8.1, 24.19.0 and 22.23.2
([`../../../ci/config/module.f.mjs`](../../../ci/config/module.f.mjs)); the
destroy table above was re-measured on the first and the last of those and
reproduced row for row, and these have not been.

So the size that goes in the header is the bound the reads stop at. `fjs/web`'s
fold stops at `FileStat.size` rather than at EOF, and what ends the reads short
of that bound — an *empty* read — fails the cell: the destroy again, and the one
direction Node would have caught anyway. Short of the **bound**, not short of
the **request**: a chunk smaller than what was asked for is not itself the
failure, and reading it as one would fail every file whose size is not a
multiple of `chunkBytes`. The bound is a parameter of the moved loop, not a
second loop: `fjs/cas` does not know a blob's size, keeps reading to the empty
read, and keeps the chunked framing that goes with it. What the bound holds is
the *framing*, not the *identity* — the bytes are still whatever the reads
found, which under a replaced entry is a new file cut to the old one's length.
That is [stat-then-read](../../../web/todo/stat-then-read.md), unchanged and
already filed: binding the metadata and the reads to one handle is what answers
it, and no length declared from a name can.

**The bound also decides what the loop advances by.** Both `fjs/cas` loops step
`loop(offset + chunkBytes)` whatever the read returned, and that is sound only
because the fold ends at the next empty read: on a local regular file a short
read *is* the last one — measured on Darwin with Node 23.11.0, every mid-file
`readBytes` came back with its full 131,072 bytes, and the only positive short
read that could be forced was a genuine truncation. A bounded fold does not end
there. A short chunk stops being the last chunk, and a fixed step would step
over whatever the read did not return — a hole in a response whose length is
already declared. `readBytes` promises nothing better than that: it is one
`FileHandle.read` ([`../module.mjs`](../module.mjs)), where `writeBytes` a few
lines below loops over short writes for exactly this reason. So the moved loop
asks for `min(chunkBytes, bound - offset)` and advances by the length it got.

**The pump pulls at the socket's pace.** A lazy body removes the memory bound
the `Vec` cap was, and nothing puts one back unless the pump asks the socket
for permission to continue. `res.write` answers `false` once the response's
buffer is full; a pump that reads that answer and pulls anyway is throttled by
the disk rather than by the client, which is fast enough to be no throttle at
all. Measured on Darwin with Node 23.11.0, against a client that opened the
connection, asked, and then read nothing — chunks already in hand, so the
socket was the only thing that could have slowed the writes: the **first**
131,072-byte write already answered `false`, the default high-water mark being
16 KiB, and the remaining 199 went out behind it regardless, leaving all
26,216,371 bytes of a 25 MiB body and its framing resident in the process for
one request. That is the streaming benefit spent in the one place it was meant
to be collected, and one slow client is enough to spend it. So `false` parks
the pull until `drain` — the discipline [`writeAll`](../module.mjs) already
applies to the console streams, for this reason.

**And `drain` is not the only way out of that wait.** Measured the same way
with the pump parked: ten chunks written, 131,081 bytes queued, the client
destroyed at 1,023 ms and `close` on the response at 1,026 ms — and the pump
still parked three seconds later, because `drain` never comes for a socket that
has gone. Waiting on `drain` alone does not throttle a body so much as strand
one, holding its reads open for as long as the process lives. So `close` ends
the pump as surely as `drain` releases it: it stops pulling, and the producer's
reads stop with it. A client that hangs up is the ordinary case — a cancelled
download, a closed tab — not the exceptional one.

**And some responses carry no body, which takes the pace away with it.** Node
drops the body of a `HEAD` response and of a `204`, `304`, or `1xx`, and
`res.write` on one of those does not merely discard the bytes — it answers
`true`. So the socket stops being a brake in exactly the cases where there is
nothing for it to brake. Measured on Darwin with Node 23.11.0 against the same
read-nothing client, 200 writes of 131,072 bytes each: a `GET`/`200` answered
`false` on the **first** of them, while `HEAD`/`200`, `204`, `304` and `199`
answered `true` on **all 200** — 26,214,400 bytes offered, and not one of them
sent. A method-agnostic pump therefore reads a whole multi-gigabyte file at the
speed of the disk to send nothing, and never finishes at all for a producer that
does not end. So the pump does not start where Node will not carry a body. It is
the runner that checks and not the listener, which stays method-agnostic:
`fjs/web` answers `HEAD` exactly like `GET`
([`../../../web/module.f.mjs`](../../../web/module.f.mjs)) and goes on doing so,
now that `Content-Length` comes from the `stat` rather than from the body.

**The set is Node's, not the RFC's.** `205` forbids a body too (RFC 9110
§15.3.6) and Node sends one anyway — measured the same way, `false` on the first
write, exactly like `200`. A guard written from the specification would
suppress a body the host was about to send — the same plausible wrong answer,
produced by the check meant to prevent one. So it is written from the host's own
predicate: `HEAD`, `204`, `304`, `1xx`.

**The virtual runner records what went out.** `listen` in
[`../virtual/module.f.mjs`](../virtual/module.f.mjs) can pump the body with the
same `virtual(s)(...)` recursion it already uses to run the listener, and
`State.responses` holds the materialized result:

```ts
export type RecordedResponse = {
    readonly status: number
    readonly headers: Headers
    readonly body: readonly Vec[]
    /** What ended the body early, or `null` for one that ran to its end. */
    readonly failure: Nullable<IoChannel>
}
```

`readonly Vec[]` is the shape a `Dir` already stores a file in
([`../virtual/types.ts`](../virtual/types.ts), `_Entity`), so a fixture and a
recorded response read alike — the oversized fixture `fjs/web`'s proof already
builds for its `413` case becomes the one a streamed-body proof asserts against.
`failure` is the socket case's counterpart: a proof asserting a whole body has to
be able to tell it from one that stopped, and a bare chunk array cannot.

**And `listen` mirrors the no-body predicate**, recording the skip rather than
hiding it: a response the pump never pulled holds an empty `body` and a `null`
`failure` — nothing went out, and nothing went wrong — which is exactly what a
`HEAD` or a `204` is. A virtual runner that pumped where the Node one does not
would let a listener with a nonterminating body pass here and hang there.

**`fjs/web` then loses its `413` rather than raising it.** `tooLarge` goes, with
the row documenting it in the module's response table — that table is what a
consumer reads before adopting the server. The `isFile` guard stays: it was
never about size. `open` on a FIFO with no writer blocks forever and holds a
thread-pool slot, and a FIFO stats as zero bytes, so no bound can stand in for
the check.

#### Stage 2 — the request body

Nothing in the tree pulls one chunk of a request. `readBytes` is
`(path, offset, size)` and a socket has no path;
`Read` ([`../../common/types.ts`](../../common/types.ts)) names a console
stream. So this side needs a new operation over a request-scoped handle — a
`Nominal`, as `Server` is — and that is why it is staged rather than settled
here.

It carries the two questions this issue opened with:

- **A listener that never reads its body.** The runner must drain the rest or
  destroy the connection, and [`answerRequest`](../module.mjs) already argues
  the choice for its own `413`: draining reads bytes the server has already
  decided not to use, so it destroys. A listener that answers early is the same
  shape, and should get the same answer.
- **A second pull on an exhausted body**, which a `List` makes expressible and a
  socket cannot serve twice.

Until this lands `IncomingMessage.body` stays one `Vec` and the runner keeps
refusing a larger request with `413` — a limit enforced where it is crossed,
which is what [DESIGN §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
asks of one.

**It also settles which status an oversized body earns**, a question
[#1819](https://github.com/functionalscript/functionalscript/issues/1819) raises
and this design does not have to answer twice. `413` says the *request* was too
large: wrong for a file the server cannot frame, right for a request the server
will not read. After stage 1 the only `413` left is the runner's, where the
subject really is the request; stage 2 retires that one too, and what is left
answering `413` is a listener with a size policy of its own — correctly.

### Tasks

- [ ] Move `fjs/cas`'s `readBytes` chunk loop into `../module.f.mjs` beside
      `writeFromStream`, with its byte bound, its advance by the actual chunk
      length, and proof coverage, and read `cas` through it.
- [ ] Stage 1: `ServerResponse<O>` with a `List` body; the Node runner's
      pump — its `drain`/`close` discipline, the no-body guard and the
      unframable-body refusal that keep it from starting, and its
      destroy-on-failure in both the cell and `failSafe`; the virtual runner's
      `RecordedResponse`, mirroring both guards.
- [ ] Stage 1: serve files past the cap in `fjs/web` — `Content-Length` from the
      `stat` size and the reads bounded by it, `tooLarge` and its `413` row
      deleted, the `isFile` guard kept.
- [ ] Stage 2: name the operation that pulls one request-body chunk, and answer
      what an undrained body does.
- [ ] Stage 2: `IncomingMessage.body` as a `List`, retiring the runner's `413`.

A body that stalls under the cap is a third consequence, filed separately as
[request-body-timeouts](./request-body-timeouts.md): the listener cannot answer
until a body it may not even want has finished arriving.

### Related

- [`fjs/web`](../../../web/README.md) — the size limit section states the cap
  this issue lifts.
- [`fjs/cas` web-api-server](../../../cas/todo/web-api-server.md) — blocked on
  this for arbitrary-size `add`/`get`.
- `fjs/effects/node/module.f.mjs` — `writeFromStream`, the chunk-list shape a
  streamed body should follow.
- [`fjs/effects/list`](../../list/types.ts) — `List`, and why a failure belongs
  to the cell rather than to the item it would otherwise be carried beside.
- [GitHub issue #1819](https://github.com/functionalscript/functionalscript/issues/1819)
  — the report the Problem section's numbers come from.
