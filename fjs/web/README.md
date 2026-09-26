# fjs web — static file server

```
fjs web [root] [port]
```

Serves `root` (default `.`) over HTTP on `port` (default `8080`), bound to
loopback. One request, one file — of any size, and without holding it: the body is
read from one open file a chunk at a time, as fast as the client takes it. One
request, one file:

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

`respond` answers with a **frame**, not with bytes. The body it carries is a list
the runner pulls, and the file it reads from is open by the time the frame is
built, so the frame also carries the `release` that gives that file back. The
runner is the party that runs it, because the runner is the only one present at
every way a response can end — a `HEAD` whose body it never pulls, a client that
hangs up mid-download, a refusal before the headers.

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
| any other host failure | `500` |

Failures carry a `text/plain` body. A `500` reports the error *kind*
(`errorSummary`) rather than the host's message, which is where the host puts
the absolute path it could not read — a client is not entitled to the server's
filesystem layout.

Every response states its `Content-Length`, **taken from the `fstat` of the open
file the body is read through, with the reads bounded by that same number.** The
two are one measurement rather than a promise and a hope: a size read from a *name*
before the bytes are is a guess about a file that may have grown or shrunk by the
time the read reaches it — a fold that ended at the end of the file would stream
the surplus past the count already promised — and a handle the reads come from
cannot answer one thing to the `fstat` and another to the read.

The runner counts as well, and destroys the socket where the count and the header
disagree in **either** direction, because that bound is one producer's discipline
and `ServerResponse` is every listener's. A body longer than it promised has its
surplus parsed by the client as the next response's status line; a body shorter
than it promised is not noticed on the server side at all, and what tells the
client is an idle timeout minutes later.

`HEAD` is answered exactly like `GET`, body included — and **the runner is now the
party that drops it**, where Node used to be: a gate declines to pull a body Node
will not carry, so a multi-gigabyte file is not read at the speed of the disk to
send nothing. The headers go out as they stand, so the client learns the size it
asked for. Measured against the host in
[`fjs/effects/node/proof.mjs`](../effects/node/proof.mjs)
(`createServer.suppressesABodyNodeWillNotCarry`), because what a host does with a
body it is offered is a claim only the host can settle — and there on every runtime
the suite runs, since what is claimed is the runner's own behaviour rather than
Node's.

A response may **not** declare its own `Transfer-Encoding`: framing is between the
runner and the socket, and a listener that writes one is answered `500` before the
headers. Neither may a body with no `Content-Length` go out on a request the host
will not frame chunked — such a response is delimited by the connection closing, so
a producer that failed mid-body would hand the client a truncated body byte for
byte identical to a whole one. That is `500` too. Neither refusal is reachable
through this module, which declares the `fstat` size and writes no framing header;
they are there for the next listener.

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

One question is asked before any byte is read, and it is whether the entry is a
**regular file**. A FIFO, a device or a socket is answered `404` and never read: a
FIFO is a stream with a writer at the other end, not a file with contents, and a
served tree with one in it would stall every other response if a request waited on
one.

**It is asked of the open file rather than of the name**, and that is the whole of
what reading through a handle buys. `fstat` on the descriptor the body will be read
through describes the entry those reads come from; a `stat` of a name describes
whatever the name held at that moment, and the two need not be the same entry. The
same `fstat` gives the size the `Content-Length` declares, so the guard and the
header are answers about one file.

That order is only possible because **the open does not wait for a writer.** A
plain read-only open of a writerless FIFO never returns — measured on Darwin with
Node 26.8.1, it left the process unable to exit at all, holding a thread-pool slot
for as long as it lived — so a guard that asked the descriptor could never be
reached at all. `open` passes `O_NONBLOCK`: the FIFO opens at once, `fstat` says it
is no regular file, and the handle is given back unread. Windows has neither the
flag nor a FIFO an `open` reaches, and gets the open it always had.

It used to ask about the size as well, and that question retired with the
ceiling: nothing here bounds a file any more. The kind is not the same question
wearing a different name — a FIFO stats as zero bytes and would have passed every
bound there ever was.

A **directory** opens successfully on POSIX and is answered `404` from its `fstat`;
Windows refuses the open with `EISDIR` and that is mapped to `404` too, so one
request does not have two statuses depending on the host it ran on.

### A path that descends through a file

`/README.md/` asks for `README.md/index.html`, and a POSIX host refuses that
`open` with `ENOTDIR`: the name before the slash exists and has nothing under
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
read what it was pointed at is not obviously the wrong answer for them.

**And only while the root is a directory.** `fjs web README.md` would make every
request stat a path descending through a file, and mapping that to `404` would
tell every visitor the site is missing and the operator nothing at all. So the
root is checked twice over: `main` refuses a root that is not a directory before
it binds anything — reported on `stderr` with exit code `1`, like a bad port —
and the `ENOTDIR` mapping re-stats the root before answering, so a root
*replaced* while the server runs goes back to `500`. The re-check costs a `stat`
on the `ENOTDIR` path and nothing on any other. It is a `stat` of the **root** and
not of the requested entry, so it is not the race reading through a handle closed:
what it re-reads is the operator's configuration, and the worst a stale answer can
do is turn one `404` into the `500` an operator needs to see.

A root that is *deleted* rather than replaced is not covered: every later `stat`
fails `ENOENT`, which is the ordinary `404` path, and validating the root before
accepting an `ENOENT` too would put a second `stat` on the most common answer a
static server gives to improve a diagnostic. `404` is not false in either case —
with the root gone or a file, nothing under it exists — so what the asymmetry
costs is diagnostic reach, not correctness. The version that answers both is
holding the root **open** and resolving beneath the handle — which `Fs` can now
express, since it has handles, and which would drop the re-check rather than
sharpen it. Nothing needs it yet: the two statuses it would tell apart are both
`404`, and the cost is one `stat` on the rarest answer this server gives.

`FileStat` grew `isDirectory` for the startup check: `isFile === false` is not
"is a directory", since a FIFO, a device and a socket answer that too, and
serving one of those as a root is the same mistake as serving a file.

**Not `readdir(root)`**, which is the obvious alternative and needs no new
operation. It answers a different question: a directory may be traversable
without being listable — mode `--x` permits opening a known path under it while
`readdir` fails `EACCES` — so a root this server can serve perfectly well would
be refused at startup. Reading a whole directory only to discard it is the
smaller objection.

### There is no size limit, and what replaced it

There used to be one, and it was the `Vec`: `readFile` answers a single one,
which caps at 131,072 bytes, and `ServerResponse.body` was one too, so a larger
file was refused with `413` rather than truncated. A demo that tried to replace
`python3 -m http.server` with this command found eleven of the modules its page
imports over that ceiling and reverted the swap
([#1819](https://github.com/functionalscript/functionalscript/issues/1819)).

The body is now a **lazy list the runner pulls at the socket's pace** — one chunk
a pull, from one open file — so the response frame can carry any file and the
process holds a chunk of it rather than the whole thing. `res.write` answering
`false` is what parks the next pull, so a client that reads slowly is a server that
reads slowly; a client that hangs up is a server that stops reading. Serving a
gigabyte costs what serving a kilobyte costs, in memory.

Both things the old refusal was protecting are still held, and by a stronger
guarantee than the chunk list gave: the bytes are one file's because they come from
one **open file**, which cannot be replaced underneath the reads the way a name can,
and the declared length is that file's own `fstat` size with the reads bounded by
it, so it cannot promise a count the body does not have in either direction.

There was an intermediate route, and it is recorded rather than deleted: a chunk
list read through `readWhole`, which lifted the cap and left the whole file in
memory. It remains what a caller who wants a file's bytes in hand should use, and
`fjs/git` does.

**A file whose size is a lie is served as its size**, which is the one thing the
two routes answer differently. A procfs file is a regular file of nought bytes that
yields thousands when read; `readWhole` read it to the end, and this reads it to the
declared length, so such a file is served as `200` with no body. The answer stays
self-consistent — the header and the bytes agree — and a served tree of ordinary
files never meets the case, but pointing this server at `/proc` no longer shows
their contents.

The **request** side still has the cap — see "Request bodies" below — which is
stage 2 of
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

The runner counts as it reads — into an array it mutates, for a reason that is
about counts rather than bytes: rebuilding the array per chunk copies everything
received so far on every chunk, and 20,000 one-byte chunks is 20 KB of payload and
200 million copies. A cap on payload size is not a cap on chunk count, and a
request that will be refused must not cost more than one that is served. Measured
here: 2,794 ms to refuse that request before, 167 ms after, and doubling the chunk
count now doubles the time instead of quadrupling it — again one machine's
numbers, with the change in shape rather than the milliseconds being what is
claimed.

`readWhole` does **not** collect its chunks that way, and the difference is who
picks the count. Its window is a fixed 128 KiB, so the number of chunks is the
file's size divided by it, and the rebuild's reference copies are noise beside
reading the file. A request body has no such floor: the client picks both the
size and the count, and can make the second large while the first stays tiny.
So this stays one exception, not a rule. A served file does not reach `readWhole`
at all any more — the response body is pulled a chunk at a time and never
collected — and `fjs/git` is its caller now.

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

All of it goes away with a streamed *request* body, which is stage 2 of
[streaming-http-bodies](../effects/node/todo/streaming-http-bodies.md) — the
response half above has landed and this half has not, so the cap a client runs
into is the one on what it *sends*.

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
queued, **pulls the body it answered with**, and records what went out. No socket
is involved, and it is the same listener the Node runner would drive — the same
gates in the same order, the same byte count against the declared length. The
listener rides in the handle rather than in the state so that two servers in one
program are two servers there too, as they are on a host.

It pulls rather than reads the frame and stops, and the difference is the whole
point of a lazy body: a proof that asserted about the frame alone would be
asserting about a response no byte of which had been produced. What it records is
the chunks that went out **and what stopped them**, since a body that was cut short
holds the same chunks a whole one does up to the point they differ.

And it runs the `release` the response carries, which is what makes the leak
provable: the virtual file system keeps its open files in the state, so every case
asserts that nothing is still open once the request is over. That assertion is
shown failing, on a listener that opens a file and writes the pure end as its
`release`, in the virtual runner's own proofs.

Two claims are left that no fixture can make, and they live in
[`./proof.mjs`](./proof.mjs) beside a real socket: that a file far larger than the
process should hold arrives byte for byte and in order, and that the process does
not hold it.

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

**Symlinks are followed.** `resolve` decides containment from the URL, which a
link inside the root can defeat by pointing outside it — the root boundary holds
for paths, not for the file system's own indirection. Checking it properly needs
the target's real path, and there is no `realpath` effect yet:
[symlink-containment](./todo/symlink-containment.md). Until then, the loopback
binding is what bounds it, and a tree with unaudited links is not one to serve —
a `node_modules` or `.git` link is ordinary enough that this is a real caveat and
not a theoretical one. **It gates `--host`**: this server must not become
reachable from another machine while the root boundary can be walked out of.
