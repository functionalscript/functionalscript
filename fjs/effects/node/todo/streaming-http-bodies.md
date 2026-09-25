## streaming-http-bodies. Streaming HTTP request and response bodies

**Priority:** P3
**Status:** open

### Problem

`IncomingMessage.body` (`fjs/effects/node/types.ts`) is a single `Vec`, and a
`Vec` caps at 131,072 bytes (128 KiB). The whole body is therefore materialized
before a listener sees it: the Node runner buffers the request, bounded at the
cap.

The runner refuses what it cannot represent — a request body past the cap is
answered `413` without the listener seeing it — so the limit is at least honest,
but it is still a limit no HTTP client expects.

**`ServerResponse.body` was one `Vec` too, and is now a lazy `List` the runner
pulls at the socket's pace.** The response half of stage 1 landed in two steps:
the eager route made the body a chunk list, which lifted the cap and left the
whole file in memory, and the handle-effect route made it lazy, which is what
took the footprint down to one chunk. The sections below are written for that
second route and describe what shipped; "The eager route, as landed" records what
the first one did with each of them, and is kept because it remains an
alternative — one open and no laziness — rather than a step that was undone.

One consumer is still bounded by this:

- [`fjs/cas` web-api-server](../../../cas/todo/web-api-server.md) wants HTTP
  precisely because the protocol streams bodies, which would let `add`/`get`
  carry blobs of any size where MCP is capped at 128 KiB of inline content. The
  CAS store already streams (`Cas.read`/`Cas.write` deal in chunk lists), so
  this effect is the only thing in the way. Its `add` needs the **request** half,
  which is stage 2; its `get` has what it needs.

[`fjs/web`](../../../web/) is no longer one of them. It serves a file of any size
with the bytes held bounded by one chunk of it, reading through an open file it
gives back when the response ends however it ends.

**The cap was low enough to have cost an adoption**, which is the report this
issue opened with. A demo replacing
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

**The two sides are not equally ready, and did not land together.** The
response side was buildable from what was in the tree, except for the one part of
it that serves a *named* file: reading a body in chunks resolves that name once
per chunk, which is a race the whole-file read does not have. So `fjs/web` reads
its body through the handle effect — `open`, `fstat`, a bounded read, `close`,
which stage 1 added to `Fs` and the virtual file system models with its open
handles in `State` — and the reason is "What the bound holds" below. The request
side needs an operation that does not exist yet, so it is staged second and the
runner keeps its `413` until it lands.

**2026-09-22 — that blocker has an answer the paragraph above predates, and it
is a trade rather than a removal.** [`ReadWhole`](../types.ts) was added on
2026-09-14 (`11e3533f`), after this section was written. It answers a list of
`Vec`s from **one `open`**, so the chunks it produces are one file's and the
per-chunk splice the paragraph above describes cannot happen — and it is
implemented in both runners and read through `readWholeBytes` by `fjs/git`'s
[`packstore`](../../../git/packstore/module.f.mjs) and
[`refstore`](../../../git/refstore/module.f.mjs), so it is a proven operation
and not a sketch. Its own docstring states the property this
section needs: *"The chunks are one open's, which is why this is not a fold
over `readBytes`. That operation resolves the path per call, so reading a file
in windows can straddle two files."*

What it costs is laziness, and with it a length declared before the read: the
operation takes no bound and reads to the end rather than to the `stat` size, so
a `Content-Length` on this route is summed from the chunks it answered instead of
declared ahead of them. The three routes to a body are distinct and none
dominates:

| | one inode | lazy |
|---|---|---|
| [`readChunks`](../module.f.mjs) over [`readBytes`](../module.mjs) | no — that operation opens the path once per chunk | yes |
| [`readWhole`](../module.mjs) | yes — one `open`, chunked to EOF | no, the whole file is materialized |
| the handle effect (`open`, `fstat`, `pread`, `close`) | yes | yes |

So **the wait was stated too strongly: serving a large file does not depend on
another issue.** `ReadWhole` needed nothing from the handle effect — what it still
needed was a chunk-list body, because `ServerResponse.body`
([`../types.ts`](../types.ts)) was one `Vec` and that was the cap itself. It has
one now, and serving past the cap through `ReadWhole` costs peak memory equal to
the file, which for the case that prompted this — a static server for a
development demo — is what `readFile` already cost, and the cap is what
`readFile` could not do. The handle effect was still the only route that is both
one inode and lazy, which is why it was built.

**Stage 1 below is written for the handle effect, which is the route `fjs/web`
takes, and the eager route is recorded here rather than carried into it.** Every
section after this one speaks for that route: the `Content-Length` read from the
`fstat`, the no-body gate whose point is the read it saves, the handle `release`
gives back. The eager route answers each of them differently — the header is the
summed length of chunks already in hand, a `HEAD` has materialized the file before
the gate is reached, and there is no handle to return — so it is recorded as the
alternative it is. What that note changed was what the handle effect was owed for:
not whether a large body is possible, only what it costs.

**The eager route costs more than the memory, and the operation says why.**
[`readWhole`](../module.mjs) rebuilds its chunk list on every window rather than
appending, and its own comment gives the assumption that makes that free: *"a
file is however many `Vec`s it takes and the count is small — 128 KiB a chunk, so
eighty of them for ten megabytes."* Lifting a *web* cap is what breaks that
assumption, because it is what makes an arbitrary size reachable from a request:
a body of gigabytes is tens of thousands of windows, the rebuild is quadratic in
that count, and all of it is spent before the first byte reaches the socket. So
the eager route needed a linear collection in the operation before it was enough
for an arbitrary size.

**That was recorded here as its own change, and it turned out to belong to the
same one.** The premise it rested on — that the chunk count is the operation's,
small, and `fjs/git`'s to keep small — expires the moment `fjs/web` reads a
requested file through it: the count becomes the caller's, exactly as a request
body's chunk count already is for `collectBounded` beside it. So the eager route
landed with the accumulator mutated and `collectBounded`'s own comment cited as
the precedent it follows, rather than leaving a quadratic collection behind a cap
it had just removed. What was left to the handle effect was the memory, not the
copying, and that is what it took.

**One thing `ReadWhole` does not fix, stated so this is not read as more than
it is.** [`readWhole`](../module.mjs) `stat`s the path and then opens it, two
operations on a name, so its own `isFile` guard carries a window of its own. It
says so itself, in the comment above the operation: *"That leaves a window between
the `stat` and the `open` in which the path could become one, which is the host's
own race and not one this operation creates; what it removes is the race between
reads."* That race is narrower than the one this section cited — a wrong guard
outcome in a vanishing window, not two files spliced into one correctly-sized
body — but it is the same shape. `fjs/web` no longer has it: the handle effect
asks the *descriptor* what it holds, and `Open` does not wait for a writer, which
is what makes that order possible at all. `readWhole` keeps it, and `fjs/git`'s
`packstore` and `refstore` are its callers now.

This section is corrected rather than worked around, per
[DESIGN.md](../../../../doc/DESIGN.md) §3 ("Design before implementation"), and separately from any implementation
for the same reason.

#### The eager route, as landed

The note above names four sections the eager route has to be taken through
rather than around — framing, the no-body gate, `release`, and the
[`fjs/web`](../../../web/README.md) corrections. This is that pass, kept here so
that the handle-effect sections below go on speaking for the route they describe.
**It is written in the past tense from here on**, because it is not what
[`fjs/web`](../../../web/module.f.mjs) does: that reads through an open file. What
the eager route was is `ServerResponse.body` as `readonly Vec[]` — the shape
[`ReadWhole`](../types.ts) answers and the shape a `Dir` already stores a file in
([`../virtual/types.ts`](../virtual/types.ts), `_Entity`) — with the body read
through `readWhole`. `readWhole` itself stays: `fjs/git`'s `packstore` and
`refstore` read through it, and a caller that wants one file's bytes in hand and
does not care what they cost still has it.

**Framing was the sum of the chunks, and the problem "What the bound holds"
measures did not arise on that route.** That section's case is a length declared
ahead of an unbounded read: 131,072 bytes promised from a `stat` and 132,072 sent
by a file that grew, under a header nothing can check. A sum over chunks already
in hand cannot overrun, because there is nothing left to read that could disagree
with it — the count and the bytes are the same measurement taken once. The
`fstat`-declared, read-bounded framing the sections below describe is what a
*lazy* body needs instead, and it needs it for the reason those sections give: a
lazy body has no length to sum. `response` in
[`../../../web/module.f.mjs`](../../../web/module.f.mjs) says so where the header
is built.

**The no-body gate had nothing to hold.** Its whole point is the read it saves —
a `HEAD` or a `304` whose producer is never pulled, so a multi-gigabyte file is
not read at the speed of the disk to send nothing. On that route the file was read
before the listener had a status to return, so there was no pull left to suppress
and a gate would have saved nothing: the runner wrote every chunk whatever the
method was, and Node dropped the body of a `HEAD`, a `204`, a `304` or a `1xx`
itself. The gate exists now, so the runner declines before Node is offered a byte,
and [`../proof.mjs`](../proof.mjs) pins that against the host
(`createServer.suppressesABodyNodeWillNotCarry`) where it used to pin Node's own
dropping. [`fjs/web`](../../../web/module.f.mjs) answers a `HEAD` exactly like a
`GET` either way — which party drops the body is the runner's business, not the
listener's.

**`release` had nothing to hold either, and so was not a field.** `readWhole`
opens and closes inside the one operation, exactly as `readFile` and `readBytes`
do, so no response carried a descriptor that outlived it and there was nothing for
a runner to give back on any of the exits the sections below enumerate. A required
field that every listener writes as the pure end would have been a field that
records no obligation. It arrived with the handle effect, which is what creates the
obligation — and `fjs/cas`, which holds nothing, writes the pure end.

**And the README was corrected with the code**, which is the one task of the four
that is the same task on either route: its `413` row, its size-limit section, and
its `Content-Length` paragraph. Of that paragraph's two claims, the first was
replaced — the length was summed over the chunks that were read rather than
"computed from the body it carries" — and the second was *kept and measured*: Node
was still the party that dropped a `HEAD` body, because that route added no gate in
front of it. Both have moved again with the lazy route: the length comes from the
`fstat`, and the runner is the party that declines to pull.

**What that route did not give is a bounded memory footprint**, and that is the
whole of what the handle effect was owed for. Peak memory was the file, per
request in flight, so a server pointed at large files traded a cap it could
report for an appetite it cannot. Nor did the runner read `res.write`'s answer:
`false` names a full buffer, and pausing on it would have throttled nothing, since
the bytes it would wait to send were already spent. A pump that pulls at the
socket's pace is the sections below, and it is the answer to both.

#### Stage 1 — the response body

**The type.**

```ts
export type ServerResponse<O extends Operation> = {
    readonly status: number
    readonly headers: Headers
    readonly body: List<O, Vec, IoChannel>
    /** Whatever the body held, given back — see "nobody closes" below. */
    readonly release: Effect<O, null, never>
}

export type RequestListener<O extends Operation> =
    (_: IncomingMessage) => Effect<O, ServerResponse<O>, never>
```

`ServerResponse` gains `O` because a lazy body *is* an effect, and the
operations it performs are the listener's own — `fjs/web`'s would be a bounded
read from one `open`, and not `ReadBytes`, which takes a path and so resolves the
name again on every chunk, for the reason "What the bound holds" below gives. It
gains `release` because a lazy body may also *hold* something,
and the runner is the only party present at every way one ends.
`CreateServer`'s `RequestListener<Operation>` spelling does not change, and it
is not erasure that keeps it there: the declaration pins
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

That duplication was filed as `66o-read-streamfile-dedup`, which answered it by
keeping the loop in `fjs/cas` and pointing `read` at `streamFile`. A caller
outside `fjs/cas` moved the destination, so the loop landed here instead and
that issue is retired with this task. The question it held open — whether
`read`, pinned to `List<FileCasOperation, …>` by the `FileCas` interface, could
take a loop written elsewhere without a cast — is answered: it can. Ordinary
`Effect` widening carries `List<ReadBytes, …>` into it, no cast needed.

**`Content-Length` stays derivable, and stops being derived from the body.**
`fjs/web` writes it as `length(body) >> 3n` today, which a lazy list cannot
answer without draining. It does not have to: the size is already in hand where
it is needed, since `readBounded` is handed a `FileStat` and the `stat` that
produced it is the one the FIFO guard is there for anyway — an `fstat` on the
held handle, once the reads go through one. A producer that does not know its
size omits the header, and what Node then frames the response with depends on
the request: `Transfer-Encoding: chunked` for one
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

So a declared length is the only framing that carries a check at all — the
client counting the bytes the header promised it — and the case it misses is
exactly the one a producer that cannot state its size lands in: a truncated
file the client cannot tell from a whole one, which is the
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
A response Node will carry no body for is not this case at all, and the order
the pre-pump guards are asked in — stated with the no-body one below — is what
says so.

**That predicate is Node's own only while the listener leaves the framing to
Node.** `ServerResponse.headers` can carry a `Transfer-Encoding`, and Node takes
the header over the default. Measured on Darwin with Node 26.8.1 and reproduced
row for row on 22.23.2, one 131,072-byte chunk written of a longer body and then
the producer failing, `curl` speaking the request's own version:

| response headers | request | `useChunkedEncodingByDefault` | on the wire | `curl` |
| --- | --- | --- | --- | --- |
| none | 1.1 | `true` | chunked | exit `18` |
| `transfer-encoding: identity` | 1.1 | `true` | close-delimited | exit **`0`**, 131,072 bytes |
| none | 1.0 | `false` | close-delimited | exit `0`, 131,072 bytes |
| `transfer-encoding: chunked` | 1.0 | `false` | chunked | exit `18` |
| `content-length: 262144` | 1.0 and 1.1 | either | length-delimited | exit `18` |

The flag is wrong in both directions. An `identity` on an HTTP/1.1 request
leaves it `true` over a close-delimited response — the truncated body handed
over as a whole one, which is the answer this refusal exists to prevent, reached
past the guard against it. A `chunked` on an HTTP/1.0 request leaves it `false`
over a response Node chunks, which the refusal would turn away. The value that
is right in every row is `res.chunkedEncoding`, and `writeHead` is what sets it:
after that call `headersSent` is `true` and there is no `500` left to send.
(`writeHead` alone puts nothing on the wire — measured, a `writeHead` and then a
`destroy` leaves the client an empty reply rather than a status — so reading the
right value late does not buy a late refusal either.)

**So the listener does not write `Transfer-Encoding`, and a response whose
headers name one is refused `500` before them.** Framing is between the runner
and the socket. What a listener writes is a description of its body,
`Content-Length` included — that is the `fstat` size, not a statement about
delimiters — and Node frames it from there. Interpreting a listener's
`Transfer-Encoding` instead would mean restating Node's rule for what counts as
chunked, and that rule is a regexp over the header value: measured the same way,
`x-chunked` and `chunked, gzip` both make Node chunk the body, and a client
de-chunks neither, so the restatement would be wrong in the cases it was written
for. Refusing the header takes that whole class of disagreement out of the
design and leaves `res.useChunkedEncodingByDefault` and the listener's
`Content-Length` as the whole of Node's framing decision, which is what makes
the refusal above exact rather than nearly right.

Nothing in the tree produces either refusal — `fjs/web` declares its length from
the `stat` and writes no `Transfer-Encoding` — which is the reason to state them
here rather than to discover them: the design admits an unsized body, and these
are the responses it may not answer one with. The virtual runner mirrors both
for the reason it mirrors the no-body guard. The header one costs it nothing,
being a header it already records; the length one costs its `IncomingMessage` a
field, since the type carries `method`, `url`, `headers` and `body`
([`../types.ts`](../types.ts)) and nothing about framing.

**That field is the answer, not the evidence for it.**

```ts
export type IncomingMessage = {
    readonly method: string
    readonly url: string
    readonly headers: Headers
    readonly body: Vec
    /**
     * Whether a body with no `Content-Length` is framed
     * `Transfer-Encoding: chunked` for this request — the host's own answer,
     * on the request because only the host computes it.
     */
    readonly chunkedResponse: boolean
}
```

The Node runner fills it from the `res.useChunkedEncodingByDefault` that
[`answerRequest`](../module.mjs) already has in hand, so gate 3 reads one field
in both runners and neither derives it; a fixture states it as it states the
method, and `State.requests`
([`../virtual/types.ts`](../virtual/types.ts)) records it with the rest. The
alternatives are a version — `httpVersion`, or a major/minor pair — and they
put a second implementation of Node's rule in the tree, because the version is
only half of what sets the flag. Node's `ServerResponse` constructor takes the
other half from the request's `TE`, through `chunkExpression`: the same regexp
over a header value the paragraph above declines to restate for
`Transfer-Encoding`, and a `.f.mjs` may not write one at all
([AGENTS.md §3](../../../../AGENTS.md#3-functionalscript-and-typescript-fjs)).
Measured over raw request lines on Darwin with Node 26.8.1 and reproduced row
for row on 22.23.2: HTTP/1.1 is `true` whatever its `TE` says, and HTTP/1.0 is
`true` for `chunked`, `CHUNKED`, `gzip, chunked` and `trailers, chunked`,
`false` for an absent `TE`, an empty one, `gzip` and `chunkedx` — and `true`
for **`x-chunked`**, which no reading of the protocol makes chunked. A restated
scan would have to reproduce that on purpose to keep the two runners agreeing.
So the field is a boolean, and its name says which direction it frames: a
*request* body may be chunked too, and this is not that. A listener may read it
and learns only what the runner has already decided — what it may not do is act
on it, which is gate 1.

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
for the old one — and nothing clamps it. Measured on Darwin with Node 26.8.1 and
reproduced figure for figure on 22.23.2: a response declaring 131,072 bytes and
writing 1,000 more put all 132,072 of them on the wire, `res.write` answered
`false` for the surplus exactly as it had for the chunk before it — the
high-water mark, not a refusal — and `res.end()` raised nothing. The keep-alive
client failed `HPE_INVALID_CONSTANT` on the **in-flight** response, not merely
on the next one: the surplus is parsed as the following status line, so the
request being answered is lost along with the one after it. That
declared-length check runs one way only. The table above is the short body;
there is no row for the long one, and no event to put in it.

Node 23.11.0 is not a version this repository pins. The pinned set is 26.8.1,
24.19.0 and 22.23.2
([`../../../ci/config/module.f.mjs`](../../../ci/config/module.f.mjs)); the
destroy table above and the overrun figures just given were measured on the
first and the last of those and reproduced row for row. Three figures below are
23.11.0's alone and say so where they appear: the short-read one, the
backpressure one, and the no-body table.

So on the held-handle route the size that goes in the header is the bound the
reads stop at. `fjs/web`'s fold stops at `FileStat.size` rather than at EOF, and
what ends the reads short of that bound — an *empty* read — fails the cell: the
destroy again, and the one direction Node would have caught anyway. Short of the
**bound**, not short of
the **request**: a chunk smaller than what was asked for is not itself the
failure, and reading it as one would fail every file whose size is not a
multiple of `chunkBytes`. The bound is a parameter of the moved loop, not a
second loop: `fjs/cas` does not know a blob's size, keeps reading to the empty
read, and keeps the chunked framing that goes with it.

The eager alternative has no bound to stop at, so it forbids the overrun by
having nothing declared ahead of the read to run past; that is the note above's,
not this section's.

**And the runner counts, because that bound is one producer's discipline and
`ServerResponse<O>` is everyone's.** `fjs/web` can be trusted to stop at
`FileStat.size` because `fjs/web` writes both the header and the fold. Nothing
in the type ties them together, and no other listener is under that discipline:
a `Content-Length` smaller than what the lazy body goes on to produce is
ordinary code, not an abuse, and what it buys is the measurement above — one
response's surplus eating the next one's status line, so the request being
answered is lost and the one behind it with it. That is the plausible wrong
value [DESIGN §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
refuses, produced by a listener the design invites. So the pump keeps a byte
count against the declared length, and a chunk that would carry the count past
it is a failed cell: none of that chunk is written, and the socket is destroyed.
That leaves the body **short** of what was declared, over a socket no client
can read a whole body from — the first row of the destroy table, `ECONNRESET` —
so the client is told rather than misled. Writing the chunk's first
`bound − written` bytes and ending cleanly is the other choice and the wrong
one: a body exactly as long as it promised is a body every client reads as
whole.

**And the same count answers the other end, which Node does not.** A list that
simply stops is the mirror of the chunk that overshoots, and just as ordinary: a
listener declaring ten bytes and producing five is writing plain code, not
abusing anything. `fjs/web`'s bounded fold catches its own version of it — a
file that *shrank* between the `fstat` and the reads ends on the empty read the
bound fails the cell for — but that is again one producer's discipline, and
`ServerResponse<O>` is everyone's. Measured on Darwin with Node 26.8.1 and
reproduced on 22.23.2, byte for byte and on the same timeout: a response
declaring 131,072 bytes, 65,536 written, then `res.end()`. Nothing on the server
side notices. `res.end()` raises nothing, no `error` reaches the response or its
socket, `writableFinished` is `true`, and the socket goes back into the
keep-alive pool. What tells the client is the connection ending, and for a
keep-alive request that is the server's idle timeout — `curl` exit `18` and
Node's own agent `ECONNRESET` after 65,536 bytes, both six seconds in, against
1 ms for the same response on a `Connection: close` request.

**And the wait is the mild half of it.** The server goes on answering a
connection whose framing is already wrong. Two pipelined requests came back as
131,342 bytes, the second status line at offset 65,671 — well inside body 1's
declared window, which runs 135 to 131,207 — so a client reading that body to
the 131,072 bytes it was promised takes response 2's status line, its headers
and all but the last 135 of its body as the tail of the first one. Those 135 are
what it then tries to read a status line from: replayed to Node's own parser,
the stream failed `HPE_INVALID_CONSTANT` and both responses were lost. That is
the overrun's corruption reached from the other side. So the count is compared
at the far end too, and a body that ends before the length it declared destroys
the socket exactly as one that would run past it does: the same number, the same
exit, and the `ECONNRESET` at once rather than at the idle timeout.

**A body the runner never pulled is not a short one.** Gate 2 suppresses before
the pump starts, so the count never begins — and a `HEAD`, `204` or `304`
declaring the length of the body Node will not send is a complete answer, not a
truncated one. Measured the same way: `curl` exit `0`, and Node's agent reads
`complete: true` both on that response and on the next request over the same
connection. `fjs/web` answers `HEAD` exactly like `GET` and takes its
`Content-Length` from the `fstat`, so this is the common case and not a corner
of one. A body with no declared length has nothing to fall short of, and a pump
ended by a recorded `close` is the client's own departure, over a socket that is
already gone.

**No type takes that count's place.** The alternative would be an API in which a
declared size and a body cannot disagree, and a lazy body has no length for one
to be checked against — finding out costs draining it, which is the thing
streaming exists not to do. Lifting `Content-Length` out of `Headers` into a
field of its own would sharpen what the runner *reads*, a `StringMap<string>`
being free to say `Content-Length: none` or to say it twice in two spellings;
it would not make the stream agree with the number, so it is not this issue's
answer and the header stays where it is. What both that count and gate 1 need
from `Headers` is the same thing, and it is worth saying once: a header name is
matched the way Node matches one, case-insensitively.

**What the bound holds is the framing, and the identity it does not hold is a
wider one than this document claimed.** It said the residual risk was the
`stat`-then-read race "unchanged and already filed" — a replaced entry read whole,
cut to the old one's length. That was wrong, and the two operations are why. `readFile` resolves the name **once** and
reads the whole body through what that resolution opened
([`../module.mjs`](../module.mjs), `readFile`), so today's body is always one
file's bytes, and `fjs/web` even takes its `Content-Length` from that body
rather than from the `stat` — a substitution under the current code is a
different file answered *coherently*. `readBytes` opens, reads one chunk and
closes ([`../module.mjs`](../module.mjs), `readBytes`), so a loop over it
resolves the name once **per chunk**. The loop does not inherit the race; it
multiplies it by the number of chunks.

And what comes out the other end is new in kind. Measured on Darwin with Node
26.8.1, a 524,288-byte file replaced by a same-sized one after the first pull:
the bounded loop returned all 524,288 bytes — exactly the `Content-Length`
already declared — as 131,072 bytes of the first file followed by 393,216 of the
second. The same replacement issued 5 ms into a 169 ms `readFile` of a 512 MiB
file returned the first file entire. So the response stops being a substitution
and becomes a **splice**: a body that never existed as any file, arriving under
a correct length, a clean end, and nothing for a client to check it against.
That is not a wrong status in a vanishing window, which is what a `stat`-then-read
guard costs and what made it deferrable; it is the plausible wrong value
[DESIGN §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) refuses,
and [AGENTS.md §5](../../../../AGENTS.md#5-pull-requests-and-releases) does not
let a design defer one behind a `todo/`.

**So `fjs/web`'s reads come from one `open` rather than from a name resolved
again per chunk.** The handle effect — `open`, `fstat`, a bounded read, `close` —
binds every chunk of one response to one inode and keeps the body lazy;
`readWhole` binds them as well and spends the laziness to do it, which is the
alternative the 2026-09-22 note above records. What cannot bind them is a
length declared from a name, and neither can re-`stat`ing afterwards, since a
`FileStat` carries `size`, `isFile` and `isDirectory` and no identity to
compare. The shared loop therefore takes its chunk source as a parameter rather
than a path, which lets the two callers differ rather than forcing one to wait
for the other: `fjs/cas` keeps reading by name, because a name in the store is
its content's hash — an entry is published under it by `rename` and can only
ever be republished with the same bytes — so whichever inode a per-chunk open
lands on holds what the last one held, and an entry that is *gone* fails the
cell rather than splicing. `fjs/web` has no such guarantee about a served tree,
which is the whole difference.

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

**And it can arrive before there is a pump to end.** The pump is the last thing
a request does, and `fjs/web`'s listener opens a handle and `fstat`s it before
it has a status to return, so the same cancelled download arriving a few
milliseconds earlier closes the response while nothing is watching. Measured on
Darwin with Node 26.8.1 and reproduced on 22.23.2 — the client destroyed 111 ms
in, the listener returning at 300 — `close` fired at 112 ms, and by the time the
listener was done `res.closed` and `res.destroyed` were both `true`. From there
`writeHead` raised nothing and set `headersSent`; the first `res.write` answered
`false` like any full buffer; and the wait prescribed above never ended, because
`drain` does not come for a socket that has gone and `close` does not come
twice. Still parked when the watchdog fired two seconds later, with no `error`
event on the response either. Nothing ends that pump, so nothing runs `release`,
and the handle it holds is held for the life of the process — the leak the
`release` section below exists to prevent, reached by the one door that section
does not name.

**So closure is a value the runner records, not an edge the pump listens for.**
[`answerRequest`](../module.mjs) is handed `res` before it calls the listener,
which is early enough: it observes `close` once, there, and what the pump reads
afterwards is the record. Two things follow. A response already closed when the
listener returns is not answered at all — no `writeHead`, no gates, no pull,
`release` and done — because a status written to a client that has gone is a
`writeHead` that silently sets `headersSent` on a destroyed socket, and
`headersSent` is the flag `failSafe` reads to decide a status is no longer
available. And the park is a race between `drain` and that record rather than
between `drain` and a second `close`, so a closure that already happened wins it
at once instead of never arriving. Measured the same way against a pump built
like that: `release` ran at 309 ms, the moment the listener returned, where the
wait as prescribed ran it never. The mid-park case — the client leaving at 602
ms with the pump already parked — released at 602 ms, which is what the edge
listener already did for it; the record is what makes the two cases one case,
not a second policy beside it.

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
now that `Content-Length` comes from the `stat` rather than from the body. What
that costs is the handle the listener opened for a body the runner then drops,
and the `release` below is who gives it back.

**The set is Node's, not the RFC's.** `205` forbids a body too (RFC 9110
§15.3.6) and Node sends one anyway — measured the same way, `false` on the first
write, exactly like `200`. A guard written from the specification would
suppress a body the host was about to send — the same plausible wrong answer,
produced by the check meant to prevent one. So it is written from the host's own
predicate: `HEAD`, `204`, `304`, `1xx`.

**Three gates stand before the pump, so the order they are asked in is part of
the design.** They overlap: a `HEAD` on an HTTP/1.0 request, answered with a
body whose size the listener does not know, satisfies two of them at once. A
runner asks them in this order and answers with the first that fires.

1. **Did the listener write a `Transfer-Encoding`?** `500`, before the headers.
   The response is one the listener had no business framing, whatever body this
   particular request would have carried.
2. **Will Node carry a body at all?** `HEAD`, `204`, `304`, `1xx` — the producer
   is never pulled, and the listener's status and headers go out as they stand.
3. **Can the body that will go out be framed?** No `Content-Length` on a request
   whose `chunkedResponse` is `false` — `500`, before the headers.
4. None of them fires, and the pump runs.

The framing header first, because it is the response being malformed rather than
this body being undeliverable; suppression before the length refusal, because
that refusal exists to stop a truncated body from passing for a whole one and a
body Node drops is never on the wire to be truncated. A `HEAD` or a `304` is a
complete answer whatever framing the body it does not carry would have had, so
the other order answers `500` to a request this server can satisfy exactly —
refusing what it *can* handle, which is not what
[DESIGN §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) asks
for. Both runners take the gates in this order, or they disagree about a request
neither of them has any trouble with.

**A handle the pump never finishes reading is a handle nobody closes.** Every
exit above stops short of the far end of the body, and the far end is where a
`close` cell would be: a response closed before the pump starts is never
answered, the gates refuse or suppress before the first pull, a recorded `close`
ends the pump at whichever cell the client hung up on, a chunk past the declared
length destroys, a failed cell destroys, and `failSafe` destroys. Only a
response that runs to its end reaches the cleanup, which is the one case nobody
was worried about. The
handle is open by then in any case — `fjs/web` opens it before it has a status
to return, since the `fstat` on it is where the `Content-Length` comes from —
so a `HEAD`, whose producer is never pulled at all, leaks one descriptor per
request, and so does every cancelled download. Today's `readFile` and
`readBytes` both open and close inside the one operation
([`../module.mjs`](../module.mjs)), so neither costs anything now; a held handle
turns both into leaks, and a leak per request is descriptor exhaustion rather
than something to file and get to later
([AGENTS.md §5](../../../../AGENTS.md#5-pull-requests-and-releases) on
regressions). Whether the `isFile` guard could be that same `fstat`, when the `open` it follows
is the thing that guard exists to prevent on a FIFO, was the question the handle
effect had to answer before `fjs/web` could read through one — and the answer is
the flag. `Open` does not wait for a writer: measured on Darwin with Node 26.8.1,
a plain read-only open of a writerless FIFO never returned and left the process
unable to exit at all, while `O_RDONLY | O_NONBLOCK` answered at once and the
`fstat` said `isFile: false`. So the guard moved onto the descriptor and the
window between asking about a name and opening it closed. Windows has no such flag
and no FIFO an `open` reaches; the runner passes `0` there and the open is the one
it always had.

**`List` cannot be asked to clean up, and no combinator can be written that
asks.** A cell is a `first` and a `tail` behind an `Effect`
([`../../list/types.ts`](../../list/types.ts)): a consumer that stops pulling
tells the producer nothing, because there is no cell left in which to tell it.
Nor is the effect layer's `finally` the missing piece — `finallyStep` is
declined in [`../../module.f.mjs`](../../module.f.mjs) as `resultStep` plus a
policy, which is exactly what it is *for a composer that is still on the stack
for both halves*. A pumped body is the other shape. When the pump gives up,
nothing that knows a handle exists is on the stack to be given a chance.

**So the response states what to release, and the runner releases it however
the body ended.** That is the `release` field in the type above: an effect in
the listener's own operations, run exactly once per response — after the last
cell, after a refusal, after a suppression, after a destroy, and after a
response that was already closed before there was anything to send it. It is
required rather than optional, because a listener holding nothing writes the
pure end and a field that must be written is one that cannot be forgotten,
which is the whole of what went wrong here. The producer's own last cell does
*not* close, or the two owners close twice. Its channel is `never` in the sense
[`../../types.ts`](../../types.ts) gives that word — a claim that the failure
is absorbed here — because a `close` that fails at this point has nobody left
to tell: the response is either complete or already destroyed.

`fjs/cas` holds nothing, reads by name, and releases the pure end; `fjs/web`
releases its handle. The obligation is on the listener that opened something,
which is the only party that knows what that was.

**The virtual runner records what went out.** `listen` in
[`../virtual/module.f.mjs`](../virtual/module.f.mjs) can pump the body with the
same `virtual(s)(...)` recursion it already uses to run the listener, and
`State.responses` holds the materialized result:

```ts
export type RecordedResponse = {
    readonly status: number
    readonly headers: Headers
    readonly body: readonly Vec[]
    /**
     * What made this response incomplete, or `null` for one a client reads as
     * whole.
     */
    readonly failure: Nullable<IoChannel | Overrun | Underrun>
}

/** A cell that would have carried the body past its declared length. */
export type Overrun = readonly['overrun', number]

/** A body that ended before the length it declared. */
export type Underrun = readonly['underrun', number]
```

`readonly Vec[]` is the shape a `Dir` already stores a file in
([`../virtual/types.ts`](../virtual/types.ts), `_Entity`), so a fixture and a
recorded response read alike — `largeChunks`, the over-one-`Vec` fixture
`fjs/web`'s proof now serves through `readWhole`, is the one a lazy-body proof
would assert against too. It replaced the oversized fixture that proof built for
its `413` case, which went with the refusal.
`failure` is the socket case's counterpart: a proof asserting a whole body has to
be able to tell it from one that stopped, and a bare chunk array cannot.

`failure` widens past `IoChannel` because the count above is the runner's own
refusal and not the producer's failure — the cell was fine, and a proof that
could not tell that destroy from a clean end could not assert the count at all.
`IoChannel` is the channel of *IO*, extended at a site with failures of its own
([`../../types.ts`](../../types.ts)), and this is one; the number it carries is
the length that was declared.

`Underrun` is that same widening at the other end, and the record states it
rather than a proof deriving it. Both figures are already there to subtract —
the declared length in `headers`, what went out as the sum of `body` — and the
subtraction is wrong exactly where it would matter: a `HEAD` or a `304` declares
a length and records an empty `body`, so a proof comparing the two would fail
the responses the gates were written to let through. What tells those apart is
whether the pump ran at all, which the record does not say and does not need to
once the runner states its own outcome. The number is the declared length again,
for the same reason.

**And `listen` mirrors the no-body predicate**, recording the skip rather than
hiding it: a response the pump never pulled holds an empty `body` and a `null`
`failure` — nothing went out, and nothing went wrong — which is exactly what a
`HEAD` or a `204` is. It runs `release` there too, and `RecordedResponse` gains
no field for it: what a proof asserts is that the virtual file system's handles
are all closed once the request is over, which is the leak itself rather than a
report of it. A virtual runner that pumped where the Node one does not
would let a listener with a nonterminating body pass here and hang there.

**`fjs/web` then loses its `413` rather than raising it.** This paragraph and the
next are the two the eager route already carried out — what they ask for is the
same on either route. `tooLarge` went, with the row documenting it in the module's
response table — that table is what a consumer reads before adopting the server.
The `isFile` guard stayed: it was never about size. A FIFO stats as zero bytes, so
no bound can stand in for the check. What the handle effect changed is the *entry*
the guard answers about: it is the `fstat` of the descriptor the reads come from
rather than a `stat` of a name the read then re-resolves, and the open does not
wait for a writer, which is what makes that order possible.

**And the module's table is not the only copy of that promise.**
[`../../../web/README.md`](../../../web/README.md) is the guide a consumer
reads instead of the source, and three of its passages describe the version
stage 1 replaced: the same `413` row, the "size limit" section stating the
131,072-byte ceiling and the `stat`-before-read that enforced it, and the
paragraph deriving every `Content-Length` from "the body it carries" — which this
design takes from the `fstat` instead. That last one carries a second claim that
also stopped holding: it credited Node with dropping a `HEAD` body, and after gate
2 the runner declines to pull one before Node is offered a byte of it. Deleting the
`tooLarge` row and leaving those would be a behavior guide that promises a refusal
the server no longer makes; a false document is the same wrong answer as false
code, given to whoever checks before requesting. The runner's `413` for an
oversized *request* is not in this set — that one is stage 2's, and the README
already names the issue that retires it.

**That set was one passage short, and the missing one was deferred on a reading
that did not survive.** This section put that file's own `stat`-then-read caveat
outside the set, on the grounds that it would go when the issue that owned it did.
Its *deletion* did wait for that, and the issue is now closed, so the caveat is
gone. What it *said* never waited: the caveat's example was "an oversized file
becomes `500` instead of `413`", and once `tooLarge` was gone there was no `413`
for anything to arrive in place of — the sentence described a promise the server no
longer makes, which is the same defect the rest of this paragraph is about. A
passage whose deletion belongs to another issue still has to be true until that
issue deletes it.

#### What every runtime answers

**The pump's host proofs run on all three runtimes, and that is a measurement
rather than an inheritance.** Two HTTP host proofs used to skip on Bun and Deno,
because what they claimed was that *Node* drops a `HEAD` body — a claim about one
host, answered through each runtime's own `node:http` compatibility layer. The
pump changes what is being claimed: the runner is the party that declines to pull,
and that is the same FunctionalScript on all three. What is left host-dependent is
the handful of properties the pump leans on, and a compatibility layer is exactly
where those might diverge. So each was asked of each runtime rather than assumed.

Measured on Darwin, arm64, against the versions
[`../../../ci/config/module.f.mjs`](../../../ci/config/module.f.mjs) pins:

| what the pump leans on | Node 26.8.1 | Bun 1.4.2 | Deno 2.8.3 |
| --- | --- | --- | --- |
| `res.useChunkedEncodingByDefault`, HTTP/1.1 then raw 1.0 | `true`, `false` | `true`, `false` | `true`, `false` |
| first 131,072-byte `write` to a client that reads nothing | `false` | `false` | `false` |
| `drain` once the client reads | fires | fires | fires |
| `close` on the response when the client hangs up mid-handler | 63 ms | 66 ms | 65 ms |
| `res.closed` read after that | `true` | `true` | **`undefined`** |
| `writeHead` afterwards | no throw, `headersSent` `true` | same | same |
| `res.write` afterwards | `false` | `false` | `false` |
| `res.destroy()` after the headers | `ECONNRESET` after 131,072 bytes | same | same |
| `res.end()` short of a declared length | nothing for four seconds | same | same |
| `res.write` on a `HEAD`, `204` or `304`, and what the client gets | `true`, nought bytes | same | same |
| a non-blocking open of a writerless FIFO | opens at once, `isFile` `false` | same | same |
| a read through a handle after a `rename` over its name | the opened bytes | same | same |
| `open` on a directory, then a read | opens, `EISDIR` | same | same |
| a second `close` of the same handle | `ok` | `ok` | `ok` |

**One row differs, and it is the row the design already told the runner not to
read.** `res.closed` answers `true` on Node and Bun and `undefined` on Deno. The
pump reads the *recorded* `close` event instead — "closure is a value the runner
records, not an edge the pump listens for", above — and that event fired within
three milliseconds of the same moment on all three. So the property the two
runners share is the one that is portable, and `_ServerResponse`
([`../private.ts`](../private.ts)) leaves `closed` out on purpose.

Nothing here is asserted per runtime, because nothing needed to be. A row that had
differed would have become a per-runtime assertion rather than a skip: a proof that
runs nowhere says nothing about the runtime it was skipped on, which is how those
two proofs came to cover one host out of three.

**What did differ was the two runtimes' own test runners, which is a separate
thing from what they do.** Both were found by CI rather than by the table, and both
are recorded here because the next proof that binds a socket or reads a large file
meets them again.

`deno test` ran with no network permission. The `test` and `cov` tasks in
`deno.json` listed `--allow-read`, `--allow-write`, `--allow-env` and
`--allow-sys`, and the `fjs` task beside them already listed `--allow-net` — the
suite had never needed it, because the only proofs that bound a socket were the two
that skipped. Every socket proof failed there in under a millisecond. The tasks now
list it; binding is loopback, and the port is whichever the host offers.

`bun test` gives one proof **five seconds**, and `bunfig.toml`'s `[test] timeout`
does not change that on Bun 1.4.2 — measured, the proofs were still cut off at
5,003 ms. Two of `fjs/web`'s host proofs need longer, and the reason is the `Vec`:
it is a `bigint`, so every chunk is converted going in and coming out, and Bun pays
about 600 ms for a 131,072-byte chunk where Node 26.8.1 pays about 40. Neither
proof can be made smaller, because both need a body larger than the loopback
socket's accept window — about a megabyte — or the pump finishes before the client
can act. So those two are skipped on Bun with the figures beside them
([`../../../web/proof.mjs`](../../../web/proof.mjs)), and every proof about the
*runner* still runs on all three.

That per-chunk figure is worth keeping for its own sake: it says serving a large
file under Bun costs fifteen times what it costs under Node, and the cost is the
representation rather than the pump.

**One decision here has no proof of its behaviour, and it is worth naming.** The
non-blocking open is measured — by hand, in the row above and in `Open`
([`../types.ts`](../types.ts)) — and not proven, because what it does needs a
FIFO: nothing in `Fs` or in `node:fs` makes one, and calling `mkfifo` would be
this repository's code calling an external tool, which
[AGENTS.md §6](../../../../AGENTS.md#6-external-tools) does not allow without
approval first. So [`../proof.mjs`](../proof.mjs) asserts the flag the open asks
for rather than the behaviour it buys, and says so where it does it. What would
replace that is either approval for a `mkfifo` fixture in the proof or an
operation in `Fs` that makes one; the other half of the same guard — that the kind
is read off the descriptor — *is* proven by behaviour, on a directory.

Two properties the design states are **not** in the table, because no proof leans
on them across runtimes: that Node sends the body of a `205` — which is why
`carriesNoBody`'s set is the host's and not the RFC's — and the framing table's
`transfer-encoding: identity` row. Both were measured on Node alone, and both
describe a response this server does not produce.

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

- [x] Move `fjs/cas`'s `readBytes` chunk loop into `../module.f.mjs` beside
      `writeFromStream`, generic in the op-set its chunk source names, with its
      byte bound, its advance by the actual chunk length, its chunk source as a
      parameter rather than a path, and proof coverage, and read `cas` through
      it. — `readChunks`, with `_ChunkSource` and `_ReadChunks` beside
      `_WriteLoop`. Both `fjs/cas` loops (`read` and `streamFile`) call it and
      the hand-written ones are gone. **No cast was needed**: the
      `List<ReadBytes, …>` the source produces widens into `read`'s pinned
      `List<FileCasOperation, …>` by ordinary `Effect` widening, which settles
      the inference question
      `66o-read-streamfile-dedup` left for `tsc`, and retires that issue.
- [x] Stage 1: `ServerResponse<O>` with a **lazy** `List` body and a `release` —
      the chunk list it carried was neither — and
      `IncomingMessage.chunkedResponse` for gate 3 to read; the Node runner's
      pump — its `drain` park released by a recorded `close`, including one
      that fired before the pump existed, the three gates that keep it from
      starting in their stated order, its byte count against a declared
      `Content-Length` compared at both ends, its destroy-on-failure in the
      cell, in either direction of the count and in `failSafe`, and the
      `release` it runs once on every one of those exits; the virtual runner's
      `RecordedResponse` with its `Overrun` and its `Underrun`, mirroring the
      gates, their order, the count, and the release. — The predicates both
      runners read are `headerValue`, `carriesNoBody` and `responseGate` in
      [`../module.f.mjs`](../module.f.mjs), so the gate order is the design's and
      not each runner's; the Node runner's `recordClose`, `park`, `pumpBody` and
      `deliver` are in [`../module.mjs`](../module.mjs), and `release` runs in a
      `finally` so a continuation that *throws* releases on its way to `failSafe`.
      The host proofs bind a real socket ([`../proof.mjs`](../proof.mjs),
      `createServer`) and **run on every runtime**: every property the pump leans
      on was measured identical on Node 26.8.1, Bun 1.4.2 and Deno 2.8.3 — see "What
      every runtime answers".
- [x] Stage 1: the handle effect — `open`, `fstat`, bounded read, `close` —
      modelled in the virtual file system, as the chunk source `fjs/web` reads
      through, with its open handles visible to a proof so an unreleased one fails
      a test. This is the route that makes a large body lazy as well as safe. —
      `Open`, `Fstat`, `Pread` and `Close` over a `Handle` in
      [`../types.ts`](../types.ts), POSIX's four names because `fstat` is one of
      them; `State.handles` in [`../virtual/types.ts`](../virtual/types.ts) records
      what each open resolved to, which is the one-inode binding, and
      `handles.throw.unreleasedHandle` in
      [`../virtual/proof.f.mjs`](../virtual/proof.f.mjs) is that assertion failing
      on a listener that writes the pure end while holding one. `Open` passes
      `O_NONBLOCK`, which is what lets the kind be asked of the descriptor at all:
      a plain read-only open of a writerless FIFO never returns. This closed the
      issue that designed it, which is deleted.
- [x] Stage 1, by the eager route: serve files past the cap in `fjs/web`, with
      `ServerResponse.body` a chunk list, the body read through `readWhole` — one
      `open`, so the bytes are one file's — a `Content-Length` summed over the
      chunks that were read, which cannot overrun because nothing is left to
      read, the Node runner writing each chunk and then ending, `tooLarge` and
      its `413` row deleted, the `isFile` guard kept, and
      [`../../../web/README.md`](../../../web/README.md) corrected with them:
      its `413` row, its size-limit section, and its `Content-Length`
      paragraph's two claims — the derivation replaced, and Node the party that
      drops a `HEAD` body kept and pinned against the host across many writes.
      `readWhole`'s chunk accumulator became linear in the same change, since a
      served file is what makes the chunk count the caller's. See "The eager
      route, as landed". No `release`: nothing this route holds outlives a
      response.
- [x] Stage 1: make `fjs/web`'s body lazy as well as bound to one inode — the
      body read from one `open` through the handle effect above, and a
      `Content-Length` the reads cannot overrun: the `fstat` size declared, and
      the reads bounded by it. A size declared ahead of an unbounded read would
      be the guess "What the bound holds" measured going wrong on a file that
      grew. Then whatever is held given back through `release`. This is what
      takes the memory footprint from the whole file down to one chunk; the cap
      itself was already gone. — `respond` opens once and asks the descriptor;
      `openResponse` declares the `fstat` size and bounds `readChunks` by it, and
      every frame built after a successful `open` carries `releaseHandle` as its
      `release`. Every case in [`../../../web/proof.f.mjs`](../../../web/proof.f.mjs)
      goes through `listen` and asserts the virtual file system has nothing open
      afterwards; `respond.oneInode` replaces the served entry between two pulls
      and still reads the opened one, and `respond.boundedByTheFstat` grows it and
      still stops at the declared length. The footprint is a host measurement:
      [`../../../web/proof.mjs`](../../../web/proof.mjs) serves a file of a
      hundred and twenty-eight mebibytes to a client that reads nothing, and
      `createServer.pullsAtTheSocketsPace` in [`../proof.mjs`](../proof.mjs) is the
      exact bound — ten times the body is not ten times the memory.
- [ ] Stage 2: name the operation that pulls one request-body chunk, and answer
      what an undrained body does.
- [ ] Stage 2: `IncomingMessage.body` as a `List`, retiring the runner's `413`.

A body that stalls under the cap is a third consequence, filed separately as
[request-body-timeouts](./request-body-timeouts.md): the listener cannot answer
until a body it may not even want has finished arriving.

### Related

- [`fjs/web`](../../../web/README.md) — the behavior guide a consumer reads
  before adopting the server. Its size-limit section, its response table, its
  `Content-Length` paragraph and its "entry checked is not the entry read" caveat
  were all corrected as stage 1 landed; what they describe now is a body read
  through one open file and held one chunk at a time.
- [`fjs/cas` web-api-server](../../../cas/todo/web-api-server.md) — blocked on
  stage 2 for arbitrary-size `add`; its `get` has the response half it needs.
- `fjs/effects/node/module.f.mjs` — `writeFromStream`, the chunk-list shape a
  streamed body should follow.
- [`fjs/effects/list`](../../list/types.ts) — `List`, why a failure belongs to
  the cell rather than to the item it would otherwise be carried beside, and the
  cell shape that leaves a consumer no way to tell a producer it has stopped.
- [GitHub issue #1819](https://github.com/functionalscript/functionalscript/issues/1819)
  — the report the Problem section's numbers come from.
