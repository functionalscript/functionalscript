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
- **`EISDIR` for on-a-directory.** `p.length === 0` means `operation` descended
  all the way, so the path named a directory. This needs a new error value and a
  decision about `writeBytes`, which reaches the same guard. It is also the case
  where "match the host" does not settle anything: FreeBSD does not fail at all,
  so choosing `EISDIR` is a deliberate policy — model the platforms the CI runs
  and the ones callers are on — rather than the answer a host gives. Say that in
  the code if it is chosen, or a later reader will take it for parity the way
  the docstring this issue came from did.
- **Leave it, and say so.** Answering one code for every non-file is simpler.
  What this option cannot claim is host parity — an earlier draft of this
  bullet said a caller treating all three alike is right everywhere, and
  **on-a-directory** is not an error on FreeBSD at all, so it is not. If this is
  the choice it is a decision to model less than a host does, and `statPath`'s
  argument for the opposite has to be reconciled with it rather than left
  standing next to it.

### Who would notice

`ENOTDIR` is already load-bearing one module away, and in a way that turns on
exactly this issue. `fjs/web`'s `answer` re-checks the served root **only** when
the code is `ENOTDIR`, and that one branch is what separates two answers the
module insists on keeping apart:

- a request whose path descends through a file, under a valid root — `404`,
  identical to a missing name, so a trailing slash cannot be used to ask
  whether a file exists;
- every request, when the served **root** has itself been replaced by a file —
  `500`, because answering `404` would report the operator's mistake as the
  client's, "a lie told to every visitor for the life of the process".

`ENOENT` cannot reach that branch: `isNotFound` is `code === 'ENOENT'` and
`fileResponse` maps it straight to `404`. So if
[stat-then-read](../../../../web/todo/stat-then-read.md) collapses `respond`'s
`stat` and read into one read, the first case is unaffected — `404` either way —
and the second silently becomes the lie the re-check exists to prevent.

What stops that today is not luck: `rootNotDirectory` in
[`../../../../web/proof.f.mjs`](../../../../web/proof.f.mjs) pins the `500`, so
a refactor dropping the `stat` goes red rather than quiet. The consequence for
*this* issue is the ordering it implies — while the reads answer `ENOENT` for
the shape `stat` calls `ENOTDIR`, the read is not a substitute for the `stat`,
and this issue has to be settled before that refactor can be. `throughFile` in
the same file proves the `404` half against this runner deliberately, because
the status differs by platform on a real host.

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
- [ ] If the codes change, update the `*NestedThroughFile` fixtures and the
      comment above them in the same commit.

### Related

- `statPath` in [`../module.f.mjs`](../module.f.mjs) — the `ENOTDIR` argument
  this diverges from, made for `stat` and not carried to the reads.
- [lexical-path-resolution](./lexical-path-resolution.md) — the closest
  relative, and traversal rather than kind: `..` collapses lexically here where
  a host walks the path, so `readFile('missing/../real.txt')` answers where a
  host says `ENOENT`. Its proposal already carries this issue's ordering, from
  the descent side rather than the leaf side — "fail with `ENOENT` when a
  component is missing, and with `ENOTDIR` when one is a file" — so the two
  want deciding together, or the second will contradict the first.
- [stat-then-read](../../../../web/todo/stat-then-read.md) — the refactor this
  issue gates: while the reads answer `ENOENT` where `stat` answers `ENOTDIR`,
  a single read cannot replace `respond`'s `stat` without losing the root
  re-check.
- [dirent-kinds](./dirent-kinds.md) and
  [jsmodule-read-policy](./jsmodule-read-policy.md) — two more places this
  runner answers something a host would not, both about entry *kind* rather
  than traversal.
