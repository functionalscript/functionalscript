## Writing a ref, and the reflog

**Priority:** P3
**Status:** open

### Problem

Reading refs is done: [`fjs/git/ref`](../../ref/module.f.mjs) reads the three
files as the grammars they are, and
[`fjs/git/refstore`](../module.f.mjs) finds and opens them, answering
every ref a repository holds and the id one name resolves to.

Writing and deleting one are done. `tryWrite` writes the loose file under Git's
own `.lock`, and `tryDelete` takes a name out of both files it can be in, under
Git's two locks — the pieces below that are checked. What is left is appending to
the reflog, and every way the two are narrower than `git update-ref`.

### Proposal

**Writing a ref takes a lock — done.** Git writes `refs/heads/x.lock`, fills
it, and renames it over `refs/heads/x`, so a concurrent writer fails to create
the lock rather than interleaving. The rename is the atomic step, and the lock
file is why `fjs/git/refstore`'s walk skips a name ending in `.lock`: such a
file is a write in progress and not a ref.
[`refstore`](../module.f.mjs)'s `tryWrite` does that, in five
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

The virtual runner cannot see that fix — it has no symlinks — and for two review
rounds nothing else could either, because a proof that writes on the host was
refused by the Deno task's permissions. `60abfe04` on `main` granted
`--allow-write` for the file-module fixtures, which is what makes
`effects/node/proof.mjs`'s `writeExclusive` proofs possible: they hold the flag
itself. `exclusive` writes a free name and reads the bytes back, then refuses the
same name with the bytes it held unchanged; `symlink` plants a link at the name
and a dangling link beside it and refuses both with the target untouched and the
named file never created. Changing `wx` back to `w` reddens both and nothing else,
which is the check the earlier rounds could only assert. The file symlinks are
skipped on Windows, where creating one needs a privilege — hence the first case,
which holds the flag on every platform on its own.

`tryWrite`'s own `@type` holds the rest: the two calls put
`CreateExclusive | WriteFile` in the operation set and the annotation names
`WriteExclusive`, so `tsc` refuses the revision. A `types.ts` `Assert<Equal<…>>`
restating that set was written and deleted: falsifying it reported, but breaking
the *mechanism* reported at the annotation instead, so it claimed a guard it did
not provide.

**And the rollback is the runner's, because that is where `O_EXCL` succeeding is
known.** Two revisions decided ownership at the caller instead and each was a
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

**The rollback itself has no fixture, and none is available here.** It runs where
the write fails after the `O_EXCL` open succeeded, and nothing in node's API
produces that: the open is what fails for a taken name, a bad path or a full
descriptor table, and once it has succeeded a write of at most `maxLengthBytes`
to a fresh descriptor does not fail without a filesystem fault. `fromVec` cannot
raise it either — `writeExclusive` refuses a non-octet `Vec` ahead of the host,
and every other `Vec` converts. So deleting the `rm` leaves the suite green,
measured, and that is recorded rather than closed with a contrivance: a proof
would need a fault-injecting filesystem, and inventing a failure the operation
does not otherwise have in order to reach the line would put the test's shape
into the runner.

What is left over: if the runner's `close` fails after a successful write the
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

The *loose* directions looked like the host's to refuse where it happened to, and
the check that covers them came from a third case neither `mkdir` nor `rename`
catches. A **symlink to a directory** at the ref's own path: measured on node
22.22.2, `fs.rename` over it succeeds, replaces the link, and leaves every ref
inside the linked directory unreachable — while `update-ref` exits 128 and Git
reads those refs through the link the whole time, `show-ref`, `for-each-ref` and
`rev-parse` all answering them. So the write `stat`s the ref's path before taking
the lock, which follows the link and so covers the symlink and a real directory
alike (`refPrefixCode`).

**That `stat` turned out to cover the file direction too**, which a later review
round caught and an earlier revision of this file had wrong. A loose *file* where
the name's parent directory must go puts that file in the ref's own path, so the
`stat` is `ENOTDIR` — measured on node 22.22.2 and on the virtual runner, which
agree, with `leadsNowhere` not swallowing it — and the `mkdir` is never reached.
Git refuses the same write with `'refs/heads/a' exists; cannot create
'refs/heads/a/b'`, exit 128, the ref intact. `writeLooseIsAFile` pins it and
dropping the `stat` reddens it; the symlink itself still has no fixture, since the
virtual filesystem has no symlinks, and `writeRefIsADirectory` pins that branch
through a real directory.

So one refusal of the four carries the host's code rather than `refPrefixCode`.
Whether it should be `refPrefixCode` with Git's message is open: naming the file
in the way means walking the path component by component, which is a `stat` per
segment on a state the write is about to refuse anyway.

**An *empty* directory at the ref's path is where this is narrower than Git**, and
a review round found it. Measured on 2.43.0, with the ref's own path a directory:

| `.git/refs/heads/topic/` holds | `update-ref refs/heads/topic` |
| --- | --- |
| nothing | **exit 0** — the directory is removed and the ref published |
| only an empty `sub/` | **exit 0** — both removed, ref published |
| a ref file `notaref` | 128, `'refs/heads/topic/notaref' exists; cannot create 'refs/heads/topic'` |
| only `x.lock` | 128, `there is a non-empty directory '…/refs/heads/topic' blocking reference 'refs/heads/topic'` |

So Git's rule is *recursively empty*, and anything at all in the directory —
another writer's lock included — refuses. `tryWrite` refuses all four with
`refPrefixCode`.

**The state is reachable by ordinary use, and this writer makes it.** The `mkdir`
runs before the lock, so a write of `refs/heads/topic/x` that then fails leaves
`refs/heads/topic/` behind; measured, Git does the same — `update-ref
refs/heads/topic/x` against a held lock leaves the directory — and the next
`update-ref refs/heads/topic` succeeds there where this refuses. Git's own
deletes do not leave one: measured, `update-ref -d`, `branch -D` and `pack-refs
--all` each remove the directories they empty.

Refusing is safe rather than wrong — the `rename` would answer `EISDIR` anyway,
measured, so nothing is written either way and nothing is left behind; the
difference is a refusal where Git succeeds. **What removing it needs is a new
operation.** The emptiness test is a `readdir`, which the walk already has, but
the removal was not expressible: `Rm` is `(path: string) => IoResult<void>` with
no options, node's `rm` without `recursive` answers `ERR_FS_EISDIR` for a
directory, and the virtual runner's `rmOp` never sees one because `operation`
descends into it first. `rmdir` is the primitive that fits, since it refuses a
non-empty directory itself (`ENOTEMPTY`, measured) and so cannot lose a ref to a
race the way a recursive `rm` behind a separate check could. It exists now —
`fjs/effects/node` gained it for the delete below, which prunes the directories
it empties — so what is left for the write is the walk that establishes a
directory is *recursively* empty, and the decision to remove one it did not make.

**The `.lock` costs five bytes of the name's length budget, and Git pays the same
one.** A ref name has no length limit in Git's grammar — measured,
`git check-ref-format` accepts a last component of 4096 bytes at exit 0 — but
`update-ref` refuses one of 251 bytes:

| last component | `git update-ref` | the host, `open(name, 'wx')` | the host, `open(name + '.lock', 'wx')` |
| --- | --- | --- | --- |
| 250 bytes | exit 0 | `ok` | `ok` (255) |
| 251 bytes | 128, `Unable to create '….lock': File name too long` | `ok` | **`ENAMETOOLONG`** (256) |

So the effective limit is `NAME_MAX` minus five, and the failure names the lock
file rather than the ref. `tryWrite` inherits it from the same suffix, and the
`writeExclusive` is where it surfaces — the host's `ENAMETOOLONG`, loud, before
anything is created. Parity rather than narrowness, and it is the one place the
lock protocol costs a caller something it would not otherwise pay.

Two other bounds are not this one and are worth keeping apart. `nameText`
refuses a name past `maxLengthBytes` because there is no string to build a path
from at all — a crash before that guard, recorded above — and the virtual runner
enforces *neither* limit, which is
[`fjs/effects/node/virtual/todo/no-name-length-limit.md`](../../../effects/node/virtual/todo/no-name-length-limit.md).

**The lock protects against a concurrent writer, not against a process that can
write in the ref's directory**, and two review rounds found the same window from
two ends. Both are real, and both reproduce:

- **After the `wx` open.** A process that unlinks the lock and creates a
  replacement at that name makes the runner fill the *unlinked* inode; the write
  reports `ok`, the name holds the replacement, and the `rename` publishes it.
  Reproduced with the interleaving written out by hand: the ref ended up holding
  `ATTACKER` where the caller asked for an id.
- **After the `stat`.** A process that plants a symlink to a directory at the
  ref's path once the `stat` has answered "absent" gets that link replaced by the
  `rename`, which leaves every ref inside the linked directory unreachable — the
  same measurement that motivated the `stat`, moved one step later in time.

**No check closes either, and the reason is the publish primitive.** Every check
is before the `rename`; the `rename` names a path; so any test can be invalidated
between the test and the rename. Narrowing is all that is on offer — an `fstat` of
the held descriptor compared against a `stat` of the lock's path is racy against
the same interleaving — and nothing in `fjs/effects/node` publishes an *inode*
rather than a name: node exposes `rename`, `link` and `symlink` over paths, with
no `renameat2`, no `RENAME_*` or `AT_*` constants and no `linkat(AT_EMPTY_PATH)`
(checked against node 22.22.2's `fs` surface). An operation that closed it would
have to be a new `Fs` member built on one of those calls, so it is not a check
this writer is missing.

**And the threat model is what settles it.** Both windows need a process that can
create a file in the directory holding the ref. Such a process needs no race:
measured, a ref file written by hand into `.git/refs/heads/` is one `rev-parse`,
`show-ref` and `for-each-ref` all answer. So the window is not the way in — it is
a slower version of a door already open, and refusing to publish would not close
it.

What the design does owe, and does: the damage stays inside `refs/`. Measured, a
`rename` over a symlink — to a file or to a directory — replaces the link rather
than following it, and the target keeps its bytes. So neither window can write
through a planted link to somewhere else in the filesystem, which is the property
that would make this more than a namespace the attacker could already edit.

Deferring rather than fixing is deliberate and is *not* silence in
[DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)'s sense:
each operation did what it promised, and what changed is the filesystem under it,
not the answer given. A read-back-and-compare after the rename was considered and
rejected — it cannot prevent the publication it would detect, it races on its own,
and it would report a false failure whenever a *benign* concurrent writer replaced
the ref immediately afterwards, which is a regression in ordinary use to chase an
adversary who can write the ref directly.

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

**Deleting a ref — done.** A name can be in two files, and the loose file must go
*and* the `packed-refs` line with it, or the packed line reappears as the ref.
`tryDelete` does both, and the reflog, by Git's protocol — measured with `strace`
on 2.43.0: `<name>.lock` and then `packed-refs.lock`, each opened
`O_CREAT|O_EXCL` and closed empty, so they are mutexes and never written, and both
taken for every delete, an absent name included; `packed-refs` read under them;
the file without the name written to `packed-refs.new`, itself `O_EXCL`, and
renamed over `packed-refs`; the loose file unlinked; both locks unlinked; the
directories left empty removed. It answers whether there was a ref, and `false`
is not a refusal: Git exits 0 and says nothing for either.

The order is the design:

- **The packed line before the loose file**, because a loose file shadows a
  packed line by existing: the other order leaves a window in which the stale
  packed id is the ref, and a failure in it leaves that id the ref for good.
- **The reflog last**, where Git unlinks it before renaming `packed-refs`. A
  delete that fails after that rename still has the loose file, which decides the
  name, so the ref is what it was — and in Git's order its history is gone. Git
  reaches that state without any failure, measured: on a `packed-refs` whose
  `sorted` claim its bisection trips over — a comment line between two refs is
  enough — `git update-ref -d` exits 0 with the file byte-identical, the ref still
  in it, and its reflog removed.
- **Once the ref is gone, what the cleanup answers is dropped**: a reflog left
  behind can only retain more, a lock left behind is the next writer's `EEXIST` as
  Git's would be, and a directory left behind holds no ref.

**The pruning is Git's.** Measured: to lock a *packed-only*
`refs/heads/feat/deep/x`, Git creates `refs/heads/feat/deep`, and removes it and
`logs/refs/heads/feat` once the delete is done; deleting `refs/heads/a/b/c`
removes `refs/heads/a/b` and `refs/heads/a`; the last ref of `refs/remotes/origin`
takes that directory with it and leaves `refs/remotes`; `refs/heads` and
`refs/tags` stay, empty. So the rule is every directory below `refs/<top>/`, and
the same below `logs/`. This is what `rmdir` was added to `fjs/effects/node` for.

**It deletes the name, never its target**, which is `--no-deref`. Without it
`git update-ref -d` on a symbolic ref deletes the ref it points to and leaves the
symbolic one dangling — `git fsck` exits 2 with `invalid sha1 pointer 0000…`.

**Every refusal leaves the repository as it was**, which each fixture checks over
the whole tree: the three name refusals `tryWrite` has, `HEAD` foremost —
measured, `git update-ref --no-deref -d HEAD` exits 0 having removed `.git/HEAD`,
after which every command answers `not a git repository`; a directory at the
name's path, or a symlink to one, which Git refuses too (exit 1, `'refs/heads/a/b'
exists; cannot create 'refs/heads/a'`); a file in the path (`ENOTDIR`); either lock
held, or a `packed-refs.new` already there (`EEXIST`, and left); a loose file
holding bytes that are no ref, which Git refuses too — measured, with and without
`--no-deref`, `cannot lock ref … reference broken`, exit 1, nothing changed,
while a symbolic ref to an absent target or to one outside `refs/` is deleted; a
`packed-refs` that will not parse; and one that claims `sorted` and is not. That
last is
refused because Git bisects it: measured, with `ccc`, `aaa`, `bbb` in that order
`refs/heads/ccc` does not resolve, and deleting `aa` from `aa`, `zz`, `master`
made `zz` stop resolving — so a rewrite that keeps such a file's order can lose
Git a ref the delete was not asked about.

**Where it differs from `git update-ref -d`**, each measured:

| state | Git | `tryDelete` |
| --- | --- | --- |
| an empty directory at the name's path | removes it, exit 0 | `refPrefixCode` |
| a refusal after the directories are made | leaves the one it made for the lock | removes the ones it made, and no other |
| an absent name with a packed ref under it | exit 1, `cannot lock ref` | `false` |
| the name packed twice | removes one line, exit 0, the ref still resolves | removes both |
| a `packed-refs` Git did not write | its own header, re-sorted, missing `^` lines read from the object store | the file's own header and order |
| a `packed-refs` out of order under `sorted` | may exit 0 having removed nothing | `unsortedPackedCode` |

For a file Git wrote, the rewrite is byte-identical to Git's — measured for seven
targets, and the 46-byte header alone once the last ref goes.

**The reflog is retention with a clock on it** — the measurement is in
[reflog-roots.md](./reflog-roots.md), which also owns reading the reflog for the
roots it holds. What follows for a writer is that its entries are roots that
stop being ones on a clock this side does not control: appending to a reflog
does not make an object safe to depend on, and deleting a ref does not make its
objects collectable while the reflog still names them.

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
[`fjs/git/store`](../../store/module.f.mjs), which nothing in `refstore` imports
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
loses is the extra retention a reflog entry gives.

**It does not rewrite `packed-refs`.** A packed line of the same name is
shadowed by the new loose file, which is what Git leaves too — measured, an
`update-ref` of a packed-only ref writes the loose file and leaves the packed
line stale. So this one is not a divergence at all for a *write*; the rewrite
belongs to a delete, which is the half above.

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

A Git ref is a retention root and nothing else, and its name carries no DISOT
meaning — the rule is
[git-name-resolution](../../../../todo/git-name-resolution.md)'s. A writer is where that bound is easiest to break, because choosing what to
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
- [ ] Decide whether the `ENOTDIR` a loose file in the ref's path is refused
      with becomes `refPrefixCode` carrying Git's message, which costs a `stat`
      per path segment to name the file in the way.
- [ ] Decide whether publication should bind to the inode the lock was opened
      on, which needs an `Fs` operation over `renameat2` or
      `linkat(AT_EMPTY_PATH)` rather than a check here — and whether it is worth
      it, given that the window needs a process which can write the ref directly.
- [ ] Publish over a **recursively empty** directory at the ref's path, as Git
      does, rather than refusing it — `rmdir` exists now, so what is left is a
      `readdir` walk to establish emptiness and fixtures for all four rows of
      the table above. Worth doing because this writer's own `mkdir` leaves such
      a directory behind whenever a write of a name under it fails. A delete
      refuses an empty directory at the name's path the same way, where Git
      removes it, and the same walk would close both.
- [ ] Hold the `writeExclusive` rollback with a proof, if a way to fail a write
      after the `O_EXCL` open ever exists here — a fault-injecting host runner,
      or an `Fs` seam a proof can answer for. Deleting the `rm` is green today.
- [x] Delete a ref: the `packed-refs` line, then the loose file, then the
      reflog, under both of Git's locks, and the directories it empties.
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

- [git-name-resolution](../../../../todo/git-name-resolution.md) — the rule
  above, and why a ref is only a retention root.
- [`fjs/git/refstore`](../module.f.mjs) — both halves: the reading
  one, and `tryWrite` with the measurements behind every refusal.
- [`fjs/git/refname`](../../refname/module.f.mjs) — `lockSuffix`, and why no ref
  is ever named by a writer's lock file.
- [`fjs/git/ref`](../../ref/module.f.mjs) — the file grammars a writer must
  produce, measured against Git.
- [`fjs/git/store`](../../store/module.f.mjs) — from an id to the object a ref
  keeps, and what an object-existence check would have to read.
- [`fjs/effects/node/virtual`](../../../effects/node/virtual/module.f.mjs) —
  `mkdirOp`, the virtual `mkdir` this write no longer reaches, which now refuses
  a file in its path with the host's `ENOTDIR` or `EEXIST` rather than replacing
  it with a directory.
