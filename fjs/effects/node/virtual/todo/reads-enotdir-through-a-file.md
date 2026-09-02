## The reads answer `ENOENT` where `stat` answers `ENOTDIR`

**Priority:** P3
**Status:** open

### Problem

`resolveFile` in [`../module.f.mjs`](../module.f.mjs) answers `ENOENT` for every
remaining path that is not exactly one segment. Two different situations reach
that guard, and a host distinguishes them:

| `readFile(p)` where… | this runner | POSIX host |
| --- | --- | --- |
| `a` is a file, `p = 'a/b'` | `ENOENT` | `ENOTDIR` |
| `a` is a directory, `p = 'a'` | `ENOENT` | `EISDIR` |
| `a` is absent, `p = 'a'` | `ENOENT` | `ENOENT` |

`stat` already models the first row. `statPath`'s JSDoc argues the case at
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

Not decided. `enotdir` already exists in the module, so the first row is nearly
free; the second is the one that needs a decision.

**The order of the guards is the whole difficulty, and `p.length` alone cannot
carry it.** `operation` hands the op the *full* remaining path in two different
situations — the first name is absent, or it exists and is not a directory —
so `readFile('missing/child')` and `readFile('a/child')` with `a` a file both
arrive with `p.length === 2`. A length test alone would answer `ENOTDIR` for
the first, where a host says `ENOENT`. `statPath` gets this right by asking
`entryOf(dir, path[0]) === undefined` **before** its length guard, and any
change here has to copy that ordering rather than merely cite it:

```js
if (p.length === 0) { /* the path was a directory */ }
const file = entryOf(dir, p[0])
if (file === undefined) { return enoent }   // absent first name, any length
if (p.length !== 1) { return enotdir }      // it exists and is not a directory
```

- **`ENOTDIR` for a longer path, once presence is checked first.** With the
  ordering above, `resolveFile` answers `enotdir` only where `statPath` does.
  Small, and it makes the two operations agree.
- **`EISDIR` for an empty path.** `p.length === 0` means `operation` descended
  all the way, so the path named a directory and a host says `EISDIR`. This
  needs a new error value and a decision about `writeBytes`, which reaches the
  same guard and whose host answer is also `EISDIR`.
- **Leave it, and say so.** Answering one code for every non-file is simpler,
  and a caller that treats all three alike is right on every host. If that is
  the choice, `statPath`'s argument for the opposite has to be reconciled with
  it rather than left standing next to it.

Whichever is chosen, `readFile('missing/child')` wants a fixture of its own:
nothing today pins that an absent first name answers `ENOENT` rather than
whatever the new longer-path branch returns, which is exactly the case a length
test would have broken.

Whichever is chosen, the three `*NestedThroughFile` fixtures in
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
- [dirent-kinds](./dirent-kinds.md) and
  [jsmodule-read-policy](./jsmodule-read-policy.md) — the other two places this
  runner answers something a host would not, both about entry *kind* rather
  than traversal.
