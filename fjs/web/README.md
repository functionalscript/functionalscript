# fjs web — static file server

```
fjs web [root] [port]
```

Serves `root` (default `.`) over HTTP on `port` (default `8080`), bound to
loopback. One request, one file:

```
fjs web            # http://127.0.0.1:8080/ serves the working directory
fjs web docs 3000  # http://127.0.0.1:3000/ serves ./docs
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

**Dot-prefixed segments are not served**, at any depth: `/.env`, `/.git/config`
and `/docs/.secret/key` are all `404`. These are the files whose exposure the
loopback binding exists to prevent, so handing them to anyone who asks would put
the boundary in the wrong place. `404` rather than `403` because whether such a
file exists is itself what is not being disclosed. A NUL in a path (`%00`) is
`400`: no path can contain one, and letting it reach the file system reports a
host failure for what is plainly a bad request.

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
| `GET`/`HEAD` on a missing, dot-prefixed, or non-regular path | `404` |
| any other method | `405`, with `Allow: GET, HEAD` |
| a path that escapes `root`, or an undecodable URL | `400` |
| a file larger than one `Vec` | `413` |
| any other host failure | `500` |

Failures carry a `text/plain` body. A `500` reports the error *kind*
(`errorSummary`) rather than the host's message, which is where the host puts
the absolute path it could not read — a client is not entitled to the server's
filesystem layout.

Every response states its `Content-Length`, computed from the body it carries.
The runner does not: Node sends an unmeasured body with `Transfer-Encoding:
chunked`. `HEAD` is then answered exactly like `GET`, bytes included — Node drops
the body of a `HEAD` response itself and keeps these headers, so the one frame
serves both, and the client still learns the size it asked for.

`Content-Type` comes from the file's extension
([`fjs/media/type`](../media/type/)'s `detectPath`), never from its bytes.
Sniffing cannot serve this question at all — `text/html`, `text/css` and
`text/javascript` are byte-identical UTF-8 text, and a browser treats them as
three different things. Every response also carries
`X-Content-Type-Options: nosniff`, so the browser does not go looking for a
second opinion in the bytes of a type this server has already answered.

**The file system decides what a name matches.** On a case-insensitive volume
`/INDEX.HTML` serves `index.html`, and Windows has its own rules about trailing
dots and spaces. `resolve` normalizes the path but does not — cannot portably —
predict which names a given host treats as the same file, so a hidden-segment or
extension check is a check on the name as *written*.

### What is not read at all

`stat` runs before every read, and it answers two questions rather than one: how
big the entry is, and whether it is a **regular file**. A FIFO, a device or a
socket is answered `404` and never opened — `open` on a FIFO with no writer
blocks until one appears, so the read would never return and would hold a
thread-pool slot while it waited. A served tree with one FIFO in it and a handful
of requests would stall every other response. Size cannot stand in for the check:
a FIFO stats as zero bytes and passes every bound.

### The size limit

`readFile` yields a single `Vec`, which caps at 131,072 bytes, and
`ServerResponse.body` is one `Vec` too. So this version cannot answer with a
larger file — and it must not answer with part of one, which is why the size is
read with `stat` **before** the bytes are, and a file over the cap is refused
with `413`. Serving larger files needs a streaming response body, which is an
effect-layer change:
[streaming-http-bodies](../effects/node/todo/streaming-http-bodies.md).

### Request bodies

`GET` and `HEAD` carry none worth reading, and this server ignores what a client
sends anyway — but ignoring it is not the same as surviving it. A body larger
than one `Vec` used to kill the process: the runner buffered it, `listToVec`
threw at the cap, and the throw landed in an `async` handler whose promise
nobody awaited. Any client could end the server with one request.

The runner now counts as it reads and answers `413` itself, without calling the
listener — over the cap there is no `IncomingMessage` to build, since its `body`
is a single `Vec`. It also answers `500` rather than dying if a listener throws:
a panic must not outlive the request that caused it.

Both answers close the connection, which is the difference between refusing a
request and surviving the refusal. Neither has read the request to its end, so
on a keep-alive connection Node would sit waiting for a body that never arrives
— one client declaring ten megabytes and sending a hundred kilobytes could hold
sockets open indefinitely. Draining the rest would be the polite alternative and
the wrong one: it reads bytes the server has already refused.

All of it goes away with
[streaming bodies](../effects/node/todo/streaming-http-bodies.md).

## Proving it without a socket

`main` is proven end to end against the virtual runner, request in and response
out. The runner grew two operations for it: `createServer` hands back a handle
carrying the listener, and `listen` gives that listener every request the fixture
queued, recording what came back. No socket is involved, and it is the same
listener the Node runner would drive. The listener rides in the handle rather
than in the state so that two servers in one program are two servers there too,
as they are on a host.

The run ends where a real one would not: `forever`'s result type is
`Result<never, NotImplemented>`, so `error(notImplemented)` is the *only* value
it can produce, and a runner that cannot block has nothing else to answer. The
program therefore stops at that last step and exits `1`, which is the honest
report — the server did not run to completion because this runner cannot run a
program that never ends.

## Binding

The address is `127.0.0.1`, and it is bound before anything is announced.

The announced URL says so. Node's own `listen(port)` binds the
unspecified address, which would publish whatever directory the command was
pointed at — `.` by default, so a working tree with its sources, its keys and its
`.env` — to the whole network because someone typed two words. That is why
[`Listen`](../effects/node/types.ts) takes the host as a **required** argument
rather than defaulting: binding everywhere should be something a program says,
not something it gets by writing less.

Reaching the server from another machine therefore waits on `--host`, along with
`--port`, for [named options in `fjs/cli`](../cli/todo/options-edsl.md).

Binding *fails* asynchronously — a taken port arrives as the server's `error`
event, not as a throw — so `Listen` settles on the outcome rather than on the
call. Before that, `fjs web` on a busy port printed the URL it was serving and
was then killed by an unhandled `EADDRINUSE`; now the failure comes back through
the effect's channel and the program exits `1` with
`listen EADDRINUSE: address already in use 127.0.0.1:8080`.

## Deliberately absent

No directory listing, no range requests, no compression, no caching headers, no
TLS, no configuration beyond the two positional arguments. A directory requested
without a trailing slash is not redirected to one — `/docs` is not a file, so it
answers `500` (`EISDIR`) where `/docs/` serves `docs/index.html`. Port `0` is
refused with the out-of-range values: Node reads it as "any free port", and
nothing here can ask which one it got, so the URL it printed would name a dead
port.

**Symlinks are followed.** `resolve` decides containment from the URL, which a
link inside the root can defeat by pointing outside it — the root boundary holds
for paths, not for the file system's own indirection. Checking it properly needs
the target's real path, and there is no `realpath` effect yet:
[symlink-containment](./todo/symlink-containment.md). Until then, the loopback
binding is what bounds it, and a tree with unaudited links is not one to serve —
a `node_modules` or `.git` link is ordinary enough that this is a real caveat and
not a theoretical one. **It gates `--host`**: this server must not become
reachable from another machine while the root boundary can be walked out of.
