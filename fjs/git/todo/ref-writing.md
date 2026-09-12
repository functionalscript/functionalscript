## Writing a ref, and the reflog

**Priority:** P3
**Status:** open

### Problem

Reading refs is done: [`fjs/git/ref`](../ref/module.f.mjs) reads the three
files as the grammars they are, and
[`fjs/git/refstore`](../refstore/module.f.mjs) finds and opens them, answering
every ref a repository holds and the id one name resolves to. Nothing writes
one, so a repository this code reads it cannot update.

Two pieces are left, and they are not the same size.

### Proposal

**Writing a ref takes a lock.** Git writes `refs/heads/x.lock`, fills it,
and renames it over `refs/heads/x`, so a concurrent writer fails to create
the lock rather than interleaving. The rename is the atomic step, and the
lock file is why `fjs/git/refstore`'s walk skips a name ending in `.lock`:
such a file is a write in progress and not a ref. Writing needs
`createExclusive`, `writeFile` and `rename`, all of which
[`fjs/effects/node`](../../effects/node/module.f.mjs) already has.

Deleting a ref is the harder half, because a name can be in two files: the
loose file must go *and* the `packed-refs` line with it, or the packed line
reappears as the ref. Git rewrites `packed-refs` under its own lock for that.

**The reflog is not retention.** `logs/refs/heads/x` records where a ref has
pointed, and entries expire — `gc.reflogExpire` defaults to 90 days — so an
id reachable only from a reflog is not kept. That is why
[`refstore`](../refstore/module.f.mjs)'s `tryRoots` answers refs and not
reflogs, and a writer that appends to one must not treat the entries it
writes as roots.

### The bound this is under

[git-name-resolution](../../../todo/git-name-resolution.md) makes Git refs
retention roots and nothing else: a ref keeps commits reachable so Git does
not prune them, and a ref's *name* carries no DISOT meaning — not a name, not
an identity, not authority, not a signal of rename or archive, not a way to
choose among heads. DISOT semantics come from `.disot.*` files, authority and
timestamp evidence, and ancestry.

A writer is where that bound is easiest to break, because choosing what to
call a ref looks like naming something. It is not: a ref written here exists
to stop `git gc` collecting an object, and a writer that encodes anything
else in the name has moved DISOT semantics into Git's namespace.

### Related

- [git-name-resolution](../../../todo/git-name-resolution.md) — the rule
  above, and why a ref is only a retention root.
- [`fjs/git/refstore`](../refstore/module.f.mjs) — the reading half, and the
  `.lock` skip a writer's lock file explains.
- [`fjs/git/ref`](../ref/module.f.mjs) — the file grammars a writer must
  produce, measured against Git.
- [object-store.md](./object-store.md) — from an id to the object a ref
  keeps.
