## The object store: from an id to the object, and the walk

**Priority:** P3
**Status:** open

### Problem

[`fjs/git/store`](../store/module.f.mjs) takes an id and gives the
`Envelope` the object is, as the Proposal below asks, so the first half of
this is done — for loose objects, and at a directory the caller spells.
What is left is the rest of that: an id in a pack, and the
directory found rather than given, since a caller should not have to know
that an id `ab12…` lives at `objects/ab/12…` if it is loose and elsewhere
if it is packed, nor which directory `objects/` sits in when a worktree is
linked. Both consumers under [`todo/`](../../../todo/) also need a walk
built on the store: a commit to its tree, a tree to its entries, an entry
to a blob.

### Proposal

- `read(id)`: the loose path first, then every pack the directory holds,
  answering the `Envelope` or refusing with a channel error that names the
  id. Finding the directory is its own step, later: `objects/` lives in
  the repository's common directory, and a worktree reaches it by the
  same rule whatever its kind. `.git` is either a directory, which is
  the repository, or a file whose `gitdir:` line names a directory; that
  directory is the repository unless it holds a `commondir` file, whose
  line names the repository instead. So a main worktree made by
  `git init` has `.git/` itself; one made with `--separate-git-dir` has a
  `.git` file pointing straight at the repository, which has no
  `commondir`; and a linked worktree's `.git` file points at its
  per-worktree directory under the main repository's `worktrees/`, whose
  `commondir` names the shared repository that owns `objects/`,
  `packed-refs` and the shared refs. The parent of a `.git` file holds no
  objects and is never searched. `objects/info/alternates` adds
  directories to search after the repository's own, and is deferred the
  same way.
- An id given by a caller is checked against the object read, which is
  where [SHA-1](../../crypto/todo/sha1.md) and `fjs/crypto/sha2` come in:
  a store that does not hash trusts its file names. In a SHA-1 repository
  the check is only as strong as SHA-1, and
  [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md)
  decides what more a read checks — collision detection, a SHA-256 twin
  from a mapping, a field in the commit — and a read here does whatever
  that decision says, once it is made.
- The walk: a commit's tree by `tree`, a tree's entry by name through
  `fjs/git/tree`, and the blob's bytes — the three steps
  [git-name-resolution](../../../todo/git-name-resolution.md) takes, as
  functions over `read`, with the repository's id width read once from
  `config` and threaded through: `extensions.objectFormat = sha256` means
  32-byte ids, and `sha1`, or the key absent — as it is in every
  repository `git init` writes by default, which has no `[extensions]`
  section — means SHA-1 and 20-byte ids, since Git accepts the explicit
  spelling and `git rev-parse --show-object-format` prints it. Any other
  value is refused, as Git refuses it.
- All of it over the effects, proven against the virtual filesystem with
  the checked-in fixtures laid out as a repository.

### Tasks

- [x] The id width from `config`: [`fjs/git/config`](../config/module.f.mjs),
      and `oidBytes` in [`fjs/git/store`](../store/module.f.mjs).
- [x] `tryRead(id)` over loose objects, with the id check on read, in
      `fjs/git/store`.
- [ ] `tryRead` over packs once [packfiles.md](./packfiles.md) lands.
- [ ] The common directory found: a linked worktree's `gitdir` and
      `commondir`, and `alternates`.
- [ ] The walk from a commit to a blob by path.

### Related

- [`fjs/git/README.md`](../README.md) — the readers the store feeds.
- [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md) —
  what an id check means in a SHA-1 repository.
- [refs.md](./refs.md) — from a name to the id the walk starts from.
- [packfiles.md](./packfiles.md) — where most objects are.
