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
ref, the reflog, and every way the writer is narrower than `git update-ref`.

### Proposal

**Writing a ref takes a lock — done.** Git writes `refs/heads/x.lock`, fills
it, and renames it over `refs/heads/x`, so a concurrent writer fails to create
the lock rather than interleaving. The rename is the atomic step, and the lock
file is why `fjs/git/refstore`'s walk skips a name ending in `.lock`: such a
file is a write in progress and not a ref.
[`refstore`](../refstore/module.f.mjs)'s `tryWrite` does that, in five
effects — `packed-refs`, a `stat` of the ref's own path, the directories above
the file, the exclusive write of the id's hex digits and an LF, the rename — and
gives the lock back where a
failure of the **rename** would otherwise leave it, and never on any earlier
failure: that write succeeding is the only evidence the lock is this writer's,
and no error code is evidence of the same. The file is `oidBytes * 2 + 1` bytes
and not a fixed 41 — measured, `update-ref` writes 41 bytes in a SHA-1 repository
and 65 in one created with `git init --object-format=sha256`, whose ids are
sixty-four digits. The LF is not load-bearing for Git's own reader — a file
holding the digits alone resolves, measured — and is written because Git writes
it.

**The create and the fill are one effect**, which is a hole and not a round trip.
`createExclusive` closes its descriptor, so a `writeFile` after it reopens the
*pathname* with the flags `w` gives — `O_TRUNC`, and symlinks followed. Measured
on node 22.22.2 with the name replaced by a symlink between the two calls: the
`writeFile` succeeded and **overwrote the link's target**, and the name was still
a symlink, so the rename would have published the link as the ref. `O_EXCL`
answers `EEXIST` on that symlink — and on a dangling one, since it refuses a link
without following it — with the target untouched; the control is that a free name
is created and filled and a second attempt on the taken name is `EEXIST` with the
bytes unchanged. That is `fjs/effects/node`'s `writeExclusive`, added for this.
Adding it widens `NodeOp`, which a custom runner must implement, so the PR
declares a breaking change.

No runner here can see that fix: the virtual filesystem has no symlinks and the
host proofs write nothing, since the Deno task runs without `--allow-write`. What
holds it is `tryWrite`'s own `@type` — the two calls put
`CreateExclusive | WriteFile` in the operation set and the annotation names
`WriteExclusive`, so `tsc` refuses the revision. A `types.ts` `Assert<Equal<…>>`
restating that set was written and deleted: falsifying it reported, but breaking
the *mechanism* reported at the annotation instead, so it claimed a guard it did
not provide.

**And the rollback is the runner's, because that is where `O_EXCL` succeeding is
known.** Three revisions decided ownership at the caller instead and each was a
review finding. The first cleaned up over the whole sequence, so a `packed-refs`
refusal deleted a live writer's lock. The second kept the write inside the span
and carved out `EEXIST` as the one "not mine" error — also wrong: measured on node
22.22.2 with the process out of file descriptors, a `wx` open of a name another
writer holds answers **`EMFILE`**, not `EEXIST`, against the same call with
descriptors available which answers `EEXIST`. So `writeExclusive` removes the file
when its own write fails, and its contract is that the file either holds the data
or is not there. Every refusal fixture holds a foreign lock, and
`writeNotMineOnAnyError` drives an `EMFILE` host, so neither revision can come
back.

What is left of that: if the runner's `close` fails after a successful write the
file is left behind, and the rollback unlinks by path rather than by descriptor,
so a replacement in that window would be removed instead. Both are failures on a
filesystem already failing, and both are `fjs/effects/node`'s to fix if a caller
ever needs them fixed.

**No ref name may be a directory prefix of another**, and finding that out takes
both of the reads. Measured on 2.43.0: with `refs/heads/a` packed,
`update-ref refs/heads/a/b` exits 128 with `'refs/heads/a' exists; cannot create
'refs/heads/a/b'`, and with `refs/heads/c/d` packed the same command on
`refs/heads/c` exits 128 the other way round. `refPrefixCode` and
`badPackedCode` are the refusals that come out of the `packed-refs` read.

The two directions do not cost the same, which is the argument for refusing both.
A packed `refs/heads/a` beside a loose `refs/heads/a/b` is listed by `show-ref`
and `for-each-ref`, resolved by `rev-parse` both ways, walked by
`rev-list --all` and reported by nothing in `fsck` — and `git pack-refs --all`
packs both lines happily, so Git's own writer produces the state its
`update-ref` refuses to create. The other direction is different: with
`refs/heads/c/d` packed and a loose `refs/heads/c` beside it,
`git rev-parse refs/heads/c/d` answers `ambiguous argument … unknown revision`,
because the loose *file* stands where the path's directory would be. `show-ref`
still lists it and `rev-list --all` still walks it, so the object is still kept —
but a name that resolved before the write does not resolve after it, and no
caller was told. One direction is policy and the other is a ref the write breaks;
both are refused, because the rule Git states is one rule and half of it would be
harder to explain than either answer.

The *loose* directions are the host's to refuse, and only one of them actually
is. A loose file where the parent directory must go is `ENOTDIR` from the `mkdir`,
and a real directory where the ref's file must go is `EISDIR` from the `rename`.
A **symlink to a directory** at the ref's own path is neither: measured on node
22.22.2, `fs.rename` over it succeeds, replaces the link, and leaves every ref
inside the linked directory unreachable — while `update-ref` exits 128 and Git
reads those refs through the link the whole time, `show-ref`, `for-each-ref` and
`rev-parse` all answering them. So the write `stat`s the ref's path before taking
the lock and refuses a directory, which covers the symlink and the real directory
alike because `stat` follows links. Found by review of the write; the symlink
itself has no fixture, since the virtual filesystem has no symlinks, and
`writeRefIsADirectory` pins the branch through a real directory.

That check is a snapshot, and `git pack-refs` can invalidate it under either
writer's feet — Git's included. `refs/heads/a/b` is loose, so a write of
`refs/heads/a` sees no packed collision and is refused by the `rename` instead,
the loose file having made `refs/heads/a` a directory; between those two moments
a concurrent `pack-refs --all` packs `a/b`, prunes the loose file *and the
now-empty directory*, and the rename succeeds. Measured on Git 2.43.0:

| step | result |
| --- | --- |
| `refs/heads/a.lock` in place, as `update-ref` takes it first | — |
| `git pack-refs --all` | exit 0; `a/b` packed; loose file **and** `refs/heads/a` directory pruned; **`a.lock` untouched** |
| the lock holder's `rename` | succeeds |
| `git rev-parse refs/heads/a/b` | `ambiguous argument … unknown revision` |
| control: `update-ref refs/heads/a` from the settled state | exit 128, `'refs/heads/a/b' exists; cannot create 'refs/heads/a'` |

So `update-ref` takes the lock before it verifies availability, `pack-refs` does
not honour that lock when pruning a *different* name, and the rename that follows
is the same rename. The check is real and the race is what defeats it, for Git as
much as for this writer. Closing it means holding `packed-refs.lock` across the
check and the rename — what `pack-refs` itself takes, and what `update-ref`
deliberately does not, since it would serialise every ref write behind one lock.
A writer that took it would be stricter than Git by a protocol Git does not have,
and would fail or block whenever `pack-refs` runs. Found by review of this PR;
recorded as a decision below rather than built.

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

Each measured against Git 2.43.0 and each named at `tryWrite`. None of them is a
wrong answer — the writer refuses, or leaves the file exactly as Git leaves it —
so each is a task rather than a bug. They are deliberately not counted: the
object check turned out to be two constraints rather than one, and a number in
the prose is the first thing a finding like that makes wrong.

**It does not check that the object is there.** `git update-ref refs/heads/g`
with a well-formed id no object has exits 128 with `trying to write ref … with
nonexistent object`, and a file holding such an id makes `show-ref` answer
`bad ref`, `for-each-ref` and `rev-list --all` exit 128, and `fsck` report
`invalid sha1 pointer`. So the check is worth having, and it makes a writer of
refs a reader of objects: the id would have to be looked up through
[`fjs/git/store`](../store/module.f.mjs), which nothing in `refstore` imports
today. A caller that wrote the object knows it is there, which is why this is
deferred rather than done with the write.

**And under `refs/heads/` the object has to be a commit**, which is a second,
stronger constraint and not a corollary of the first — found by review of the
write and measured across five namespaces and five object kinds on Git 2.43.0:

| namespace | blob | tree | commit | tag → commit | tag → blob |
| --- | --- | --- | --- | --- | --- |
| `refs/heads/` | 128 | 128 | 0 | **128** | 128 |
| `refs/tags/`, `refs/remotes/origin/`, `refs/notes/`, `refs/other/` | 0 | 0 | 0 | 0 | 0 |

The refusal is `trying to write non-commit object … to branch`. Two things in
that table are easy to get wrong: a **tag object whose own target is a commit**
is refused as well, so the rule is "is a commit" and not "peels to one"; and no
other namespace has the rule at all, not even an invented one. So this is one
namespace's rule rather than a rule about refs, and answering it needs the
object's *type* — its header — which is strictly more than asking whether it is
there. Both go through the same reader, which is why they are one task.

A branch written at a blob by hand is **not** a value the reading half answers
wrongly, which is why this is recorded rather than refused. Measured:
`rev-parse` prints the id at exit 0, `show-ref` and `for-each-ref` list the ref
— `for-each-ref` naming its type as `blob` — `rev-list --all` exits 0, and
`git branch --list` shows it; only `git fsck` reports
`error: refs/heads/<n>: not a commit`. It is a retention root in fact too: with
every reflog expired, `git gc --prune=now` printed `error: Object … not a
commit` and kept the blob. So `tryRoots` listing it agrees with `show-ref`,
`for-each-ref` and `gc`, and what is missing is the validation `fsck` does.

**It does not honour `core.sharedRepository`.** Measured on Git 2.43.0 with
`git init --shared=group` and a `0022` umask:

| path | `git update-ref refs/heads/topic/x` | this writer |
| --- | --- | --- |
| `refs/heads/topic` | `2775` | `2755` — what `mkdir -p` gives under that umask |
| `refs/heads/topic/x` | `664` | `644` |

The group-write bit is the one that matters: without it the next group member's
exclusive create of a `.lock` inside that directory fails with `EACCES`, so this
writer succeeds and the *next* one cannot. That is a loud failure rather than a
wrong value, which is why it is recorded here, and it is still a namespace nobody
asked for.

Two ways out, and neither is free. **Honour it**: read `core.sharedRepository`
(nothing in `fjs/git/config` reads any `core.*` key today) and give `mkdir` and
the write a mode — `MakeDirectoryOptions` is `{ recursive: true }` and nothing
else, so the effects grow. **Refuse it**: the config read alone, and then
`tryWrite` is unusable on every shared repository, which is a wide refusal for a
narrow gap. Whichever is chosen, the file mode is wrong on such a repository even
when the directory already exists, so a fix that only touches `mkdir` is half a
fix.

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

- [x] Write a ref under a lock: the directories, the exclusive write of
      `oidBytes * 2 + 1` bytes through one open, the rename, and the lock given
      back on a failure after that write and not before it.
- [x] Refuse a name a packed ref bars as a directory prefix, either way round,
      and a `packed-refs` that will not parse — the questions no filesystem
      answer can stand in for.
- [ ] Decide whether a write holds `packed-refs.lock` across its prefix check
      and its rename, which is the only thing that closes the `pack-refs` race
      above — and is stricter than `git update-ref`, which does not take it.
- [ ] Decide `core.sharedRepository`: honour the mode, or refuse such a
      repository. Needs a `core.*` read either way, and a mode on `mkdir` and on
      the write if it is honoured.
- [ ] Give the loose `mkdir` direction a fixture, once
      [`fjs/effects/node/virtual/todo/mkdir-over-a-file.md`](../../effects/node/virtual/todo/mkdir-over-a-file.md)
      stops the virtual `mkdir` replacing a file with a directory — today a
      fixture there would watch the writer delete a ref and pass.
- [ ] Delete a ref: the loose file *and* the `packed-refs` line, under
      `packed-refs`'s own lock, or the packed line comes back as the ref.
- [ ] Decide whether a write checks that the object is there **and, under
      `refs/heads/`, that it is a commit**, and what that costs — `refstore`
      would have to read objects, and the type check needs the header rather
      than only the object's presence.
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
- [`fjs/effects/node/virtual/todo/mkdir-over-a-file.md`](../../effects/node/virtual/todo/mkdir-over-a-file.md)
  — why the loose prefix direction has a node measurement and no fixture.
