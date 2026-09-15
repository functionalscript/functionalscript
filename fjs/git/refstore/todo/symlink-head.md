## The listing reads an entry's kind and the lookup cannot

**Priority:** P3
**Status:** open

### Problem

A symbolic ref has an older spelling than `ref: refs/heads/x`: a symlink. Git
still reads it, and treats the two forms differently depending on where the link
points. Measured on Git 2.43.0:

```
$ ln -s refs/heads/master .git/HEAD
$ git rev-parse HEAD                   # the branch's id
$ git symbolic-ref HEAD                # refs/heads/master

$ printf '%s\n' "$id" > .git/outside
$ ln -s outside .git/HEAD
$ git rev-parse HEAD                   # fatal: not a git repository
$ git show-ref                         # fatal: not a git repository
$ git status                           # fatal: not a git repository
```

So a link under `refs/` is a repository Git reads, and a link anywhere else is
not a repository at all — the same rule `targetAllowed` enforces for the
`ref: …` spelling, applied to a link.

[`refstore`](../module.f.mjs) cannot tell the two apart. Every way it can ask
about a path follows the link: `readFile` reads what is at the other end, and
`stat` answers for that file too. Only a directory listing carries the kind of
the entry *itself*, and it says "neither a file nor a directory" for both
spellings alike. So `tryRoots` refuses both, with `headKindCode`.

That is narrower than Git for the first spelling, and it is the right way round
for the second: following the link is how a repository makes this module read a
file outside it. `.git/HEAD` naming `/etc/passwd` would be answered as a
detached `HEAD` if that file's first line read as an id, which is the boundary
[`refstore`](../module.f.mjs)'s header claims — a path that leaves the
repository is not a ref — and which a link walks straight through.

`tryResolve` refuses it now as well, and pays for the answer the only way it
can: a `readdir` of the gitdir, for the name `HEAD` alone. The two halves no
longer disagree about that name, and the cost is one listing on a lookup that
would otherwise be a single read.

That is the *cost* this issue would remove rather than a gap it would close. An
`lstat` answers the same question about one path, so the lookup would stop
listing a directory to learn about a file — and the walk would stop refusing the
spelling Git reads, which is the part still outstanding.

The narrower rule stays where it is: only `HEAD` is asked about, because only
`HEAD` is a name Git refuses a link at. Measured on Git 2.43.0 with each
pointing at the same file outside the repository, `git rev-parse HEAD` answers
`not a git repository` and `git rev-parse ORIG_HEAD` answers the id.

What still has the shape of [byte-ref-names.md](./byte-ref-names.md) — one half
able to look and the other not — is the FIFO below, where the lookup has no name
to special-case.

### The same gap, at a FIFO under `refs/`

A symlink is not the only kind the listing can see and the lookup cannot, and
the second one is worse than a wrong answer. A FIFO read with no writer does not
fail — it *waits* — so a reader that treats every non-directory as a file stops
there for as long as nothing writes.

Git's listing skips it and Git's lookup blocks on it. Measured on Git 2.43.0
with a FIFO at `refs/heads/pipe` and no writer:

```
$ git show-ref                            # the other branches, at once
$ git for-each-ref                        # the same
$ git status                              # exits 0
$ git gc --prune=now                      # exits 0
$ git rev-parse --verify refs/heads/pipe  # blocks until killed
```

A FIFO inside a subdirectory of `refs/` is skipped with its siblings still
listed, so the skip is per entry rather than the end of the walk. With a writer
that sends an id and closes, `rev-parse` answers that id — so the lookup treats
whatever comes out of the pipe as the ref's value.

[`refstore`](../module.f.mjs)'s walk skips it, on the kind a `stat` answers,
which is Git's listing exactly. `tryResolve` blocks, which is Git's lookup
exactly. Both halves therefore match Git today, and the gap between them is
Git's too — but it is a gap a caller can be caught by, and `lstat` closes it here
without changing what the listing does. The `HEAD` listing above does not help:
a FIFO can be at any name under `refs/`, so there is no one name to ask about.

A FIFO `HEAD` is the one place this module is already better than Git rather
than narrower: `git status` and `git rev-parse HEAD` in a repository whose
`.git/HEAD` is a writerless FIFO both hang, and `headIsFile` refuses it with
`headKindCode` at once.

### What the walk does *not* follow: a link to a directory

A `stat` says what an entry finally is, so the walk follows a link to a ref file
and reads it, as Git does. It stops at a link to a **directory**, with
`ERR_LINKED_DIR`, and that one is not a gap in the reading — it is a bound.

Git walks in. Measured on Git 2.43.0 in a repository with one branch and
`refs/heads/up` linked to `..`:

```
$ git show-ref
<id> refs/heads/master
<id> refs/heads/up/heads/master
<id> refs/heads/up/heads/up/heads/master
<id> refs/heads/up/heads/up/heads/up/heads/master
…
```

— a name per depth, until the path grows too long for the host to open. Git
*streams* those names and stops at the path limit. `tryRoots` collects its
answer into one array, so it has neither property: following the link would be an
unbounded allocation out of a single entry of a repository this module did not
choose.

Skipping instead of refusing would be the other wrong answer, because this
function's result is what a `gc` keeps: a silently dropped subtree of refs is
objects deleted.

So walking into one wants the walk itself bounded first — a depth or a set of
directories already visited, which is a change to the walk and not to the kind
test. `lstat` and `readlink` are what tell it that an entry *is* a link at all,
which is the same operation the rest of this issue wants, so the two belong
together.

### Proposal

- A `readlink` operation in [`fjs/effects/node`](../../../effects/node/module.f.mjs),
  answering the link's target as text — or `lstat`, which answers the kind
  without following. Node has both; nothing in this repository asks for either
  yet.
- `lstat` also lets `tryResolve` skip a FIFO and every other kind
  it cannot read, which is the half the listing already has. A lookup that can
  ask about the entry does not have to open it to find out.
- With it, `HEAD` as a link under `refs/` reads as the symbolic ref it is: the
  target is a ref name, and the rest of the resolution is the one this module
  already does, `targetAllowed` included. A link anywhere else stays refused,
  which is what Git answers.
- The lookup then refuses on the same evidence as the listing, since it can ask
  about the link without listing a directory.

Until then the refusal stands where it can be seen, and a repository with a
symlink `HEAD` — a spelling Git has not written since before 1.5 — is one this
module reports rather than reads.

### Related

- [`fjs/git/refstore`](../module.f.mjs) — `headIsFile`, where the `HEAD` refusal
  is; `statted`, where the walk asks what an entry finally is; `linkedDirCode`,
  the one kind it refuses; and `targetAllowed`, which is the same rule as the
  first for the other spelling.
- [byte-ref-names.md](./byte-ref-names.md) — the other place where the listing
  and the lookup can see different things, for the same kind of reason.
