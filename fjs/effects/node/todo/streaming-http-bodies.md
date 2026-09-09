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

**`Content-Length` stays derivable, and stops being derived from the body.**
`fjs/web` writes it as `length(body) >> 3n` today, which a lazy list cannot
answer without draining. It does not have to: the size is already in hand where
it is needed, since `readBounded` is handed a `FileStat` and the `stat` that
produced it is the one the FIFO guard is there for anyway. A producer that does
not know its size omits the header and Node frames the response
`Transfer-Encoding: chunked`.

**A body cell that fails after the headers are written must destroy the socket,
not end the response.** Measured on Darwin with Node 23.11.0 — one
131,072-byte chunk written, then the producer failing:

| framing | `res.end()` | `res.destroy()` |
| --- | --- | --- |
| `Content-Length` declared | 131,072 bytes, then `ECONNRESET` | `ECONNRESET` |
| `Transfer-Encoding: chunked` | a **clean, complete** 131,072-byte response — `res.complete` is `true` and no error is raised | `ECONNRESET` |

So Node's own framing check covers the declared-length case and nothing else,
and the case it misses is exactly the one a producer that cannot state its size
lands in: a truncated file the client cannot tell from a whole one, which is the
plausible wrong value [DESIGN §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
exists to refuse. Destroying covers both framings.
[`failSafe`](../module.mjs) keeps the pre-headers case, where a status is still
available and `500` is the answer.

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

So the size that goes in the header is the bound the reads stop at. `fjs/web`'s
fold stops at `FileStat.size` rather than at EOF, and a read that comes up short
of that bound fails the cell — the destroy again, and the one direction Node
would have caught anyway. The bound is a parameter of the moved loop, not a
second loop: `fjs/cas` does not know a blob's size, keeps reading to the empty
read, and keeps the chunked framing that goes with it. What the bound holds is
the *framing*, not the *identity* — the bytes are still whatever the reads
found, which under a replaced entry is a new file cut to the old one's length.
That is [stat-then-read](../../../web/todo/stat-then-read.md), unchanged and
already filed: binding the metadata and the reads to one handle is what answers
it, and no length declared from a name can.

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
      `writeFromStream`, with its byte bound and proof coverage, and read `cas`
      through it.
- [ ] Stage 1: `ServerResponse<O>` with a `List` body; the Node runner's pump
      and its destroy-on-failure; the virtual runner's `RecordedResponse`.
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
