# CAS in a Git branch

A Git branch as a content-addressable store: the branch's tree is the map
from canonical CAS paths — `.cas/ab/cd/<rest>`, the layout
[`fjs/cas`](../module.f.mjs)'s `toPath` spells — to immutable content, so a
commit of the branch *is* a CAS snapshot, and `fjs/cas/git` reads one and
writes to one through the `Cas<O>` surface every other consumer of
[`fjs/cas`](../README.md) already uses. The first consumer is the
[build cache](../../ci/todo/097-smart-ca-ci.md), which remembers successful
builds in a `build-cache` branch of the repository it builds, while the
source checkout stays on its own branch.

[`module.f.mjs`](module.f.mjs) is the whole of it; [`cli/`](cli/module.f.mjs)
is `fjs cas git`, each command one call into it.

## Three commands, one local branch

```sh
fjs cas git add <branch> <path>          # store a file; prints its key
fjs cas git get <branch> <key> <path>    # restore a key into a file
fjs cas git list <branch>                # every key the branch holds
```

The same three `fjs cas` has for the store under `~/.cas/`, over a branch
of the repository at the current directory — its `.git`, read as Git reads
one, or the directory itself where it is a bare repository. Run them from
the root of the worktree: the parents are not searched
([`cli/todo/find-repository-upward.md`](cli/todo/find-repository-upward.md)).

Everything else is Git's own, and the backend does none of it:

| to | run |
| --- | --- |
| share the branch | `git push origin build-cache` |
| take another repository's additions | `git fetch origin build-cache:build-cache`, a fast-forward of the local branch where it has nothing of its own; where it has, check it out in a worktree (`git worktree add ../cache build-cache`) and `git merge origin/build-cache` there — different keys are different paths and the same key is the same bytes, so independent additions never conflict, and two branches that began apart take `--allow-unrelated-histories`, safe here since their trees are disjoint maps |
| take content out | a deletion commit — `git rm` on a checkout of the branch, say |
| reclaim the bytes | Git's own maintenance, once nothing names them |

## What the API offers

| | reads | writes |
| --- | --- | --- |
| `snapshot(branch)` | the commit `refs/heads/<branch>` is at when the snapshot is opened, pinned there | none: a `CasReader<O>`, `Cas<O>` without `write` |
| `branchCas(sha2, branch, author)` | the commit the branch is at when each operation runs | `write`: the blob and the rebuilt `.cas` trees as loose objects, and one commit moving the branch — or nothing, where the key is already there |

`Branch` is `{ dir, branch }`: the repository directory — the one that holds
`objects/`, `refs/` and `config` — and the branch's name. A branch that is
not there is the empty map; `add` creates it with a root commit.

**A write is a commit, or nothing.** `write` stores content as Git stores a
file: the blob as a loose object in the repository's own `objects/`, the
trees above it rebuilt in the order Git requires, and one commit on the
branch whose parent is the commit it was at. The tree decides before the
blob is stored, so content already under its key writes no object and no
commit, even where its blob sits in a pack or a borrowed directory. The
source checkout is never touched: no `HEAD`, no index, no file of the
worktree — only `objects/` and the branch ref, which the proof says by
comparing the filesystem before and after. The branch is a store; a
checkout of it, if there is one, sees its ref move as `git fetch` moves one.

**The author is the repository's.** `configuredAuthor(dir, home)` reads
`user.name` and `user.email` as `git commit` does — the repository's
`config`, then `~/.gitconfig` — and refuses, as `ERR_AUTHOR`, a value an
ident cannot hold (`A <B>`, which `git commit` would silently strip), an
empty or blank one, and a `config` holding an `[include]` or `[includeIf]`
it does not follow. The `GIT_AUTHOR_*` environment is not read
([DESIGN.md §7](../../../doc/DESIGN.md#7-cli-parameters-over-environment-variables)).
Where else `git commit` may look, and what it strips, that this does not:
[`todo/author-as-git-commit.md`](todo/author-as-git-commit.md).

**What is refused rather than answered**, each a repository this backend
did not write, all as `ERR_CAS_ENTRY`: a tree `git fsck` refuses (a name
held twice, out of order, zero-padded modes, an all-zero id, a `.git` or
over-long name); below `.cas` an entry whose mode is not `100644` or
`40000` as spelled, or a key filed where `toPath` does not file it; an
object a `.cas` path names that is no tree, no blob, or not in the
repository; and, for a write, a key's path already holding another blob — a
collision or a corrupt store. A `config` Git does not open is
`ERR_REPOSITORY_FORMAT`, a branch ref naming no commit `ERR_SNAPSHOT_HEAD`.
A key the branch does not hold is the ordinary miss, `ENOENT` as `fileCas`
reports one. Each is a proof in [`proof.f.mjs`](proof.f.mjs).

Neither a listing nor a write reads a blob to vouch for it: the listing
names a key by the tree's word, and a write of content the tree already
holds under its key is nothing to write, by the same word. An object the
tree names that the repository does not hold is the repository's
corruption, and the read of that key refuses it. Vouching would cost an
object read per key listed and per write of content already there, which
is the one cost both are built not to pay.

Everything is native over [`fjs/git`](../../git/README.md): the id width
from `config`, the refs through the ref store and its writer, the objects
through the object store and the walk, the trees and commits through their
writers, the loose file through [`fjs/zlib/stored`](../../zlib/stored/module.f.mjs).
No `git` runs.

## Limits

Each filed beside the module rather than built around:

- [`todo/streaming-writes.md`](todo/streaming-writes.md) — a payload is held
  in memory while its object is written, because a loose object's envelope
  states the size before the bytes.
- [`todo/concurrent-local-writers.md`](todo/concurrent-local-writers.md) —
  two writers of one repository moving the branch at once can lose one
  another's commit, since the ref writer locks a file and compares nothing.
  Two writers in two repositories each have their own branch, and
  `git merge` joins them.
- [`todo/author-as-git-commit.md`](todo/author-as-git-commit.md) — the
  configuration `git commit` reads beyond the two files read here, and the
  whitespace it strips from an ident.
- [`todo/absent-or-malformed.md`](todo/absent-or-malformed.md) — a ref that
  is there but malformed reads as an absent one.
- [`cli/todo/find-repository-upward.md`](cli/todo/find-repository-upward.md) —
  the commands do not search the parents of the current directory as `git`
  does.
