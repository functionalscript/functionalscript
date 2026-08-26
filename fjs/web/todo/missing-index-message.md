## missing-index-message. A directory with no index reads as a bad URL

**Priority:** P3
**Status:** open

### Problem

`fjs web` answers `/` with `not found` when the served root has no
`index.html`, which describes the file the server looked for and not the
request the client made. The URL was right, the root was right, and the one
thing missing is a file the operator generates — but the sentence names none of
that, so the first reading is that the address is wrong.

It is reachable from a clean checkout. `index.html` is a build artifact and is
gitignored, so `fjs web` in a fresh tree answers `not found` at `/` until
`npm run index-html` has run. Nothing in the response points at that.

The same sentence covers every other refusal:

| request | today |
|---|---|
| `/` with no `index.html` in the root | `404 not found` |
| `/fjs/` — a directory that exists, with no index | `404 not found` |
| `/no-such-dir/` | `404 not found` |
| `/fjs/web/nope.md` | `404 not found` |
| `/.git/` | `404 not found` |
| `/README.md/` — a trailing slash onto a regular file | `500 io error: ENOTDIR` on POSIX, `404 not found` on Windows |

Byte-identical, the first five. That is not an oversight for `/.git/`: refusing
a dot-prefixed path as *absent* is what keeps its existence undisclosed, per
`resolve`'s note and "Deliberately absent" in [`../README.md`](../README.md).
So the fix is not "say more when a file is missing" — it is to say more about
**what was asked for** without saying more about what is on disk.

The last row is the exception, and it sits in exactly the shape this issue
triggers on: a directory-form request whose status already tells an existing
regular file from nothing. It is filed separately as
[notdir-status](./notdir-status.md), because the message is not what is wrong
with it.

### Proposal

Give a directory-form request its own sentence, decided by the shape of the
URL rather than by the file system. Such a request is one the server answered
by appending `index.html`, and saying so discloses nothing: the client sent
that path and already knows its shape.

```
no index.html in /fjs/
```

**Directory-form is not "ends in a slash".** `resolve` asks
`segments.length === 0 || decoded.endsWith('/')`, so a path that *parses* to
nothing qualifies too — `/.`, `/%2E`, `/a/..` and `/fjs/..` all get
`index.html` appended and none ends in a slash. Verified: each answers `200`
against a root that has one. A trailing slash is sufficient, not necessary, and
an implementation keying off it alone would leave these on the old sentence.

**A hidden path keeps `not found`, though it is directory-form too.**
`resolve` refuses a dot-prefixed segment *before* computing `isDirectory`, so
`/.git/` never reaches the branch that appends `index.html` — and that
ordering is right rather than an obstacle to route around. The new sentence is
a claim about having looked; for a hidden path the server refused without
touching the disk, so `no index.html in /.git/` would describe work it did not
do. Non-disclosure is unaffected either way, which is worth stating plainly:
the hidden refusal never consults the disk, so `/.git/` and `/.nonexistent/`
answer identically whichever sentence they carry — verified. What separates
them from `/foo/` is that the client wrote a dot, which the client already
knows. So the question is which message is true, and only one of them is.

Three constraints on the wording:

- **Name the URL path, not the resolved path.** `fileResponse` already
  prefers `errorSummary` to `errorMessage` so a client is not handed the
  server's filesystem layout; a message reading `no index.html in
  /home/…/fjs/` would give back exactly that.
- **Do not distinguish an existing directory from a missing one.** Telling
  `/fjs/` apart from `/no-such-dir/` requires a second `stat` and turns the
  response into a directory-existence oracle — the enumeration the identical
  `404`s are written to deny, per the dot-prefixed-existence note in `resolve`
  and "Deliberately absent" in [`../README.md`](../README.md). (Not the
  loopback and `Host` checks: `respond` answers `403 host not served` before
  `resolve` runs, so a rebound origin never reaches a `404` at all. Those
  defend the socket; this defends what an answer says.) Both should keep
  answering the same sentence.
- **Echo the percent-encoded spelling, never the decoded one.** The candidates
  disagree — the raw target, the decoded path and the re-joined segments
  differ for `/fjs%2F` (decodes to `/fjs/`) and `/fjs/./` (re-joins to `fjs`)
  — but the choice is not only cosmetic. Nothing on the way in excludes a
  control character: `percentDecode` rejects a malformed escape and invalid
  UTF-8, `resolve` rejects NUL separately, and `/%1B%5B31m/` and `/a%0Ab/` are
  none of those — they decode to real control characters. A body is not only
  read by browsers: `curl` and `wget` write
  it to a terminal, where an ANSI or OSC sequence is acted on rather than
  displayed. `text/plain` and `nosniff` bound what a *browser* does with the
  bytes and say nothing about that, so calling them harmless was wrong.

  The encoded form cannot carry the problem. A raw control byte never reaches
  this module — Node's parser answers `400 Bad Request` on the request line
  before the listener runs, verified — so in the target such a character
  exists only as the printable text `%1B`. Echoing the target's path as
  received therefore needs no escaping pass and no list of dangerous
  characters, which is the version of this that cannot rot. Echoing a
  normalized path instead is fine on the same terms, provided it is
  re-encoded before it reaches the body; what must not happen is quoting
  `percentDecode`'s output directly.

  Nothing echoes anything today — the current answer is the constant `not
  found` — so this is a property to build in, not a bug to fix. And nothing
  needs plumbing for it: `respond` already binds `parseTarget(url)` for the
  host check, so `target.path` is in scope where the message would be built.
  Only the `isDirectory` fact below has to travel.

The obstacle is that the distinction is gone by the time it is needed.
`resolve` computes `isDirectory` and then returns `Result<string, Refusal>` —
a path and nothing else — so `respond` cannot tell an appended `index.html`
from a requested one, and `fileResponse` sees only a `stat` failure. Options:

1. Widen what `resolve` returns, so the routing fact travels with the path.
   Keeps every routing decision in the one pure function that owns them, at
   the cost of a change to `Resolve` and its proofs.
2. Re-derive it in `respond` from the URL. No type change, but it puts a
   second copy of "what counts as a directory request" outside `resolve`,
   which is the split the module header exists to state.
3. Key off the resolved path ending in `index.html`. Cheapest and wrong: it
   cannot tell `/index.html` — a request naming the file — from `/`.

(1) is the one that matches how the module is factored.

Two spellings are open. A literal `/index.html` should perhaps get the new
sentence too — the message would be true, and treating it as a directory
request would not be. And `/fjs/..` is directory-form without looking it, so
`no index.html in /fjs/..` names a path that reads as a file's neighbour;
echoing the parsed path instead would name a directory the client never wrote.
Either answer satisfies the encoding constraint above — a normalized path is
re-encoded on the way out — so that choice stays open on its own merits.

### Tasks

- [ ] Decide how the directory-form fact reaches `respond` — (1) above unless
      something argues otherwise.
- [ ] Answer a directory-form `404` with a sentence naming `index.html` and
      the URL path, leaving every other `404` as it is. Key it off `resolve`'s
      own predicate, not off a trailing slash — and off the branch that
      appends `index.html`, so a hidden path keeps `not found`.
- [ ] Prove `/.git/` still answers `not found`, and answers it identically to
      `/.nonexistent/`, so the refusal stays ahead of the new sentence.
- [ ] Prove `/%1B%5B31m/` echoes `%1B%5B31m` and not the escape it names, so
      no answer this server writes can drive a terminal.
- [ ] Prove that `/fjs/` and `/no-such-dir/` still answer identically — and
      `/README.md/` with them, which needs
      [notdir-status](./notdir-status.md) first. Without it the proof passes
      while the directory-form shape still leaks. It will pass anyway for
      `/locked/` and `/loop1/`, which that issue scopes out on purpose, so
      state what the proof covers rather than letting it read as "no
      directory-form request discloses".
- [ ] Update the response table in `module.f.mjs` and the prose in
      [`../README.md`](../README.md).

### Related

- [`fjs/web`](../README.md) — "Deliberately absent", where the missing
  directory listing and the `/docs` vs `/docs/` split are settled.
- [notdir-status](./notdir-status.md) — a directory-form request whose status
  already discloses, which this issue's proof depends on. Not the only one: it
  scopes itself to `ENOTDIR` and leaves `EACCES` and `ELOOP` at `500`
  deliberately, so directory-form requests still do not answer uniformly on a
  POSIX host.
- [`fjs/website`](../../website/) — writes the `index.html` whose absence this
  is about.
