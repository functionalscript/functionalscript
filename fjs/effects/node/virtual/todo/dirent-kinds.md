## `readdir` here has two entry kinds where a host has three

**Priority:** P2
**Status:** open

### Problem

[`../module.f.mjs`](../module.f.mjs)'s `readdir` derives its flags from one
question — `isFile = !isDir(content)`, `isDirectory = !isFile` — so this file
system can only answer "file" or "directory". A host answers a third thing: a
symbolic link, a FIFO, a device and a socket are all **neither**, which is the
whole reason `Dirent` carries both flags (functionalscript#1827) and the whole
reason a walk asks `isDirectory` before descending rather than `!isFile`.

The consequence is narrow and worth naming: **no fixture can produce the entry
the two flags exist to distinguish**, so a walk's guard against it cannot be
proven here. It was found by reading rather than by a failure — the guard in
`website/module.f.mjs` is pinned by a *directory* fixture, which is the case
that already worked.

`stat` in the same file already models three states: a `JsModule` answers
`isFile: false, isDirectory: false`, and `readdir` answers `isFile: true` for
that same entry. So the two operations of one runner disagree about one entry.

### Why it was not fixed with the flag

The obvious change — make `readdir` answer `isFile: false` for a `JsModule`, as
`stat` does — is not obviously safe: `emergent_testing`'s discovery walks a
virtual tree whose modules *are* `JsModule` entries, and it selects them with
`isFile`. Making that consistent means deciding what a `JsModule` is to a
directory listing before changing what it answers, which is a decision this
issue exists to make rather than something to slip into an unrelated PR.

### Proposal

Give the virtual file system an entry kind that is neither a file nor a
directory, and settle `JsModule` at the same time:

1. decide whether a `JsModule` is a *file* to `readdir` (it is importable, so
   arguably yes) or the third thing (`stat`'s current answer), and make both
   operations agree;
2. if the third state has no other inhabitant, add one — a link entry is the
   honest name for it, since that is the host entry the flags exist for;
3. pin a walk's `isDirectory` guard on it, which is the proof
   functionalscript#1827 could not write.

### Related

- functionalscript#1827 — where `Dirent` gained `isDirectory`, and where the
  guard is pinned only by the directory case.
- `changelog/0.48.0/1751.md` — `FileStat` gaining `isDirectory`, the same
  argument for `stat`.
