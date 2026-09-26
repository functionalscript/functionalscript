## dangling-link-over-packed. A link that leads nowhere does not shadow a packed line here, and does for `rev-parse`

**Priority:** P4
**Status:** open

### Problem

A loose ref shadows a packed line of the same name by existing (the store's
header). A symbolic link at the loose path that leads nowhere is the case
where "exists" has two readings, and Git's own readers take both. Measured on
Git 2.43.0, with `refs/heads/x` packed at a commit and `.git/refs/heads/x` a
link to a name that is not there:

| reader | answer |
| --- | --- |
| `git show-ref`, `git for-each-ref` | list `refs/heads/x` at the packed id, exit 0 |
| `git rev-parse --verify refs/heads/x` | `fatal: Needed a single revision`, exit 128 |

[`tryRoots`](../module.f.mjs) agrees with the listing: its walk skips a link
that leads nowhere, and the packed line is listed. [`tryResolve`](../module.f.mjs)
does **not** agree with `rev-parse`: `readFile` through the link answers
`ENOENT`, `tryBytes` reads that as no loose file, and the packed id is the
answer, where Git treats the link as the loose file and refuses the name.

Nothing is lost either way (the packed line stays a root, and `tryRoots`
lists it), so this is a lookup answering a name Git's lookup refuses rather
than a retention error. Found while answering a review of
[#2315](https://github.com/functionalscript/functionalscript/pull/2315), where
[`tryDelete`](../write/module.f.mjs) removes such a link as Git does and
answers `true` only for the packed line.

### Proposal

Decide which of Git's two answers the lookup follows. Following `rev-parse`
needs the lookup to tell "no entry" from "a link that leads nowhere", which
an `lstat` or a listing answers and `readFile` does not.

### Tasks

- [ ] Decide, and pin the chosen answer with a fixture (a host, since the
      virtual filesystem has no links).

### Related

- [symlink-head.md](./symlink-head.md) — the other place a link at a ref's
  path needs a question `readFile` cannot answer.
