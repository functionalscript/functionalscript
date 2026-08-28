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

Percent-decoding validates every escape before decoding any, which is what keeps
it linear: growing one byte array per escape copies everything decoded so far on
every escape, and a target of escapes fits comfortably under Node's header limit
while costing far more than one. Measured here, before and after:

| escapes | before | after |
|---------|--------|-------|
| 2,500   | 61 ms  | 42 ms |
| 5,000   | 101 ms | 43 ms |
| 10,000  | 313 ms | 74 ms |
| 20,000  | 2,995 ms | 104 ms |

Doubling the count used to quadruple the time; now it roughly doubles it. **The
shape is the claim, not the magnitudes** — those are one machine's, on Linux with
Node 22.22.2, and a reviewer's Darwin figures differ by roughly 6× while tracing
the same curve.

Those are `resolve` measured directly. Over a socket the request line stops at
Node's 16 KB limit, so about **5,400 escapes** is the most a client can send —
6,000 gets a `431` from Node's parser before this server sees it. The top two
rows are therefore the shape of the curve rather than a reachable cost; the
5,000-escape row is the reachable one.

It is done over **bytes, not characters**: a non-ASCII character
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
| `GET`/`HEAD` on a missing, dot-prefixed, or non-regular path, or one descending through a file | `404` |
| any other method | `405`, with `Allow: GET, HEAD` |
| a `Host` this server does not answer for | `403` |
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

### A path that descends through a file

`/README.md/` asks for `README.md/index.html`, and a POSIX host answers that
`stat` with `ENOTDIR`: the name before the slash exists and has nothing under
it. That is client-caused in the way a missing name is — every served tree has
thousands of regular files, so any client can ask — so it is a `404`, the same
answer `/nope.md/` gets.

While it was a `500` the two answered differently, which made a trailing slash a
way to ask *"is there a regular file at this name?"* — the enumeration the
identical `404`s elsewhere exist to deny. It was also platform-dependent:
Windows reports `ENOENT` for the same request and answered `404` already, so one
request had two statuses depending on the host it ran on.

**Only `ENOTDIR`.** A directory whose mode denies traversal (`EACCES`) and a
symlink cycle (`ELOOP`) reach the same directory-form shape on POSIX and stay at
`500`: both are entries an operator placed, and a `500` saying the host could not
read what it was pointed at is not obviously the wrong answer for them. `EISDIR`
needs no rule — `stat` succeeds on a directory, `isFile` is false, and it is
already `404`.

**And only while the root is a directory.** `fjs web README.md` would make every
request stat a path descending through a file, and mapping that to `404` would
tell every visitor the site is missing and the operator nothing at all. So the
root is checked twice over: `main` refuses a root that is not a directory before
it binds anything — reported on `stderr` with exit code `1`, like a bad port —
and the `ENOTDIR` mapping re-stats the root before answering, so a root
*replaced* while the server runs goes back to `500`. The re-check costs a `stat`
on the `ENOTDIR` path and nothing on any other, and what it leaves is the
request-local window [stat-then-read](./todo/stat-then-read.md) already
describes, rather than a wrong status for the life of the process.

A root that is *deleted* rather than replaced is not covered: every later `stat`
fails `ENOENT`, which is the ordinary `404` path, and validating the root before
accepting an `ENOENT` too would put a second `stat` on the most common answer a
static server gives to improve a diagnostic. `404` is not false in either case —
with the root gone or a file, nothing under it exists — so what the asymmetry
costs is diagnostic reach, not correctness. The version that answers both is
holding the root **open** and resolving beneath the handle, which is
[stat-then-read](./todo/stat-then-read.md)'s effect.

`FileStat` grew `isDirectory` for the startup check: `isFile === false` is not
"is a directory", since a FIFO, a device and a socket answer that too, and
serving one of those as a root is the same mistake as serving a file.

### The size limit

`readFile` yields a single `Vec`, which caps at 131,072 bytes, and
`ServerResponse.body` is one `Vec` too. So this version cannot answer with a
larger file — and it must not answer with part of one, which is why the size is
read with `stat` **before** the bytes are, and a file over the cap is refused
with `413`. Serving larger files needs a streaming response body, which is an
effect-layer change:
[streaming-http-bodies](../effects/node/todo/streaming-http-bodies.md).

### Request targets

Both forms an origin server can be sent are accepted. **Origin-form**
(`/main.css?v=2`) is what a browser sends. **Absolute-form**
(`http://localhost:8080/main.css`) is what a client sends through a proxy, and
RFC 9112 §3.2.2 requires an origin server to accept it too — and to take the host
from the *target* rather than from the `Host` header, since a proxy rewrites one
and not the other. So an absolute-form target for a name this server does not
answer for is `403` even when the header says something reassuring.

Anything else is `400`: the asterisk-form `*`, an authority-form `host:port` from
a `CONNECT`, an empty target, and a target whose scheme is missing or is not one
this server speaks — `://localhost/x` and `1://localhost/x` name no scheme at
all, and reading "whatever precedes `://`" as one served them.

### Request bodies

`GET` and `HEAD` carry none worth reading, and this server ignores what a client
sends anyway — but ignoring it is not the same as surviving it. A body larger
than one `Vec` used to kill the process: the runner buffered it, `listToVec`
threw at the cap, and the throw landed in an `async` handler whose promise
nobody awaited. Any client could end the server with one request.

The runner counts as it reads — into an array it mutates, which is the one place
in this repository where that is the right answer: rebuilding the array per chunk
copies everything received so far on every chunk, and 20,000 one-byte chunks is
20 KB of payload and 200 million copies. A cap on payload size is not a cap on
chunk count, and a request that will be refused must not cost more than one that
is served. Measured here: 2,794 ms to refuse that request before, 167 ms after,
and doubling the chunk count now doubles the time instead of quadrupling it —
again one machine's numbers, with the change in shape rather than the
milliseconds being what is claimed.

Past the cap it answers `413` itself, without calling the listener — there is no
`IncomingMessage` to build up there, since its `body` is a single `Vec`. It also
answers `500` rather than dying if a listener throws: a panic must not outlive
the request that caused it.

Both answers close the connection, which is the difference between refusing a
request and surviving the refusal. Neither has read the request to its end, so
on a keep-alive connection Node would sit waiting for a body that never arrives
— one client declaring ten megabytes and sending a hundred kilobytes could hold
sockets open indefinitely. Draining the rest would be the polite alternative and
the wrong one: it reads bytes the server has already refused.

All of it goes away with
[streaming bodies](../effects/node/todo/streaming-http-bodies.md).

What is *not* covered: a body that stalls under the cap. The runner reads a body
to its end before the listener sees it, so a client declaring twenty megabytes
and sending one hundred kilobytes holds a connection until Node's five-minute
`requestTimeout` — even for a `POST`, which this server was never going to serve.
Loopback bounds it; the fix is
[request-body-timeouts](../effects/node/todo/request-body-timeouts.md).

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

### Binding loopback is not the whole check

It stops another machine from reaching the socket. It does not stop a browser on
*this* machine from being told that a name the attacker owns lives at
`127.0.0.1` — that is DNS rebinding, and the fetches that follow arrive here
looking entirely ordinary: right socket, right port, real client. The only place
the lie is written down is the `Host` header, which says the request was for
`attacker.example`. Serve it, and the browser files the response under the
attacker's origin and hands the working tree to their JavaScript.

So the `Host` is checked first, before the method and before the path, against
the names this server answers for — `localhost`, `127.0.0.1`, `[::1]`, with or
without a port, matched case-insensitively as host names are, and with a trailing
root dot (`localhost.`) treated as the same name, since it is. Anything else
is `403`, including a request with no `Host` at all and one whose authority
carries **userinfo**: `127.0.0.1:8080@attacker.example` names the attacker's
host, not loopback, and reading it from the left finds an address that was never
the host at all. RFC 9110 §4.2.4 deprecates userinfo in an `http` URI, so
refusing it outright is both correct and the only reading that cannot be walked
backwards into. HTTP/1.1 requires one and every browser sends one, so accepting its
absence would leave a hole shaped exactly like a client that omits it on purpose.

An absolute-form target must also name a **host**. `http:///index.html` reads as
an empty authority and the path `/index.html` here, and as the host
`index.html` and the path `/` to a URL parser — two readings, neither of them
the client's — so it is `400`, as RFC 9110 §4.2.1 requires of a recipient given
an `http` URI with an empty host. `http://:80/index.html` is the same target
wearing a port, and `new URL` refuses that one outright.

What may follow a name is a **port and nothing else**, and a port is digits
**below 65536**: `localhost:bad`, `localhost:8080:999` and `localhost:65536` are
all `403`, the last because a URL parser refuses the same authority
(`new URL('http://localhost:65536/')` throws). The digits are read as a number
rather than counted, since a parser reads `:00008080` as port 8080 and a length
test would not. Reading a name and discarding whatever follows it is not a
check — it is the check's absence, wearing its clothes.

`--host` will have to extend that list as well as the bind address; the two are
different questions and only one of them is about reachability.

Binding *fails* asynchronously — a taken port arrives as the server's `error`
event, not as a throw — so `Listen` settles on the outcome rather than on the
call. Before that, `fjs web` on a busy port printed the URL it was serving and
was then killed by an unhandled `EADDRINUSE`; now the failure comes back through
the effect's channel and the program exits `1` with
`listen EADDRINUSE: address already in use 127.0.0.1:8080`.

## Deliberately absent

No directory listing, no range requests, no compression, no caching headers, no
TLS, no configuration beyond the two positional arguments. A directory requested
without a trailing slash is not redirected to one — `/docs` is not a regular
file, so it answers `404` where `/docs/` serves `docs/index.html`. Port `0` is
refused with the out-of-range values: Node reads it as "any free port", and
nothing here can ask which one it got, so the URL it printed would name a dead
port.

**A `CONNECT` is answered by the runner, not by this module.** Node routes it to
the server's `connect` event, so it never reaches a listener at all, and with no
handler there the socket is dropped without a byte of HTTP. The Node runner
answers `501 Not Implemented` — not `405`, since that must carry `Allow` and
only a listener knows what it allows, while `501` is precisely a method the
server cannot support for any resource. That is true of every server the effect
layer can build: a `RequestListener` maps a request frame to a response frame
and has no vocabulary for a tunnel.

**The entry checked is not the entry read.** `stat` and `readFile` are two
operations on a name, so an entry swapped between them answers for something
that is gone: an oversized file becomes `500` instead of `413`, and a FIFO is
opened despite the `isFile` guard. Doing it properly means reading through one
opened handle, and `Fs` offers no handles:
[stat-then-read](./todo/stat-then-read.md). Whoever can swap an entry inside the
served tree can already put anything there, so the window costs the *promises*
in the table above rather than the boundary itself.

**Symlinks are followed.** `resolve` decides containment from the URL, which a
link inside the root can defeat by pointing outside it — the root boundary holds
for paths, not for the file system's own indirection. Checking it properly needs
the target's real path, and there is no `realpath` effect yet:
[symlink-containment](./todo/symlink-containment.md). Until then, the loopback
binding is what bounds it, and a tree with unaudited links is not one to serve —
a `node_modules` or `.git` link is ordinary enough that this is a real caveat and
not a theoretical one. **It gates `--host`**: this server must not become
reachable from another machine while the root boundary can be walked out of.
