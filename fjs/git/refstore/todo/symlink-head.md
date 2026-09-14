## A symlink `HEAD` is refused, and one spelling of it is one Git reads

**Priority:** P4
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

`tryResolve` does not refuse it at all, because it reads one file by name and
never lists a directory. The two halves therefore disagree about a symlink
`HEAD`: the listing refuses the repository and the lookup answers the id at the
other end of the link. That is the same shape as
[byte-ref-names.md](./byte-ref-names.md) — one half can look and the other
cannot — and it has the same cause: a path API that answers only about the file
a name finally reaches.

### Proposal

- A `readlink` operation in [`fjs/effects/node`](../../../effects/node/module.f.mjs),
  answering the link's target as text — or `lstat`, which answers the kind
  without following. Node has both; nothing in this repository asks for either
  yet.
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

- [`fjs/git/refstore`](../module.f.mjs) — `headIsFile`, where the refusal is,
  and `targetAllowed`, which is the same rule for the other spelling.
- [byte-ref-names.md](./byte-ref-names.md) — the other place where the listing
  and the lookup can see different things, for the same kind of reason.
