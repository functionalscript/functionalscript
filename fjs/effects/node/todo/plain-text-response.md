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
exported from `fjs/effects/node/module.f.mjs` beside the type; `fjs/web`'s
`plainText` becomes it plus its own extra header; the runner's
`respondWith` becomes the `writeHead(…).end(…)` line `answerRequest`
already has, applied to the value; `connectRefusal` renders its status
line and headers from the same value, so the length is computed.

### Tasks

- [ ] `plainTextResponse` with a proof; `fjs/web` and the runner over it;
      the runner keeps one way to put a frame on a socket.
- [ ] `tsc`, `fjs test`.

### Related

- [streaming-http-bodies.md](./streaming-http-bodies.md) — when the
  runner answers and destroys; this is what it answers with.
- [`../../web/todo/name-too-long-status.md`](../../../web/todo/name-too-long-status.md) —
  changes one such status; one owner to change it in.
