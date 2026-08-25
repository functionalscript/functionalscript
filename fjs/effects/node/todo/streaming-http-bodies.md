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

### Proposal

No design yet. The shape to aim at is the one `writeFromStream` already uses for
files — `List<O, Vec, IoChannel>` as the body on both sides — so a listener
answers with a chunk list it produces lazily and the runner pumps it into the
socket, and a large request body is read chunk by chunk rather than collected.
Open questions: what a listener that never reads its request body does, whether
`Content-Length` stays derivable, and how the virtual runner models a streamed
response (it records whole `ServerResponse` values today).

### Tasks

- [ ] Design the streaming body type for `IncomingMessage` / `ServerResponse`.
- [ ] Implement it in the Node runner (`fjs/effects/node/module.mjs`) and in the
      virtual runner, with proof coverage.
- [ ] Serve files past the cap in `fjs/web`, retiring its `413`.

### Related

- [`fjs/web`](../../../web/README.md) — the size limit section states the cap
  this issue lifts.
- [`fjs/cas` web-api-server](../../../cas/todo/web-api-server.md) — blocked on
  this for arbitrary-size `add`/`get`.
- `fjs/effects/node/module.f.mjs` — `writeFromStream`, the chunk-list shape a
  streamed body should follow.
