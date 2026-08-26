## notdir-status. A path through a regular file answers `500`, and only on POSIX

**Priority:** P3
**Status:** open

### Problem

`GET /README.md/` answers `500 io error: ENOTDIR` on Linux and macOS. The
request is client-caused — a regular file is not a directory, and nothing under
it can exist — so by this module's own doctrine it belongs with the `404`
answers rather than in the channel reserved for the host failing at something it
should have managed. The same argument is already made about `%00`: *"a NUL is a
malformed URL, not a host error"*, and again in
[name-too-long-status](./name-too-long-status.md) for `ENAMETOOLONG`.

`isNotFound` (`fjs/effects/node/module.f.mjs`) tests `ENOENT` and nothing else,
so `fileResponse` falls past its `404` branch to the `500`.

**It is also a disclosure, which `ENAMETOOLONG` is not.** The status separates
a path that runs through an existing regular file from one that runs through
nothing:

| request | POSIX | Windows |
|---|---|---|
| `/nope.md/` — nothing there | `404 not found` | `404 not found` |
| `/README.md/` — an existing regular file | `500 io error: ENOTDIR` | `404 not found` |

So on POSIX a trailing slash answers "is there a regular file at this name?",
which is the enumeration the identical-`404` answers elsewhere are written to
deny — see the dot-prefixed-existence note in `resolve` and "Deliberately
absent" in [`../README.md`](../README.md).

**And the status is platform-dependent**, which is the part that makes it worth
filing beyond its sibling. Windows returns `ENOENT` where POSIX returns
`ENOTDIR`, so the same request is `404` on one host and `500` on another, and a
proof written on one platform cannot see the other's answer. Verified directly:
`statSync('README.md/index.html')` reports `ENOENT` on `win32`.

Reported on
[#1714](https://github.com/functionalscript/functionalscript/pull/1714), where
it contradicted a claim that the `404` was uniform.

### Proposal

Answer `404`: a path that descends through a regular file names nothing, and
whether the file it descends through exists is not a distinction worth
publishing.

**Test it in `fileResponse`, not in `isNotFound`.** Widening the shared
predicate is the tempting reading — `ENOENT` and `ENOTDIR` are one fact
wearing two names, and which one a host says is not a distinction this module
wants. But `isNotFound` has two other callers, and both document, in prose, an
intent that widening would violate:

- `fjs/cas`'s `list` answers `ok([])` for an absent store and surfaces
  everything else, because *"a `.cas` that exists but cannot be read
  (permissions, corruption) is a genuine storage error and is surfaced, not
  masked as 'no hashes'"*. A store path with a regular file among its
  components would start reporting as an **empty store**.
- `fjs/cas/evo`'s `decodeReadRevision` splits `revision not found` from
  `failed to read revision`, because *"calling any of those 'not found' would
  deny a stored revision exists"*. It would start denying one.

Both would fail quietly, in the direction that loses data rather than the one
that raises an error, and neither is a trade this issue is entitled to make on
their behalf. A predicate named for one errno is the wrong place to put a
second one that only some of its callers want.

So the answer is local: `fileResponse` already tests `notRegular` and
`tooLarge` before reaching `isNotFound`, and this is the same kind of test —
what *this server* will answer as absent. If a later caller wants the same
reading, the thing to share is a named predicate that says so, not a broader
`isNotFound`.

**But validate the root first, or the mapping swallows an operator error.**
`ENOTDIR` does not only arise below a valid root. `fjs web README.md` serves a
regular file as its root, so `join` produces `README.md/index.html` and *every*
request stats a path descending through a file — the same errno, and nothing
inside `fileResponse` can tell it from `/README.md/` under a good root. A
blanket mapping would answer `404 not found` to every request against a
misconfigured server, which is the one case where `500` was telling the
operator something true.

So the root is checked in `main`, before `listen`: if it is not a directory,
`errorExit` the way an out-of-range port already does. That is better than a
per-request comparison of the offending component against the root — it needs
no extra `stat` on the serving path, and it fails at the moment the mistake
was made rather than on someone else's request.

**But a startup check alone does not establish the invariant the mapping
needs.** Rename the root, or replace it with a regular file, and every later
`stat(root/…)` is `ENOTDIR` from the root itself — which `fileResponse` would
then report as a client-caused `404` for the rest of the process's life. That
is not the request-local window
[stat-then-read](./stat-then-read.md) describes, where two calls race
microseconds apart; this one opens once and stays open, and it turns the
operator's mistake into a lie told to every visitor. An earlier draft of this
file claimed the two windows were the same size. They are not.

So the mapping re-checks: on `ENOTDIR`, `stat` the root, and answer `404` only
if it is still a directory — otherwise `500`, which is again the true answer.
The cost sits where it belongs, since `ENOTDIR` is the rare path and the
serving path is untouched. What remains is a genuine race, between that
re-check and the `stat` that produced the error, and it is the request-local
kind that `stat-then-read` already covers — a wrong status in a vanishing
window rather than a wrong status forever.

Keep the startup check as well. It is what turns the common case — a mistyped
root — into immediate feedback instead of a `500` that waits for a visitor.

Worth noticing that this is already the answer on Windows, silently: `stat`
there reports `ENOENT`, so `fjs web README.md` starts happily and answers
`404` to everything — verified. The check makes both hosts say the same true
thing at startup instead of two different misleading things per request.

**The check needs an operation the effect layer does not have.** `FileStat` is
`{ size, isFile }`, so `isFile === false` is not "is a directory" — it also
covers a FIFO, a device, a socket, and the virtual runner's `JsModule`, whose
`_Entity` is `readonly Vec[] | Dir | JsModule`. Serving any of those as a root
is the same operator error as serving a regular file, so the check has to name
what it wants: **add `isDirectory` to `FileStat`**, in the node runner and the
virtual one together, and reject a root that is not one — including the case
where both flags are false.

Not `readdir(root)`, which needs no new API and is the obvious alternative. It
answers a different question: a directory may be traversable without being
listable — mode `--x` permits opening a known path under it while `readdir`
fails `EACCES` — so a root that this server can serve perfectly well would be
refused at startup. Reading a whole directory to discard it is the smaller
objection.

Failure handling is the same `errorExit` either way, and covers two cases:
`stat` failing at all — a root that does not exist — and a root that exists
and is not a directory. Both are the command line being wrong, which is what
`main` already reports that way for a port.

**Scope: `ENOTDIR` only, and the other two stay at `500` deliberately.** Two
more `stat` failures reach the same directory-form shape and disclose the same
way, on POSIX:

| request | POSIX |
|---|---|
| `/locked/` — a directory with an `index.html`, mode `000` | `500 io error: EACCES` |
| `/loop1/` — a symlink cycle | `500 io error: ELOOP` |

Both are left as they are, because the doctrine that makes `ENOTDIR` a `404`
does not reach them. `ENOTDIR` fires on any ordinary file — every served tree
has thousands, so any client can ask — which is what makes it client-caused. A
mode-`000` directory or a symlink cycle is an entry an operator placed, and a
`500` saying the host could not read what it was pointed at is not obviously
the wrong answer. Reopen them on their own evidence, not as a corollary of
this.

`EISDIR` needs no entry: `stat` succeeds on a directory and `isFile` is false,
so it is already `notRegular` → `404`.

**All three are POSIX-only.** Windows has none of them — `ENOTDIR` arrives as
`ENOENT` (see the table above), mode `000` does not stop traversal, so
`stat('locked/index.html')` simply succeeds, and a symlink cycle reports
`ENOENT` rather than `ELOOP`. So the oracle is a property of POSIX hosts, and
a proof of its absence has to run on one.

The obstacle is the same as its sibling's: the virtual file system never
reports `ENOTDIR`, so the branch would be unreachable, which the coverage gate
rejects and `fjs/AGENTS.md` §1.2 says to restructure away rather than leave
uncovered. So this is two changes — teach the virtual file system to refuse a
path that descends through a regular file, then map the error.

### Tasks

- [ ] Report `ENOTDIR` from the virtual file system for a path descending
      through a regular file.
- [ ] Add `isDirectory` to `FileStat`, in the node runner and the virtual one.
- [ ] Reject a non-directory root in `main`, before `listen` — including a
      root that does not exist, and one that is neither file nor directory.
- [ ] Answer `404` for it from `fileResponse`, leaving `isNotFound` alone —
      but only after re-checking that the root is still a directory, so a root
      replaced after startup keeps answering `500`.
- [ ] Prove `/README.md/` and `/nope.md/` answer identically, through the
      virtual runner — `proof.f.mjs` already drives `respond` that way, so
      once the virtual file system reports `ENOTDIR` the proof runs anywhere
      and covers the branch on every host. It must not be conditioned on the
      host's `stat`, which would leave the new branch uncovered on Windows.
      The proof covers `ENOTDIR` and says so: `/locked/` and `/loop1/` stay at
      `500` by the scoping above, so it must not claim directory-form requests
      disclose nothing in general.
- [ ] Check the real answer on a POSIX host once, separately — the virtual
      file system models what the host does, and this is the issue where that
      model was wrong on two platforms at once.
- [ ] Update the response table in `module.f.mjs` and
      [`../README.md`](../README.md).

### Related

- [name-too-long-status](./name-too-long-status.md) — the same shape for
  `ENAMETOOLONG`, without the disclosure or the platform split.
- [missing-index-message](./missing-index-message.md) — triggers on the
  directory-form request this leaks through.
- `fjs/effects/node/module.f.mjs` — `isNotFound`, the `ENOENT`-only test this
  deliberately leaves alone.
- `fjs/effects/node/types.ts` — `FileStat`, which grows `isDirectory` for the
  root check.
- `fjs/cas/module.f.mjs` and `fjs/cas/evo/module.f.mjs` — its other two
  callers, whose documented readings settle that question.
- `fjs/effects/node/virtual/module.f.mjs` — the file system that would grow the
  error, and the one `proof.f.mjs` already drives `respond` through.
- [stat-then-read](./stat-then-read.md) — the request-local replace-underneath
  race, which is what the `ENOTDIR` re-check degrades to, and which a startup
  check on its own would have been much worse than.
