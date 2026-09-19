## Writing a ref, and the reflog

**Priority:** P3
**Status:** open

### Problem

Reading refs is done: [`fjs/git/ref`](../ref/module.f.mjs) reads the three
files as the grammars they are, and
[`fjs/git/refstore`](../refstore/module.f.mjs) finds and opens them, answering
every ref a repository holds and the id one name resolves to.

Writing one has started. `tryWrite` writes the loose file under Git's own
`.lock`, which is the piece below that is checked; what is left is deleting a
ref, the reflog, and the five ways the writer is narrower than
`git update-ref`.

### Proposal

**Writing a ref takes a lock — done.** Git writes `refs/heads/x.lock`, fills
it, and renames it over `refs/heads/x`, so a concurrent writer fails to create
the lock rather than interleaving. The rename is the atomic step, and the lock
file is why `fjs/git/refstore`'s walk skips a name ending in `.lock`: such a
file is a write in progress and not a ref.
[`refstore`](../refstore/module.f.mjs)'s `tryWrite` does that, in four
effects — the directories above the file, the exclusive create, the 41 bytes,
the rename — and gives the lock back where a failure after the create would
otherwise leave it.

Deleting a ref is the harder half, because a name can be in two files: the
loose file must go *and* the `packed-refs` line with it, or the packed line
reappears as the ref. Git rewrites `packed-refs` under its own lock for that.

**The reflog is retention with a clock on it.** `logs/refs/heads/x` records
where a ref has pointed, and Git keeps an object an entry names until that entry
expires — `gc.reflogExpire` defaults to 90 days and
`gc.reflogExpireUnreachable` to 30. Measured on Git 2.43.0: a commit left only
in the reflog by `git reset --hard HEAD~1` survives `git gc --prune=now`, and is
gone after `git reflog expire --expire=now --expire-unreachable=now --all` and
another `gc --prune=now`.

An earlier revision of this file said the opposite — "the reflog is not
retention", reasoning from expiry to irrelevance — and the measurement above is
the case that breaks it. What follows for a writer is not that its entries are
not roots, but that they are roots that stop being ones on a clock this side does
not control: appending to a reflog does not make an object safe to depend on, and
deleting a ref does not make its objects collectable while the reflog still names
them. [`refstore`](../refstore/module.f.mjs)'s `tryRoots` answers refs only, and
that is now what its doc says; reading the reflog for the roots it holds is
[`refstore/todo/reflog-roots.md`](../refstore/todo/reflog-roots.md).

### Where the writer is narrower than `git update-ref`

Five, each measured against Git 2.43.0 and each named at `tryWrite`. None of
them is a wrong answer — the writer refuses or leaves the file exactly as Git
leaves it — so each is a task rather than a bug.

**It does not check that the object is there.** `git update-ref refs/heads/g`
with a well-formed id no object has exits 128 with `trying to write ref … with
nonexistent object`, and a file holding such an id makes `show-ref` answer
`bad ref`, `for-each-ref` and `rev-list --all` exit 128, and `fsck` report
`invalid sha1 pointer`. So the check is worth having, and it makes a writer of
refs a reader of objects: the id would have to be looked up through
[`fjs/git/store`](../store/module.f.mjs), which nothing in `refstore` imports
today. A caller that wrote the object knows it is there, which is why this is
deferred rather than done with the write.

**It writes no reflog line**, where `update-ref` writes one under
`core.logAllRefUpdates` — measured, `logs/refs/heads/master` gains a line on
each update in a non-bare repository. A ref with no reflog is ordinary (every
`refs/tags/*` has none), so this loses nothing a reader depends on; what it
loses is the extra retention the paragraph above describes.

**It does not rewrite `packed-refs`.** A packed line of the same name is
shadowed by the new loose file, which is what Git leaves too — measured, an
`update-ref` of a packed-only ref writes the loose file and leaves the packed
line stale. So this one is not a divergence at all for a *write*; it is a
divergence for a delete, which is the half above.

**It does not dereference a symbolic ref already at the name.** Measured, with
`refs/heads/sym` holding `ref: refs/heads/master`, `git update-ref
refs/heads/sym <id>` writes `refs/heads/master` and leaves `sym` symbolic,
while `--no-deref` replaces `sym` with the id. `tryWrite` does the latter.
Both are Git behaviours, and which one a caller wants is a parameter this has
no caller to design against yet.

**It refuses a name outside `refs/`.** `update-ref` writes a pseudoref
literally — `FOO_HEAD` becomes `.git/FOO_HEAD` at exit 0 — and `HEAD` is why
refusing is right for now: with `.git/HEAD` holding `ref: refs/heads/master`,
`git update-ref HEAD <id>` leaves that file untouched and writes the *branch*,
so a writer handed `HEAD` has two answers and no way to know which was meant.
`git symbolic-ref` is the third thing again. A caller that wants one of them
should say which, and then this becomes a parameter rather than a refusal.

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

### Tasks

- [x] Write a ref under a lock: the directories, the exclusive create, the 41
      bytes, the rename, and the lock given back on a failure after it is
      taken.
- [ ] Delete a ref: the loose file *and* the `packed-refs` line, under
      `packed-refs`'s own lock, or the packed line comes back as the ref.
- [ ] Decide whether a write checks that the object is there, and what that
      costs — `refstore` would have to read objects.
- [ ] Decide whether dereferencing a symbolic ref at the name is a parameter,
      and whether a caller wants `HEAD` and the pseudorefs at all.
- [ ] Append to the reflog, once there is a clock to write a timestamp with
      and a caller that needs the entry.
- [ ] `tsc`, `fjs test`.

### Related

- [git-name-resolution](../../../todo/git-name-resolution.md) — the rule
  above, and why a ref is only a retention root.
- [`fjs/git/refstore`](../refstore/module.f.mjs) — both halves: the reading
  one, and `tryWrite` with the measurements behind every refusal.
- [`fjs/git/refname`](../refname/module.f.mjs) — `lockSuffix`, and why no ref
  is ever named by a writer's lock file.
- [`fjs/git/ref`](../ref/module.f.mjs) — the file grammars a writer must
  produce, measured against Git.
- [`fjs/git/store`](../store/module.f.mjs) — from an id to the object a ref
  keeps, and what an object-existence check would have to read.
