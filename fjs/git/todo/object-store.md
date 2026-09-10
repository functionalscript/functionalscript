## The object store: from an id to the object, and the walk

**Priority:** P3
**Status:** open

### Problem

The readers here take bytes and give values; nothing takes an id and gives
bytes. [`fjs/git/loose`](../loose/module.f.mjs) reads one file at a path
the caller spelled, and a caller should not have to know that an id
`ab12…` lives at `objects/ab/12…` if it is loose and in a pack otherwise.
Both consumers under [`todo/`](../../../todo/) need one function from an
id to an object, and a walk built on it: a commit to its tree, a tree to
its entries, an entry to a blob.

### Proposal

- `read(id)`: the loose path first, then every pack the directory holds,
  answering the `Envelope` or refusing with a channel error that names the
  id; `alternates` and the parent of a worktree's `.git` file are found by
  the same function, later.
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
  `config` (`extensions.objectFormat`) and threaded through.
- All of it over the effects, proven against the virtual filesystem with
  the checked-in fixtures laid out as a repository.

### Tasks

- [ ] The id width from `config`.
- [ ] `read(id)` over loose objects, then over packs once
      [packfiles.md](./packfiles.md) lands.
- [ ] The id check on read.
- [ ] The walk from a commit to a blob by path.

### Related

- [`fjs/git/README.md`](../README.md) — the readers the store feeds.
- [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md) —
  what an id check means in a SHA-1 repository.
- [refs.md](./refs.md) — from a name to the id the walk starts from.
- [packfiles.md](./packfiles.md) — where most objects are.
