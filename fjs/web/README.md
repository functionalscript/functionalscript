# fjs web — static file server

```
fjs web [root] [port]
```

Serves `root` (default `.`) over HTTP on `port` (default `8080`). One request,
one file:

```
fjs web            # http://localhost:8080/ serves the working directory
fjs web docs 3000  # http://localhost:3000/ serves ./docs
```

## Why it exists

The pages this repository generates had nowhere to be looked at.
[`fjs/website`](../website/) writes an `index.html`, and its
[generate-website](../website/todo/generate-website.md) plan adds `README.md`
conversion, `main.css`, per-module demos and a browser test runner — none of
which can be opened over a `file://` URL, because anything that depends on an
origin breaks there. The alternative was installing an unrelated third-party
server.

It is also the first program to exercise the HTTP side of the effect layer.
`CreateServer`, `Listen` and `Forever` were declared, implemented by the Node
runner, exported — and called by nothing, so none of it was evidence of
anything. It is now.

## Structure

Three layers, in one direction, each provable by itself:

| | what it does | what it needs |
|---|---|---|
| `resolve` | URL → path under `root` | nothing — it is pure |
| `respond` | request frame → response frame | a file system |
| `main` | argument parsing, socket, log line | a host |

The split is what makes the middle layer testable: `respond` performs IO but no
networking, so the [virtual runner](../effects/node/virtual/) can drive it with
an in-memory file system and read the response back. `main` is thin on purpose —
everything that could be decided without a socket was already decided below it.

### Resolving

`resolve` strips the query and the fragment, percent-decodes what is left,
normalizes it with [`fjs/path`](../path/), appends `index.html` to a path ending
in `/`, and rejects anything that points above `root`.

Percent-decoding is done over **bytes, not characters**: a non-ASCII character
arrives as several escapes (`%D0%9F` is one letter), so the escapes are decoded
to bytes first and the whole sequence read back as UTF-8 at the end. Decoding
each escape on its own would produce mojibake for every non-ASCII name. Bytes
that are not valid UTF-8 are a `400` rather than a lossy name.

Traversal is rejected **in segment space**. `parse` collapses `.` and `..` the
way the file system does, so a `..` that survives it is one that climbs above the
root, and the check is `segments.includes('..')` — nothing about the string form
of the path. A textual comparison against `root` would be weaker, and could not
be written here anyway: `normalize` drops a leading empty segment, so `/var/www`
would come back as `var/www` and every absolute root would silently become
relative. That is also why the path is built with `join` rather than `concat`.

### Answering

| case | status |
|---|---|
| file found | `200` with its bytes |
| `GET`/`HEAD` on a missing path | `404` |
| any other method | `405` |
| a path that escapes `root`, or an undecodable URL | `400` |
| a file larger than one `Vec` | `413` |
| any other host failure | `500` |

Failures carry a `text/plain` body. A `500` reports the error *kind*
(`errorSummary`) rather than the host's message, which is where the host puts
the absolute path it could not read — a client is not entitled to the server's
filesystem layout.

`HEAD` is answered exactly like `GET`, bytes included: Node omits the body of a
`HEAD` response itself while keeping the headers, so answering the two alike is
what makes `Content-Length` correct without computing it.

`Content-Type` comes from the file's extension
([`fjs/media/type`](../media/type/)'s `detectPath`), never from its bytes.
Sniffing cannot serve this question at all — `text/html`, `text/css` and
`text/javascript` are byte-identical UTF-8 text, and a browser treats them as
three different things.

### The size limit

`readFile` yields a single `Vec`, which caps at 131,072 bytes, and
`ServerResponse.body` is one `Vec` too. So this version cannot answer with a
larger file — and it must not answer with part of one, which is why the size is
read with `stat` **before** the bytes are, and a file over the cap is refused
with `413`. Serving larger files needs a streaming response body, which is an
effect-layer change:
[streaming-http-bodies](../effects/node/todo/streaming-http-bodies.md).

## Proving it without a socket

`main` is proven end to end against the virtual runner, request in and response
out. The runner grew two operations for it: `createServer` stores the listener
in the virtual state, and `listen` hands it every request the fixture queued,
recording what came back. No socket is involved, and it is the same listener the
Node runner would drive.

The run ends where a real one would not: `forever`'s result type is
`Result<never, NotImplemented>`, so `error(notImplemented)` is the *only* value
it can produce, and a runner that cannot block has nothing else to answer. The
program therefore stops at that last step and exits `1`, which is the honest
report — the server did not run to completion because this runner cannot run a
program that never ends.

## Deliberately absent

No directory listing, no range requests, no compression, no caching headers, no
TLS, no configuration beyond the two positional arguments. A directory requested
without a trailing slash is not redirected to one — `/docs` is not a file, so it
answers `500` (`EISDIR`) where `/docs/` serves `docs/index.html`. `--port` and
`--host` wait on [named options in `fjs/cli`](../cli/todo/options-edsl.md);
until then both arguments are positional.
