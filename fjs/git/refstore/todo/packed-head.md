## Git holds two refs called `HEAD`, and one entry per name cannot

**Priority:** P3
**Status:** open

### Problem

[`tryRoots`](../module.f.mjs) answers a list of one entry per name, which is
right for every name a repository ordinarily has and wrong for exactly one.
A `packed-refs` file may hold a line named `HEAD`, and a repository always has
a `HEAD` file, and Git keeps **both** — the file as what the name *means*, the
packed line as a ref of its own that keeps an object alive.

Measured on Git 2.43.0, with `$B` packed as `HEAD` beside a `HEAD` file
detached at `$A`:

```
$ git show-ref --head
<A> HEAD
<B> HEAD
$ git rev-parse HEAD
<A>
$ git for-each-ref                        # nothing: neither is under refs/
$ git rev-list --all
<B>
<A>
$ git fsck --unreachable                  # nothing unreachable
$ git reflog expire --expire=now --expire-unreachable=now --all
$ git gc --prune=now && git cat-file -t $B
commit
```

A `HEAD` file naming a *branch* is the same: `show-ref --head` prints the
branch's id and the packed id, and both survive that `gc`. And the packed line
is not something a repository grows by itself — `git pack-refs --all` writes no
`HEAD` line, measured with a detached `HEAD` and an `ORIG_HEAD` set — but once
it is in the file, `git gc` rewrites `packed-refs` with the line still there.

A name under `refs/` is the opposite, which is what makes shadowing a rule
rather than a guess. With `refs/heads/x` loose at `$A` and packed at `$B`,
`show-ref` and `rev-list --all` answer only `$A`, `fsck` calls `$B` unreachable,
and the same `gc` prunes it.

So the two rules are different rules, and this module had one. Adding the loose
`HEAD` name to the shadow set — which is what stops the listing carrying two
entries called `HEAD` — dropped a root the repository is keeping, from a list
whose stated purpose is to name the roots. The listing now refuses the
collision with `packedHeadCode` instead, which is narrower than Git by a
refusal and not by a wrong answer.

### Proposal

- Answer both, by making a `Root` say which store it came from, or by answering
  the packed lines a loose name shadows in a second list beside the first. The
  second is smaller and keeps `Root` a name and an id; the first is honest about
  a ref store having two halves, and `fjs/git/store` will want the distinction
  when it writes a ref.
- Whichever shape, keep the *meaning* of the name unambiguous: `tryResolve`
  already answers the file, and a caller that maps name to id must keep getting
  that answer rather than whichever entry the list holds last.
- Then this refusal goes away, and `packedHeadCode` with it.

### Related

- [`reflog-roots.md`](reflog-roots.md) — the other half of "not every root Git
  has", and the same kind of gap: a root this list does not name.
- [`symlink-head.md`](symlink-head.md) — the other refusal that is narrower than
  Git for a `HEAD` this module cannot read faithfully.
