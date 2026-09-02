## The reads answer `ENOENT` where `stat` answers `ENOTDIR`

**Priority:** P3
**Status:** open

### Problem

`resolveFile` in [`../module.f.mjs`](../module.f.mjs) answers `ENOENT` for every
remaining path that is not exactly one segment. Two different situations reach
that guard, and a host distinguishes them:

| case | `readFile(p)` where… | this runner | a host |
| --- | --- | --- | --- |
| **absent** | `a` is absent, `p = 'a'` or `'a/child'` | `ENOENT` | `ENOENT` everywhere |
| **through-a-file** | `a` is a file, `p = 'a/b'` | `ENOENT` | `ENOTDIR` on POSIX, `ENOENT` on Windows |
| **on-a-directory** | `a` is a directory, `p = 'a'` | `ENOENT` | `EISDIR` on Linux, macOS and Windows; **no error at all on FreeBSD** |

The cases are named because this table has already been reordered once and the
prose below it did not follow; refer to them by name, never by position.

**on-a-directory** is the one that is not a single host answer. Node documents
`readFile` of a directory as platform-specific: an error on macOS, Linux and
Windows, and *a representation of the directory's contents* on FreeBSD
(`fs.readFile` in `@types/node`, and the same note in Node's own docs). So
`EISDIR` is what the three platforms this repository's CI runs report, not a
contract every host honours — and **through-a-file**'s `ENOTDIR` carries the
Windows caveat `statPath` already records.

`stat` already models **through-a-file**. `statPath`'s JSDoc argues the case at
length — "a path that descends through a non-directory is `ENOTDIR`, not
`ENOENT`" — and answers `enotdir` so that a caller's `ENOTDIR` branch can be
reached and proven here. The reads and `writeBytes` do not, so **one runner
answers two different codes for one path shape**: `stat('a/b')` says `ENOTDIR`
and `readFile('a/b')` says `ENOENT`, for the same `a` and the same `b`.

The consequence is the one `statPath` names: a caller that branches on `ENOTDIR`
after a *read* — or on `EISDIR` after reading a directory, which is the more
common guard — has no fixture that reaches it. The branch cannot be proven
against this runner, and a proof that reads `ENOENT` there is evidence about
the runner rather than about the host.

Found by the Codex review bot on
[#1850](https://github.com/functionalscript/functionalscript/pull/1850), against
a proof comment that claimed `ENOENT` was the host's answer. It is not; the
comment now says so, and the fixtures pin what is actually returned.

### Proposal

Not decided. `enotdir` already exists in the module, so **through-a-file** is
nearly free; **on-a-directory** is the one that needs a decision, and
**absent** is already right.

**The order of the guards is the whole difficulty, and `p.length` alone cannot
carry it.** `operation` hands the op the *full* remaining path in two different
situations — the first name is absent, or it exists and is not a directory —
so `readFile('missing/child')` and `readFile('a/child')` with `a` a file both
arrive with `p.length === 2`. A length test alone would answer `ENOTDIR` for
the **absent** one, where a host says `ENOENT`. `statPath` gets this right by asking
`entryOf(dir, path[0]) === undefined` **before** its length guard, and any
change here has to copy that ordering rather than merely cite it:

```js
if (p.length === 0) { /* the path was a directory */ }
const file = entryOf(dir, p[0])
if (file === undefined) { return enoent }   // absent first name, any length
if (p.length !== 1) { return enotdir }      // it exists and is not a directory
```

- **`ENOTDIR` for through-a-file, once presence is checked first.** With the
  ordering above, `resolveFile` answers `enotdir` only where `statPath` does.
  Small, and it makes the two operations agree.
- **`EISDIR` for on-a-directory — but `p.length === 0` does not mean "a
  directory".** An empty `p` has *two* sources, and the document that only
  counts one of them will get this wrong:

  1. **`parse` returned `[]`** — `.`, `''`, and anything a `..` collapses to
     nothing, since `parse` applies `..` lexically before any operation looks
     at the file system.
  2. **`operation` descended all the way** — every segment named an existing
     directory, so the op is called with nothing left. `readFile('realdir')`
     arrives this way even though `parse('realdir')` is `['realdir']`.

  The second is the ordinary case, and the one the `EISDIR` option is *for*.
  Measured against this runner and a Linux host:

  | input | reaches `resolveFile` with `[]` via | here | a host | |
  | --- | --- | --- | --- | --- |
  | `realdir` | descent | `ENOENT` | `EISDIR` | wrong today |
  | `.` | `parse` | `ENOENT` | `EISDIR` | wrong today |
  | `realdir/..` | `parse` | `ENOENT` | `EISDIR` | wrong today |
  | `''` | `parse` | `ENOENT` | `ENOENT` | right today |
  | `missing/..` | `parse` | `ENOENT` | `ENOENT` | right today |
  | `a/b/../..` | `parse` | `ENOENT` | `EISDIR` if `a/b` are directories, else `ENOENT`/`ENOTDIR` | depends |

  So the single length guard is not accidentally right — it is right for the
  two inputs that name nothing and wrong for every input that reaches a real
  directory, which is the whole point of the option. What it cannot do is
  separate the rows: `statOp`'s `path === ''` guard rescues one of them, and
  the rest need the walk to be physical, because `realdir/..` and `missing/..`
  are the same string shape and the same `parse` output with different host
  answers. That is
  [lexical-path-resolution](./lexical-path-resolution.md), a **precondition**
  of this option rather than a sibling of it.

  Beyond that, this needs a new error value and a decision about `writeBytes`,
  which reaches the same guard. It is also the case where "match the host" does
  not settle anything: FreeBSD does not fail at all, so choosing `EISDIR` is a
  deliberate policy — model the platforms the CI runs and the ones callers are
  on — rather than the answer a host gives. Say that in the code if it is
  chosen, or a later reader will take it for parity the way the docstring this
  issue came from did.

- **Leave it, and say so.** Answering one code for every non-file is simpler.
  What this option cannot claim is host parity — an earlier draft of this
  bullet said a caller treating all three alike is right everywhere, and
  **on-a-directory** is not an error on FreeBSD at all, so it is not. If this is
  the choice it is a decision to model less than a host does, and `statPath`'s
  argument for the opposite has to be reconciled with it rather than left
  standing next to it.

### Who would notice

`ENOTDIR` is already load-bearing one module away. `fjs/web`'s `answer`
re-checks the served root **only** when the code is `ENOTDIR`, and that one
branch separates two answers the module insists on keeping apart: a path
descending through a file under a valid root is `404`, identical to a missing
name so a trailing slash cannot be used to ask whether a file exists; while a
served **root** that has itself been replaced by a file is `500`, because `404`
there would report the operator's mistake as the client's. `throughFile` and
`rootNotDirectory` in
[`../../../../web/proof.f.mjs`](../../../../web/proof.f.mjs) pin both, against
this runner deliberately, because the status differs by platform on a real
host.

That works because `respond` takes its `ENOTDIR` from `stat`, which models it,
and not from a read, which does not. So the gap is narrow and worth stating
exactly: **a caller that needs `ENOTDIR` from a read has no fixture here**, and
`ENOENT` will not substitute — `isNotFound` is `code === 'ENOENT'` and
`fileResponse` maps it to `404`, so the distinction is simply lost rather than
reported differently.

No current plan needs that.
[stat-then-read](../../../../web/todo/stat-then-read.md) replaces the
`stat`-then-`readFile` pair with an `open`/`fstat`/bounded-read handle, not
with a bare read, and a root held open would drop the re-check rather than
depend on it. So this issue does not gate that one; it bounds what a future
caller can ask a read for.

Whichever option is chosen, then:

- `readFile('missing/child')` wants a fixture of its own. Nothing today pins
  that an absent first name answers `ENOENT` rather than whatever a new
  longer-path branch returns, which is exactly the case a length test would
  have broken.
- The three `*NestedThroughFile` fixtures in
  [`../proof.f.mjs`](../proof.f.mjs) pin the current codes, so they are the ones
  that have to change, deliberately, with it.

### Tasks

- [ ] Decide, reconciling with `statPath`'s JSDoc either way.
- [ ] Whatever is chosen, pin `readFile('missing/child')` — an absent first
      name at `p.length > 1` — so the presence-before-length ordering cannot
      be lost.
- [ ] If `EISDIR` is chosen: settle
      [lexical-path-resolution](./lexical-path-resolution.md) first, since
      `readFile('missing/..')` is indistinguishable from `readFile('.')` until
      the walk is physical; give the reads and `writeBytes` `statOp`'s
      `path === ''` carve-out in the same change; and pin all three of
      `readFile('realdir')` and `readFile('.')` as `EISDIR`, `readFile('')` and
      `readFile('missing/..')` as `ENOENT`. `realdir` is the one that arrives
      by descent rather than through `parse`, so it is the row a fixture built
      only from odd path strings would miss.
- [ ] If the codes change, update the `*NestedThroughFile` fixtures and the
      comment above them in the same commit.

### Related

- `statPath` in [`../module.f.mjs`](../module.f.mjs) — the `ENOTDIR` argument
  this diverges from, made for `stat` and not carried to the reads.
- [lexical-path-resolution](./lexical-path-resolution.md) — traversal rather
  than kind, and a **precondition** of this issue's `EISDIR` option rather than
  a sibling: `parse` collapses `missing/..` to the same empty list `.` gives,
  so `EISDIR` cannot be assigned to an empty `p` until the walk is physical.
  Its proposal also already carries this issue's guard ordering from the
  descent side — "fail with `ENOENT` when a component is missing, and with
  `ENOTDIR` when one is a file" — so whichever lands second must not contradict
  the first.
- [stat-then-read](../../../../web/todo/stat-then-read.md) — where `fjs/web`'s
  `stat`-then-`readFile` pair goes. It does **not** depend on this issue: its
  proposal is an `open`/`fstat`/bounded-read handle, and a root held open needs
  no `ENOTDIR` re-check at all.
- [dirent-kinds](./dirent-kinds.md) and
  [jsmodule-read-policy](./jsmodule-read-policy.md) — two more places this
  runner answers something a host would not, both about entry *kind* rather
  than traversal.
