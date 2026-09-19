## plain-text-response. The runner hand-builds HTTP refusal frames that `fjs/web` builds purely

**Priority:** P4
**Status:** open

### Problem

`fjs/effects/node/module.mjs` writes a plain-text HTTP response three ways,
none of them the `ServerResponse` value its own `types.ts` defines:

```js
// respondWith
const body = textEncoder.encode(`${message}\n`)
res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'content-length': `${body.length}`, connection: 'close' }).end(body)
// connectRefusal — a raw string with a hand-counted length
'HTTP/1.1 501 Not Implemented\r\n' + 'content-type: text/plain; charset=utf-8\r\n' + 'content-length: 26\r\n' + …
// answerRequest — the one honest serializer of a ServerResponse
res.writeHead(status, outHeaders).end(fromVec(outBody))
```

while `fjs/web`'s `plainText` builds the same frame as a value, one layer
too high for the runner to reach. What a `413`, `500` or `501` looks like
is not impure, and today no proof reaches `respondWith`, `failSafe`'s
pre-headers branch, or the `26`, which is right and unchecked.

### Proposal

`plainTextResponse: (status: number) => (message: string) => ServerResponse`
exported from `fjs/effects/node/module.f.mjs` beside the type: the status,
`content-type`, a computed `content-length`, and the body. `fjs/web`'s
`plainText` becomes it plus its own extra header.

**`connection: close` is not part of the value.** It is the runner's socket
policy, and `respondWith`'s doc says why it must be there — both refusals
answer without reading the body to its end, and without it a keep-alive
socket waits forever for the rest. It must equally *not* be on an ordinary
`fjs/web` response, which keeps its connection. So the runner keeps one
private step that adds it:

```js
// fjs/effects/node/module.mjs
const closing = r => ({ ...r, headers: { ...r.headers, connection: 'close' } })
const respondWith = res => status => message =>
    writeResponse(res)(closing(plainTextResponse(status)(message)))
```

where `writeResponse` is the `writeHead(…).end(…)` line `answerRequest`
already has, now the runner's one way to put a frame on a socket.
`failSafe`'s pre-headers branch goes through `respondWith` as today, and
`connectRefusal` renders its status line and headers from
`closing(plainTextResponse(501)(…))`, so the `26` is computed and the
`close` is the same one the other two refusals carry. The doc paragraph on
why the connection closes moves to `closing`.

### Tasks

- [ ] `plainTextResponse` with a proof; `fjs/web` over it.
- [ ] `writeResponse` and `closing` in the runner; `respondWith`,
      `failSafe` and `connectRefusal` over them; the three refusals still
      carry `connection: close` and ordinary responses still do not.
- [ ] `tsc`, `fjs test`.

### Related

- [streaming-http-bodies.md](./streaming-http-bodies.md) — when the
  runner answers and destroys; this is what it answers with.
- [`../../web/todo/name-too-long-status.md`](../../../web/todo/name-too-long-status.md) —
  changes one such status; one owner to change it in.
