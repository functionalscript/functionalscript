## The object store: from an id to the object, and the walk

**Priority:** P3
**Status:** open

### Problem

[`fjs/git/store`](../store/module.f.mjs) takes an id and gives the `Envelope`
the object is, as the Proposal below asks, from either place an object lives:
the loose file, and the packs below `objects/pack/` through
[`fjs/git/packstore`](../packstore/module.f.mjs). A caller no longer has to know
that an id `ab12…` sits at `objects/ab/12…` when it is loose and somewhere in a
pack when it is not. [`fjs/git/walk`](../walk/module.f.mjs) is the walk both
consumers under [`todo/`](../../../todo/) needed — a commit to its tree, a tree
to its entries, an entry to a blob — over whatever reads objects, and
[`fjs/git/repo`](../repo/module.f.mjs) finds the directory to read at from a
worktree of any kind.

One thing is left, and it is about where a store may look rather than what it
can read:

- a `refDelta` whose base is not in the pack that names it, which `packstore`
  refuses rather than guess at — the base may be loose, in another pack, or
  nowhere, and only a reader of the whole store can say. Now that a store is
  several object directories rather than one, that reader exists: `readIn` is
  the whole-store read such a base would be resolved through. See
  [packfiles.md](./packfiles.md).

### Proposal

- `read(id)`: the loose path first, then every pack the directory holds,
  answering the `Envelope` or refusing with a channel error that names the
  id. Done for one directory, and it is where the two things left above would
  land — a base outside the pack that names it, and a second directory to
  search. Finding the directory was its own step and is done:
  [`fjs/git/repo`](../repo/module.f.mjs)'s `tryCommonDir` takes a worktree
  of any kind to the common directory `objects/` lives in, by the one rule
  Git uses — `.git` is the repository or a file whose `gitdir:` line names
  one, and that directory is the repository unless its `commondir` names
  another. It stays a step of its own and `read` keeps taking the
  directory: a caller that starts from a checkout puts the two together,
  which is what [`fjs/git/README.md`](../README.md) says and what
  `tryRead(dir, oidBytes)` is. `objects/info/alternates` adds directories
  to search after the repository's own, and is done: `objectsDirs` answers
  them, transitively, and `readIn` reads over the list so a caller reading
  many objects resolves the borrowings once.
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
- [x] `tryRead` over packs: [`fjs/git/packstore`](../packstore/module.f.mjs)
      answers from the `.idx` and the pack beside it, and
      [`fjs/git/store`](../store/module.f.mjs) reads the loose file first and
      the packs where it cannot answer. That is *not* Git's order — measured on
      Git 2.43.0, a file of garbage planted at a packed object's loose path
      leaves `git cat-file -p` printing the object and only `git fsck`
      complaining, so Git asks its packs first. The same answers come out of
      either order, since an object is the same object wherever it is stored
      and the id is checked against whichever copy answered; this one is
      cheaper, because an index is hashed whole when it is opened and asking
      the packs first would pay that on every read of a repository whose
      objects are loose.
- [x] The common directory found: a linked worktree's `gitdir` and
      `commondir`, in [`fjs/git/repo`](../repo/module.f.mjs).
- [x] `alternates`: the directories `objects/info/alternates` adds, which
      the store searches after its own — `objectsDirs` answers the list,
      transitively and with a directory already reached skipped, and `readIn`
      reads over it. Three line shapes send Git to a directory this reader
      does not open — each a miss and never a wrong object, since the id is
      checked against whatever answers — and none is refused:
      [alternates-line-quirks.md](./alternates-line-quirks.md) records them,
      [byte-paths.md](./byte-paths.md) owns the two that are really about a
      path being bytes.
- [x] The walk from a commit to a blob by path:
      [`fjs/git/walk`](../walk/module.f.mjs), `peel`, `tryEntries` and
      `tryEntry` over whatever reads objects.

### Related

- [`fjs/git/README.md`](../README.md) — the readers the store feeds.
- [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md) —
  what an id check means in a SHA-1 repository.
- [`fjs/git/refstore`](../refstore/module.f.mjs) — from a name to the id the
  walk starts from, which is read rather than pending; writing one is
  [ref-writing.md](./ref-writing.md).
- [packfiles.md](./packfiles.md) — where most objects are.
