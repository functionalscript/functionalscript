## `fjs web` static file server

**Priority:** P3
**Status:** open

### Problem

There is no way to look at the pages this repository generates. `fjs/website/module.f.mjs`
writes an `index.html`, and [generate-website](../website/todo/generate-website.md) plans
`README.md` conversion, `main.css`, per-module `page.f.mjs` demos, and a browser test
runner — all of which need a local HTTP server to be viewed at all. Today the only
options are opening `file://` URLs (which breaks anything relying on an origin) or
installing an unrelated third-party server.

The effects to build one already exist and have no consumer: `CreateServer`, `Listen`,
and `Forever` are declared in `fjs/effects/node/types.ts`, implemented by the Node
runner (`fjs/effects/node/module.mjs`), and exported as `createServer`, `listen`, and
`forever` from `fjs/effects/node/module.f.mjs`. Nothing in the repository calls them,
so the HTTP side of the effect layer is unproven by any real program.

### Proposal

Add a `fjs web` command that serves a directory over HTTP. The first version does one
thing: map a request path to a file on disk and return its bytes, so `index.html` and
its assets load in a browser.

#### CLI

```
fjs web [root] [port]
```

`root` defaults to `.` and `port` to `8080`. Both are positional because
`fjs/cli` has no notion of a named option yet; once
[options-edsl](../cli/todo/options-edsl.md) lands, `port` becomes `--port`.
Registered in the `commands` table of `fjs/module.f.mjs`:

```js
{
    names: ['web', 'w'],
    description: 'Serve a directory over HTTP',
    handler: webMain,
}
```

#### Module layout

A new `fjs/web/` module, split so that the routing decision is pure and the socket
handling is a thin shell:

- `fjs/web/module.f.mjs`
  - `resolve: (root: string) => (url: string) => Result<string, ...>` — pure. Strips
    the query and fragment, percent-decodes, normalizes with `fjs/path`'s `normalize`,
    appends `index.html` when the path ends in `/`, and rejects anything that escapes
    `root` (`isProperPrefix` from `fjs/path`).
  - `respond: (root: string) => RequestListener<Fs>` — resolves the path, reads the
    file, and builds a `ServerResponse`. Effectful but socket-free, so it is provable
    against the virtual runner's file system.
  - `main` — a `Program` that parses `args`, calls `createServer(respond(root))`,
    `listen(server, port)`, logs the URL, and ends in `forever()`.
- `fjs/web/types.ts` — the type-level API.
- `fjs/web/proof.f.mjs` — 100% proof coverage.

#### Responses

| Case | Status |
|------|--------|
| File found | `200` with its bytes |
| `GET`/`HEAD` on a missing path | `404` |
| Any other method | `405` |
| Path that escapes `root`, or undecodable | `400` |

Failures carry a `text/plain` body; nothing else is configurable in this version — no
directory listing, no range requests, no compression, no caching headers, no TLS.

#### Content type

`Content-Type` is derived from the file extension, not from the bytes.
`fjs/media/type` sniffs magic bytes and UTF-8, which cannot distinguish `text/html`
from `text/css` from `application/javascript` — every one of them is plain UTF-8 text,
and a browser needs the distinction. Add a small extension table (`.html`, `.css`,
`.js`, `.mjs`, `.json`, `.svg`, `.png`, `.jpg`, `.gif`, `.webp`, `.wasm`, `.txt`),
falling back to `application/octet-stream`. Text types get `; charset=utf-8`. The
table belongs in `fjs/media/type` next to the existing magic-byte table, since
extension-to-media-type is the same question asked from the other end.

#### Size limit

`readFile` caps at 131,072 bytes (128 KiB) and `ServerResponse.body` is a single `Vec`,
so this version cannot serve a larger file. That is acceptable for the pages
`fjs/website` produces, but it must fail loudly rather than truncate: `stat` the file
first and answer `413` when it exceeds the cap. Serving larger files needs a streaming
response body — a separate issue against `fjs/effects/node`, to be filed when this one
is implemented.

#### Proof coverage

`createServer`, `listen`, and `forever` are `todo` (unimplemented) in the virtual
runner (`fjs/effects/node/virtual/module.f.mjs`), so `main` cannot be proven until they
are. Implement them there: `createServer` stores the listener in the virtual state,
`listen` records the port, and `forever` returns once the fixture's queued requests are
drained. That makes an end-to-end proof — request in, response out — possible without a
real socket, and it is the reason `respond` is kept free of socket effects.

### Tasks

- [ ] Add the extension-to-media-type table to `fjs/media/type` with proof coverage.
- [ ] Write `fjs/web/module.f.mjs` (`resolve`, `respond`, `main`) and `fjs/web/types.ts`.
- [ ] Prove `resolve` and `respond` in `fjs/web/proof.f.mjs`, including traversal
      rejection, `405`, `404`, and `413`.
- [ ] Implement `createServer`, `listen`, and `forever` in the virtual runner; prove
      `main` end to end.
- [ ] Register the `web` command in `fjs/module.f.mjs`.
- [ ] Document the command in `fjs/README.md` and the module's own `README.md`.
- [ ] File the follow-up issue for a streaming response body.
- [ ] `npm run update`, `npx tsc`, `fjs t`.

### Related

- [fjs/website generate-website](../website/todo/generate-website.md) — the pages this
  server exists to view; `fjs web` is how they get looked at locally.
- [fjs/cli options-edsl](../cli/todo/options-edsl.md) — turns the positional `port` into
  `--port`; also `--host` and any later flag.
- [fjs/effects/node requestlistener-stateful](../effects/node/todo/requestlistener-stateful.md)
  — a static server is stateless by design, so it is unblocked by that question, but it
  is the first real consumer whose needs should inform the answer.
- `fjs/effects/node/types.ts` — `CreateServer`, `Listen`, `Forever`, `IncomingMessage`,
  `ServerResponse`, `RequestListener`.
- `fjs/path/module.f.mjs` — `normalize`, `concat`, `isProperPrefix` for path resolution.
