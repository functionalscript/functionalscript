## stdio-oversize-response-message. Say "response too large" instead of a bare internal error

**Priority:** P4
**Status:** open

### Problem

When a response does not fit one encoded line, `handleLine`
(`fjs/mcp/stdio/module.f.ts`) falls back to `internalErrorResponse(resp.id)` —
the standard `-32603` *"Internal error"* from `fjs/media/json/rpc`. The
transport handles the overflow correctly: nothing throws, the process survives,
and the request still gets a response carrying its `id`. What the client
receives, though, is indistinguishable from a genuine server fault. There is no
way to tell "your query matched too much, ask for less" from "the server has a
bug", so the one recovery that would actually work — request a smaller slice —
is the one the message does not suggest.

The overflow is easy to reach without any tool misbehaving, because MCP tool
results carry JSON as *text* content: the JSON-RPC serializer escapes it a
second time, so a value well under the cap can encode past it (a string of
quote characters roughly doubles). Every JSON-returning tool is exposed —
`cas_get` with `content: true` has proofs pinning exactly this double-escaping
path (`getContentBase64InflationOverflowWritesInternalError`,
`getContentDoubleEscapedOverflowWritesInternalError`), and `evo_list` /
`evo_revision` (`fjs/cas/evo/mcp`) inherit the same envelope.

No tool can improve on this from its own side. Whether an encoded response fits
is knowable only by encoding it, which happens in the transport; a tool that
tried to answer the question itself would have to estimate the encoded size
from the unencoded value — the size prediction AGENTS.md rules out. The
transport is the only layer holding the fact, so it is the only layer that can
report it.

### Proposal

Give the first fallback its own error body instead of reusing `internalError`:

```ts
const tooLargeError = rpcError(-32603)('response too large to encode')
const tooLargeResponse = (id: Response['id']): Response =>
    ({ jsonrpc, error: tooLargeError, id })
```

Keep the code `-32603`: this *is* a server-side failure to deliver, and no
standard JSON-RPC code fits better (`-32603` is the catch-all; the reserved
implementation-defined range `-32099..-32000` is an option if a distinct code
is wanted later). Only the message changes, so no client that switches on
`code` breaks.

The terminal `id: null` fallback keeps the constant `internalError` body: it
exists for a pathological caller-controlled `id`, its shape must stay the
smallest possible line, and by then the `id` is gone so the client cannot
attribute the message to a request anyway.

This composes with
[stdio-write-fallback-list](stdio-write-fallback-list.md), which folds the same
cascade over a candidate list: the list becomes
`[resp, tooLargeResponse(resp.id), internalErrorResponse(null)]` and the
distinction is then visible as data. Doing that issue first makes this a
one-element change; doing this one first is fine too.

### Tasks

- [ ] Add the `response too large to encode` error body; use it for the first
      fallback in `handleLine`, leaving the `id: null` terminal as-is.
- [ ] Update the `@module` doc's edge-case list, which currently describes the
      first retry as a `-32603` internal-error body.
- [ ] Extend `fjs/mcp/stdio/proof.f.ts` to assert the message on the
      oversized-response path, keeping the existing oversized-`id` coverage.
- [ ] Check the `cas_get` overflow proofs in `fjs/cas/mcp/proof.f.ts`, which
      assert `code` (not `message`), still pass unchanged.

### Related

- [stdio-write-fallback-list](stdio-write-fallback-list.md) — restructures the
  same cascade into a candidate list; the two are best implemented together.
- `fjs/mcp/stdio/module.f.ts` — `writeResponse` (the `maxLength`-bounded
  encoder whose `error` result drives the fallback) and `handleLine`.
- `fjs/cas/evo/mcp/README.md` — the "Result size" note describing this
  behaviour from a tool's side, and why a tool cannot report it itself.
